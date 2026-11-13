// Where a buyer lands after paying, and after any off-site step (3-D Secure,
// a bank page, a pay-later application) whatever its outcome. The URL says
// what happened, but anyone can type a URL, so the page asks the server what
// Whop says before it shows a thank-you. Fulfillment belongs to webhooks.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { WhopElements, useWhop } from '@whop/elements-react'
import { CircleAlert, CircleCheck, Clock, LoaderCircle, Phone } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Brand } from '#/components/Brand'
import { TestModeBanner } from '#/components/checkout/TestModeBanner'
import { getWhop } from '#/components/checkout/whopClient'
import { getOffer } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'
import { site } from '#/config/site'
import { money } from '#/lib/format'
import { useWhopEnv } from '#/lib/whopEnv'
import { chargeDeposit, paymentOutcome } from '#/server/checkout.functions'

interface ReturnSearch {
  offer?: string
  status?: string
  payment?: string
  setup?: string
  client_secret?: string
  step?: string
  mode?: string
}

const text = (value: unknown) => (typeof value === 'string' && value.length < 400 ? value : undefined)

export const Route = createFileRoute('/checkout/return')({
  validateSearch: (search: Record<string, unknown>): ReturnSearch => ({
    offer: text(search.offer),
    status: text(search.status),
    payment: text(search.payment),
    setup: text(search.setup),
    client_secret: text(search.client_secret),
    step: text(search.step),
    mode: text(search.mode),
  }),
  head: () => ({ meta: [{ title: `Payment | ${site.company.name}` }, { name: 'robots', content: 'noindex' }] }),
  component: ReturnPage,
})

type Face = 'checking' | 'succeeded' | 'processing' | 'failed' | 'none'

function ReturnPage() {
  const search = Route.useSearch()
  const { env, ready } = useWhopEnv()
  const offer = getOffer(search.offer ?? '')
  const finishingDeposit = search.step === 'card'

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label={`${site.company.name} home`} className="no-underline">
            <Brand />
          </Link>
          <a href={site.company.phoneHref} className="type-note flex min-h-11 items-center gap-2 !text-[1rem] no-underline hover:text-accent">
            <Phone aria-hidden="true" className="size-4" />
            {site.company.phone}
          </a>
        </div>
      </header>
      {ready && env === 'sandbox' ? <TestModeBanner /> : null}
      <main className="shell py-16 lg:py-24">
        <div className="max-w-2xl">
          {!ready ? (
            <Checking />
          ) : finishingDeposit ? (
            <FinishDeposit search={search} env={env} />
          ) : (
            <Outcome search={search} env={env} offerTitle={offer?.title} offerKey={offer?.key} price={offer?.price ?? null} currency={offer?.currency} />
          )}
        </div>
      </main>
    </div>
  )
}

function Checking({ label = 'Confirming your payment' }: { label?: string }) {
  return (
    <div role="status">
      <LoaderCircle aria-hidden="true" className="animate-spin-slow size-10 text-accent" strokeWidth={1.75} />
      <h1 className="type-title mt-6">{label}</h1>
      <p className="type-lede mt-4">This takes a few seconds. Keep this page open.</p>
    </div>
  )
}

