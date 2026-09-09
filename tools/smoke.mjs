import { JSDOM } from "jsdom"

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost/",
  pretendToBeVisual: true,
})

const w = dom.window
for (const key of [
  "window", "document", "navigator", "HTMLElement", "Element", "Node", "Event",
  "CustomEvent", "MouseEvent", "SVGElement", "localStorage", "getComputedStyle",
]) {
  // Node defines some of these globals itself, and navigator has no setter.
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? w : w[key],
    writable: true,
    configurable: true,
  })
}
globalThis.requestAnimationFrame = w.requestAnimationFrame.bind(w)

const { render } = await import("solid-js/web")
const { App } = await import("./smoke-out/app-bundle.mjs")

const CTC = `nicoletta lindor
5 anni fa
Tema: le stagioni

Alex Lawrence
5 anni fa
#01 Ottobre

Maulamb
5 anni fa
#02 Novembre

fotomie2009
5 anni fa
#03 con la chitarra

nicoletta lindor
5 anni fa
Come votare
seleziona una foto per ognuno dei criteri

Alex Lawrence
5 anni fa
eo #02
ce #03
it #02
tc #03

Maulamb
5 anni fa
eo #03
ce #03
it #01
tc #03`

const F = "Click the CONTEST"

const click = (label) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label)
    ?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }))

