import type { ContestFormat } from "../format"
import { generatedOutput } from "./generated"

const SAMPLE = `@Sonia Bianchi
Benvenuti alla gara di questo mese! Postate le vostre foto qui sotto.
---
@Marco Rossi
Ecco la mia <a href="https://flickr.com/photo/1"><img src="p1.jpg" /></a> #1
---
@Giulia Verdi
#2 scattata al tramonto sul molo
---
@Luca Neri
#3
---
@Anna Gialli
La mia foto di questo mese #4
---
@Paolo Blu
#5
---
@Elena Viola
#6 grazie a tutti
---
@Sonia Bianchi
##########
Si vota! Cinque preferenze in ordine, dalla migliore alla peggiore.
---
@Marco Rossi
#2#3#5#4#6
---
@Giulia Verdi
#3#1#6#5#4
---
@Luca Neri
#2#6#1#4#5
---
@Anna Gialli
#3#2#4#6#1
---
@Paolo Blu
#5#3#2#6#1
---
@Sonia Bianchi
Stop Voting
Grazie a tutti, ci vediamo il mese prossimo.`

/**
 * One ordered run of ids per voter, best first. The first preference is worth
 * as many points as there are preferences, the last one is worth 1.
 */
export const soniaGallery: ContestFormat = {
  id: "sg",
  label: "Sonia Gallery",
  hidden: true,
  blurb: "Voto a preferenze ordinate: #3#7#12",

  votingStarts: { linePattern: /^#{6,}$/, scope: "comment" },
  votingEnds: { bodyContains: "Stop Voting", scope: "rest" },

  ignore: generatedOutput,

  photoIdPattern: /#\s?(\d{1,2})/,

  ballot: {
    kind: "ranked",
    linePattern: /^(?:#\s?\d{1,2}\s*)+$/,
    idPattern: /#\s?(\d{1,2})/g,
  },

  scoring: { kind: "positional" },

  tables: [{ id: "generale", label: "Classifica Generale", category: null }],

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

  defaultPreferences: 5,
  sample: SAMPLE,
}