function Outcome({
  search,
  env,
  offerTitle,
  offerKey,
  price,
  currency,
}: {
  search: ReturnSearch
  env: WhopEnv
  offerTitle?: string
  offerKey?: string
  price: number | null
  currency?: string
}) {
  const check = useServerFn(paymentOutcome)
  // The URL is only a hint: anyone can type status=succeeded. A thank-you needs
  // a payment that Whop confirms, so no payment ID means nothing to celebrate.
  const claimed: Face = search.status === 'failed' || search.status === 'canceled' ? 'failed' : 'processing'
  const [face, setFace] = useState<Face>(search.payment ? 'checking' : claimed === 'failed' ? 'failed' : 'none')

  useEffect(() => {
    if (!search.payment) return
    let cancelled = false
    let attempts = 0
    const ask = async () => {
      attempts += 1
      const { outcome } = await check({ data: { paymentId: search.payment!, env } }).catch(() => ({ outcome: 'unknown' as const }))
      if (cancelled) return
      if (outcome === 'succeeded') setFace('succeeded')
      else if (outcome === 'failed') setFace('failed')
      else if ((outcome === 'processing' || outcome === 'requires_action') && attempts < 6) window.setTimeout(ask, 2000)
      else if (outcome === 'unknown') setFace(claimed)
      else setFace('processing')
    }
    void ask()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.payment, env])

  if (face === 'checking') return <Checking />
  if (face === 'none') {
    return (
      <div className="animate-panel">
        <h1 className="type-title">We can't find a payment to confirm</h1>
        <p className="type-lede mt-4">This link doesn't include a payment. If you've paid, your receipt is in your email. If something looks wrong, call {site.company.phone}.</p>
        <Link to="/" className="btn btn-quiet mt-8">
          Back to the home page
        </Link>
      </div>
    )
  }
  const deposit = offerKey === 'deposit'
  const amount = price != null && currency ? money(price, currency) : null

  if (face === 'succeeded') {
    return (
      <div role="status" className="animate-panel">
        <CircleCheck aria-hidden="true" className="size-12 text-ok" strokeWidth={1.75} />
        <h1 className="type-title mt-6">{deposit ? 'Deposit paid. Your date is held.' : 'Payment received'}</h1>
        <p className="type-lede mt-4">
          {amount && offerTitle ? `${amount} for ${offerTitle.toLowerCase()}. ` : ''}A receipt is on its way to your email.
        </p>
        {offerKey && site.checkout[offerKey] ? (
          <ol className="m-0 mt-8 grid list-none gap-3 border-t border-line p-0 pt-6">
            {site.checkout[offerKey].next.map((line, index) => (
              <li key={line} className="flex gap-3">
                <span className="type-figure flex size-6 flex-none items-center justify-center rounded-full bg-ink text-[0.8125rem] text-page">{index + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {search.payment ? <p className="type-note mt-8 text-ink-soft">Reference {search.payment}</p> : null}
        <Link to="/" className="btn btn-quiet mt-6">
          Back to the home page
        </Link>
      </div>
    )
  }

  if (face === 'failed') {
    return (
      <div role="alert" className="animate-panel">
        <CircleAlert aria-hidden="true" className="size-12 text-danger" strokeWidth={1.75} />
        <h1 className="type-title mt-6">Your payment did not go through</h1>
        <p className="type-lede mt-4">No money was taken. You can try again with the same card or a different way to pay.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {offerKey ? (
            <a href={`/checkout/${offerKey}${env === 'sandbox' ? '?mode=test' : ''}`} className="btn btn-primary">
              Back to checkout
            </a>
          ) : null}
          <a href={site.company.phoneHref} className="btn btn-quiet">
            <Phone aria-hidden="true" className="size-[1.125rem]" />
            Pay by phone
          </a>
        </div>
      </div>
    )
  }

  return (
    <div role="status" className="animate-panel">
      <Clock aria-hidden="true" className="size-12 text-accent" strokeWidth={1.75} />
      <h1 className="type-title mt-6">We are confirming your payment</h1>
      <p className="type-lede mt-4">
        Your bank is still deciding. We will email you as soon as it is confirmed, and you do not need to pay again.
      </p>
      {search.payment ? <p className="type-note mt-8 text-ink-soft">Reference {search.payment}</p> : null}
      <Link to="/" className="btn btn-quiet mt-6">
        Back to the home page
      </Link>
    </div>
  )
}

/**
 * The buyer left the page to approve saving their card (a bank's 3-D Secure
 * page) and has come back. If the card was saved, charge the deposit to it.
 */
function FinishDeposit({ search, env }: { search: ReturnSearch; env: WhopEnv }) {
  const elements = useMemo(() => getWhop(), [])
  return (
    <WhopElements elements={elements} environment={env}>
      <FinishDepositInner search={search} env={env} />
    </WhopElements>
  )
}

function FinishDepositInner({ search, env }: { search: ReturnSearch; env: WhopEnv }) {
  const whop = useWhop()
  const charge = useServerFn(chargeDeposit)
  const started = useRef(false)
  const [state, setState] = useState<{ face: Face; payment?: string; error?: string }>({ face: 'checking' })

  useEffect(() => {
    if (started.current || !whop) return
    if (search.status !== 'succeeded' || !search.setup) {
      setState({ face: 'failed', error: 'Your card was not saved, so nothing was charged.' })
      return
    }
    started.current = true
    const run = async () => {
      const payment = await charge({ data: { setupIntentId: search.setup!, clientSecret: search.client_secret ?? '', env } })
      if (!payment.ok) {
        setState({ face: 'failed', error: payment.error })
        return
      }
      if (payment.status === 'paid') {
        setState({ face: 'succeeded', payment: payment.id })
        return
      }
      if (!payment.clientSecret) {
        setState({ face: 'processing', payment: payment.id })
        return
      }
      const next = await whop.payments.handleNextAction({ clientSecret: payment.clientSecret })
      if (next.redirected) return
      if (next.status === 'succeeded') setState({ face: 'succeeded', payment: payment.id })
      else if (next.status === 'processing') setState({ face: 'processing', payment: payment.id })
      else setState({ face: 'failed', error: next.lastPaymentError?.message ?? 'Your card is saved but the deposit was not charged.' })
    }
    run().catch(() => setState({ face: 'failed', error: 'Your card is saved but the deposit was not charged.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whop])

  if (state.face === 'checking') return <Checking label="Charging your deposit" />
  if (state.face === 'failed') {
    return (
      <div role="alert" className="animate-panel">
        <CircleAlert aria-hidden="true" className="size-12 text-danger" strokeWidth={1.75} />
        <h1 className="type-title mt-6">Your deposit was not charged</h1>
        <p className="type-lede mt-4">{state.error} You can try again, or call us and we will take it by phone.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={`/checkout/deposit${env === 'sandbox' ? '?mode=test' : ''}`} className="btn btn-primary">
            Back to checkout
          </a>
          <a href={site.company.phoneHref} className="btn btn-quiet">
            <Phone aria-hidden="true" className="size-[1.125rem]" />
            {site.company.phone}
          </a>
        </div>
      </div>
    )
  }
  const deposit = getOffer('deposit', env)
  return (
    <Outcome
      search={{ ...search, status: state.face, payment: state.payment, step: undefined }}
      env={env}
      offerTitle={deposit?.title}
      offerKey="deposit"
      price={deposit?.price ?? null}
      currency={deposit?.currency}
    />
  )
}
