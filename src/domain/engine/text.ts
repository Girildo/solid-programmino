/** Turning raw comment bodies into something patterns can be matched against. */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
}

/**
 * Drops markup and resolves entities, keeping the text that was inside tags.
 * Tags go first so that escaped angle brackets in the text are never read as markup.
 */
export function toPlainText(body: string): string {
  return decodeEntities(body.replace(/<[^>]*>/g, " "))
}

/**
 * True when the comment embeds a Flickr photo, which is how a submission looks.
 * Deliberately narrow: any other link is just a link, and flagging it as a
 * submission missing its number would be noise.
 */
export function hasEmbeddedLink(body: string): boolean {
  return /<a\s[^>]*href=["']?https?:\/\/(?:www\.)?flickr\.com/i.test(body)
}

const TRAILING_STOP = /\s*STOP\s*$/i

/**
 * Non-empty trimmed lines, with the trailing STOP some voters append removed
 * so that "#12 STOP" is read as the ballot line it is meant to be.
 */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(TRAILING_STOP, "").trim())
    .filter((line) => line.length > 0)
}

const IMG_SRC = /<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)/i
const PHOTO_HREF = /<a[^>]+href=["']?(https?:\/\/(?:www\.)?flickr\.com\/photos\/[^"'\s>]+)/i

/**
 * The thumbnail and photo page a submission points at.
 *
 * Only absolute URLs are taken: a pasted thread carries no markup, and a
 * relative src would resolve against this app rather than against Flickr.
 */
export function extractPhotoMedia(body: string): { thumbnail: string | null; link: string | null } {
  return {
    thumbnail: IMG_SRC.exec(body)?.[1] ?? null,
    link: PHOTO_HREF.exec(body)?.[1] ?? null,
  }
}
