import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { categoriesOf } from "./domain/format";
import { formatById, visibleFormats } from "./domain/formats";
import { buildReport } from "./domain/engine/report";
import type { RankCountingStrategy } from "./domain/engine/tally";
import { tally } from "./domain/engine/tally";
import type { CommentRole, RoleOverrides, ThreadComment } from "./domain/types";
import { CommentsPanel } from "./ui/CommentsPanel";
import { IssuesPanel } from "./ui/IssuesPanel";
import { PhotoPreviewLayer, photoPreviewProps } from "./ui/photoPreview";
import { RankingTable } from "./ui/RankingTable";
import { ReportPanel } from "./ui/ReportPanel";
import { SourcePanel } from "./ui/SourcePanel";

const STORAGE_KEY = "programmino.prefs";

/** The settings that outlive a visit. The thread itself deliberately does not. */
type StoredPrefs = {
  formatId: string;
  /** How many preferences each format was last run with, keyed by format id. */
  preferences: Record<string, number>;
  rankCountingStrategy: RankCountingStrategy;
  excludeNonVoters: boolean;
};

/** What the slider can produce, and so what may come back out of storage. */
const PREFERENCES = { min: 1, max: 10 };

const DEFAULT_FORMAT = visibleFormats[0]!;

/**
 * The stored counts, without whatever else may be sitting under that key.
 * A number rather than a map is the older single-format shape.
 */
function storedCounts(value: unknown, formatId: string): Record<string, number> {
  const raw =
    typeof value === "number"
      ? { [formatId]: value }
      : typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : {};

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([, count]) =>
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= PREFERENCES.min &&
        count <= PREFERENCES.max,
    ),
  ) as Record<string, number>;
}

function loadPrefs(): StoredPrefs {
  const fallback: StoredPrefs = {
    formatId: DEFAULT_FORMAT.id,
    preferences: {},
    rankCountingStrategy: "standard",
    excludeNonVoters: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Partial<StoredPrefs>;

    // A format that is no longer offered must not stay selected from last time.
    const offered = visibleFormats.some(
      (format) => format.id === stored.formatId,
    );
    const formatId =
      offered && stored.formatId ? stored.formatId : fallback.formatId;

    return {
      formatId,
      preferences: storedCounts(stored.preferences, formatId),
      rankCountingStrategy:
        stored.rankCountingStrategy === "dense" ? "dense" : "standard",
      excludeNonVoters: stored.excludeNonVoters === true,
    };
  } catch {
    return fallback;
  }
}

