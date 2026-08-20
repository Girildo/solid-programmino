import type { ContestFormat } from "../format"
import { generatedOutput } from "./generated"

const SAMPLE = `@Sonia Bianchi
Campionato: postate le foto, si vota fra una settimana.
---
@Marco Rossi
La mia <a href="https://flickr.com/photo/1"><img src="p1.jpg" /></a> #1
---
@Giulia Verdi
#2 in controluce
---
@Luca Neri
#3
---
@Anna Gialli
#4 finalmente sono riuscita a scattarla
---
@Paolo Blu
#5
---
@Elena Viola
#6
---
@Sonia Bianchi
Esempio di votazione:
T: #1
E: #2
O: #3
Tre preferenze per categoria.
---
@Marco Rossi
T: #3
T: #2
T: #6
E: #2
E: #4
E: #5
O: #6
O: #3
O: #2
---
@Giulia Verdi
T:#1
T:#3
T:#5
E:#3
E:#6
E:#1
O:#4
O:#1
O:#5
---
@Luca Neri
T: #2
T: #4
T: #1
E: #2
E: #6
E: #4
O: #2
O: #5
O: #6
---
@Anna Gialli
T: #3
T: #5
T: #2
E: #3
E: #1
E: #4
O: #3
O: #6
O: #1
---
@Sonia Bianchi
Risultato Finale in arrivo!`

/**
 * Three separate votes per preference, one per category. Every vote is worth
 * one point, so the general table is the sum of the three category tables.
 */
export const campionato: ContestFormat = {
  id: "cm",
  label: "Campionato",
  hidden: true,
  blurb: "Voto per categoria: T: #12 / E: #7 / O: #3",

  votingStarts: { linePattern: /^Esempio di votazione:?$/i, scope: "comment" },
  votingEnds: { bodyContains: "Risultato Finale", scope: "comment" },

  ignore: generatedOutput,

  photoIdPattern: /#\s?(\d{1,2})/,

  ballot: {
    kind: "categorical",
    categories: [
      { key: "T", label: "Tecnica" },
      { key: "E", label: "Espressività" },
      { key: "O", label: "Originalità" },
    ],
    linePattern: /^([TEO])\s*:?\s*#\s?(\d{1,2})$/i,
  },

  scoring: { kind: "flat", points: 1 },

  tables: [
    { id: "generale", label: "Classifica Generale", category: null },
    { id: "tecnica", label: "Tecnica", category: "T" },
    { id: "espressivita", label: "Espressività", category: "E" },
    { id: "originalita", label: "Originalità", category: "O" },
  ],

  rules: [
    { id: "photoLinkWithoutId", severity: "error" },
    { id: "duplicatePhotoId", severity: "warning" },
    { id: "unknownPhotoId", severity: "error" },
    { id: "duplicateVote", severity: "error" },
    { id: "ballotTooShort", severity: "error" },
    { id: "ballotTooLong", severity: "warning" },
    { id: "selfVote", severity: "warning" },
    { id: "didNotVote", severity: "warning" },
    { id: "everyPhotoAtZero", severity: "error" },
  ],

  defaultPreferences: 3,
  sample: SAMPLE,
}
