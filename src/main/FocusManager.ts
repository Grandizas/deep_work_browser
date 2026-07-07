import type { FocusPhase, FocusSnapshot } from '../shared/types'

// Break length after a completed focus session (everything unlocked).
const BREAK_MS = 5 * 60 * 1000

/**
 * The focus-session state machine, owned by the main process so the timer
 * survives renderer reloads. Holds one session at a time:
 *   idle → focus (a work session, only the workspace's allowlist is reachable)
 *        → break (everything unlocked) → idle.
 *
 * Only phase transitions are pushed to the renderer; the countdown is computed
 * there from `endsAt`. Set `onChange` to be notified of transitions.
 */
class FocusManager {
  private phase: FocusPhase = 'idle'
  private endsAt: number | null = null
  private workspaceId: string | null = null
  private allowlist: string[] = []
  private timer: NodeJS.Timeout | null = null

  /** Called on every phase transition (start / end / expiry). */
  onChange: (() => void) | null = null
  /** Called when a focus session finishes and auto-rolls into a break. */
  onComplete: (() => void) | null = null

  /** Start a focus session for a workspace, allowing only `allowlist` sites. */
  startFocus(workspaceId: string, durationMs: number, allowlist: string[]): void {
    this.phase = 'focus'
    this.workspaceId = workspaceId
    this.allowlist = allowlist
    this.endsAt = Date.now() + durationMs
    this.arm()
    this.emit()
  }

  /** Start a break — everything unlocked for `durationMs`. */
  startBreak(durationMs: number): void {
    this.phase = 'break'
    this.allowlist = []
    this.endsAt = Date.now() + durationMs
    this.arm()
    this.emit()
  }

  /** End the current session and return to idle. */
  end(): void {
    this.phase = 'idle'
    this.endsAt = null
    this.workspaceId = null
    this.allowlist = []
    this.disarm()
    this.emit()
  }

  /** Whether a workspace is currently under an active focus/break session. */
  phaseFor(workspaceId: string): FocusPhase {
    if (this.phase === 'idle') return 'idle'
    return this.workspaceId === workspaceId ? this.phase : 'idle'
  }

  getAllowlist(): string[] {
    return this.allowlist
  }

  snapshot(): FocusSnapshot {
    return { state: this.phase, endsAt: this.endsAt, workspaceId: this.workspaceId }
  }

  // Fire once when the current session's timer elapses.
  private arm(): void {
    this.disarm()
    const ms = Math.max(0, (this.endsAt ?? Date.now()) - Date.now())
    this.timer = setTimeout(() => this.onExpire(), ms)
  }

  private disarm(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private onExpire(): void {
    if (this.phase === 'focus') {
      // Focus complete → auto-roll into a break (everything unlocked), and fire
      // the completion celebration.
      this.startBreak(BREAK_MS)
      this.onComplete?.()
    } else {
      // A break elapsed → back to idle.
      this.end()
    }
  }

  private emit(): void {
    this.onChange?.()
  }
}

export const focus = new FocusManager()
