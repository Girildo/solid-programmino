import type { ContestFormat, Marker } from "../format"
import { ruleSeverity } from "../format"
import type { ClassifiedComment, Issue, RoleOverrides, ThreadComment } from "../types"
import { hasEmbeddedLink, toLines, toPlainText } from "./text"

function matchesMarker(marker: Marker, text: string, lines: string[]): boolean {
  if (marker.bodyContains && text.toLowerCase().includes(marker.bodyContains.toLowerCase())) {
    return true
  }
  return marker.linePattern !== undefined && lines.some((line) => marker.linePattern!.test(line))
}

/**
 * Walks the thread in order and decides what each comment is.
 *
 * The submission-then-voting split is positional: every comment after the
 * format's start marker is read as a ballot, everything before it as a photo.
 */
export function segment(
  comments: ThreadComment[],
  format: ContestFormat,
  overrides: RoleOverrides = {},
): { classified: ClassifiedComment[]; issues: Issue[] } {
  const classified: ClassifiedComment[] = []
  const issues: Issue[] = []
  const linkSeverity = ruleSeverity(format, "photoLinkWithoutId")

  let voting = false
  let halted = false

  for (const comment of comments) {
    const text = toPlainText(comment.body)
    const lines = toLines(text)
    const base = { ...comment, text, overridden: false }

    // Checked before everything else so a pinned role can also rescue comments
    // that an unwanted end marker swept up.
    const forced = overrides[comment.index]
    if (forced) {
      if (forced === "votingStart") voting = true
      classified.push({ ...base, role: forced, overridden: true })
      continue
    }

    if (halted) {
      classified.push({ ...base, role: "ignored" })
      continue
    }

    if (format.ignore?.some((marker) => matchesMarker(marker, text, lines))) {
      classified.push({ ...base, role: "ignored" })
      continue
    }

    if (format.votingEnds && matchesMarker(format.votingEnds, text, lines)) {
      if (format.votingEnds.scope === "rest") halted = true
      classified.push({ ...base, role: "ignored" })
      continue
    }

    if (matchesMarker(format.votingStarts, text, lines)) {
      voting = true
      classified.push({ ...base, role: "votingStart" })
      continue
    }

    if (!format.photoIdPattern.test(text)) {
      if (linkSeverity && hasEmbeddedLink(comment.body)) {
        issues.push({
          severity: linkSeverity,
          code: "photoLinkWithoutId",
          message: `Il commento di ${comment.author.name} contiene una foto ma non il numero con il cancelletto`,
          author: comment.author,
          commentIndex: comment.index,
        })
      }
      classified.push({ ...base, role: "ignored" })
      continue
    }

    classified.push({ ...base, role: voting ? "ballot" : "submission" })
  }

  return { classified, issues }
}
