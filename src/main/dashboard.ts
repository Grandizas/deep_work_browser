// The "Today" dashboard (new-tab page) — its own charcoal theme, matching the
// Forge design. A self-contained data-URL document (no preload, no IPC): main
// bakes the numbers in at load time; reloading recomputes a fresh snapshot.

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

// An offline favicon: an inline SVG letter-tile with a colour deterministically
// derived from the host. No network — works even for blocked/unknown sites.
function faviconTile(origin: string): string {
  let hash = 0
  for (let i = 0; i < origin.length; i++) hash = (hash * 31 + origin.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  const ch = escapeHtml((origin[0] || '?').toUpperCase())
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="hsl(${hue} 42% 44%)"/><text x="16" y="22" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/** Build the dashboard data URL for a stats snapshot. */
export function dashboardDataUrl(stats: DashboardStats): string {
  const sitesRows =
    stats.topSites.length > 0
      ? stats.topSites
          .map(
            (s) =>
              `<li class="site"><img src="${faviconTile(s.origin)}" alt="" /><span class="host">${escapeHtml(
                s.origin
              )}</span><span class="count">${s.visits}</span></li>`
          )
          .join('')
      : `<li class="empty">No sites visited yet today</li>`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Today</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Instrument+Serif&display=swap');
      :root { color-scheme: dark; }
      * { box-sizing: border-box; margin: 0; }
      body {
        height: 100vh; color: #ebebf5; overflow: auto;
        font-family: 'Hanken Grotesk', -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif;
        background: radial-gradient(circle at 50% 0%, #232430, #1b1b1f 42%);
        display: flex; justify-content: center;
      }
      .wrap { width: 680px; max-width: 90%; padding: 86px 24px 48px; }
      header { margin-bottom: 30px; }
      h1 {
        font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 46px;
        letter-spacing: -0.01em; line-height: 1.05; margin-bottom: 6px;
      }
      .date { font-size: 14px; color: #8f8f9a; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .stat {
        background: #212127; border: 1px solid #303038; border-radius: 16px; padding: 20px 22px;
        transition: transform 0.14s ease, border-color 0.14s ease;
      }
      .stat:hover { transform: translateY(-3px); border-color: #3c3c46; }
      .stat .value {
        font-size: 30px; font-weight: 700; line-height: 1.05; color: #f2f2f7;
        font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 4px;
      }
      .stat.streak .value { font-size: 32px; color: #4f8cff; }
      .stat.streak .fire { font-size: 22px; }
      .stat .label {
        font-size: 11.5px; color: #8f8f9a; margin-top: 7px;
        text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      }
      .details { display: grid; grid-template-columns: 1fr 200px; gap: 20px; margin-top: 32px; align-items: start; }
      .eyebrow {
        font-size: 11px; color: #8f8f9a; text-transform: uppercase;
        letter-spacing: 0.5px; font-weight: 700; margin-bottom: 12px;
      }
      ul { list-style: none; }
      .site {
        display: flex; align-items: center; gap: 11px; padding: 9px 0;
        font-size: 13.5px; border-bottom: 1px solid #2a2a31;
      }
      .site:last-child { border-bottom: none; }
      .site img { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; }
      .site .host { flex: 1; color: #d6d6e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .site .count { color: #8f8f9a; font-variant-numeric: tabular-nums; }
      .empty { color: #8f8f9a; font-size: 13px; padding: 9px 0; }
      .distractions { background: #212127; border: 1px solid #303038; border-radius: 16px; padding: 18px 20px; }
      .distractions .num { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .distractions .cap { font-size: 12.5px; color: #8f8f9a; margin-top: 4px; }
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
        <div class="stat streak"><div class="value">${stats.streak}<span class="fire">🔥</span></div><div class="label">Day streak</div></div>
      </div>
      <div class="details">
        <section>
          <p class="eyebrow">Recent today</p>
          <ul>${sitesRows}</ul>
        </section>
        <section class="distractions">
          <p class="eyebrow">Distractions</p>
          <div class="num">${stats.blockedToday}</div>
          <div class="cap">blocked today</div>
        </section>
      </div>
    </div>
    <script>
      (function () {
        var now = new Date();
        var h = now.getHours();
        document.getElementById('greeting').textContent =
          h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
        document.getElementById('date').textContent =
          now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      })();
    </script>
  </body>
</html>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}
