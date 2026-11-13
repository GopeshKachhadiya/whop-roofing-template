// Server side of the checkout pages.
//
//  createPayment   a confirmation token from the Payment Elements -> POST /payments
//  saveCard        a setup-mode confirmation token -> POST /setup_intents (card on file)
//  chargeDeposit   the deposit plan, charged to the card that setup intent saved
//  paymentOutcome  what Whop says happened, for the return page
//
// The browser never names a price: every charge is for a plan ID that this
// server looks up from the offer key.
import { createServerFn } from '@tanstack/react-start'
import { asWhopEnv, getPurchasableOffer } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'
import { InputError, asString, clientIp, safeEqual, sha256Hex, siteOrigin } from './guards.server'
import { WhopApiError, accountId, whopApi } from './whop.server'

export type ChargeResult =
  | { ok: true; id: string; status: string; clientSecret: string | null }
  | { ok: false; error: string }

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof InputError) return { ok: false, error: error.message }
  if (error instanceof WhopApiError) {
    console.error('[checkout]', error.status, error.type, error.message)
    // 4xx messages from the Payments API are written for the buyer ("Your card was declined").
    if (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403) {
      return { ok: false, error: error.message }
    }
  } else {
    console.error('[checkout]', error)
  }
  return { ok: false, error: fallback }
}

function returnUrl(offerKey: string, env: WhopEnv): string {
  const mode = env === 'sandbox' ? '&mode=test' : ''
  return `${siteOrigin()}/checkout/return?offer=${encodeURIComponent(offerKey)}${mode}`
}

export const createPayment = createServerFn({ method: 'POST' })
  .validator((data: { offerKey: string; confirmationToken: string; env?: WhopEnv }) => data)
  .handler(async ({ data }): Promise<ChargeResult> => {
    try {
      const env = asWhopEnv(data.env)
      const offerKey = asString(data.offerKey, 'Offer', { min: 1, max: 40 })
      const token = asString(data.confirmationToken, 'Payment details', { min: 5, max: 400 })
      const offer = getPurchasableOffer(offerKey, env)
      if (!offer || offer.kind !== 'service') throw new InputError('This item is not available to buy online.')
      const payment = await whopApi<{ id: string; status: string; client_secret: string | null }>('POST', '/payments', {
        env,
        body: {
          account_id: accountId(env),
          variant_id: offer.planId,
          confirmation_token: token,
          return_url: returnUrl(offer.key, env),
          metadata: { offer: offer.key, source: 'website_checkout' },
        },
        idempotencyKey: `pay-${await sha256Hex(token)}`,
      })
      return { ok: true, id: payment.id, status: payment.status, clientSecret: payment.client_secret }
    } catch (error) {
      return failure(error, 'The payment could not be started. You have not been charged. Try again.')
    }
  })

export const saveCard = createServerFn({ method: 'POST' })
  .validator((data: { confirmationToken: string; env?: WhopEnv }) => data)
  .handler(async ({ data }): Promise<ChargeResult> => {
    try {
      const env = asWhopEnv(data.env)
      const token = asString(data.confirmationToken, 'Payment details', { min: 5, max: 400 })
      const offer = getPurchasableOffer('deposit', env)
      if (!offer) throw new InputError('Deposits are not available online right now.')
      const setupIntent = await whopApi<{ id: string; status: string; client_secret: string | null }>('POST', '/setup_intents', {
        env,
        body: {
          account_id: accountId(env),
          confirmation_token: token,
          currency: offer.currency,
          return_url: `${returnUrl('deposit', env)}&step=card`,
          metadata: { purpose: 'deposit', offer: 'deposit', source: 'website_checkout' },
        },
        idempotencyKey: `setup-${await sha256Hex(token)}`,
      })
      return { ok: true, id: setupIntent.id, status: setupIntent.status, clientSecret: setupIntent.client_secret }
    } catch (error) {
      return failure(error, 'Your card could not be saved. You have not been charged. Try again.')
    }
  })

interface SetupIntent {
  id: string
  account_id: string | null
  status: string
  client_secret: string | null
  member_id: string | null
  payment_method_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export const chargeDeposit = createServerFn({ method: 'POST' })
  .validator((data: { setupIntentId: string; clientSecret: string; env?: WhopEnv }) => data)
  .handler(async ({ data }): Promise<ChargeResult> => {
    try {
      const env = asWhopEnv(data.env)
      const setupIntentId = asString(data.setupIntentId, 'Saved card', { min: 6, max: 80 })
      const clientSecret = typeof data.clientSecret === 'string' ? data.clientSecret : ''
      if (!/^sint_[A-Za-z0-9]{6,40}$/.test(setupIntentId)) throw new InputError('That saved card was not found.')
      const offer = getPurchasableOffer('deposit', env)
      if (!offer) throw new InputError('Deposits are not available online right now.')

      const setupIntent = await whopApi<SetupIntent>('GET', `/setup_intents/${setupIntentId}`, { env })
      // Only the browser that just saved the card holds its client secret. If
      // Whop issued none, fall back to "saved in the last few minutes"; either
      // way the idempotency key below allows one deposit per saved card.
      const proven = setupIntent.client_secret
        ? clientSecret.length > 0 && (await safeEqual(setupIntent.client_secret, clientSecret))
        : Date.now() - new Date(setupIntent.created_at).getTime() < 20 * 60_000
      if (!proven || setupIntent.metadata?.purpose !== 'deposit' || setupIntent.account_id !== accountId(env)) {
        throw new InputError('That saved card was not found.')
      }
      if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method_id || !setupIntent.member_id) {
        throw new InputError('Your card is not saved yet. Finish the card step first.')
      }

      const payment = await whopApi<{ id: string; status: string; client_secret: string | null }>('POST', '/payments', {
        env,
        body: {
          account_id: accountId(env),
          variant_id: offer.planId,
          member_id: setupIntent.member_id,
          payment_method_id: setupIntent.payment_method_id,
          // The homeowner is on the page, so the bank may ask them to confirm.
          off_session: false,
          ip_address: clientIp(),
          return_url: returnUrl('deposit', env),
          metadata: { offer: 'deposit', setup_intent_id: setupIntent.id, source: 'website_checkout' },
        },
        // One deposit per saved card, however many times the browser retries.
        idempotencyKey: `deposit-${setupIntent.id}`,
      })
      return { ok: true, id: payment.id, status: payment.status, clientSecret: payment.client_secret }
    } catch (error) {
      return failure(error, 'Your card is saved but the deposit was not charged. Call us and we will finish it by phone.')
    }
  })

export type Outcome = 'succeeded' | 'processing' | 'requires_action' | 'failed' | 'unknown'

export const paymentOutcome = createServerFn({ method: 'GET' })
  .validator((data: { paymentId: string; env?: WhopEnv }) => data)
  .handler(async ({ data }): Promise<{ outcome: Outcome }> => {
    const paymentId = typeof data.paymentId === 'string' ? data.paymentId.trim() : ''
    if (!/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId)) return { outcome: 'unknown' }
    try {
      const status = await whopApi<{ status: string }>('GET', `/payments/${paymentId}/status`, { env: asWhopEnv(data.env) })
      if (status.status === 'succeeded' || status.status === 'requires_capture') return { outcome: 'succeeded' }
      if (status.status === 'processing' || status.status === 'confirming') return { outcome: 'processing' }
      if (status.status === 'requires_action') return { outcome: 'requires_action' }
      if (status.status === 'canceled' || status.status === 'requires_confirmation') return { outcome: 'failed' }
      return { outcome: 'unknown' }
    } catch {
      return { outcome: 'unknown' }
    }
  })
