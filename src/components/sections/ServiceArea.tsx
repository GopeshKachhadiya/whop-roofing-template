// Where the crews go. Towns are plotted from the yard by distance and compass
// bearing, so the map redraws itself from the config with no map tiles.
import { MapPin } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { site } from '#/config/site'
import { cx } from '#/lib/format'

const SIZE = 520
const CENTER = SIZE / 2
const EDGE = 214

type ZipResult = { zip: string; town: string | null } | null

export function ServiceArea() {
  const { area, company } = site
  const [zip, setZip] = useState('')
  const [result, setResult] = useState<ZipResult>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const inputId = useId()
  const scale = EDGE / area.radiusMiles

  const towns = useMemo(
    () =>
      area.towns.map((town) => {
        const angle = ((town.bearing - 90) * Math.PI) / 180
        const x = CENTER + Math.cos(angle) * town.miles * scale
        const y = CENTER + Math.sin(angle) * town.miles * scale
        // Names sit on the outward side of each dot so they never run back over the middle.
        return { ...town, x, y, labelLeft: x < CENTER - 6 }
      }),
    [area.towns, scale],
  )

  const check = (event: FormEvent) => {
    event.preventDefault()
    const value = zip.trim().slice(0, 5)
    if (!/^\d{5}$/.test(value)) {
      setResult({ zip: '', town: null })
      return
    }
    const town = area.towns.find((item) => (item.zips as readonly string[]).includes(value))
    setResult({ zip: value, town: town?.name ?? null })
  }

  const lit = hovered ?? result?.town ?? null

  return (
    <section id="area" className="py-20 lg:py-32" aria-labelledby="area-title">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
        <div>
          <h2 id="area-title" className="type-title">
            {area.headline}
          </h2>
          <p className="type-lede mt-4">{area.body}</p>

          <form onSubmit={check} className="mt-8" noValidate>
            <label htmlFor={inputId} className="field-label">
              Check your ZIP code
            </label>
            <div className="mt-2 flex max-w-sm gap-2">
              <input
                id={inputId}
                className="field-input"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder={company.zip}
                value={zip}
                onChange={(event) => {
                  setZip(event.target.value.replace(/\D/g, ''))
                  setResult(null)
                }}
                aria-describedby={`${inputId}-result`}
              />
              <button type="submit" className="btn btn-quiet flex-none">
                Check ZIP
              </button>
            </div>
            <p id={`${inputId}-result`} role="status" className="mt-3 min-h-[3.25rem] text-[0.9688rem]">
              {result === null ? null : result.zip === '' ? (
                <span className="field-error">Enter a 5-digit ZIP code.</span>
              ) : result.town ? (
                <span className="animate-panel block font-semibold text-ok">
                  Yes, we cover {result.zip} ({result.town}). Inspections are usually within two working days.
                </span>
              ) : (
                <span className="animate-panel block text-ink-soft">
                  {result.zip} is outside our usual area. Call{' '}
                  <a href={company.phoneHref} className="link">
                    {company.phone}
                  </a>{' '}
                  and we will tell you if a crew can get there.
                </span>
              )}
            </p>
          </form>

          <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
            {area.towns.map((town) => (
              <li key={town.name}>
                <button
                  type="button"
                  onMouseEnter={() => setHovered(town.name)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(town.name)}
                  onBlur={() => setHovered(null)}
                  className={cx(
                    'type-note min-h-8 border-0 bg-transparent p-0 transition-colors duration-150',
                    lit === town.name ? 'text-accent' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {town.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <figure className="m-0">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block h-auto w-full max-w-[34rem]" role="img" aria-labelledby="area-map-title">
            <title id="area-map-title">{`Map of towns served within ${area.radiusMiles} miles of ${company.city}: ${area.towns.map((town) => town.name).join(', ')}.`}</title>
            <circle cx={CENTER} cy={CENTER} r={EDGE} fill="var(--color-surface)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
            {area.rings.map((miles) => (
              <g key={miles}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={miles * scale}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeOpacity="0.55"
                  strokeWidth="1.25"
                  strokeDasharray="10 4"
                />
                <text x={CENTER + 5} y={CENTER + miles * scale + 15} className="type-note" fontSize="12" fill="var(--color-accent)">
                  {miles} mi
                </text>
              </g>
            ))}
            <line x1={CENTER} y1={CENTER - EDGE} x2={CENTER} y2={CENTER + EDGE} stroke="var(--color-line)" strokeWidth="1" />
            <line x1={CENTER - EDGE} y1={CENTER} x2={CENTER + EDGE} y2={CENTER} stroke="var(--color-line)" strokeWidth="1" />
            <text x={CENTER} y={CENTER - EDGE - 10} textAnchor="middle" className="type-note" fontSize="13" fill="var(--color-ink-soft)">
              N
            </text>

            {[...towns].sort((a, b) => b.miles - a.miles).map((town) => {
              const active = lit === town.name
              const home = town.miles === 0
              return (
                <g
                  key={town.name}
                  onMouseEnter={() => setHovered(town.name)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'default' }}
                >
                  {active && !home ? (
                    <line x1={CENTER} y1={CENTER} x2={town.x} y2={town.y} stroke="var(--color-accent)" strokeWidth="2" />
                  ) : null}
                  {home ? (
                    <rect x={town.x - 9} y={town.y - 9} width="18" height="18" fill="var(--color-brand)" stroke="var(--color-ink)" strokeWidth="2" transform={`rotate(45 ${town.x} ${town.y})`} />
                  ) : (
                    <circle
                      cx={town.x}
                      cy={town.y}
                      r={active ? 7.5 : 5}
                      fill={active ? 'var(--color-accent)' : 'var(--color-ink)'}
                      style={{ transition: 'r 160ms cubic-bezier(0.25, 1, 0.5, 1), fill 160ms' }}
                    />
                  )}
                  <text
                    x={home ? town.x : town.labelLeft ? town.x - 11 : town.x + 11}
                    y={home ? town.y - 20 : town.y + 4.5}
                    textAnchor={home ? 'middle' : town.labelLeft ? 'end' : 'start'}
                    fontSize={home ? 17 : 13.5}
                    fontWeight={home || active ? 750 : 600}
                    className={home ? undefined : 'type-note'}
                    fill={active ? 'var(--color-accent)' : 'var(--color-ink)'}
                    paintOrder="stroke"
                    stroke="var(--color-surface)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  >
                    {town.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <figcaption className="type-note mt-3 flex items-center justify-center gap-2 text-ink-soft">
            <MapPin aria-hidden="true" className="size-4" />
            Distances from our yard at {company.street}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
