// The "speed bump" shown when a distraction is blocked. It's a self-contained
// local page (data URL, no preload) loaded into the tab. Its buttons navigate to
// a sentinel host that the tab's will-navigate handler intercepts and acts on —
// so the buttons "message main" without exposing any IPC surface to the tab.

// `.invalid` is a reserved TLD that never resolves, so even if interception ever
// failed the button would fail safe rather than load something real.
const SENTINEL_HOST = 'dwb.invalid'

export type InterstitialAction = { type: 'continue'; url: string } | { type: 'break' }

/** Parse a navigation target into an interstitial button action, or null. */
export function parseInterstitialAction(url: string): InterstitialAction | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== SENTINEL_HOST) return null
  if (u.pathname === '/continue') {
    const target = u.searchParams.get('url')
    return target ? { type: 'continue', url: target } : null
  }
  if (u.pathname === '/break') return { type: 'break' }
  return null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Build the interstitial data URL for a blocked destination. */
export function interstitialUrl(blockedUrl: string): string {
  const host = escapeHtml(hostOf(blockedUrl))
  const continueHref = `https://${SENTINEL_HOST}/continue?url=${encodeURIComponent(blockedUrl)}`
  const breakHref = `https://${SENTINEL_HOST}/break`

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${host}</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
        background: #1b1b1f; color: #ebebf5;
      }
      .card { width: 440px; max-width: 90vw; text-align: center; padding: 0 24px; }
      .glyph { font-size: 44px; margin-bottom: 12px; }
      h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
      .host { font-size: 14px; color: #a8a8b3; margin: 0 0 28px; word-break: break-all; }
      .actions { display: flex; flex-direction: column; gap: 10px; }
      button {
        font: inherit; font-size: 14px; font-weight: 600; padding: 12px 16px;
        border: 1px solid #3a3a42; border-radius: 10px; background: #26262d; color: #ebebf5;
        cursor: pointer; transition: background 0.12s ease;
      }
      button:hover { background: #30303a; }
      .primary { border-color: transparent; background: #3a3a42; }
      .continue { background: transparent; border-color: transparent; color: #8a8a95; font-weight: 500; font-size: 13px; }
      .continue:hover { color: #ebebf5; background: transparent; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="glyph">🌱</div>
      <h1>This isn't in your current workspace.</h1>
      <p class="host">${host}</p>
      <div class="actions">
        <button class="primary" onclick="history.back()">Go Back</button>
        <button onclick="location.href='${breakHref}'">Take a Break</button>
        <button class="continue" onclick="location.href='${continueHref}'">Continue Anyway</button>
      </div>
    </div>
  </body>
</html>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}
