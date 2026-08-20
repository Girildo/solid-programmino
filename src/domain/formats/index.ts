import type { ContestFormat } from "../format"
import { soniaGallery } from "./soniaGallery"
import { campionato } from "./campionato"
import { clickTheContest } from "./clickTheContest"

/** Every format the engine can read, including the ones not offered any more. */
export const formats: ContestFormat[] = [clickTheContest, soniaGallery, campionato]

/** The formats the picker offers. */
export const visibleFormats: ContestFormat[] = formats.filter((format) => !format.hidden)

export function formatById(id: string): ContestFormat {
  const found = formats.find((f) => f.id === id)
  if (!found) throw new Error(`Formato sconosciuto: ${id}`)
  return found
}

export { soniaGallery, campionato, clickTheContest }
