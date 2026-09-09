import { toPlainText } from "../domain/engine/text"
import type { ThreadComment } from "../domain/types"

/** The server-side proxy, which adds the API key and forwards to Flickr. */
const ENDPOINT = "/api/flickr"
const TOPIC_IN_URL = /\/discuss\/(\d+)/
const GROUP_IN_URL = /\/groups\/([^/?#]+)/
const PER_PAGE = 500

export function topicIdFromUrl(url: string): string | null {
  return TOPIC_IN_URL.exec(url.trim())?.[1] ?? null
}

/** Flickr writes text either bare or wrapped, depending on the field. */
type FlickrText = string | { _content?: string }

type FlickrReply = {
  author?: string
  authorname?: string
  message?: FlickrText
}

type FlickrTopic = {
  subject?: FlickrText
  /** Paging lives on the topic, not next to the replies. */
  pages?: number | string
  total?: number | string
}

type FlickrResponse = {
  stat?: string
  message?: string
  replies?: {
    reply?: FlickrReply[]
    topic?: FlickrTopic
  }
}

/** A discussion as the app reads it: the thread, and what it is called. */
export type Discussion = {
  /** The topic's subject, or null when Flickr sent none. */
  title: string | null
  comments: ThreadComment[]
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

function textOf(value: FlickrText | undefined): string {
  if (typeof value === "string") return value
  return value?._content ?? ""
}

function subjectOf(topic: FlickrTopic | undefined): string | null {
  const subject = toPlainText(textOf(topic?.subject)).trim()
  return subject.length > 0 ? subject : null
}

/**
 * A group discussion: its subject, and every reply oldest first.
 *
 * The topic's opening post is not a reply and is left out: it announces the
 * contest, it does not take part in it.
 */
export async function fetchDiscussion(url: string): Promise<Discussion> {
  const topicId = topicIdFromUrl(url)
  if (!topicId) {
    throw new Error("Link non valido: mi aspetto un indirizzo che contenga /discuss/<numero>")
  }

  const groupId = groupIdFromUrl(url)
  if (!groupId) {
    throw new Error("Link non valido: mi aspetto un indirizzo che contenga /groups/<gruppo>/")
  }

  const comments: ThreadComment[] = []
  let title: string | null = null
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

    const topic = payload.replies?.topic
    pages = Number(topic?.pages ?? 1) || 1
    if (title === null) title = subjectOf(topic)

    for (const reply of payload.replies?.reply ?? []) {
      const name = reply.authorname ?? reply.author ?? "Sconosciuto"
      comments.push({
        index: comments.length + 1,
        author: { id: reply.author ?? name.toLowerCase(), name },
        body: textOf(reply.message),
      })
    }
    page += 1
  } while (page <= pages)

  return { title, comments }
}
