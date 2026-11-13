// Repair, replacement, inspection. Picking a service shows what the crew
// does, what it costs and the one next step for it.
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useEstimate } from '#/components/EstimateContext'
import { getOffer } from '#/config/offers'
import { site } from '#/config/site'
import type { Service } from '#/config/site'
import { cx, money } from '#/lib/format'
import { trackOnce } from '#/lib/track'

function announce(serviceKey: string) {
  const service = site.services.find((item) => item.key === serviceKey)
  if (!service) return
  const offer = getOffer(service.offerKey)
  const product = { variant_id: offer?.planId ?? undefined, product_id: offer?.productId ?? undefined }
  const price = offer?.price != null ? { value: offer.price, currency: offer.currency.toUpperCase() } : {}
  // Our own event, plus the standard one ad platforms match sales against.
  trackOnce(`service:${service.key}`, 'service_viewed', { service: service.key, ...product, ...price })
  trackOnce(`view:${service.key}`, 'view_content', { ...product, ...price })
}

export function Services() {
  const [selected, setSelected] = useState<string>(site.services[0].key)
  const section = useRef<HTMLElement>(null)
  const seen = useRef(false)
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { openEstimate } = useEstimate()

  // The first service counts as viewed once the section is actually on screen.
  useEffect(() => {
    const node = section.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seen.current = true
          announce(selected)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (key: string) => {
    setSelected(key)
    if (seen.current) announce(key)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = site.services.map((item) => item.key)
    const index = keys.indexOf(selected)
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % keys.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + keys.length) % keys.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = keys.length - 1
    else return
    event.preventDefault()
    choose(keys[next])
    tabs.current[keys[next]]?.focus()
  }

  const service: Service = site.services.find((item) => item.key === selected) ?? site.services[0]
  const offer = getOffer(service.offerKey)
  const deposit = getOffer('deposit')

  return (
    <section ref={section} id="services" className="pb-10 lg:pb-16" aria-labelledby="services-title">
      <div className="shell">
        <h2 id="services-title" className="sr-only">
          Services
        </h2>

        <div className="theme-bone overflow-hidden rounded-[28px]">
          <div role="tablist" aria-label="Services" className="flex overflow-x-auto border-b border-line">
            {site.services.map((item) => {
              const isSelected = item.key === selected
              return (
                <button
                  key={item.key}
                  ref={(node) => {
                    tabs.current[item.key] = node
                  }}
                  role="tab"
                  type="button"
                  id={`service-tab-${item.key}`}
                  aria-selected={isSelected}
                  aria-controls="service-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => choose(item.key)}
                  onKeyDown={onKeyDown}
                  className={cx(
                    'relative min-h-16 flex-1 border-0 bg-transparent px-5 whitespace-nowrap transition-colors duration-200 lg:min-h-20',
                    isSelected ? 'text-on-brand' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {isSelected ? (
                    <motion.span layoutId="service-tab" className="absolute inset-0 bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />
                  ) : null}
                  <span className="relative font-[family-name:var(--font-display)] text-[1.0625rem] font-bold tracking-[-0.02em] uppercase lg:text-[1.375rem]">
                    {item.name.replace(/^Roof /i, '')}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            key={service.key}
            role="tabpanel"
            id="service-panel"
            aria-labelledby={`service-tab-${service.key}`}
            tabIndex={0}
            className="animate-panel grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:p-12"
            data-whop-product-id={offer?.productId ?? undefined}
            data-whop-variant-id={offer?.planId ?? undefined}
            data-whop-price={offer?.price ?? undefined}
            data-whop-currency={offer ? offer.currency.toUpperCase() : undefined}
          >
            <div>
              <h3 className="type-title !text-[clamp(2rem,1.3rem+2.4vw,3.5rem)]">{service.name}</h3>
              <p className="type-lede mt-4 max-w-xl">{service.summary}</p>

              <ul className="m-0 mt-8 grid list-none gap-3 p-0">
                {service.includes.map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check aria-hidden="true" className="mt-1 size-[1.125rem] flex-none text-accent" strokeWidth={2.5} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col rounded-[20px] bg-[#0d0d0c] p-7 text-[#eeece7] sm:p-8">
              <dl className="grid grid-cols-2 gap-x-6">
                {service.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="type-note text-[#a8a59e]">{fact.label}</dt>
                    <dd className="m-0 mt-1.5 font-semibold">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-auto pt-10">
                {service.action === 'buy' && offer?.price != null ? (
                  <>
                    <p className="type-figure text-[clamp(3.5rem,2.5rem+3vw,5.5rem)] leading-none">{money(offer.price, offer.currency)}</p>
                    <p className="mt-3 text-[0.9688rem] text-[#a8a59e]">{offer.description}</p>
                    <Link to="/checkout/$offer" params={{ offer: offer.key }} className="btn btn-primary mt-6 w-full">
                      {service.buyLabel ?? 'Book now'}
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="type-figure text-[2.25rem] leading-none">Free written estimate</p>
                    <p className="mt-3 text-[0.9688rem] text-[#a8a59e]">
                      Priced per square, with decking listed per sheet.
                      {deposit?.price != null ? ` A ${money(deposit.price, deposit.currency)} deposit holds your date.` : ''}
                    </p>
                    <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => openEstimate(service.key)}>
                      Request an estimate
                    </button>
                    {deposit?.price != null ? (
                      <Link to="/checkout/$offer" params={{ offer: 'deposit' }} className="btn mt-2 w-full border-[#5a5852] text-[#eeece7] hover:border-[#eeece7]">
                        Already have an estimate? Pay your deposit
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
