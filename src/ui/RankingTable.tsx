import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import type { JSX } from "solid-js"
import type { ContestFormat } from "../domain/format"
import { categoriesOf } from "../domain/format"
import type { Row, Table } from "../domain/types"
import { photoHoverProps } from "./photoPreview"

type Props = {
  table: Table
  format: ContestFormat
  /** Adds one column per category, for the table that sums them all. */
  showBreakdown: boolean
}

const CATEGORY_PREFIX = "cat:"

type Sort = { key: string; dir: 1 | -1 }

const DEFAULT_SORT: Sort = { key: "points", dir: -1 }

function valueOf(row: Row, key: string): string | number {
  if (key.startsWith(CATEGORY_PREFIX)) return row.breakdown[key.slice(CATEGORY_PREFIX.length)] ?? 0
  if (key === "id") return row.photo.id
  if (key === "author") return row.photo.author.name
  if (key === "position") return row.position
  return row.points
}

export function RankingTable(props: Props) {
  const [sort, setSort] = createSignal<Sort>(DEFAULT_SORT)
  const categories = () => (props.showBreakdown ? categoriesOf(props.format) : [])

  // Switching table switches which columns exist, so a sort left on a column
  // that is no longer shown would order by something invisible.
  createEffect(() => {
    props.table.id
    setSort(DEFAULT_SORT)
  })

  const toggle = (key: string) => {
    const ascendingFirst = key === "author" || key === "id" || key === "position"
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === -1 ? 1 : -1 }
        : { key, dir: ascendingFirst ? 1 : -1 },
    )
  }

  const rows = createMemo(() => {
    const { key, dir } = sort()
    return [...props.table.rows].sort((a, b) => {
      const left = valueOf(a, key)
      const right = valueOf(b, key)
      if (typeof left === "string" || typeof right === "string") {
        return String(left).localeCompare(String(right), "it") * dir
      }
      // Ties fall back to the standing, so a category sort still reads as a ranking.
      return (left - right) * dir || a.position - b.position || a.photo.id - b.photo.id
    })
  })

  const header = (key: string, label: JSX.Element, className: string, title?: string) => (
    <th
      classList={{ [className]: true, sortable: true, sorted: sort().key === key }}
      title={title}
      onClick={() => toggle(key)}
    >
      {label}
      <span class="arrow">{sort().key === key ? (sort().dir === -1 ? "▼" : "▲") : ""}</span>
    </th>
  )

  return (
    <div class="table-scroll">
      <table class="ranking">
        <thead>
          <tr>
            {header("position", "#", "col-pos", "Posizione nella classifica generale")}
            {header("id", "Foto", "col-photo")}
            {header("author", "Autore", "col-author")}
            <For each={categories()}>
              {(category) =>
                header(
                  `${CATEGORY_PREFIX}${category.key}`,
                  category.key.toUpperCase(),
                  "col-num",
                  category.label,
                )
              }
            </For>
            {header("points", "Punti", "col-num")}
          </tr>
        </thead>
        <tbody>
          <For each={rows()}>
            {(row) => (
              <tr classList={{ podium: row.position <= 3, zero: row.points === 0 }}>
                <td class="col-pos" data-position={row.position}>
                  {row.position}
                </td>
                <td
                  classList={{ "col-photo": true, hoverable: row.photo.thumbnail !== null }}
                  {...photoHoverProps(row.photo)}
                >
                  #{row.photo.id}
                </td>
                <td class="col-author">{row.photo.author.name}</td>
                <For each={categories()}>
                  {(category) => (
                    <td
                      classList={{
                        "col-num": true,
                        muted: sort().key !== `${CATEGORY_PREFIX}${category.key}`,
                        lead: sort().key === `${CATEGORY_PREFIX}${category.key}`,
                      }}
                    >
                      {row.breakdown[category.key] ?? 0}
                    </td>
                  )}
                </For>
                <td class="col-num points">{row.points}</td>
              </tr>
            )}
          </For>
          <Show when={props.table.rows.length === 0}>
            <tr>
              <td class="empty" colspan={4 + categories().length}>
                Nessuna foto trovata
              </td>
            </tr>
          </Show>
        </tbody>
      </table>
    </div>
  )
}
