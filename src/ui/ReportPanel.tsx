import { createSignal } from "solid-js"

type Props = {
  text: string
}

export function ReportPanel(props: Props) {
  const [copied, setCopied] = createSignal(false)

  const copy = async () => {
    await navigator.clipboard.writeText(props.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section class="panel">
      <header class="panel-head">
        <h2>Da incollare nella discussione</h2>
        <button class="primary" onClick={copy}>
          {copied() ? "Copiato" : "Copia"}
        </button>
      </header>
      <pre class="report">{props.text}</pre>
    </section>
  )
}
