import type { ContestFormat, Marker } from "../format"
import { ruleSeverity } from "../format"
import type {
  ClassifiedComment,
  CommentRole,
  Issue,
  RoleOverrides,
  Severity,
  ThreadComment,
} from "../types"
import { hasEmbeddedLink, toLines, toPlainText } from "./text"

function matchesMarker(marker: Marker, text: string, lines: string[]): boolean {
  if (marker.bodyContains && text.toLowerCase().includes(marker.bodyContains.toLowerCase())) {
    return true
  }
  return marker.linePattern !== undefined && lines.some((line) => marker.linePattern!.test(line))
}

type Phase = { voting: boolean; halted: boolean }

/** What the format makes of one comment, and what that does to the phase. */
type Automatic = {
  role: CommentRole
  /** True when this comment is an end marker that discards the rest. */
  halts: boolean
  issue: Issue | null
}

/**
 * Reads one comment against the format. Pure, so it can be asked what a
 * comment would be without letting the answer move the thread on.
 */
function classify(
  comment: ThreadComment,
  text: string,
  lines: string[],
  format: ContestFormat,
  phase: Phase,
  linkSeverity: Severity | null,
): Automatic {
  const plain = { halts: false, issue: null }

  if (phase.halted) return { role: "ignored", ...plain }

  if (format.ignore?.some((marker) => matchesMarker(marker, text, lines))) {
    return { role: "ignored", ...plain }
  }

  if (format.votingEnds && matchesMarker(format.votingEnds, text, lines)) {
    return {
      role: "ignored",
      halts: format.votingEnds.scope === "rest",
      issue: null,
    }
  }

  if (matchesMarker(format.votingStarts, text, lines)) {
    return { role: "votingStart", ...plain }
  }

  if (!format.photoIdPattern.test(text)) {
    const issue =
      linkSeverity && hasEmbeddedLink(comment.body)
        ? {
            severity: linkSeverity,
            code: "photoLinkWithoutId" as const,
            message: `Il commento di ${comment.author.name} contiene una foto ma non il numero con il cancelletto`,
            author: comment.author,
            commentIndex: comment.index,
          }
        : null
    return { role: "ignored", halts: false, issue }
  }

  return { role: phase.voting ? "ballot" : "submission", ...plain }
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

  const phase: Phase = { voting: false, halted: false }

  for (const comment of comments) {
    const text = toPlainText(comment.body)
    const lines = toLines(text)
    // Read every comment, pinned or not, so the panel can still show what the
    // format made of it and the organiser can compare before dropping the pin.
    const auto = classify(comment, text, lines, format, phase, linkSeverity)
    const base = { ...comment, text, autoRole: auto.role }

    const forced = overrides[comment.index]
    if (forced) {
      // A pinned role answers for the comment on its own, so an end marker
      // that fired by accident stops discarding everything behind it.
      if (forced === "votingStart") phase.voting = true
      classified.push({ ...base, role: forced, overridden: true })
      continue
    }

    if (auto.issue) issues.push(auto.issue)
    if (auto.halts) phase.halted = true
    if (auto.role === "votingStart") phase.voting = true

    classified.push({ ...base, role: auto.role, overridden: false })
  }

  return { classified, issues }
}
