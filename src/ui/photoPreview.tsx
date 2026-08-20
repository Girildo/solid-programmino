import { Show, createSignal } from "solid-js"
import type { Photo } from "../domain/types"

type Preview = { src: string; x: number; y: number }

/**
 * One floating preview at a time, shared by every list that shows photos.
 *
 * It is positioned fixed rather than nested in the hovered row because the
 * lists it serves scroll, and an absolutely placed popup would be clipped.
 */
const [preview, setPreview] = createSignal<Preview | null>(null)

const MARGIN = 16
const WIDTH = 240

export function photoHoverProps(photo: Photo) {
  if (!photo.thumbnail) return {}
  const src = photo.thumbnail
  return {
    onMouseEnter: (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement
      const box = target.getBoundingClientRect()
      const x = Math.min(box.right + MARGIN, window.innerWidth - WIDTH - MARGIN)
      const y = Math.min(box.top, window.innerHeight - WIDTH - MARGIN)
      setPreview({ src, x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) })
    },
    onMouseLeave: () => setPreview(null),
  }
}

export function PhotoPreviewLayer() {
  return (
    <Show when={preview()}>
      {(shown) => (
        <img
          class="photo-preview"
          src={shown().src}
          alt=""
          style={{ left: `${shown().x}px`, top: `${shown().y}px` }}
        />
      )}
    </Show>
  )
}