function clickHeader(label) {
  const th = [...document.querySelectorAll("table.ranking th")].find(
    (node) => node.textContent.trim().replace(/[^A-Za-z#]/g, "") === label,
  )
  th.dispatchEvent(new w.MouseEvent("click", { bubbles: true }))
}

function toggle(label) {
  const box = [...document.querySelectorAll("label.toggle")]
    .find((node) => node.textContent.replace(/\s+/g, " ").includes(label))
    .querySelector('input[type="checkbox"]')
  box.checked = !box.checked
  box.dispatchEvent(new w.Event("change", { bubbles: true }))
}

// jsdom has no PointerEvent, and pointerType is what the preview branches on.
function pointer(node, type, pointerType) {
  const event = new w.Event(type, { bubbles: true })
  event.pointerType = pointerType
  node.dispatchEvent(event)
}

function previewState() {
  const shown = document.querySelector(".photo-preview")
  if (!shown) return "nessuna"
  return shown.classList.contains("centred") ? "al centro" : "di fianco"
}

function autoLabel(index) {
  const row = [...document.querySelectorAll(".comments li")].find(
    (li) => li.querySelector(".idx").textContent.trim() === String(index),
  )
  return row.querySelector('select.role option[value=""]').textContent.trim()
}

function setRole(index, role) {
  const row = [...document.querySelectorAll(".comments li")].find(
    (li) => li.querySelector(".idx").textContent.trim() === String(index),
  )
  const select = row.querySelector("select.role")
  select.value = role
  select.dispatchEvent(new w.Event("change", { bubbles: true }))
}

async function scenario(name, { format, text, preferences, fix, extra }) {
  document.getElementById("root").innerHTML = ""
  w.localStorage.clear()
  const dispose = render(() => App(), document.getElementById("root"))

  click(format)
  click("Incolla")

  const ta = document.querySelector("textarea.paste")
  ta.value = text
  ta.dispatchEvent(new w.Event("input", { bubbles: true }))

  const slider = document.querySelector("input.slider")
  slider.value = String(preferences)
  slider.dispatchEvent(new w.Event("input", { bubbles: true }))

  click("Analizza")
  await new Promise((r) => setTimeout(r, 30))

  if (fix) {
    fix()
    await new Promise((r) => setTimeout(r, 30))
  }

  const body = document.body.textContent.replace(/\s+/g, " ")
  const detected = /(\d+) commenti riconosciuti tramite ([^.]+)\./.exec(body)
  const rows = [...document.querySelectorAll("table.ranking tbody tr")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()).join("/"),
  )
  const warnings = [...document.querySelectorAll(".issue-group h3")].map((h) =>
    h.textContent.trim().replace(/\s+/g, " "),
  )
  const report = document.querySelector("pre.report")?.textContent ?? ""
  const thumbs = [...document.querySelectorAll(".photos li.hoverable")].length
  console.log(`\n### ${name}  [${format}]`)
  console.log(`  rilevati: ${detected?.[1] ?? "-"} commenti tramite "${detected?.[2] ?? "-"}"`)
  console.log(`  classifica: ${rows.join("  ") || "(vuota)"}`)
  console.log(`  segnalazioni: ${warnings.join(", ") || "nessuna"}`)
  if (extra) extra({ report, thumbs, rows })
  dispose()
  return { report, thumbs, rows }
}

await scenario("Flickr moderno", { format: F, text: CTC.replace(/(\d+) anni fa/g, "$1 years ago"), preferences: 1 })
await scenario("Flickr classico", {
  format: F,
  text: CTC.replace(/^(.+)\n\d+ anni fa$/gm, "$1 says:"),
  preferences: 1,
})
await scenario("Flickr italiano", { format: F, text: CTC, preferences: 1 })
await scenario("blob senza separatori", {
  format: F,
  text: CTC.replace(/\n\d+ anni fa/g, ""),
  preferences: 1,
})
await scenario("quattro criteri + tetto di due voti", {
  format: F,
  text: CTC,
  preferences: 1,
})

const QUOTED_MARKER = CTC.replace(
  `Maulamb
5 anni fa
#02 Novembre`,
  `Maulamb
5 anni fa
#02 Novembre

Zoe
5 anni fa
quando arriva il Come votare?`,
)

await scenario("marcatore citato per sbaglio", {
  format: F,
  text: QUOTED_MARKER,
  preferences: 1,
})
// Comment 4 is the one the marker caught by mistake. Pinning it must not cost
// the format's own answer, or there is nothing left to compare the pin against.
await scenario("stesso thread, ruolo corretto a mano", {
  format: F,
  text: QUOTED_MARKER,
  preferences: 1,
  fix: () => {
    click("Mostra")
    setRole(4, "ignored")
  },
  extra: () => {
    console.log(`  commento 4 forzato a "Ignorato", ${autoLabel(4)}`)
  },
})

// A real submission carries Flickr markup, which is where thumbnails come from.
const WITH_MARKUP = CTC.replace(
  "#01 Ottobre",
  `#01 Ottobre <a href="https://www.flickr.com/photos/x/51187854398/"><img src="https://live.staticflickr.com/65535/51187854398_a_m.jpg" /></a>`,
)

const first = await scenario("submission con markup (miniature)", {
  format: F,
  text: WITH_MARKUP,
  preferences: 1,
  extra: ({ thumbs, report }) => {
    console.log(`  miniature disponibili: ${thumbs}`)
    console.log(`  report inizia con: ${JSON.stringify(report.split(/\r?\n/)[0])}`)

    const row = document.querySelector(".photos li.hoverable")
    pointer(row, "pointerenter", "mouse")
    const hovered = previewState()
    pointer(row, "pointerleave", "mouse")
    const left = previewState()

    // A touch device never sends those, so the tap has to stand on its own.
    pointer(row, "pointerup", "touch")
    const tapped = previewState()
    const backdrop = document.querySelector(".preview-backdrop")
    pointer(backdrop, "pointerup", "touch")
    const dismissed = previewState()

    console.log(`  mouse: passaggio ${hovered}, uscita ${left}`)
    console.log(`  tocco: tap ${tapped}, sfondo ${backdrop ? "presente" : "assente"}, chiusura ${dismissed}`)
  },
})

await scenario("thread + report incollato in coda", {
  format: F,
  text: `${WITH_MARKUP}

Organizzatore
5 anni fa
${first.report}`,
  preferences: 1,
})

// A result table left in the thread by the Java version, which has no
// self-excluding first line of its own.
const OLD_TABLE = `${CTC}

Mario Bertocchi
5 anni fa
Foto #3 di fotomie2009: 5 voti (EO:1|CE:2|IT:0|TC:2)
Foto #2 di Maulamb: 2 voti (EO:1|CE:0|IT:1|TC:0)
Foto #1 di Alex Lawrence: 1 voti (EO:0|CE:0|IT:1|TC:0)`

await scenario("vecchia tabella Java lasciata nel thread", {
  format: F,
  text: OLD_TABLE,
  preferences: 1,
})

// IT ranks these photos differently from the general table, so a no-op sort
// would be visible here rather than looking like success.
await scenario("ordinamento per categoria IT", {
  format: F,
  text: CTC,
  preferences: 1,
  fix: () => clickHeader("IT"),
})
await scenario("ordinamento per autore", {
  format: F,
  text: CTC,
  preferences: 1,
  fix: () => clickHeader("Autore"),
})

// fotomie2009 posts #03 and never votes, so the photo that would lead the
// table is exactly the one the option has to remove.
await scenario("senza gli autori che non hanno votato", {
  format: F,
  text: CTC,
  preferences: 1,
  fix: () => toggle("Escludi dalle classifiche"),
})

await scenario("azzeramento della sorgente", {
  format: F,
  text: CTC,
  preferences: 1,
  fix: () => {
    click("Flickr")
    const field = document.querySelector('input.field[type="url"]')
    field.value = "https://www.flickr.com/groups/clickthecontest/discuss/72157721925480241/"
    field.dispatchEvent(new w.Event("input", { bubbles: true }))
    click("Azzera")
  },
  extra: ({ rows }) => {
    const field = document.querySelector('input.field[type="url"]')
    console.log(`  campo link: ${JSON.stringify(field.value)}`)
    console.log(`  righe rimaste: ${rows.length}`)
  },
})

// Settings have to survive both a format round trip and a reload, and each
// format keeps its own count: switching used to reset the one you came from.
{
  const setSlider = (value) => {
    const slider = document.querySelector("input.slider")
    slider.value = String(value)
    slider.dispatchEvent(new w.Event("input", { bubbles: true }))
  }
  const count = () => document.querySelector("input.slider").value
  const mount = () => render(() => App(), document.getElementById("root"))

  document.getElementById("root").innerHTML = ""
  w.localStorage.clear()
  let dispose = mount()

  click(F)
  setSlider(4)
  click("Sonia Gallery")
  const onSg = count()
  setSlider(7)
  click(F)
  const backOnCtc = count()
  const saved = w.localStorage.getItem("programmino.prefs")
  dispose()

  // Same browser, next visit.
  document.getElementById("root").innerHTML = ""
  dispose = mount()
  const afterReload = count()
  click("Sonia Gallery")
  const sgAfterReload = count()

  console.log("\n### impostazioni ricordate")
  console.log(`  Click the CONTEST a 4, poi Sonia Gallery parte da ${onSg}`)
  console.log(`  tornando a Click the CONTEST: ${backOnCtc}`)
  console.log(`  dopo il riavvio: ${afterReload}, Sonia Gallery: ${sgAfterReload}`)
  console.log(`  in memoria: ${saved}`)

  // The ranking options only exist once a thread is on screen.
  const loadSample = async () => {
    click(F)
    click("Incolla")
    const ta = document.querySelector("textarea.paste")
    ta.value = CTC
    ta.dispatchEvent(new w.Event("input", { bubbles: true }))
    click("Analizza")
    await new Promise((r) => setTimeout(r, 30))
  }
  const switches = () =>
    [...document.querySelectorAll("label.toggle input")].map((box) => box.checked)

  await loadSample()
  toggle("classifica densa")
  toggle("Escludi dalle classifiche")
  const set = switches()
  dispose()

  document.getElementById("root").innerHTML = ""
  dispose = mount()
  await loadSample()
  console.log(`  interruttori: ${set} prima, ${switches()} dopo il riavvio`)
  dispose()
}

// The Flickr path with the network stubbed: checks the request Flickr actually
// needs, and that submitting the form loads a thread. jsdom does not implement
// implicit form submission, so the submit event stands in for the Enter key.
{
  const requested = []
  globalThis.fetch = async (input) => {
    requested.push(String(input))
    return {
      ok: true,
      json: async () => ({
        stat: "ok",
        replies: {
          // The subject arrives escaped, so it also proves entities are resolved.
          topic: { subject: "Click the CONTEST 42 &ndash; luci &amp; ombre", pages: 1, total: 6 },
          reply: [
            { author: "1@N01", authorname: "nicoletta lindor", message: { _content: "Tema del contest" } },
            { author: "2@N01", authorname: "Alex Lawrence", message: { _content: "#01 Ottobre" } },
            { author: "3@N01", authorname: "Maulamb", message: { _content: "#02 Novembre" } },
            { author: "1@N01", authorname: "nicoletta lindor", message: { _content: "Come votare" } },
            { author: "2@N01", authorname: "Alex Lawrence", message: { _content: "eo #02\nce #02\nit #01\ntc #01" } },
            { author: "3@N01", authorname: "Maulamb", message: { _content: "eo #01\nce #01\nit #02\ntc #02" } },
          ],
        },
      }),
    }
  }

  document.getElementById("root").innerHTML = ""
  w.localStorage.clear()
  const dispose = render(() => App(), document.getElementById("root"))

  const field = document.querySelector('input.field[type="url"]')
  field.value = "https://www.flickr.com/groups/clickthecontest/discuss/72157721925480241/"
  field.dispatchEvent(new w.Event("input", { bubbles: true }))
  field.closest("form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 50))

  const rows = [...document.querySelectorAll("table.ranking tbody tr")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()).join("/"),
  )
  const asked = (requested[0] ?? "").replace(/api_key=[^&]+/, "api_key=***")
  console.log("\n### invio nel campo Flickr (rete simulata)")
  console.log(`  richieste: ${requested.length}`)
  // Its own row in the layout grid, so the two columns still start level.
  const shown = document.querySelector(".layout > .thread-title")?.textContent ?? null
  console.log(`  titolo mostrato: ${JSON.stringify(shown)}`)
  console.log(`  group_id inviato: ${/group_id=([^&]+)/.exec(asked)?.[1] ?? "MANCANTE"}`)
  console.log(`  topic_id inviato: ${/topic_id=([^&]+)/.exec(asked)?.[1] ?? "MANCANTE"}`)
  console.log(`  classifica: ${rows.join("  ") || "(vuota)"}`)
  dispose()
}
