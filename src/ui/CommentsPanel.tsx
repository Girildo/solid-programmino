import { For, Show, createMemo, createSignal } from "solid-js"
import type { ClassifiedComment, CommentRole, RoleOverrides } from "../domain/types"

const ROLE_LABEL: Record<CommentRole, string> = {
  submission: "Foto",
  ballot: "Voto",
  votingStart: "Inizio voto",
  ignored: "Ignorato",
}

const CHOICES: CommentRole[] = ["submission", "ballot", "votingStart", "ignored"]

type Props = {
  comments: ClassifiedComment[]
  overrides: RoleOverrides
  onOverride: (index: number, role: CommentRole | null) => void
  onReset: () => void
}

export function CommentsPanel(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [onlyForced, setOnlyForced] = createSignal(false)

  const forcedCount = createMemo(() => Object.keys(props.overrides).length)
  const visible = createMemo(() =>
    onlyForced() ? props.comments.filter((comment) => comment.overridden) : props.comments,
  )

  const preview = (comment: ClassifiedComment) => {
    const flat = comment.text.replace(/\s+/g, " ").trim()
    return flat.length > 90 ? `${flat.slice(0, 90)}...` : flat || "(vuoto)"
  }

  return (
    <section class="panel">
      <header class="panel-head">
        <h2>Commenti</h2>
        <div class="row-inline">
          <Show when={forcedCount() > 0}>
            <span class="count forced">{forcedCount()} forzati</span>
            <button onClick={props.onReset}>Azzera</button>
          </Show>
          <button onClick={() => setOpen(!open())}>{open() ? "Nascondi" : "Mostra"}</button>
        </div>
      </header>

      <Show
        when={open()}
        fallback={
          <p class="hint">
            {props.comments.length} commenti letti. Aprili per correggere a mano il ruolo di uno di
            loro, quando un marcatore scatta dove non deve.
          </p>
        }
      >
        <Show when={forcedCount() > 0}>
          <label class="toggle">
            <input
              type="checkbox"
              checked={onlyForced()}
              onChange={(event) => setOnlyForced(event.currentTarget.checked)}
            />
            Mostra solo quelli forzati
          </label>
        </Show>

        <ul class="comments">
          <For each={visible()}>
            {(comment) => (
              <li classList={{ forced: comment.overridden, [`role-${comment.role}`]: true }}>
                <span class="idx">{comment.index}</span>
                <div class="who">
                  <strong>{comment.author.name}</strong>
                  <span class="preview">{preview(comment)}</span>
                </div>
                <select
                  class="role"
                  value={props.overrides[comment.index] ?? ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    props.onOverride(comment.index, value === "" ? null : (value as CommentRole))
                  }}
                >
                  <option value="">auto: {ROLE_LABEL[comment.autoRole]}</option>
                  <For each={CHOICES}>
                    {(role) => <option value={role}>{ROLE_LABEL[role]}</option>}
                  </For>
                </select>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
