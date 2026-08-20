import { planFlickrRequest, callFlickr } from "../../shared/flickrProxy"

type Env = { FLICKR_API_KEY?: string }

/**
 * Cloudflare Pages Function: GET /api/flickr
 *
 * Holds the API key so the browser never does. Discussions change slowly, so
 * the answer is cached briefly at the edge.
 */
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const plan = planFlickrRequest(new URL(request.url).searchParams, env.FLICKR_API_KEY)

  if (!plan.ok) {
    return new Response(JSON.stringify({ stat: "fail", message: plan.message }), {
      status: plan.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  }

  const { status, body } = await callFlickr(plan)
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  })
}
