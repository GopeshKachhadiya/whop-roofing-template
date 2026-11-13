// The two payment forms, both built on Whop Payment Elements. Card numbers
// are typed into Whop's hosted fields and never reach this code: the elements
// hand back a single-use confirmation token, and the server does the rest.
//
//   ServicePayForm   pays for a fixed-price service (inspection, tune-up)
//   DepositPayForm   saves the card with a setup intent, then charges the
//                    deposit to it, leaving the card on file for the invoice
import { useServerFn } from '@tanstack/react-start'
import { BrandingElement, EmailElement, PaymentElement, usePayments, useWhop } from '@whop/elements-react'
import { LoaderCircle, Lock } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { Offer, WhopEnv } from '#/config/offers'
import { site } from '#/config/site'
import { money } from '#/lib/format'
import { chargeDeposit, createPayment, saveCard } from '#/server/checkout.functions'

type PricedOffer = Offer & { price: number; planId: string }

const { company } = site

// Stable objects, so re-renders don't push new props into Whop's frames.
const LIVE_WALLETS = { payPal: 'never' } as const
const LIVE_DEFAULTS = { billingDetails: { address: { country: company.country } } }
/** Test mode fills in a sample address, so a test checkout only needs the card. */
const TEST_DEFAULTS = {
  billingDetails: {
    name: 'Test Homeowner',
    address: { line1: company.street, city: company.city, state: company.state, postal_code: company.zip, country: company.country },
  },
}
const billingDefaults = (env: WhopEnv) => (env === 'sandbox' ? TEST_DEFAULTS : LIVE_DEFAULTS)

function returnPath(offerKey: string, env: WhopEnv, status: string, paymentId?: string): string {
  const params = new URLSearchParams({ offer: offerKey, status })
  if (paymentId) params.set('payment', paymentId)
  if (env === 'sandbox') params.set('mode', 'test')
  return `/checkout/return?${params.toString()}`
}

/** A closed Apple Pay or Google Pay sheet is a change of mind, not an error. */
function wasCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'payment_request_cancelled'
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function PayButton({ busy, disabled, onClick, children, busyLabel }: { busy: boolean; disabled: boolean; onClick: () => void; children: string; busyLabel: string }) {
  return (
    <button type="button" className="btn btn-primary mt-6 w-full !min-h-[3.5rem] !text-[1.0625rem]" disabled={disabled || busy} aria-busy={busy} onClick={onClick}>
      {busy ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin-slow size-5" />
          {busyLabel}
        </>
      ) : (
        <>
          <Lock aria-hidden="true" className="size-[1.125rem]" />
          {children}
        </>
      )}
    </button>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="animate-panel mt-5 rounded-[12px] bg-danger-wash px-4 py-3 text-[0.9688rem] font-semibold text-danger">
      {message}
    </p>
  )
}

