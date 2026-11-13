// How a job is paid for, start to finish. On wide screens the four cards
// start as one stack and fan out as you scroll, then each lights up in turn.
// Phones and reduced-motion settings get a simple stack that needs no motion.
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useRef, useState } from 'react'
import { ScrollWords } from '#/components/ScrollWords'
import { getOffer } from '#/config/offers'
import { site } from '#/config/site'
import { cx, money } from '#/lib/format'

type Step = (typeof site.billing)[number]

function moneyLine(step: Step, index: number): string {
  const offer = step.money ? getOffer(step.money) : undefined
  if (offer?.price != null) {
    return `${money(offer.price, offer.currency)} ${step.money === 'deposit' ? 'today, applied to your invoice' : 'credited toward any job'}`
  }
  return index === site.billing.length - 1 ? 'Balance due after sign-off' : 'Nothing due'
}

function CardBody({ step, index, lit }: { step: Step; index: number; lit: boolean }) {
  return (
    <>
      <p className={cx('type-figure text-[3.25rem] leading-none', lit ? 'text-on-brand' : 'text-ink-soft')}>{index + 1}</p>
      <div className="mt-auto pt-8">
        <h3 className="font-[family-name:var(--font-display)] text-[1.875rem] leading-none font-semibold tracking-[-0.04em] uppercase">{step.title}</h3>
        <p className={cx('mt-3 text-[0.9688rem] leading-snug', lit ? 'text-on-brand' : 'text-ink-soft')}>{step.body}</p>
        <p className={cx('type-note mt-4', lit ? 'text-on-brand' : 'text-accent')}>{moneyLine(step, index)}</p>
      </div>
    </>
  )
}

function FanCard({ step, index, progress, lit }: { step: Step; index: number; progress: MotionValue<number>; lit: boolean }) {
  const offset = index - (site.billing.length - 1) / 2
  const x = useTransform(progress, [0, 0.42], ['0%', `${offset * 94}%`])
  const y = useTransform(progress, [0, 0.42], [index * -6, Math.abs(offset) * 22])
  const rotate = useTransform(progress, [0, 0.42], [(index - 1.5) * 2.5, offset * 5])
  return (
    <motion.li
      style={{ x, y, rotate, zIndex: lit ? 10 : index }}
      className={cx(
        'absolute flex h-[25rem] w-[clamp(15rem,21.5vw,20rem)] flex-col rounded-[24px] border p-7 transition-colors duration-300',
        lit ? 'border-brand bg-brand text-on-brand' : 'border-line bg-raised text-ink',
      )}
    >
      <CardBody step={step} index={index} lit={lit} />
    </motion.li>
  )
}

export function Billing() {
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start start', 'end end'] })
  const [lit, setLit] = useState(-1)

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = value < 0.42 ? -1 : Math.min(site.billing.length - 1, Math.floor(((value - 0.42) / 0.56) * site.billing.length))
    setLit(next)
  })

  const title = 'You never pay for a roof you have not seen.'
  const sub = 'A small deposit holds your date. The balance is only billed after you walk the finished roof with the foreman.'

  return (
    <section id="billing" aria-labelledby="billing-title">
      <h2 id="billing-title" className="sr-only">
        {title}
      </h2>

      {/* Wide screens with motion: the fan. */}
      <div ref={stage} className="relative hidden h-[300svh] lg:motion-safe:block">
        <div className="sticky top-0 flex h-svh flex-col items-center overflow-hidden pt-28">
          <p className="type-title max-w-4xl px-6 text-center" aria-hidden="true">
            {title}
          </p>
          <p className="type-lede mt-4 max-w-xl px-6 text-center">{sub}</p>
          <div className="relative mt-4 flex w-full flex-1 items-center justify-center">
            <ol className="relative m-0 flex h-[25rem] w-[clamp(15rem,21.5vw,20rem)] list-none p-0">
              {site.billing.map((step, index) => (
                <FanCard key={step.title} step={step} index={index} progress={scrollYProgress} lit={lit === index} />
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Phones and reduced motion: cards that stack as you scroll. */}
      <div className="shell py-20 lg:motion-safe:hidden">
        <div aria-hidden="true">
          <ScrollWords text={title} className="type-title" />
        </div>
        <p className="type-lede mt-4 max-w-xl">{sub}</p>
        <ol className="m-0 mt-10 grid list-none gap-4 p-0">
          {site.billing.map((step, index) => (
            <li
              key={step.title}
              className={cx(
                'flex min-h-[19rem] flex-col rounded-[24px] border p-6 motion-safe:sticky',
                index === 1 ? 'border-brand bg-brand text-on-brand' : 'border-line bg-raised text-ink',
              )}
              style={{ top: `${5.5 + index * 0.75}rem` }}
            >
              <CardBody step={step} index={index} lit={index === 1} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
