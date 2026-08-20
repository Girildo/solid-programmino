import type { ThreadComment } from "../domain/types"

/**
 * How a pasted thread was cut into comments. Shown to the user, because a
 * silently mis-segmented thread produces an empty tally that looks like a bug
 * in the contest rather than a bad paste.
 */
export type PasteStrategy = "json" | "authors" | "separators" | "single"

export type PasteResult = {
  comments: ThreadComment[]
  strategy: PasteStrategy
}

const SEPARATOR = /^\s*-{3,}\s*$/
const EXPLICIT_AUTHOR = /^@\s*(.+?)\s*$/
const SAYS =
  /^(.{1,60}?)\s*(?:\((?:member|admin|moderator|amministratore)\)\s*)?(?:says|said|ha scritto|dice|scrive)\s*:?\s*$/i
const TIMESTAMP =
  /^(?:posted\s+)?(?:about\s+)?\d+\s*(?:second|minute|hour|day|week|month|year|secondi?|minuti?|or[ae]|giorni?|settiman[ae]|mes[ei]|ann[oi])s?\s*(?:ago|fa)\.?$/i
const NAME_LIKE = /^[^#<>@]{2,60}$/

type LooseComment = Record<string, unknown>

function pick(record: LooseComment, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.length > 0) return value
    if (value && typeof value === "object") {
      const content = (value as LooseComment)["_content"]
      if (typeof content === "string" && content.length > 0) return content
    }
  }
  return null
}

function fromJson(input: string): ThreadComment[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return null
  }

  const container = parsed as LooseComment | null
  const nested = container?.["replies"] as LooseComment | undefined
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(nested?.["reply"])
      ? (nested["reply"] as unknown[])
      : Array.isArray(container?.["reply"])
        ? (container["reply"] as unknown[])
        : null
  if (!rows) return null

  return rows.map((row, position) => {
    const record = (row ?? {}) as LooseComment
    const name =
      pick(record, ["authorname", "author_name", "author", "name", "autore"]) ?? `Anonimo ${position + 1}`
    const id = pick(record, ["author_id", "authorId", "nsid"]) ?? name.toLowerCase()
    return {
      index: position + 1,
      author: { id, name },
      body: pick(record, ["message", "body", "text", "testo", "content"]) ?? "",
    }
  })
}

type Block = { name: string; lines: string[] }

function headerAt(lines: string[], index: number): string | null {
  const trimmed = lines[index]!.trim()

  const explicit = EXPLICIT_AUTHOR.exec(trimmed)
  if (explicit?.[1]) return explicit[1]

  const says = SAYS.exec(trimmed)
  if (says?.[1]) return says[1].trim()

  const next = lines[index + 1]?.trim() ?? ""
  if (trimmed.length > 0 && NAME_LIKE.test(trimmed) && TIMESTAMP.test(next)) return trimmed

  return null
}

/**
 * Cuts the text wherever an author header appears.
 *
 * Three headers are recognised, because people paste from different places:
 * an explicit "@Nome", Flickr's "Nome says:", and the modern layout where the
 * name sits on its own line above a relative timestamp.
 */
function splitIntoBlocks(input: string): { blocks: Block[]; sawHeader: boolean; sawSeparator: boolean } {
  const lines = input.split(/\r?\n/)
  const blocks: Block[] = []
  let current: Block | null = null
  let sawSeparator = false

  // Author names win over dashes. A generated result table draws its own rule
  // out of dashes, and reading those as comment boundaries would tear the table
  // into fragments that then look like ballots.
  const sawHeader = lines.some((_, index) => headerAt(lines, index) !== null)

  const open = (name: string) => {
    current = { name, lines: [] }
    blocks.push(current)
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const trimmed = line.trim()

    if (SEPARATOR.test(trimmed)) {
      sawSeparator = true
      if (!sawHeader) {
        current = null
        continue
      }
    }

    const header = headerAt(lines, index)
    if (header !== null) {
      const consumesTimestamp = !EXPLICIT_AUTHOR.test(trimmed) && !SAYS.test(trimmed)
      open(header)
      if (consumesTimestamp) index += 1
      continue
    }

    // A timestamp on its own belongs to the layout, not to the comment.
    if (TIMESTAMP.test(trimmed)) continue

    if (!current) {
      if (trimmed.length === 0) continue
      open("")
    }
    current!.lines.push(line)
  }

  return { blocks, sawHeader, sawSeparator }
}

/**
 * Reads a thread the user pasted in.
 *
 * Accepts the JSON the Flickr API returns, a thread copied straight out of the
 * browser, or blocks separated by a line of dashes.
 */
export function parsePastedThread(input: string): PasteResult {
  const trimmed = input.trim()
  if (trimmed.length === 0) return { comments: [], strategy: "single" }

  const asJson = fromJson(trimmed)
  if (asJson) return { comments: asJson, strategy: "json" }

  const { blocks, sawHeader, sawSeparator } = splitIntoBlocks(trimmed)

  const comments: ThreadComment[] = []
  for (const block of blocks) {
    const body = block.lines.join("\n").trim()
    if (body.length === 0 && block.name.length === 0) continue
    const name = block.name.length > 0 ? block.name : `Anonimo ${comments.length + 1}`
    comments.push({
      index: comments.length + 1,
      author: { id: name.toLowerCase(), name },
      body,
    })
  }

  const strategy: PasteStrategy = sawHeader
    ? "authors"
    : sawSeparator
      ? "separators"
      : comments.length > 1
        ? "separators"
        : "single"

  return { comments, strategy }
}
