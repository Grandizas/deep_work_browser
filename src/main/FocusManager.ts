import type { FocusPhase, FocusSnapshot } from '../shared/types'

// Break length after a completed focus session (everything unlocked).
const BREAK_MS = 5 * 60 * 1000

/** Persisted focus state, so a crash/restart resumes the session. */
export interface FocusPersisted {
  phase: FocusPhase
  endsAt: number | null
  workspaceId: string | null
  allowlist: string[]
  paused: boolean
  pausedRemainingMs: number
}

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
  private paused = false
  private pausedRemainingMs = 0
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
    this.paused = false
    this.pausedRemainingMs = 0
    this.endsAt = Date.now() + durationMs
    this.arm()
    this.emit()
  }

  /** Start a break — everything unlocked for `durationMs`. */
  startBreak(durationMs: number): void {
    this.phase = 'break'
    this.allowlist = []
    this.paused = false
    this.pausedRemainingMs = 0
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
    this.paused = false
    this.pausedRemainingMs = 0
    this.disarm()
    this.emit()
  }

  /** Freeze the countdown, remembering the remaining time. */
  pause(): void {
    if (this.phase === 'idle' || this.paused || this.endsAt === null) return
    this.pausedRemainingMs = Math.max(0, this.endsAt - Date.now())
    this.endsAt = null
    this.paused = true
    this.disarm()
    this.emit()
  }

  /** Resume from a paused session, continuing the remaining time. */
  resume(): void {
    if (!this.paused) return
    this.endsAt = Date.now() + this.pausedRemainingMs
    this.paused = false
    this.pausedRemainingMs = 0
    this.arm()
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
    const remainingMs = this.paused
      ? this.pausedRemainingMs
      : this.endsAt
        ? Math.max(0, this.endsAt - Date.now())
        : 0
    return {
      state: this.phase,
      endsAt: this.endsAt,
      workspaceId: this.workspaceId,
      paused: this.paused,
      remainingMs
    }
  }

  /** Snapshot for persistence. */
  serialize(): FocusPersisted {
    return {
      phase: this.phase,
      endsAt: this.endsAt,
      workspaceId: this.workspaceId,
      allowlist: this.allowlist,
      paused: this.paused,
      pausedRemainingMs: this.pausedRemainingMs
    }
  }

  /**
   * Restore a persisted session after a restart. A running session whose end
   * already passed during downtime is dropped; paused sessions and still-running
   * ones resume. Does not emit — the caller pushes state afterwards.
   */
  restore(data: FocusPersisted): void {
    if (data.phase === 'idle') return
    if (!data.paused && (data.endsAt === null || data.endsAt <= Date.now())) return

    this.phase = data.phase
    this.workspaceId = data.workspaceId
    this.allowlist = data.allowlist
    this.paused = data.paused
    this.pausedRemainingMs = data.pausedRemainingMs
    if (data.paused) {
      this.endsAt = null
    } else {
      this.endsAt = data.endsAt
      this.arm()
    }
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
