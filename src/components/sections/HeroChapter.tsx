// The opening of the page: a huge headline over a rounded panel holding the
// 3D house. Scrolling on lifts the roof apart while the six layers are
// explained one at a time.
import { Link } from '@tanstack/react-router'
import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEstimate } from '#/components/EstimateContext'
import { RoofDrawing, RoofStage } from '#/components/roof/RoofStage'
import { getOffer } from '#/config/offers'
import { site } from '#/config/site'
import { cx, money } from '#/lib/format'
import { skies, useLocalTime } from '#/lib/useLocalTime'

const LAYER_COUNT = site.layers.length
/** Share of the chapter spent lifting the roof apart before the first note. */
const LIFT_PORTION = 0.14
const PHASE_WORD = { morning: 'Morning', day: 'Afternoon', dusk: 'Evening', night: 'Night' }

/** "Do you come out to me?", asked from inside the 3D panel. */
function ZipPill() {
  const [zip, setZip] = useState('')
  const [reply, setReply] = useState(`Where's the roof? Type your ZIP and we'll tell you if we cover it.`)

  const check = (event: FormEvent) => {
    event.preventDefault()
    const value = zip.trim()
    if (!/^\d{5}$/.test(value)) {
      setReply('That needs a 5-digit ZIP code.')
      return
    }
    const town = site.area.towns.find((item) => (item.zips as readonly string[]).includes(value))
    setReply(
      town
        ? `Yes, ${value} is ${town.name}. An inspector can usually be there within two working days.`
        : `${value} is outside our usual area. Call ${site.company.phone} and we'll check.`,
    )
  }

  return (
    <form onSubmit={check} className="flex w-[min(25rem,calc(100%-2rem))] flex-col items-center gap-2.5" noValidate>
      <p key={reply} role="status" className="animate-panel rounded-2xl bg-[#f7f6f0] px-4 py-2.5 text-center text-[0.9375rem] leading-snug font-medium text-[#0d0d0c] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        {reply}
      </p>
      <div className="flex w-full items-center rounded-full bg-[#f7f6f0] p-1.5 pl-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <label htmlFor="hero-zip" className="sr-only">
          ZIP code
        </label>
        <input
          id="hero-zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="ZIP code"
          value={zip}
          onChange={(event) => setZip(event.target.value.replace(/\D/g, ''))}
          className="min-w-0 flex-1 border-0 bg-transparent text-[1rem] text-[#0d0d0c] outline-none placeholder:text-[#5b5a54]"
        />
        <button type="submit" className="min-h-10 flex-none rounded-full bg-brand px-4 text-[0.9375rem] font-bold text-on-brand transition-colors duration-150 hover:bg-[#ff5a1f]">
          Check ZIP
        </button>
      </div>
    </form>
  )
}