export function App() {
  const initial = loadPrefs();

  const [formatId, setFormatId] = createSignal(initial.formatId);
  const [counts, setCounts] = createSignal(initial.preferences);
  const [comments, setComments] = createSignal<ThreadComment[]>([]);
  const [title, setTitle] = createSignal<string | null>(null);
  const [activeTableId, setActiveTableId] = createSignal<string | null>(null);
  const [rankCountingStrategy, setRankCountingStrategy] =
    createSignal<RankCountingStrategy>(initial.rankCountingStrategy);
  const [excludeNonVoters, setExcludeNonVoters] = createSignal(
    initial.excludeNonVoters,
  );
  const [overrides, setOverrides] = createSignal<RoleOverrides>({});

  const format = createMemo(() => formatById(formatId()));

  // The count belongs to the contest rather than to the session, so switching
  // format brings back the number that format was last run with instead of
  // carrying one across, or resetting the other format's number to a default.
  const preferences = () => counts()[formatId()] ?? format().defaultPreferences;
  const setPreferences = (value: number) =>
    setCounts((current) => ({ ...current, [formatId()]: value }));

  const result = createMemo(() =>
    comments().length > 0
      ? tally(
          comments(),
          format(),
          preferences(),
          {
            rankCountingStrategy: rankCountingStrategy(),
            excludeNonVoters: excludeNonVoters(),
          },
          overrides(),
        )
      : null,
  );

  const loadThread = (loaded: ThreadComment[], loadedTitle: string | null) => {
    setComments(loaded);
    setTitle(loadedTitle);
    setActiveTableId(null);
    setOverrides({});
  };

  const setOverride = (index: number, role: CommentRole | null) => {
    setOverrides((current) => {
      const next = { ...current };
      if (role) next[index] = role;
      else delete next[index];
      return next;
    });
  };
  const activeTable = createMemo(() => {
    const tables = result()?.tables ?? [];
    return (
      tables.find((table) => table.id === activeTableId()) ?? tables[0] ?? null
    );
  });
  const showBreakdown = createMemo(() => {
    const table = activeTable();
    if (!table || categoriesOf(format()).length === 0) return false;
    return (
      format().tables.find((spec) => spec.id === table.id)?.category === null
    );
  });

  createEffect(() => {
    const prefs: StoredPrefs = {
      formatId: formatId(),
      preferences: counts(),
      rankCountingStrategy: rankCountingStrategy(),
      excludeNonVoters: excludeNonVoters(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // A browser that refuses to store them still runs the spoglio.
    }
  });

  const pickFormat = (id: string) => {
    setFormatId(id);
    setActiveTableId(null);
  };

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
        <Show when={title()}>
          {(subject) => <h2 class="thread-title">{subject()}</h2>}
        </Show>

        <aside class="sidebar">
          <SourcePanel
            format={format()}
            onLoaded={loadThread}
            onReset={() => loadThread([], null)}
          />

          <section class="panel">
            <header class="panel-head">
              <h2>Preferenze</h2>
              <span class="count">{preferences()}</span>
            </header>
            <input
              class="slider"
              type="range"
              min={PREFERENCES.min}
              max={PREFERENCES.max}
              step={1}
              value={preferences()}
              onInput={(event) =>
                setPreferences(Number(event.currentTarget.value))
              }
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
                      <li
                        classList={{ hoverable: photo.thumbnail !== null }}
                        {...photoPreviewProps(photo)}
                      >
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
                  Incolla il link della discussione Flickr e premi "Scarica
                  commenti". In alternativa incolla il testo del thread a mano,
                  oppure carica l'esempio del formato {format().label}.
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
                  <div
                    classList={{
                      stat: true,
                      bad: loaded().stats.ballotsWithErrors > 0,
                    }}
                  >
                    <span class="value">
                      {loaded().stats.ballotsWithErrors}
                    </span>
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
                    <h2>Opzioni di classifica</h2>
                  </header>
                  <label class="toggle">
                    <input
                      type="checkbox"
                      checked={rankCountingStrategy() === "dense"}
                      onChange={(event) =>
                        setRankCountingStrategy(
                          event.currentTarget.checked ? "dense" : "standard",
                        )
                      }
                    />
                    Usa sistema di classifica densa (non lascia spazi tra i pari
                    merito)
                  </label>
                  <label class="toggle">
                    <input
                      type="checkbox"
                      checked={excludeNonVoters()}
                      onChange={(event) =>
                        setExcludeNonVoters(event.currentTarget.checked)
                      }
                    />
                    Escludi dalle classifiche gli autori che non hanno votato
                  </label>
                </section>

                <section class="panel">
                  <header class="panel-head">
                    <h2>Classifiche</h2>
                    <Show when={loaded().tables.length > 1}>
                      <div class="tabs">
                        <For each={loaded().tables}>
                          {(table) => (
                            <button
                              classList={{
                                tab: true,
                                on: table.id === activeTable()?.id,
                              }}
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
                      <RankingTable
                        table={table()}
                        format={format()}
                        showBreakdown={showBreakdown()}
                      />
                    )}
                  </Show>
                </section>

                <IssuesPanel issues={loaded().issues} />

                <ReportPanel
                  text={buildReport(loaded(), format(), preferences())}
                />
              </>
            )}
          </Show>
        </main>
      </div>
    </div>
  );
}
