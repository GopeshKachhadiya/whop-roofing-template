import { useEstimate } from '#/components/EstimateContext'
import { ScrollWords } from '#/components/ScrollWords'
import { site } from '#/config/site'

export function Financing() {
  const { openEstimate } = useEstimate()
  const { financing } = site
  return (
    <section id="financing" className="pt-24 pb-20 lg:pt-36 lg:pb-28" aria-label="Financing">
      <div className="shell">
        <ScrollWords as="h2" text={`${financing.headline} ${financing.headlineRest}`} className="type-title max-w-[62rem] uppercase lg:!text-[clamp(3rem,1.5rem+3.6vw,5.25rem)]" />
        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="type-lede max-w-xl !text-ink">{financing.body}</p>
            <button type="button" className="btn btn-primary mt-7" onClick={() => openEstimate('replacement')}>
              Get a price to finance
            </button>
          </div>
          <ul className="m-0 list-none border-t border-line-strong p-0">
            {financing.points.map((point) => (
              <li key={point} className="border-b border-line-strong py-4 text-[1.0625rem] font-semibold">
                {point}
              </li>
            ))}
            <li className="pt-4 text-sm text-ink-soft">Pay-over-time options are offered by third-party lenders at checkout and depend on approval.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
