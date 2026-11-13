import { site } from '#/config/site'

/** The gable mark and company name. */
export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 28 20" className="h-[1.125rem] w-[1.625rem] flex-none" aria-hidden="true">
        <path d="M2 18 14 4l12 14" fill="none" stroke="var(--color-brand)" strokeWidth="4" strokeLinecap="square" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-[0.9688rem] leading-none font-bold tracking-[0.02em] whitespace-nowrap uppercase">{site.company.name}</span>
    </span>
  )
}
