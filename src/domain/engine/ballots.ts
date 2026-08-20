import type { ContestFormat } from "../format"
import { ruleSeverity } from "../format"
import type { Ballot, ClassifiedComment, Issue, Photo, Vote } from "../types"
import { extractPhotoMedia, toLines } from "./text"

/**
 * The photos in the contest, keyed by the number their author gave them.
 *
 * A submission comment is prose plus an id, so only the first id in it counts.
 */
export function collectPhotos(
  comments: ClassifiedComment[],
  format: ContestFormat,
): { photos: Map<number, Photo>; issues: Issue[] } {
  const photos = new Map<number, Photo>()
  const issues: Issue[] = []
  const duplicateSeverity = ruleSeverity(format, "duplicatePhotoId")

  for (const comment of comments) {
    if (comment.role !== "submission") continue
    const match = format.photoIdPattern.exec(comment.text)
    if (!match?.[1]) continue

    const id = Number(match[1])
    const existing = photos.get(id)
    if (existing && duplicateSeverity) {
      issues.push({
        severity: duplicateSeverity,
        code: "duplicatePhotoId",
        message: `La foto #${id} è stata usata sia da ${existing.author.name} che da ${comment.author.name}`,
        author: comment.author,
        commentIndex: comment.index,
      })
    }
    photos.set(id, { id, author: comment.author, ...extractPhotoMedia(comment.body) })
  }

  return { photos, issues }
}

function rankedVotes(text: string, spec: Extract<ContestFormat["ballot"], { kind: "ranked" }>): Vote[] {
  const ids: number[] = []
  for (const line of toLines(text)) {
    if (!spec.linePattern.test(line)) continue
    for (const match of line.matchAll(spec.idPattern)) {
      if (match[1]) ids.push(Number(match[1]))
    }
  }
  return ids.map((photoId, rank) => ({ photoId, category: null, rank }))
}

function categoricalVotes(
  text: string,
  spec: Extract<ContestFormat["ballot"], { kind: "categorical" }>,
): Vote[] {
  const byCategory = new Map<string, number[]>()
  for (const line of toLines(text)) {
    const match = spec.linePattern.exec(line)
    if (!match?.[1] || !match[2]) continue
    const key = match[1].toUpperCase()
    const ids = byCategory.get(key) ?? []
    ids.push(Number(match[2]))
    byCategory.set(key, ids)
  }

  // Declaration order, so the output does not depend on how the voter typed the ballot.
  return spec.categories.flatMap((category) =>
    (byCategory.get(category.key.toUpperCase()) ?? []).map((photoId, rank) => ({
      photoId,
      category: category.key,
      rank,
    })),
  )
}

/** Reads every ballot comment through the format's ballot grammar. */
export function parseBallots(comments: ClassifiedComment[], format: ContestFormat): Ballot[] {
  return comments
    .filter((comment) => comment.role === "ballot")
    .map((comment) => ({
      comment,
      votes:
        format.ballot.kind === "ranked"
          ? rankedVotes(comment.text, format.ballot)
          : categoricalVotes(comment.text, format.ballot),
    }))
}
