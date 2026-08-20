import type { ContestFormat } from "../format"
import { generatedOutput } from "./generated"

const SAMPLE = `nicoletta lindor
5 anni fa
Tema del contest: le stagioni

Alex Lawrence
5 anni fa
#01 Ottobre, la tua grande bellezza

Maulamb
5 anni fa
#02 Cala Novembre e le nebbie

fotomie2009
5 anni fa
#03 mentre la canto con la mia chitarra

Millie Cruz
5 anni fa
#04 This life of mine

AlessandroDM
5 anni fa
#05 Giugno, maturita' dell'anno

nicoletta lindor
5 anni fa
Come votare
seleziona una foto per ognuno dei seguenti criteri di valutazione:
Estetica e Originalita' = eo
Comunicazione Emozionale = ce
Interpretazione del Tema = it
Tecnica e Composizione = tc

Alex Lawrence
5 anni fa
eo #04
ce #02
it #05
tc #03

Maulamb
5 anni fa
eo #04
ce #04
it #01
tc #03

fotomie2009
5 anni fa
eo #01
ce #05
it #04
tc #02

Millie Cruz
5 anni fa
eo #03
ce #01
it #02
tc #05`

/**
 * The format the "Click the CONTEST" group runs today: one photo per criterion,
 * four criteria, and a cap of two mentions of the same photo per ballot.
 */
export const clickTheContest: ContestFormat = {
  id: "ctc",
  label: "Click the CONTEST",
  blurb: "Un voto per criterio: eo / ce / it / tc",

  votingStarts: { bodyContains: "Come votare", scope: "comment" },
  votingEnds: { bodyContains: "Risultato Finale", scope: "comment" },

  ignore: generatedOutput,

  photoIdPattern: /#\s?(\d{1,2})/,

  ballot: {
    kind: "categorical",
    categories: [
      { key: "eo", label: "Estetica e Originalità" },
      { key: "ce", label: "Comunicazione Emozionale" },
      { key: "it", label: "Interpretazione del Tema" },
      { key: "tc", label: "Tecnica e Composizione" },
    ],
    linePattern: /^(eo|ce|it|tc)\s*[:.-]?\s*#\s?(\d{1,2})$/i,
  },

  scoring: { kind: "flat", points: 1 },

  tables: [
    { id: "generale", label: "Classifica Generale", category: null },
    { id: "eo", label: "Estetica e Originalità", category: "eo" },
    { id: "ce", label: "Comunicazione Emozionale", category: "ce" },
    { id: "it", label: "Interpretazione del Tema", category: "it" },
    { id: "tc", label: "Tecnica e Composizione", category: "tc" },
  ],

  rules: [
    { id: "photoLinkWithoutId", severity: "error" },
    { id: "duplicatePhotoId", severity: "warning" },
    { id: "unknownPhotoId", severity: "error" },
    { id: "duplicateVote", severity: "error" },
    { id: "ballotTooShort", severity: "warning" },
    { id: "ballotTooLong", severity: "warning" },
    // The group rules cap this at two; the Java program never checked it, so it
    // is reported and left to the organiser rather than enforced.
    { id: "maxVotesPerPhoto", severity: "warning", limit: 2 },
    { id: "selfVote", severity: "warning" },
    { id: "didNotVote", severity: "warning" },
    { id: "everyPhotoAtZero", severity: "error" },
  ],

  defaultPreferences: 1,
  sample: SAMPLE,
}
