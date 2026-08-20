import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { categoriesOf } from "./domain/format"
import { formatById, visibleFormats } from "./domain/formats"
import { buildReport } from "./domain/engine/report"
import { tally } from "./domain/engine/tally"
import type { CommentRole, RoleOverrides, ThreadComment } from "./domain/types"
import { CommentsPanel } from "./ui/CommentsPanel"
import { IssuesPanel } from "./ui/IssuesPanel"
import { PhotoPreviewLayer, photoHoverProps } from "./ui/photoPreview"
import { RankingTable } from "./ui/RankingTable"
import { ReportPanel } from "./ui/ReportPanel"
import { SourcePanel } from "./ui/SourcePanel"

const STORAGE_KEY = "programmino.prefs"

type StoredPrefs = { formatId: string; preferences: number }

const DEFAULT_FORMAT = visibleFormats[0]!

function loadPrefs(): StoredPrefs {
  const fallback = {
    formatId: DEFAULT_FORMAT.id,
    preferences: DEFAULT_FORMAT.defaultPreferences,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? { ...fallback, ...(JSON.parse(raw) as Partial<StoredPrefs>) } : fallback
    // A format that is no longer offered must not stay selected from last time.
    const offered = visibleFormats.some((format) => format.id === stored.formatId)
    return offered ? stored : { ...stored, formatId: fallback.formatId, preferences: fallback.preferences }
  } catch {
    return fallback
  }
}

export function App() {
  const initial = loadPrefs()

  const [formatId, setFormatId] = createSignal(initial.formatId)
  const [preferences, setPreferences] = createSignal(initial.preferences)
  const [comments, setComments] = createSignal<ThreadComment[]>([])
  const [activeTableId, setActiveTableId] = createSignal<string | null>(null)
  const [overrides, setOverrides] = createSignal<RoleOverrides>({})

  const format = createMemo(() => formatById(formatId()))
  const result = createMemo(() =>
    comments().length > 0 ? tally(comments(), format(), preferences(), overrides()) : null,
  )

  const setOverride = (index: number, role: CommentRole | null) => {
    setOverrides((current) => {
      const next = { ...current }
      if (role) next[index] = role
      else delete next[index]
      return next
    })
  }
  const activeTable = createMemo(() => {
    const tables = result()?.tables ?? []
    return tables.find((table) => table.id === activeTableId()) ?? tables[0] ?? null
  })
  const showBreakdown = createMemo(() => {
    const table = activeTable()
    if (!table || categoriesOf(format()).length === 0) return false
    return format().tables.find((spec) => spec.id === table.id)?.category === null
  })

  createEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ formatId: formatId(), preferences: preferences() }),
    )
  })

  const pickFormat = (id: string) => {
    setFormatId(id)
    setPreferences(formatById(id).defaultPreferences)
    setActiveTableId(null)
  }

  return (
    <div class="app">
      <PhotoPreviewLayer />
      <header class="topbar">
        <div class="brand">
          <h1>Il Programmino</h1>
          <span class="subtitle">Spoglio delle gare fotografiche</span>
        </div>
        <div class="tabs formats">
          <Show
            when={visibleFormats.length > 1}
            fallback={
              <span class="tab on static" title={format().blurb}>
                {format().label}
              </span>
            }
          >
            <For each={visibleFormats}>
              {(candidate) => (
                <button
                  classList={{ tab: true, on: candidate.id === formatId() }}
                  title={candidate.blurb}
                  onClick={() => pickFormat(candidate.id)}
                >
                  {candidate.label}
                </button>
              )}
            </For>
          </Show>
        </div>
      </header>

      <div class="layout">
        <aside class="sidebar">
          <SourcePanel
            format={format()}
            onLoaded={(loaded) => {
              setComments(loaded)
              setActiveTableId(null)
              setOverrides({})
            }}
          />

          <section class="panel">
            <header class="panel-head">
              <h2>Preferenze</h2>
              <span class="count">{preferences()}</span>
            </header>
            <input
              class="slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={preferences()}
              onInput={(event) => setPreferences(Number(event.currentTarget.value))}
            />
            <p class="hint">{format().blurb}</p>
          </section>

          <Show when={result()}>
            {(loaded) => (
              <section class="panel">
                <header class="panel-head">
                  <h2>Foto in gara</h2>
                  <span class="count">{loaded().photos.length}</span>
                </header>
                <ul class="photos">
                  <For each={loaded().photos}>
                    {(photo) => (
                      <li classList={{ hoverable: photo.thumbnail !== null }} {...photoHoverProps(photo)}>
                        <span class="photo-id">#{photo.id}</span>
                        {photo.author.name}
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </Show>
        </aside>

        <main class="content">
          <Show
            when={result()}
            fallback={
              <div class="placeholder">
                <h2>Nessuna discussione caricata</h2>
                <p>
                  Incolla il link della discussione Flickr e premi "Scarica commenti". In alternativa
                  incolla il testo del thread a mano, oppure carica l'esempio del formato{" "}
                  {format().label}.
                </p>
              </div>
            }
          >
            {(loaded) => (
              <>
                <div class="stats">
                  <div class="stat">
                    <span class="value">{loaded().stats.photos}</span>
                    <span class="label">foto</span>
                  </div>
                  <div class="stat">
                    <span class="value">{loaded().stats.voters}</span>
                    <span class="label">votanti</span>
                  </div>
                  <div class="stat">
                    <span class="value">{loaded().stats.selfVoters}</span>
                    <span class="label">autovoti</span>
                  </div>
                  <div classList={{ stat: true, bad: loaded().stats.ballotsWithErrors > 0 }}>
                    <span class="value">{loaded().stats.ballotsWithErrors}</span>
                    <span class="label">voti con errori</span>
                  </div>
                </div>

                <CommentsPanel
                  comments={loaded().comments}
                  overrides={overrides()}
                  onOverride={setOverride}
                  onReset={() => setOverrides({})}
                />

                <section class="panel">
                  <header class="panel-head">
                    <h2>Classifiche</h2>
                    <Show when={loaded().tables.length > 1}>
                      <div class="tabs">
                        <For each={loaded().tables}>
                          {(table) => (
                            <button
                              classList={{ tab: true, on: table.id === activeTable()?.id }}
                              onClick={() => setActiveTableId(table.id)}
                            >
                              {table.label}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </header>
                  <Show when={activeTable()}>
                    {(table) => (
                      <RankingTable table={table()} format={format()} showBreakdown={showBreakdown()} />
                    )}
                  </Show>
                </section>

                <IssuesPanel issues={loaded().issues} />

                <ReportPanel text={buildReport(loaded(), format(), preferences())} />
              </>
            )}
          </Show>
        </main>
      </div>
    </div>
  )
}
