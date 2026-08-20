import type { ThreadComment } from "../domain/types"

/** The server-side proxy, which adds the API key and forwards to Flickr. */
const ENDPOINT = "/api/flickr"
const TOPIC_IN_URL = /\/discuss\/(\d+)/
const GROUP_IN_URL = /\/groups\/([^/?#]+)/
const PER_PAGE = 500

export function topicIdFromUrl(url: string): string | null {
  return TOPIC_IN_URL.exec(url.trim())?.[1] ?? null
}

type FlickrReply = {
  author?: string
  authorname?: string
  message?: { _content?: string } | string
}

type FlickrResponse = {
  stat?: string
  message?: string
  replies?: {
    reply?: FlickrReply[]
    /** Paging lives on the topic, not next to the replies. */
    topic?: { pages?: number | string; total?: number | string }
  }
}

async function call(params: Record<string, string>): Promise<FlickrResponse> {
  const query = new URLSearchParams(params)

  let response: Response
  try {
    response = await fetch(`${ENDPOINT}?${query}`)
  } catch {
    throw new Error("Non riesco a contattare Flickr. Controlla la connessione o usa la modalità Incolla.")
  }

  if (!response.ok) throw new Error(`Flickr ha risposto ${response.status}`)

  const payload = (await response.json()) as FlickrResponse
  if (payload.stat !== "ok") {
    throw new Error(payload.message ?? "Flickr ha rifiutato la richiesta")
  }
  return payload
}

/**
 * The group a discussion URL belongs to.
 *
 * replies.getList needs this as well as the topic id, and answers "Topic not
 * found" when it is missing. It takes the path alias straight from the URL as
 * readily as the NSID, so no lookup is needed.
 */
function groupIdFromUrl(url: string): string | null {
  const raw = GROUP_IN_URL.exec(url.trim())?.[1]
  return raw ? decodeURIComponent(raw) : null
}

function messageOf(reply: FlickrReply): string {
  if (typeof reply.message === "string") return reply.message
  return reply.message?._content ?? ""
}

/**
 * Every reply in a group discussion, oldest first.
 *
 * The topic's opening post is not a reply and is left out: it announces the
 * contest, it does not take part in it.
 */
export async function fetchDiscussion(url: string): Promise<ThreadComment[]> {
  const topicId = topicIdFromUrl(url)
  if (!topicId) {
    throw new Error("Link non valido: mi aspetto un indirizzo che contenga /discuss/<numero>")
  }

  const groupId = groupIdFromUrl(url)
  if (!groupId) {
    throw new Error("Link non valido: mi aspetto un indirizzo che contenga /groups/<gruppo>/")
  }

  const comments: ThreadComment[] = []
  let page = 1
  let pages = 1

  do {
    const payload = await call({
      method: "flickr.groups.discuss.replies.getList",
      group_id: groupId,
      topic_id: topicId,
      per_page: String(PER_PAGE),
      page: String(page),
    })

    pages = Number(payload.replies?.topic?.pages ?? 1) || 1
    for (const reply of payload.replies?.reply ?? []) {
      const name = reply.authorname ?? reply.author ?? "Sconosciuto"
      comments.push({
        index: comments.length + 1,
        author: { id: reply.author ?? name.toLowerCase(), name },
        body: messageOf(reply),
      })
    }
    page += 1
  } while (page <= pages)

  return comments
}
