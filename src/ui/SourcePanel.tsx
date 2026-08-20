import { For, Show, createSignal } from "solid-js"
import type { ContestFormat } from "../domain/format"
import type { ThreadComment } from "../domain/types"
import { fetchDiscussion } from "../sources/flickr"
import type { PasteStrategy } from "../sources/paste"
import { parsePastedThread } from "../sources/paste"

export type SourceMode = "paste" | "flickr"

type Props = {
  format: ContestFormat
  onLoaded: (comments: ThreadComment[]) => void
}

type Detection = {
  strategy: PasteStrategy
  authors: string[]
  total: number
}

const STRATEGY_LABEL: Record<PasteStrategy, string> = {
  json: "JSON delle API di Flickr",
  authors: "nomi degli autori",
  separators: "blocchi separati da ---",
  single: "un blocco solo",
}

const PLACEHOLDER = `Incolla qui la discussione, per esempio:

Marco Rossi
5 anni fa
Ecco la mia #1

Giulia Verdi
5 anni fa
#2 al tramonto`

export function SourcePanel(props: Props) {
  const [mode, setMode] = createSignal<SourceMode>("flickr")
  const [pasted, setPasted] = createSignal("")
  const [url, setUrl] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [detection, setDetection] = createSignal<Detection | null>(null)

  const loadPasted = (text: string) => {
    setError(null)
    const { comments, strategy } = parsePastedThread(text)
    if (comments.length === 0) {
      setDetection(null)
      setError("Non ho trovato nessun commento nel testo incollato")
      return
    }
    setDetection({
      strategy,
      total: comments.length,
      authors: comments.slice(0, 6).map((comment) => comment.author.name),
    })
    props.onLoaded(comments)
  }

  const loadFlickr = async () => {
    setError(null)
    setBusy(true)
    try {
      const comments = await fetchDiscussion(url())
      setDetection({
        strategy: "json",
        total: comments.length,
        authors: comments.slice(0, 6).map((comment) => comment.author.name),
      })
      props.onLoaded(comments)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitFlickr = (event: SubmitEvent) => {
    event.preventDefault()
    if (busy() || url().length === 0) return
    void loadFlickr()
  }

  const loadSample = () => {
    setMode("paste")
    setPasted(props.format.sample)
    loadPasted(props.format.sample)
  }

  const looksWrong = () => {
    const found = detection()
    return found !== null && found.total <= 1 && pasted().split("\n").length > 3
  }

  return (
    <section class="panel">
      <header class="panel-head">
        <h2>Sorgente</h2>
        <div class="tabs">
          <button classList={{ tab: true, on: mode() === "flickr" }} onClick={() => setMode("flickr")}>
            Flickr
          </button>
          <button classList={{ tab: true, on: mode() === "paste" }} onClick={() => setMode("paste")}>
            Incolla
          </button>
        </div>
      </header>

      <Show when={mode() === "paste"}>
        <textarea
          class="paste"
          spellcheck={false}
          placeholder={PLACEHOLDER}
          value={pasted()}
          onInput={(event) => setPasted(event.currentTarget.value)}
        />
        <p class="hint">
          Seleziona la discussione dal browser e incollala qui. Riconosco il nome dell'autore sopra
          l'orario, la forma <code>Nome says:</code>, i blocchi separati da <code>---</code> e il
          JSON delle API.
        </p>
        <div class="row">
          <button class="primary" onClick={() => loadPasted(pasted())}>
            Analizza
          </button>
          <button onClick={loadSample}>Carica esempio</button>
        </div>
      </Show>

      <Show when={mode() === "flickr"}>
        <form onSubmit={submitFlickr}>
          <input
            class="field"
            type="url"
            placeholder="https://www.flickr.com/groups/.../discuss/72157.../"
            value={url()}
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
          <p class="hint">
            Incolla il link della discussione, per esempio
            <code>flickr.com/groups/&lt;gruppo&gt;/discuss/&lt;numero&gt;/</code>. Se Flickr non
            risponde, copia il thread e usa la modalità Incolla.
          </p>
          <div class="row">
            <button class="primary" type="submit" disabled={busy() || url().length === 0}>
              {busy() ? "Scarico..." : "Scarica commenti"}
            </button>
          </div>
        </form>
      </Show>

      <Show when={detection()}>
        {(found) => (
          <div classList={{ detection: true, warn: looksWrong() }}>
            <strong>{found().total}</strong> commenti riconosciuti tramite{" "}
            {STRATEGY_LABEL[found().strategy]}.
            <ul class="authors">
              <For each={found().authors}>{(name) => <li>{name}</li>}</For>
              <Show when={found().total > found().authors.length}>
                <li class="more">+{found().total - found().authors.length}</li>
              </Show>
            </ul>
            <Show when={looksWrong()}>
              <p class="warn-text">
                Un commento solo: non ho riconosciuto dove finisce un autore e inizia il successivo.
                Separa i commenti con una riga di <code>---</code> e mettici sopra{" "}
                <code>@Nome</code>.
              </p>
            </Show>
          </div>
        )}
      </Show>

      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>
    </section>
  )
}
