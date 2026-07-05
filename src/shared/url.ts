// Smart address-bar handling: decide whether typed text is a URL to visit or a
// search query. Lives in shared so the main process resolves it centrally.

// Default search engine. Swap this to change the search provider.
const SEARCH_URL = 'https://www.google.com/search?q='

/**
 * Turn raw address-bar input into a URL to load, or `null` if it's empty.
 * - explicit scheme (https://, about:, data:, ...) → used as-is
 * - host-like (`example.com`, `localhost:3000`, `1.2.3.4/path`) → prefixed https
 * - anything else → a search query
 */
export function toNavigationUrl(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  // Already has an explicit scheme.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text
  if (/^(about:|data:|chrome:|file:)/i.test(text)) return text

  // Host-like: no whitespace, and either a dotted host or localhost[:port].
  const noSpace = !/\s/.test(text)
  const dottedHost = /^[^\s/]+\.[^\s]+$/.test(text)
  const localhost = /^localhost(:\d+)?(\/.*)?$/i.test(text)
  if (noSpace && (dottedHost || localhost)) return 'https://' + text

  return SEARCH_URL + encodeURIComponent(text)
}
