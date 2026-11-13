// A small on-page log of the Whop pixel events this site fires.
// Hidden by default. Add ?pixel=debug to any URL to show it; it stays on for
// the browser tab until closed.
import { Activity, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TRACK_EVENT, trackedEvents } from '#/lib/track'
import type { TrackedEvent } from '#/lib/track'

const STORAGE_KEY = 'pixel-inspector'

export function PixelInspector() {
  const [enabled, setEnabled] = useState(false)
  const [events, setEvents] = useState<TrackedEvent[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let on = false
    try {
      const param = new URLSearchParams(window.location.search).get('pixel')
      if (param === 'debug') window.sessionStorage.setItem(STORAGE_KEY, '1')
      if (param === 'off') window.sessionStorage.removeItem(STORAGE_KEY)
      on = window.sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      on = new URLSearchParams(window.location.search).get('pixel') === 'debug'
    }
    setEnabled(on)
    if (!on) return
    setEvents([...trackedEvents()])
    const onTrack = (event: Event) => setEvents((current) => [...current, (event as CustomEvent<TrackedEvent>).detail])
    window.addEventListener(TRACK_EVENT, onTrack)
    return () => window.removeEventListener(TRACK_EVENT, onTrack)
  }, [])

  if (!enabled) return null

  const close = () => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage can be unavailable in private windows; closing still works.
    }
    setEnabled(false)
  }

  // Newest first, so the event that just fired is always in view.
  const newestFirst = [...events].reverse()

  return (
    <aside
      aria-label="Pixel events"
      className="fixed right-3 bottom-3 z-50 w-[min(19rem,calc(100vw-1.5rem))] rounded-[18px] border border-slate-line bg-slate text-on-slate shadow-[0_12px_40px_rgba(10,19,24,0.35)]"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <p className="type-note flex items-center gap-2 !text-[0.875rem]">
          <Activity aria-hidden="true" className="size-4 text-brand" />
          whop.track, {events.length + 1} sent
        </p>
        <div className="flex">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Collapse pixel events' : 'Expand pixel events'}
            className="flex size-8 items-center justify-center rounded-[12px] border-0 bg-transparent text-on-slate-soft hover:text-on-slate"
          >
            {open ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronUp aria-hidden="true" className="size-4" />}
          </button>
          <button type="button" onClick={close} aria-label="Close pixel events" className="flex size-8 items-center justify-center rounded-[12px] border-0 bg-transparent text-on-slate-soft hover:text-on-slate">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      {open ? (
        <ol className="m-0 max-h-44 list-none overflow-y-auto border-t border-slate-line p-0" aria-live="polite">
          {newestFirst.map((event, index) => (
            <li key={`${event.at}-${index}`} className="animate-panel border-b border-slate-line px-3 py-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-note !text-[0.875rem] text-brand">{event.name}</span>
                <span className="text-xs text-on-slate-soft">
                  {new Date(event.at).toLocaleTimeString('en-US', { hour12: false })}
                  {event.delivered ? ' sent' : ' not sent (no pixel here)'}
                </span>
              </div>
              {event.payload ? (
                <p className="mt-0.5 text-[0.6875rem] leading-snug break-all text-on-slate-soft">
                  {Object.entries(event.payload)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(', ')}
                </p>
              ) : null}
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="type-note !text-[0.875rem]">page</span>
            <span className="text-xs text-on-slate-soft">automatic, sent by Whop hosting</span>
          </li>
        </ol>
      ) : null}
    </aside>
  )
}
