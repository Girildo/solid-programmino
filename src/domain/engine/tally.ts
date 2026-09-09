import type { ContestFormat } from "../format";
import { categoriesOf, ruleOf, ruleSeverity } from "../format";
import type {
  Author,
  Ballot,
  Issue,
  Photo,
  RoleOverrides,
  Row,
  Table,
  Tally,
  ThreadComment,
  Vote,
} from "../types";
import { collectPhotos, parseBallots } from "./ballots";
import { segment } from "./segment";

type ScoredBallot = { ballot: Ballot; votes: Vote[] };

/** Votes belonging to one scope: a category, or the whole ballot when ranked. */
function scopesOf(format: ContestFormat): (string | null)[] {
  const categories = categoriesOf(format);
  return categories.length > 0 ? categories.map((c) => c.key) : [null];
}

function scopeLabel(format: ContestFormat, scope: string | null): string {
  const category = categoriesOf(format).find((c) => c.key === scope);
  return category ? ` nella categoria ${category.label.toLowerCase()}` : "";
}

type AcceptArgs = {
  ballot: Ballot;
  photos: Map<number, Photo>;
  format: ContestFormat;
  preferences: number;
  issues: Issue[];
};

/**
 * Drops the votes that cannot be counted and reports why.
 *
 * Surviving votes are re-ranked so that a dropped preference closes the gap
 * instead of leaving a hole that positional scoring would price wrongly.
 */
function acceptVotes({
  ballot,
  photos,
  format,
  preferences,
  issues,
}: AcceptArgs): {
  votes: Vote[];
  hadError: boolean;
} {
  const author = ballot.comment.author;
  const at = { author, commentIndex: ballot.comment.index };
  const before = issues.length;

  const unknownSeverity = ruleSeverity(format, "unknownPhotoId");
  const duplicateSeverity = ruleSeverity(format, "duplicateVote");
  const shortSeverity = ruleSeverity(format, "ballotTooShort");
  const longSeverity = ruleSeverity(format, "ballotTooLong");
  const selfSeverity = ruleSeverity(format, "selfVote");

  const seen = new Set<string>();
  const kept: Vote[] = [];

  for (const vote of ballot.votes) {
    if (!photos.has(vote.photoId)) {
      if (unknownSeverity) {
        issues.push({
          severity: unknownSeverity,
          code: "unknownPhotoId",
          message: `${author.name} ha votato la foto #${vote.photoId}, che non esiste`,
          ...at,
        });
      }
      continue;
    }

    const key = `${vote.category ?? ""}#${vote.photoId}`;
    if (seen.has(key)) {
      if (duplicateSeverity) {
        issues.push({
          severity: duplicateSeverity,
          code: "duplicateVote",
          message: `${author.name} ha votato due volte la foto #${vote.photoId}${scopeLabel(format, vote.category)}`,
          ...at,
        });
      }
      continue;
    }

    seen.add(key);
    kept.push(vote);
  }

  const withinScope: Vote[] = [];
  for (const scope of scopesOf(format)) {
    const inScope = kept.filter((vote) => vote.category === scope);

    if (inScope.length < preferences && shortSeverity) {
      issues.push({
        severity: shortSeverity,
        code: "ballotTooShort",
        message: `${author.name} ha espresso ${inScope.length} preferenze invece di ${preferences}${scopeLabel(format, scope)}`,
        ...at,
      });
    }
    if (inScope.length > preferences && longSeverity) {
      issues.push({
        severity: longSeverity,
        code: "ballotTooLong",
        message: `${author.name} ha espresso ${inScope.length} preferenze invece di ${preferences}${scopeLabel(format, scope)}: contano le prime ${preferences}`,
        ...at,
      });
    }

    withinScope.push(...inScope.slice(0, preferences));
  }

  reportVotesPerPhoto({ votes: withinScope, author, at, format, issues });

  // Ranks are per scope, and only mean anything once the drops above are settled.
  const nextRank = new Map<string | null, number>();
  const accepted = withinScope.map((vote) => {
    const rank = nextRank.get(vote.category) ?? 0;
    nextRank.set(vote.category, rank + 1);
    return { ...vote, rank };
  });

  if (selfSeverity) {
    for (const vote of accepted) {
      if (photos.get(vote.photoId)?.author.id === author.id) {
        issues.push({
          severity: selfSeverity,
          code: "selfVote",
          message: `${author.name} si è autovotato con la foto #${vote.photoId}${scopeLabel(format, vote.category)}`,
          ...at,
        });
      }
    }
  }

  const hadError = issues
    .slice(before)
    .some((issue) => issue.severity === "error");
  return { votes: accepted, hadError };
}

type CapArgs = {
  votes: Vote[];
  author: Author;
  at: { author: Author; commentIndex: number };
  format: ContestFormat;
  issues: Issue[];
};

/**
 * Reports "the same photo named more than N times on one ballot".
 *
 * Some contests cap how far a voter may back one photo across categories. The
 * votes still count: whether to discard a ballot that breaks the rule is the
 * organiser's call, not the tally's.
 */
function reportVotesPerPhoto({
  votes,
  author,
  at,
  format,
  issues,
}: CapArgs): void {
  const rule = ruleOf(format, "maxVotesPerPhoto");
  if (rule?.limit === undefined) return;

  const used = new Map<number, number>();
  for (const vote of votes) {
    used.set(vote.photoId, (used.get(vote.photoId) ?? 0) + 1);
  }

  for (const [photoId, count] of used) {
    if (count <= rule.limit) continue;
    issues.push({
      severity: rule.severity,
      code: "maxVotesPerPhoto",
      message: `${author.name} ha votato la foto #${photoId} ${count} volte, il massimo è ${rule.limit}`,
      ...at,
    });
  }
}

