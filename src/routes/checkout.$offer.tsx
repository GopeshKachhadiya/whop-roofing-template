// Checkout for one offer. Everything that touches payment details is a Whop
// element: Express Checkout for Apple Pay and Google Pay, then the Email,
// Payment and Branding elements for cards and pay-later methods.
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { Checkout, ExpressCheckoutElement, Payments, WhopElements } from '@whop/elements-react'
import { ArrowLeft, Check, Lock, Phone } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Brand } from '#/components/Brand'
import { DepositPayForm, ServicePayForm } from '#/components/checkout/PayForms'
import { LiveModeWarning, TestModeBanner } from '#/components/checkout/TestModeBanner'
import { getWhop } from '#/components/checkout/whopClient'
import { getPurchasableOffer, whopAccountId } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'
import { site } from '#/config/site'
import { money } from '#/lib/format'
import { trackOnce } from '#/lib/track'
import { useTestModeUnavailable, useWhopEnv } from '#/lib/whopEnv'

export const Route = createFileRoute('/checkout/$offer')({
  loader: ({ params }) => {
    const offer = getPurchasableOffer(params.offer)
    if (!offer || !site.checkout[offer.key]) throw notFound()
    return { offerKey: offer.key }
  },
  head: ({ params }) => ({
    meta: [{ title: `${site.checkout[params.offer]?.title ?? 'Checkout'} | ${site.company.name}` }, { name: 'robots', content: 'noindex' }],
  }),
  component: CheckoutPage,
})

