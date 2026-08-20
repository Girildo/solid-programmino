/**
 * A contest format is data, not code.
 *
 * Everything that used to differ between the LogicaProgramma subclasses is
 * declared here: where voting starts and stops, how a ballot line is written,
 * how votes turn into points, which tables come out, and which rules are
 * checked. The engine in ./engine is the single interpreter for all of it.
 *
 * Adding a contest means adding one object to ./formats, never a new branch.
 */

import type { Severity } from "./types"

/**
 * A boundary comment inside the thread.
 *
 * A comment matches when `linePattern` matches one of its trimmed lines, or
 * when its text contains `bodyContains`. Give at least one of the two.
 */
export type Marker = {
  linePattern?: RegExp
  bodyContains?: string
  /**
   * "comment" drops just the matching comment.
   * "rest" drops the matching comment and everything after it.
   */
  scope: "comment" | "rest"
}

export type Category = {
  /** Tag written on the ballot line, e.g. "T" or "eo". Compared case-insensitively. */
  key: string
  label: string
}

/**
 * How a voter writes a ballot.
 *
 * ranked: one ordered run of photo ids, best first, e.g. "#3#7#12".
 * categorical: one vote per line, tagged with a category, e.g. "T: #12".
 */
export type BallotSpec =
  | {
      kind: "ranked"
      /** A line that carries ballot ids and nothing else. */
      linePattern: RegExp
      /** Global pattern; capture group 1 is the photo id. */
      idPattern: RegExp
    }
  | {
      kind: "categorical"
      categories: Category[]
      /** Capture group 1 is the category key, group 2 the photo id. */
      linePattern: RegExp
    }

/**
 * What a vote is worth.
 *
 * positional: first preference scores `preferences` points, the next one less,
 * the last one 1. This is what makes a ranked ballot a ranking.
 * flat: every vote is worth the same, so the table counts mentions.
 */
export type ScoringSpec = { kind: "positional" } | { kind: "flat"; points: number }

export type TableSpec = {
  id: string
  label: string
  /** null counts every vote; a category key counts only that category's votes. */
  category: string | null
}

export type RuleId =
  | "photoLinkWithoutId"
  | "duplicatePhotoId"
  | "unknownPhotoId"
  | "duplicateVote"
  | "ballotTooShort"
  | "ballotTooLong"
  | "maxVotesPerPhoto"
  | "selfVote"
  | "didNotVote"
  | "everyPhotoAtZero"

/**
 * A check the engine runs, and how loudly it complains.
 *
 * "error" means the result cannot be trusted; "warning" means the tally stands
 * but somebody misbehaved. Omitting a rule switches the check off.
 *
 * `limit` is read by maxVotesPerPhoto only: how many times one ballot may name
 * the same photo across all categories. Exceeding it is reported, never
 * enforced, so the tally stays the same either way.
 */
export type Rule = { id: RuleId; severity: Severity; limit?: number }

export type ContestFormat = {
  id: string
  label: string
  blurb: string

  /**
   * Kept in the code but not offered in the picker, for a contest the group no
   * longer runs. The engine still reads it, so a thread can be tallied by
   * flipping this off.
   */
  hidden?: boolean

  votingStarts: Marker
  votingEnds?: Marker

  /** Comments to drop as program output. Checked before every other rule. */
  ignore?: Marker[]

  /** Applied to a submission comment; capture group 1 is the photo id. */
  photoIdPattern: RegExp

  ballot: BallotSpec
  scoring: ScoringSpec
  tables: TableSpec[]
  rules: Rule[]

  /** Default number of preferences a voter is expected to express. */
  defaultPreferences: number

  /** Thread used by the "load an example" button, in the paste format. */
  sample: string
}

/** Categories declared by the format, empty for ranked ballots. */
export function categoriesOf(format: ContestFormat): Category[] {
  return format.ballot.kind === "categorical" ? format.ballot.categories : []
}

export function ruleSeverity(format: ContestFormat, id: RuleId): Severity | null {
  return format.rules.find((r) => r.id === id)?.severity ?? null
}

export function ruleOf(format: ContestFormat, id: RuleId): Rule | null {
  return format.rules.find((r) => r.id === id) ?? null
}
