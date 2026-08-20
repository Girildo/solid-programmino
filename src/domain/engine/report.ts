import type { ContestFormat } from "../format"
import { categoriesOf } from "../format"
import type { Row, Tally } from "../types"

const RULE = "--------------------"

function breakdownOf(format: ContestFormat, row: Row): string {
  const categories = categoriesOf(format)
  if (categories.length === 0) return ""
  const parts = categories.map((category) => `${category.key}:${row.breakdown[category.key] ?? 0}`)
  return ` (${parts.join(" ")})`
}

function line(format: ContestFormat, row: Row): string {
  return `${row.position}) #${row.photo.id} - ${row.photo.author.name} - ${row.points} punti${breakdownOf(format, row)}`
}

function podium(rows: Row[]): string {
  return rows
    .slice(0, 3)
    .map((row) => `#${row.photo.id} ${row.photo.author.name} (${row.points})`)
    .join(" | ")
}

/**
 * The text the organiser pastes back into the thread.
 *
 * The headline table is listed in full; the other tables are reduced to their
 * podium so the comment stays readable in a Flickr discussion.
 */
export function buildReport(result: Tally, format: ContestFormat, preferences: number): string {
  const [headline, ...rest] = result.tables
  const out: string[] = []

  // Opening with the format's end marker makes the pasted result ignore itself
  // when the thread is read again, instead of being scored as a ballot.
  const selfExcluding = format.votingEnds?.bodyContains
  if (selfExcluding) {
    out.push(selfExcluding)
    out.push("")
  }

  if (headline) {
    out.push(headline.label.toUpperCase())
    out.push(...headline.rows.map((row) => line(format, row)))
    out.push("")
  }

  if (rest.length > 0) {
    out.push("PODI DI CATEGORIA")
    for (const table of rest) {
      out.push(`${table.label}: ${podium(table.rows)}`)
    }
    out.push("")
  }

  out.push(RULE)
  out.push(`Formato: ${format.label} - ${preferences} preferenze`)
  out.push(`Foto in gara: ${result.stats.photos}`)
  out.push(`Hanno votato: ${result.stats.voters}`)
  out.push(`Si sono autovotati: ${result.stats.selfVoters}`)
  out.push(`Voti con errori: ${result.stats.ballotsWithErrors}`)

  const notices = result.issues.filter((issue) => issue.code !== "everyPhotoAtZero")
  if (notices.length > 0) {
    out.push("")
    out.push("SEGNALAZIONI")
    out.push(...notices.map((issue) => `- ${issue.message}`))
  }

  return out.join("\n")
}
