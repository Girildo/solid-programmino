import { Show, createSignal } from "solid-js"
import type { Photo } from "../domain/types"

/**
 * Where the preview sits: beside the row a pointer is hovering, or centred
 * when a tap opened it, since a finger covers the row it came from.
 */
type Preview =
  | { src: string; centred: true }
  | { src: string; centred: false; x: number; y: number }

/**
 * One floating preview at a time, shared by every list that shows photos.
 *
 * It is positioned fixed rather than nested in the hovered row because the
 * lists it serves scroll, and an absolutely placed popup would be clipped.
 */
const [preview, setPreview] = createSignal<Preview | null>(null)

const MARGIN = 16
const WIDTH = 300

function beside(target: HTMLElement, src: string): Preview {
  const box = target.getBoundingClientRect()
  const x = Math.min(box.right + MARGIN, window.innerWidth - WIDTH - MARGIN)
  const y = Math.min(box.top, window.innerHeight - WIDTH - MARGIN)
  return { src, centred: false, x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) }
}

function placement(shown: Preview): Record<string, string> {
  return shown.centred
    ? { left: "50%", top: "50%" }
    : { left: `${shown.x}px`, top: `${shown.y}px` }
}

export function photoPreviewProps(photo: Photo) {
  if (!photo.thumbnail) return {}
  const src = photo.thumbnail
  return {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        setPreview(beside(event.currentTarget as HTMLElement, src))
      }
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === "mouse") setPreview(null)
    },
    // A tap leaves nothing hovering, so it opens a preview that stays until it
    // is dismissed. Scrolling the list cancels the pointer and never gets here.
    onPointerUp: (event: PointerEvent) => {
      if (event.pointerType !== "mouse") setPreview({ src, centred: true })
    },
  }
}

export function PhotoPreviewLayer() {
  return (
    <Show when={preview()}>
      {(shown) => (
        <>
          {/* Dismisses the tapped preview, and stops the tap under it from
              opening another one straight away. */}
          <Show when={shown().centred}>
            <div class="preview-backdrop" onPointerUp={() => setPreview(null)} />
          </Show>
          <img
            classList={{ "photo-preview": true, centred: shown().centred }}
            src={shown().src}
            alt=""
            style={placement(shown())}
          />
        </>
      )}
    </Show>
  )
}