export function HeroChapter() {
  const chapter = useRef<HTMLDivElement>(null)
  const zipHolder = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const active = useRef(-1)
  const [current, setCurrent] = useState(-1)
  const { openEstimate } = useEstimate()
  const inspection = getOffer('inspection')
  const time = useLocalTime()
  const phase = time?.phase ?? 'dusk'

  useEffect(() => {
    const measure = () => {
      const node = chapter.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const travel = Math.max(rect.height - window.innerHeight, 1)
      // Start lifting a little before the chapter pins, so the hero hands over.
      const scrolled = Math.min(1, Math.max(0, (window.innerHeight * 0.35 - rect.top) / (travel + window.innerHeight * 0.35)))
      progress.current = Math.min(1, scrolled / LIFT_PORTION)
      const zip = zipHolder.current
      if (zip) {
        const visible = Math.max(0, 1 - progress.current * 3)
        zip.style.opacity = String(visible)
        zip.style.visibility = visible === 0 ? 'hidden' : 'visible'
      }
      const index =
        scrolled < LIFT_PORTION ? -1 : Math.min(LAYER_COUNT - 1, Math.floor(((scrolled - LIFT_PORTION) / (1 - LIFT_PORTION)) * LAYER_COUNT))
      if (index !== active.current) {
        active.current = index
        setCurrent(index)
      }
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  const jumpTo = (index: number) => {
    const node = chapter.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const travel = rect.height - window.innerHeight + window.innerHeight * 0.35
    const target = LIFT_PORTION + ((index + 0.5) / LAYER_COUNT) * (1 - LIFT_PORTION)
    const top = window.scrollY + rect.top - window.innerHeight * 0.35 + travel * target
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const shown = Math.max(current, 0)
  const layer = site.layers[shown]

  return (
    <section id="top" className="relative" aria-labelledby="hero-title">
      {/* The pinned panel: top of the screen on phones, right side on desktop. */}
      <div className="pointer-events-none sticky top-0 z-20 h-[calc(42svh+5rem)] bg-page px-3 pt-20 pb-2 lg:z-0 lg:h-svh lg:bg-transparent lg:pb-3 lg:pl-[44%]">
        <div className="relative h-full overflow-hidden rounded-[28px]" style={{ background: skies[phase] }}>
          {/* Wait for the clock so the scene is only built once, with the right light. */}
          {time ? <RoofStage progress={progress} active={active} layers={site.layers} night={phase === 'night'} /> : <RoofDrawing />}

          {time ? (
            <p className="type-note animate-panel absolute top-4 right-4 flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 px-3.5 py-2 text-[#eeece7] backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
              <span>{time.clock}</span>
              <span className="text-[#eeece7]/75">
                {PHASE_WORD[time.phase]} in {site.company.city}
              </span>
            </p>
          ) : null}

          <div ref={zipHolder} className="pointer-events-auto absolute inset-x-0 bottom-5 hidden justify-center transition-opacity duration-200 lg:flex">
            <ZipPill />
          </div>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 -mt-[calc(42svh+5rem)] lg:-mt-[100svh]">
        <div className="shell flex min-h-svh flex-col justify-end pt-[calc(42svh+6.5rem)] pb-10 lg:justify-center lg:pt-24 lg:pb-8">
          <div className="pointer-events-auto w-fit">
            <p className="tag animate-rise mb-5">{site.hero.tag}</p>
            <h1 id="hero-title" className="type-display" aria-label={site.hero.headlineLines.join(' ')}>
              {site.hero.headlineLines.map((line, index) => (
                <span key={line} className="line-mask" style={{ paddingLeft: index % 2 ? '0.62em' : 0 }} aria-hidden="true">
                  <span style={{ animationDelay: `${120 + index * 90}ms` }}>{line}</span>
                </span>
              ))}
            </h1>
          </div>

          <div className="pointer-events-auto mt-7 lg:max-w-[38%]">
            <p className="type-lede animate-rise !text-[#d9d6cf] [animation-delay:520ms]">{site.hero.lede}</p>

            <div className="animate-rise mt-6 flex flex-col gap-3 sm:flex-row [animation-delay:620ms]">
              <button type="button" className="btn btn-primary" onClick={() => openEstimate()}>
                Request an estimate
              </button>
              {inspection?.price ? (
                <Link to="/checkout/$offer" params={{ offer: 'inspection' }} className="btn btn-quiet">
                  Book an inspection, {money(inspection.price)}
                </Link>
              ) : null}
            </div>

            <p className="type-note animate-rise mt-6 flex items-center gap-2 text-ink-soft [animation-delay:720ms]">
              <Star aria-hidden="true" className="size-3.5 fill-brand text-brand" strokeWidth={1.5} />
              {site.trust.rating} from {site.trust.reviewCount} homeowners, {site.hero.proof[0].value} {site.hero.proof[0].label}
            </p>
          </div>
        </div>

        {/* Six layers. The outer block is tall; the inner one stays pinned
            while scroll position picks the layer. */}
        <div ref={chapter} id="layers" className="h-[260svh] lg:h-[300svh]">
          <div className="shell sticky top-[calc(42svh+5rem)] flex h-[calc(58svh-5rem)] flex-col justify-center py-5 lg:top-0 lg:h-svh lg:pt-20 lg:pb-6">
            <div className="pointer-events-auto lg:max-w-[38%]">
              <h2 className="type-title hidden !text-[clamp(2.5rem,1.5rem+2.4vw,4rem)] lg:block">What goes on your house</h2>
              <p className="type-lede mt-4 hidden lg:block">Most leaks start under the shingles. So that is where an honest estimate starts too.</p>

              {/* Wide screens: the whole list, with the current layer open. */}
              <ol className="m-0 mt-7 hidden list-none p-0 lg:block">
                {site.layers.map((item, index) => {
                  const open = index === current
                  return (
                    <li key={item.key} className="border-t border-line last:border-b">
                      <button
                        type="button"
                        onClick={() => jumpTo(index)}
                        aria-expanded={open}
                        className={cx(
                          'flex w-full items-center gap-4 border-0 bg-transparent py-3 text-left transition-colors duration-200',
                          open ? 'text-ink' : 'text-ink-soft hover:text-ink',
                        )}
                      >
                        <span className={cx('size-2 flex-none rounded-full transition-colors duration-200', open ? 'bg-brand' : 'bg-line-strong')} aria-hidden="true" />
                        <span className="type-heading !text-[1.1875rem]">{item.name}</span>
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quart)]"
                        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                      >
                        <p className="overflow-hidden pl-6 text-[1rem] text-ink-soft">
                          <span className="block pb-4">{item.note}</span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              {/* Phones: one layer at a time under the pinned panel. */}
              <div className="lg:hidden" aria-live="polite">
                <p className="type-note text-accent">
                  Layer {shown + 1} of {LAYER_COUNT}
                </p>
                <h2 key={layer.key} className="type-heading animate-panel mt-2 !text-[1.625rem]">
                  {layer.name}
                </h2>
                <p key={`${layer.key}-note`} className="animate-panel mt-3 text-ink-soft">
                  {layer.note}
                </p>
                <div className="mt-5 flex gap-1.5" aria-hidden="true">
                  {site.layers.map((item, index) => (
                    <span key={item.key} className={cx('h-1 flex-1 rounded-full transition-colors duration-300', index <= shown && current >= 0 ? 'bg-brand' : 'bg-line')} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
