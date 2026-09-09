/**
 * Core vocabulary shared by every contest format.
 *
 * A thread is an ordered list of comments. The engine turns it into photos,
 * ballots and issues; a format decides how.
 */

export type Author = {
  /** Stable identity used for equality. Flickr NSID, or the name in pasted threads. */
  id: string
  name: string
}

export type ThreadComment = {
  /** Position in the thread, starting at 1. Used to point the user at a comment. */
  index: number
  author: Author
  body: string
}

export type Photo = {
  id: number
  author: Author
  /** Absolute thumbnail URL, when the submission carried markup. */
  thumbnail: string | null
  /** Absolute link to the photo page on Flickr. */
  link: string | null
}

/** What a comment turned out to be, once the thread has been segmented. */
export type CommentRole = "submission" | "ballot" | "votingStart" | "ignored"

export type ClassifiedComment = ThreadComment & {
  /** The role the engine acted on: the override when there is one. */
  role: CommentRole
  /** What the format made of this comment, whether or not a role was pinned. */
  autoRole: CommentRole
  /** True when the role came from an override rather than from the format. */
  overridden: boolean
  /** Body with markup and entities resolved, ready for pattern matching. */
  text: string
}

/**
 * Roles pinned by hand, keyed by comment index.
 *
 * The markers that split a thread are ordinary prose, so a member quoting
 * "Come votare" can open voting by accident. Rather than guess who is allowed
 * to post a marker, let the organiser correct any single comment.
 */
export type RoleOverrides = Record<number, CommentRole>

export type Vote = {
  photoId: number
  /** Category key for categorical ballots, null for ranked ones. */
  category: string | null
  /** Position within the ballot (or within its category), starting at 0. */
  rank: number
}

export type Ballot = {
  comment: ClassifiedComment
  votes: Vote[]
}

export type Severity = "error" | "warning"

export type IssueCode =
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
  | "sourceError"

export type Issue = {
  severity: Severity
  code: IssueCode
  message: string
  author?: Author
  commentIndex?: number
}

export type Row = {
  photo: Photo
  points: number
  /** 1-based, shared by ties. */
  position: number
  /** Points per category, present only for categorical formats. */
  breakdown: Record<string, number>
}

export type Table = {
  id: string
  label: string
  rows: Row[]
}

export type Stats = {
  photos: number
  voters: number
  selfVoters: number
  ballotsWithErrors: number
}

export type Tally = {
  photos: Photo[]
  comments: ClassifiedComment[]
  tables: Table[]
  issues: Issue[]
  stats: Stats
}
