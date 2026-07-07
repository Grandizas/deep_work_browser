import type { BaseWindow, Rectangle } from 'electron'
import { TabManager } from './TabManager'
import { DownloadManager } from './DownloadManager'
import { PermissionManager } from './PermissionManager'
import { NetworkBlocker } from './NetworkBlocker'
import { decideNavigation } from './blocking'
import { logOverride, logBlock, getDashboardStats } from './history'
import { dashboardDataUrl } from './dashboard'
import { focus } from './FocusManager'
import type { Workspace } from '../shared/types'

/**
 * Everything session-bound for one workspace in one window: its tabs, downloads,
 * and permission prompts, all running in the workspace's own `persist:ws-<id>`
 * partition. A window keeps one of these per visited workspace and switches
 * between them by hiding one and showing another — views stay alive across
 * switches so returning to a workspace is instant.
 */
export class WorkspaceView {
  readonly tabs: TabManager
  readonly downloads: DownloadManager
  readonly permissions: PermissionManager
  readonly blocker: NetworkBlocker

  constructor(
    window: BaseWindow,
    readonly workspace: Workspace,
    onChange: () => void,
    initialRegion: Rectangle,
    onNavigate: (info: { url: string; title: string }) => void
  ) {
    this.downloads = new DownloadManager(workspace.partition, onChange)
    this.permissions = new PermissionManager(workspace.partition, onChange)
    this.blocker = new NetworkBlocker(workspace.partition, workspace.id)
    // Layer 2 decision, evaluated per navigation: a focus session for THIS
    // workspace flips the engine to "allow only approved"; a break unlocks
    // everything; otherwise the idle "block distractions" rule applies.
    const decide = (url: string): 'allow' | 'block' =>
      decideNavigation(url, workspace.id, focus.phaseFor(workspace.id))
    this.tabs = new TabManager(
      window,
      onChange,
      initialRegion,
      workspace.partition,
      onNavigate,
      decide,
      (url) => logOverride(url, workspace.id),
      (url) => logBlock(url, workspace.id),
      () => dashboardDataUrl(getDashboardStats(workspace.id))
    )
    this.downloads.attach()
    this.permissions.attach()
    this.blocker.attach()
  }

  hide(): void {
    this.tabs.hide()
  }

  show(region: Rectangle): void {
    this.tabs.show(region)
  }

  destroy(): void {
    this.downloads.detach()
    this.permissions.detach()
    this.blocker.detach()
    this.tabs.destroy()
  }
}