export function ServicePayForm({ offer, env }: { offer: PricedOffer; env: WhopEnv }) {
  const payments = usePayments()
  const whop = useWhop()
  const pay = useServerFn(createPayment)
  const [ready, setReady] = useState(false)
  const onChange = useCallback((event: { complete: boolean }) => setReady(event.complete), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!payments || !whop || busy) return
    setBusy(true)
    setError(null)
    try {
      const { confirmationToken } = await payments.createConfirmationToken({})
      const payment = await pay({ data: { offerKey: offer.key, confirmationToken, env } })
      if (!payment.ok) {
        setError(payment.error)
        return
      }
      if (payment.status === 'paid') {
        window.location.assign(returnPath(offer.key, env, 'succeeded', payment.id))
        return
      }
      if (!payment.clientSecret) {
        window.location.assign(returnPath(offer.key, env, 'processing', payment.id))
        return
      }
      // 3-D Secure, a bank page or a pay-later application, if the method needs one.
      const next = await whop.payments.handleNextAction({ clientSecret: payment.clientSecret })
      if (next.redirected) return
      if (next.status === 'succeeded' || next.status === 'processing') {
        window.location.assign(returnPath(offer.key, env, next.status, payment.id))
        return
      }
      setError(next.lastPaymentError?.message ?? 'The payment step was not finished, so you have not been charged. Try again.')
    } catch (caught) {
      if (!wasCancelled(caught)) setError(messageOf(caught, 'The payment could not be started. You have not been charged. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid gap-4">
        <EmailElement />
        <PaymentElement wallets={LIVE_WALLETS} defaultValues={billingDefaults(env)} onChange={onChange} />
      </div>
      <FormError message={error} />
      <PayButton busy={busy} disabled={!ready || !payments || !whop} onClick={submit} busyLabel="Processing payment">
        {`Pay ${money(offer.price, offer.currency)}`}
      </PayButton>
      {/* Required on every Whop payment form: the merchant-of-record notice. */}
      <div className="mt-4">
        <BrandingElement />
      </div>
    </div>
  )
}

export function DepositPayForm({ offer, env }: { offer: PricedOffer; env: WhopEnv }) {
  const payments = usePayments()
  const whop = useWhop()
  const save = useServerFn(saveCard)
  const charge = useServerFn(chargeDeposit)
  const [ready, setReady] = useState(false)
  const onChange = useCallback((event: { complete: boolean }) => setReady(event.complete), [])
  const [stage, setStage] = useState<'idle' | 'saving' | 'charging'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!payments || !whop || stage !== 'idle') return
    setStage('saving')
    setError(null)
    try {
      // 1. Card on file: confirmation token -> setup intent.
      const { confirmationToken } = await payments.createConfirmationToken({})
      const setup = await save({ data: { confirmationToken, env } })
      if (!setup.ok) {
        setError(setup.error)
        return
      }
      let status = setup.status
      if (status !== 'succeeded' && status !== 'canceled' && setup.clientSecret) {
        const next = await whop.payments.handleNextAction({ clientSecret: setup.clientSecret })
        if (next.redirected) return
        status = next.status
        if (status !== 'succeeded') {
          setError(next.lastPaymentError?.message ?? 'Your card was not saved, so nothing was charged. Try again or use another card.')
          return
        }
      }
      if (status !== 'succeeded') {
        setError('Your card could not be saved, so nothing was charged. Try a different card.')
        return
      }

      // 2. Deposit: charged to the card that was just saved.
      setStage('charging')
      const payment = await charge({ data: { setupIntentId: setup.id, clientSecret: setup.clientSecret ?? '', env } })
      if (!payment.ok) {
        setError(payment.error)
        return
      }
      if (payment.status === 'paid') {
        window.location.assign(returnPath(offer.key, env, 'succeeded', payment.id))
        return
      }
      if (!payment.clientSecret) {
        window.location.assign(returnPath(offer.key, env, 'processing', payment.id))
        return
      }
      const next = await whop.payments.handleNextAction({ clientSecret: payment.clientSecret })
      if (next.redirected) return
      if (next.status === 'succeeded' || next.status === 'processing') {
        window.location.assign(returnPath(offer.key, env, next.status, payment.id))
        return
      }
      setError(next.lastPaymentError?.message ?? `Your card is saved but the deposit was not charged. Call ${site.company.phone} and we will finish it by phone.`)
    } catch (caught) {
      if (!wasCancelled(caught)) setError(messageOf(caught, 'Your card could not be saved. You have not been charged. Try again.'))
    } finally {
      setStage('idle')
    }
  }

  return (
    <div>
      <div className="grid gap-4">
        <EmailElement />
        <PaymentElement wallets={LIVE_WALLETS} defaultValues={billingDefaults(env)} onChange={onChange} />
      </div>
      <p className="mt-5 text-[0.9375rem] text-ink-soft">
        Paying the deposit keeps this card on file with Whop. We use it for one thing: the remaining balance on your final
        invoice, after you have walked the finished roof. You can ask us to email the invoice instead.
      </p>
      <FormError message={error} />
      <PayButton
        busy={stage !== 'idle'}
        disabled={!ready || !payments || !whop}
        onClick={submit}
        busyLabel={stage === 'charging' ? 'Charging your deposit' : 'Saving your card'}
      >
        {`Pay ${money(offer.price, offer.currency)} deposit`}
      </PayButton>
      <div className="mt-4">
        <BrandingElement />
      </div>
    </div>
  )
}
