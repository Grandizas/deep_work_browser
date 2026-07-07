// The new-tab page: a snapshot of your day. Like the interstitial/error pages
// it's a self-contained data-URL document (no preload, no IPC) — main bakes the
// numbers in at load time. Reloading the tab recomputes a fresh snapshot.

import type { DashboardStats } from '../shared/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Pretty focused-time: "0m", "45m", "1h 20m". */
function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Build the dashboard data URL for a stats snapshot. */
export function dashboardDataUrl(stats: DashboardStats): string {
  const sitesRows =
    stats.topSites.length > 0
      ? stats.topSites
          .map(
            (s) =>
              `<li><span class="site">${escapeHtml(s.origin)}</span><span class="count">${s.visits}</span></li>`
          )
          .join('')
      : `<li class="muted">No sites visited yet today</li>`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Today</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f6f6f7; color: #1b1b1f;
      }
      .wrap { width: 640px; max-width: 92vw; padding: 40px 24px; }
      header { margin-bottom: 28px; }
      h1 { font-size: 26px; font-weight: 600; margin: 0 0 4px; }
      .date { font-size: 14px; color: #6b6b76; margin: 0; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .stat { background: #ffffff; border: 1px solid #e3e3e6; border-radius: 14px; padding: 18px 20px; }
      .stat .value { font-size: 30px; font-weight: 700; line-height: 1.1; }
      .stat .label { font-size: 12px; color: #6b6b76; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.4px; }
      .streak .value { color: #4f8cff; }
      details { margin-top: 22px; border-top: 1px solid #e3e3e6; padding-top: 14px; }
      summary { cursor: pointer; font-size: 13px; color: #6b6b76; list-style: none; user-select: none; }
      summary::-webkit-details-marker { display: none; }
      summary:hover { color: #1b1b1f; }
      .details-grid { display: grid; grid-template-columns: 1fr auto; gap: 24px; margin-top: 16px; align-items: start; }
      ul { list-style: none; margin: 0; padding: 0; }
      .sites li { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #e3e3e6; }
      .sites li:last-child { border-bottom: none; }
      .sites .count { color: #6b6b76; }
      .sites .muted { color: #6b6b76; border-bottom: none; }
      .blocked { text-align: right; white-space: nowrap; }
      .blocked .value { font-size: 22px; font-weight: 700; }
      .blocked .label { font-size: 12px; color: #6b6b76; margin-top: 4px; }
      .section-label { font-size: 11px; color: #6b6b76; text-transform: uppercase; letter-spacing: 0.4px; margin: 0 0 8px; }
      @media (prefers-color-scheme: dark) {
        body { background: #1b1b1f; color: #ebebf5; }
        .date, .stat .label, summary, .sites .count, .sites .muted, .blocked .label, .section-label { color: #9a9aa5; }
        .stat { background: #26262d; border-color: #34343c; }
        details { border-top-color: #34343c; }
        summary:hover { color: #ebebf5; }
        .sites li { border-bottom-color: #34343c; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1 id="greeting">Today</h1>
        <p class="date" id="date"></p>
      </header>
      <div class="stats">
        <div class="stat"><div class="value">${formatMinutes(stats.focusedMinutesToday)}</div><div class="label">Focused</div></div>
        <div class="stat"><div class="value">${stats.sessionsToday}</div><div class="label">Sessions</div></div>
        <div class="stat streak"><div class="value">${stats.streak}🔥</div><div class="label">Day streak</div></div>
      </div>
      <details>
        <summary>Show details</summary>
        <div class="details-grid">
          <div>
            <p class="section-label">Top sites today</p>
            <ul class="sites">${sitesRows}</ul>
          </div>
          <div class="blocked">
            <p class="section-label">Distractions</p>
            <div class="value">${stats.blockedToday}</div>
            <div class="label">blocked today</div>
          </div>
        </div>
      </details>
    </div>
    <script>
      (function () {
        var now = new Date();
        var h = now.getHours();
        var hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
        document.getElementById('greeting').textContent = hi;
        document.getElementById('date').textContent =
          now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      })();
    </script>
  </body>
</html>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}
