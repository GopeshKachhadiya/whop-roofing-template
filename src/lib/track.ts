// Whop pixel events.
//
// Whop hosting injects the pixel into every page, so `window.whop.track`
// exists before this code runs and page views are already counted. This
// wrapper adds our own events and mirrors each one to a DOM event so the
// on-page inspector (add ?pixel=debug to any URL) can show what fired.

export type TrackPayload = {
  value?: number
  currency?: string
  /** A stable ID so Whop counts a retried or repeated event once. */
  event_id?: string
  variant_id?: string
  product_id?: string
  [key: string]: unknown
}

export interface TrackedEvent {
  name: string
  payload: TrackPayload | undefined
  at: number
  /** False when the pixel was not on the page (local dev). */
  delivered: boolean
}

export const TRACK_EVENT = 'site:track'
const log: TrackedEvent[] = []

export function trackedEvents(): readonly TrackedEvent[] {
  return log
}

export function track(name: string, payload?: TrackPayload): void {
  if (typeof window === 'undefined') return
  const pixel = (window as unknown as { whop?: { track?: (name: string, payload?: TrackPayload) => void } }).whop
  let delivered = false
  try {
    if (pixel?.track) {
      pixel.track(name, payload)
      delivered = true
    }
  } catch {
    delivered = false
  }
  const entry: TrackedEvent = { name, payload, at: Date.now(), delivered }
  log.push(entry)
  window.dispatchEvent(new CustomEvent<TrackedEvent>(TRACK_EVENT, { detail: entry }))
}

const fired = new Set<string>()

/** Fire an event at most once per page load for a given key. */
export function trackOnce(key: string, name: string, payload?: TrackPayload): void {
  if (fired.has(key)) return
  fired.add(key)
  track(name, payload)
}
