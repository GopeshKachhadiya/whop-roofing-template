import { site } from '#/config/site'

function Gable() {
  return (
    <svg viewBox="0 0 24 24" className="mx-8 size-[0.6em] flex-none lg:mx-12" aria-hidden="true">
      <path d="M2 18 12 6l10 12" fill="none" stroke="var(--color-brand)" strokeWidth="4" strokeLinecap="square" />
    </svg>
  )
}

/** A strip of credentials sliding past. Decorative: the list also appears under Reviews. */
export function Marquee() {
  const row = site.trust.credentials.map((line) => (
    <span key={line} className="flex items-center whitespace-nowrap">
      {line}
      <Gable />
    </span>
  ))
  return (
    <div className="marquee-holder overflow-hidden border-y border-line py-5 lg:py-7" aria-hidden="true">
      <div className="marquee font-[family-name:var(--font-display)] text-[clamp(2rem,1.2rem+3.4vw,4.5rem)] leading-none font-medium tracking-[-0.045em] uppercase">
        <div className="flex">{row}</div>
        <div className="flex">{row}</div>
      </div>
    </div>
  )
}
