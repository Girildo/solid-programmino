import type { Marker } from "../format"

/**
 * Comments that are program output rather than somebody's ballot.
 *
 * A finished contest usually has its result table sitting in the thread, and a
 * table full of photo numbers reads like a ballot to anything that only looks
 * for numbers. New reports exclude themselves by opening with the format's end
 * marker; these patterns catch the ones already posted, including the tables
 * the Java version produced.
 */
export const generatedOutput: Marker[] = [
  { linePattern: /^Foto #\d{1,3} di .+:\s*\d+ voti/i, scope: "comment" },
  { bodyContains: "Foto trovate:", scope: "comment" },
  { bodyContains: "Foto in gara:", scope: "comment" },
]
