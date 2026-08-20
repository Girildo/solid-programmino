/**
 * What the server is allowed to ask Flickr on the browser's behalf.
 *
 * Shared by the deployed function and the dev server so there is one set of
 * rules rather than two that drift apart.
 */

const UPSTREAM = "https://api.flickr.com/services/rest/"

/** Only what the app actually calls. Anything wider is an open Flickr proxy. */
const ALLOWED_METHODS = new Set(["flickr.groups.discuss.replies.getList"])

/** Forwarded verbatim; every other parameter is dropped. */
const PASS_THROUGH = ["method", "group_id", "topic_id"] as const

/** Forwarded only if they are sane numbers, so the upstream cannot be driven oddly. */
const NUMERIC = { page: 1000, per_page: 500 } as const

export type ProxyPlan =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string }

export function planFlickrRequest(query: URLSearchParams, apiKey: string | undefined): ProxyPlan {
  if (!apiKey) {
    return { ok: false, status: 500, message: "FLICKR_API_KEY non configurata sul server" }
  }

  const method = query.get("method") ?? ""
  if (!ALLOWED_METHODS.has(method)) {
    return { ok: false, status: 400, message: `Metodo non consentito: ${method || "(nessuno)"}` }
  }

  const upstream = new URLSearchParams()
  for (const name of PASS_THROUGH) {
    const value = query.get(name)
    if (value !== null) upstream.set(name, value)
  }

  for (const [name, cap] of Object.entries(NUMERIC)) {
    const raw = query.get(name)
    if (raw === null) continue
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 1 || value > cap) {
      return { ok: false, status: 400, message: `Parametro ${name} non valido: ${raw}` }
    }
    upstream.set(name, String(value))
  }

  if (!upstream.get("topic_id") || !upstream.get("group_id")) {
    return { ok: false, status: 400, message: "Servono sia group_id sia topic_id" }
  }

  // The key never leaves the server; the browser only ever sees this endpoint.
  upstream.set("api_key", apiKey)
  upstream.set("format", "json")
  upstream.set("nojsoncallback", "1")

  return { ok: true, url: `${UPSTREAM}?${upstream}` }
}

/** Runs a planned request and hands back Flickr's answer unchanged. */
export async function callFlickr(plan: Extract<ProxyPlan, { ok: true }>): Promise<{
  status: number
  body: string
}> {
  const response = await fetch(plan.url)
  return { status: response.status, body: await response.text() }
}