function CheckoutPage() {
  const { offerKey } = Route.useLoaderData()
  const { env, ready } = useWhopEnv()
  const testUnavailable = useTestModeUnavailable()
  const liveOffer = getPurchasableOffer(offerKey)!
  const offer = getPurchasableOffer(offerKey, env) ?? liveOffer
  const copy = site.checkout[offerKey]
  const service = site.services.find((item) => item.key === copy.serviceKey)
  const isDeposit = offer.kind === 'deposit'

  // Pixel: the standard checkout-start event, plus our own for deposits.
  useEffect(() => {
    const payload = {
      variant_id: liveOffer.planId,
      product_id: liveOffer.productId ?? undefined,
      value: liveOffer.price,
      currency: liveOffer.currency.toUpperCase(),
    }
    trackOnce(`checkout:${offerKey}`, 'initiate_checkout', payload)
    if (isDeposit) trackOnce('deposit', 'deposit_started', payload)
  }, [offerKey, isDeposit, liveOffer])

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label={`${site.company.name} home`} className="no-underline">
            <Brand />
          </Link>
          <div className="flex items-center gap-5">
            <p className="type-note hidden items-center gap-2 text-ink-soft sm:flex">
              <Lock aria-hidden="true" className="size-4" />
              Secure checkout
            </p>
            <a href={site.company.phoneHref} className="type-note flex min-h-11 items-center gap-2 !text-[1rem] no-underline hover:text-accent">
              <Phone aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{site.company.phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          </div>
        </div>
      </header>
      {ready && env === 'sandbox' ? <TestModeBanner /> : null}
      {testUnavailable ? <LiveModeWarning /> : null}

      <main className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-16 lg:py-16">
        <section
          aria-labelledby="checkout-title"
          data-whop-product-id={liveOffer.productId ?? undefined}
          data-whop-variant-id={liveOffer.planId}
          data-whop-price={liveOffer.price}
          data-whop-currency={liveOffer.currency.toUpperCase()}
        >
          <Link to="/" hash="services" className="type-note inline-flex min-h-11 items-center gap-2 text-ink-soft no-underline hover:text-ink">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to services
          </Link>
          <h1 id="checkout-title" className="type-title mt-4">
            {copy.title}
          </h1>
          <p className="type-lede mt-4 max-w-xl">{copy.intro}</p>

          <div className="mt-8 flex items-end justify-between gap-6 border-y border-line py-6">
            <div>
              <p className="font-bold">{offer.title}</p>
              <p className="mt-1 text-[0.9688rem] text-ink-soft">{offer.description}</p>
            </div>
            <p className="type-figure flex-none text-[2.5rem] leading-none">{money(offer.price, offer.currency)}</p>
          </div>

          {!isDeposit && service ? (
            <>
              <h2 className="type-note mt-8 text-ink-soft">What is included</h2>
              <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
                {service.includes.map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check aria-hidden="true" className="mt-1 size-[1.125rem] flex-none text-accent" strokeWidth={2.5} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="type-note mt-8 text-ink-soft">What happens next</h2>
          <ol className="m-0 mt-3 grid list-none gap-3 p-0">
            {copy.next.map((line, index) => (
              <li key={line} className="flex gap-3">
                <span className="type-figure flex size-6 flex-none items-center justify-center rounded-full bg-ink text-[0.8125rem] text-page">{index + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="payment-title" className="lg:pt-[3.75rem]">
          <div className="panel p-5 sm:p-8">
            <h2 id="payment-title" className="type-heading">
              {isDeposit ? 'Pay your deposit' : 'Payment'}
            </h2>
            {ready ? <PaymentPanel offer={offer} env={env} isDeposit={isDeposit} /> : <PanelSkeleton />}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Card details are entered in fields hosted by Whop, our payment provider. {site.company.name} never sees or stores your card number.
          </p>
        </section>
      </main>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="mt-6 grid gap-4" aria-hidden="true">
      {[3, 3, 9].map((height, index) => (
        <div key={index} className="animate-pulse rounded-[12px] bg-line/60" style={{ height: `${height}rem` }} />
      ))}
    </div>
  )
}

type PricedOffer = NonNullable<ReturnType<typeof getPurchasableOffer>>

function PaymentPanel({ offer, env, isDeposit }: { offer: PricedOffer; env: WhopEnv; isDeposit: boolean }) {
  const accountId = whopAccountId(env) ?? ''
  const elements = useMemo(() => getWhop(), [])
  const origin = window.location.origin
  const mode = env === 'sandbox' ? '&mode=test' : ''
  const returnUrl = `${origin}/checkout/return?offer=${offer.key}${mode}`

  return (
    <WhopElements
      elements={elements}
      environment={env}
      appearance={{ theme: { appearance: 'dark', accentColor: 'orange', grayColor: 'sand' }, variables: { '--radius': '12px' } }}
    >
      {isDeposit ? (
        <div className="mt-6">
          {/* Setup mode: the card is saved through a setup intent, not charged by the element. */}
          <Payments accountId={accountId} mode="setup" currency={offer.currency} returnUrl={`${returnUrl}&step=card`}>
            <DepositPayForm offer={offer} env={env} />
          </Payments>
        </div>
      ) : (
        <>
          <ExpressRow offer={offer} returnUrl={returnUrl} env={env} />
          <div className="mt-6">
            <Payments accountId={accountId} plan={offer.planId} returnUrl={returnUrl}>
              <ServicePayForm offer={offer} env={env} />
            </Payments>
          </div>
        </>
      )}
    </WhopElements>
  )
}

/** Apple Pay and Google Pay. The element draws nothing on a device with no wallet. */
function ExpressRow({ offer, returnUrl, env }: { offer: PricedOffer; returnUrl: string; env: WhopEnv }) {
  return (
    <div className="mt-5">
      <Checkout
        plan={offer.planId}
        returnUrl={returnUrl}
        metadata={{ offer: offer.key, source: 'website_express_checkout' }}
        onComplete={(completion) => {
          if (completion.result !== 'payment') return
          const params = new URLSearchParams({ offer: offer.key, status: 'succeeded', payment: completion.paymentId })
          if (env === 'sandbox') params.set('mode', 'test')
          window.location.assign(`/checkout/return?${params.toString()}`)
        }}
      >
        <ExpressCheckoutElement layout="auto" wallets={{ payPal: 'never' }} />
      </Checkout>
      <div className="mt-5 flex items-center gap-4" role="separator">
        <hr className="h-px flex-1 border-0 bg-line" />
        <span className="type-note text-ink-soft">Or pay by card or over time</span>
        <hr className="h-px flex-1 border-0 bg-line" />
      </div>
    </div>
  )
}