function pointsFor(
  format: ContestFormat,
  vote: Vote,
  preferences: number,
): number {
  return format.scoring.kind === "positional"
    ? preferences - vote.rank
    : format.scoring.points;
}

// How ties are handled in the ranking system.
// 'Standard' means that if there is a tie, the next position is the number it would have been if there were no tie (gaps are left).
// 'Dense' means that if there is a tie, the next position is the immediate next number (no gaps).
export type RankCountingStrategy = "standard" | "dense";

/** What the organiser can change about the tables without touching the format. */
export type TallyOptions = {
  rankCountingStrategy: RankCountingStrategy;
  /** Keep photos whose author cast no countable ballot out of every table. */
  excludeNonVoters: boolean;
};

function buildTables(
  photos: Map<number, Photo>,
  scored: ScoredBallot[],
  format: ContestFormat,
  preferences: number,
  rankCountingStrategy: RankCountingStrategy,
): Table[] {
  const categories = categoriesOf(format);

  const breakdowns = new Map<number, Record<string, number>>();
  for (const photo of photos.values()) {
    breakdowns.set(
      photo.id,
      Object.fromEntries(categories.map((c) => [c.key, 0])),
    );
  }
  for (const { votes } of scored) {
    for (const vote of votes) {
      if (!vote.category) continue;
      const breakdown = breakdowns.get(vote.photoId);
      if (!breakdown) continue;
      breakdown[vote.category] =
        (breakdown[vote.category] ?? 0) + pointsFor(format, vote, preferences);
    }
  }

  return format.tables.map((spec) => {
    const points = new Map<number, number>();
    for (const photo of photos.values()) points.set(photo.id, 0);

    for (const { votes } of scored) {
      for (const vote of votes) {
        if (spec.category !== null && vote.category !== spec.category) continue;
        points.set(
          vote.photoId,
          (points.get(vote.photoId) ?? 0) +
            pointsFor(format, vote, preferences),
        );
      }
    }

    const rows: Row[] = [...photos.values()]
      .map((photo) => ({
        photo,
        points: points.get(photo.id) ?? 0,
        position: 0,
        breakdown: breakdowns.get(photo.id) ?? {},
      }))
      .sort((a, b) => b.points - a.points || a.photo.id - b.photo.id);

    let position = 0;
    let previous: number | null = null;

    for (const [i, row] of rows.entries()) {
      // If this row has a different number of points than the previous row, it gets a new position.
      // The next position depends on the rank counting strategy.
      if (rankCountingStrategy === "standard" && row.points !== previous) {
        position = i + 1;
        previous = row.points;
      } else if (rankCountingStrategy === "dense" && row.points !== previous) {
        position += 1;
        previous = row.points;
      }
      row.position = position;
    }

    return { id: spec.id, label: spec.label, rows };
  });
}

/**
 * Runs a thread through a format and produces the tables, the issues and the
 * counts the organiser needs. Pure: the same thread and format always give the
 * same result.
 */
export function tally(
  comments: ThreadComment[],
  format: ContestFormat,
  preferences: number,
  options: TallyOptions,
  overrides: RoleOverrides = {},
): Tally {
  const { classified, issues: segmentIssues } = segment(
    comments,
    format,
    overrides,
  );
  const { photos, issues: photoIssues } = collectPhotos(classified, format);
  const issues: Issue[] = [...segmentIssues, ...photoIssues];

  const scored: ScoredBallot[] = [];
  const voters = new Set<string>();
  let ballotsWithErrors = 0;

  for (const ballot of parseBallots(classified, format)) {
    const { votes, hadError } = acceptVotes({
      ballot,
      photos,
      format,
      preferences,
      issues,
    });
    if (hadError) ballotsWithErrors += 1;
    if (votes.length > 0) voters.add(ballot.comment.author.id);
    scored.push({ ballot, votes });
  }

  // Excluded photos stay in the photo list and in the counts: only the tables
  // drop them, so the contest still shows who took part.
  const ranked = options.excludeNonVoters
    ? new Map([...photos].filter(([, photo]) => voters.has(photo.author.id)))
    : photos;

  const tables = buildTables(
    ranked,
    scored,
    format,
    preferences,
    options.rankCountingStrategy,
  );

  const didNotVoteSeverity = ruleSeverity(format, "didNotVote");
  if (didNotVoteSeverity) {
    const silent = new Map<string, Photo>();
    for (const photo of photos.values()) {
      if (!voters.has(photo.author.id) && !silent.has(photo.author.id)) {
        silent.set(photo.author.id, photo);
      }
    }
    for (const photo of silent.values()) {
      issues.push({
        severity: didNotVoteSeverity,
        code: "didNotVote",
        message: `${photo.author.name} non ha votato (foto #${photo.id})`,
        author: photo.author,
      });
    }
  }

  const zeroSeverity = ruleSeverity(format, "everyPhotoAtZero");
  const headline = tables[0];
  if (
    zeroSeverity &&
    headline &&
    headline.rows.length > 0 &&
    headline.rows[0]!.points === 0
  ) {
    issues.push({
      severity: zeroSeverity,
      code: "everyPhotoAtZero",
      message:
        "Nessuna foto ha ricevuto punti: controlla il formato scelto e il numero di preferenze",
    });
  }

  const selfVoters = new Set(
    issues
      .filter((issue) => issue.code === "selfVote")
      .map((issue) => issue.author?.id ?? ""),
  );

  return {
    photos: [...photos.values()].sort((a, b) => a.id - b.id),
    comments: classified,
    tables,
    issues,
    stats: {
      photos: photos.size,
      voters: voters.size,
      selfVoters: selfVoters.size,
      ballotsWithErrors,
    },
  };
}
