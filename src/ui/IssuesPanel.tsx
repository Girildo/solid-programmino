import { For, Show } from "solid-js"
import type { Issue } from "../domain/types"

const GROUPS: { code: Issue["code"]; label: string }[] = [
  { code: "photoLinkWithoutId", label: "Foto senza numero" },
  { code: "duplicatePhotoId", label: "Numero usato due volte" },
  { code: "unknownPhotoId", label: "Voti a foto inesistenti" },
  { code: "duplicateVote", label: "Voti doppi" },
  { code: "ballotTooShort", label: "Preferenze mancanti" },
  { code: "ballotTooLong", label: "Preferenze in eccesso" },
  { code: "maxVotesPerPhoto", label: "Stessa foto votata troppe volte" },
  { code: "selfVote", label: "Autovoti" },
  { code: "didNotVote", label: "Non hanno votato" },
  { code: "everyPhotoAtZero", label: "Nessun punto assegnato" },
  { code: "sourceError", label: "Errori di lettura" },
]

type Props = {
  issues: Issue[]
}

export function IssuesPanel(props: Props) {
  const groups = () => {
    const named = GROUPS.map((group) => ({
      label: group.label,
      items: props.issues.filter((issue) => issue.code === group.code),
    }))

    // A rule added without a label here would otherwise vanish from the panel
    // while still counting, so anything unnamed falls through under its code.
    const labelled = new Set(GROUPS.map((group) => group.code))
    const rest = props.issues.filter((issue) => !labelled.has(issue.code))
    const unnamed = [...new Set(rest.map((issue) => issue.code))].map((code) => ({
      label: code,
      items: rest.filter((issue) => issue.code === code),
    }))

    return [...named, ...unnamed].filter((group) => group.items.length > 0)
  }

  return (
    <section class="panel">
      <header class="panel-head">
        <h2>Segnalazioni</h2>
        <Show when={props.issues.length > 0}>
          <span class="count">{props.issues.length}</span>
        </Show>
      </header>

      <Show when={props.issues.length > 0} fallback={<p class="ok">Nessun problema rilevato.</p>}>
        <For each={groups()}>
          {(group) => (
            <div class="issue-group">
              <h3 classList={{ error: group.items[0]!.severity === "error" }}>
                {group.label}
                <span class="count">{group.items.length}</span>
              </h3>
              <ul>
                <For each={group.items}>
                  {(issue) => (
                    <li classList={{ error: issue.severity === "error" }}>
                      {issue.message}
                      <Show when={issue.commentIndex}>
                        <span class="where">commento {issue.commentIndex}</span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
      </Show>
    </section>
  )
}
