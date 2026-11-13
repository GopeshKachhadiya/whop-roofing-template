// The job desk: how the final balance gets billed after the roof is on.
//
//  listJobs       deposits taken on the site, each with its card on file
//  billBalance    creates a Whop invoice for the remaining balance and either
//                 charges the stored card (issue) or emails a pay link (send)
//
// Every call checks the OFFICE_PASSCODE app secret. Set it with
//   whop apps secrets set --secret OFFICE_PASSCODE=...
// Without it the desk stays locked.
import { createServerFn } from '@tanstack/react-start'
import { asWhopEnv, getOffer, sandboxReady } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'
import { InputError, asOptionalString, asString, safeEqual, sha256Hex } from './guards.server'
import { WhopApiError, accountId, whopApi } from './whop.server'

type Money = { amount: string; currency: string } | null

export interface Job {
  setupIntentId: string
  memberId: string
  paymentMethodId: string
  customer: string
  email: string | null
  card: string
  savedAt: string
  depositStatus: string | null
  /** Billing address the customer gave at deposit checkout, if Whop has one. */
  address: BillingAddress | null
}

export interface BillingAddress {
  line1: string
  city: string
  state: string
  postalCode: string
}

export interface InvoiceSummary {
  id: string
  number: string
  status: string
  customer: string | null
  total: string | null
  amountDue: string | null
  currency: string | null
  dueAt: string | null
  createdAt: string | null
  autoCharge: boolean
  payUrl: string | null
}

export type DeskResult<T> = ({ ok: true } & T) | { ok: false; error: string; locked?: boolean }

async function unlock(passcode: unknown): Promise<void> {
  const expected = process.env.OFFICE_PASSCODE
  if (!expected) throw new InputError('The job desk is not set up yet. Add the OFFICE_PASSCODE app secret and redeploy.')
  if (typeof passcode !== 'string' || !(await safeEqual(passcode, expected))) {
    throw new InputError('That passcode is not right.')
  }
}

function deskFailure(error: unknown): { ok: false; error: string; locked?: boolean } {
  if (error instanceof InputError) return { ok: false, error: error.message, locked: /passcode|set up/.test(error.message) }
  if (error instanceof WhopApiError) {
    console.error('[office]', error.status, error.type, error.message)
    return { ok: false, error: `Whop said: ${error.message}` }
  }
  console.error('[office]', error)
  return { ok: false, error: 'Something went wrong. Nothing was billed.' }
}

function payUrl(invoice: { id: string; checkout_link?: string | null }, env: WhopEnv): string | null {
  const link = invoice.checkout_link
  if (!link) return null
  const token = link.slice(link.indexOf('.') + 1)
  const host = env === 'sandbox' ? 'https://sandbox.whop.com' : 'https://whop.com'
  return `${host}/checkout/${invoice.id}/?token=${encodeURIComponent(token)}`
}

function summarize(invoice: any, env: WhopEnv): InvoiceSummary {
  const total = invoice.total as Money
  const due = invoice.amount_due as Money
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    customer: invoice.customer_name ?? invoice.email_address ?? null,
    total: total?.amount ?? null,
    amountDue: due?.amount ?? null,
    currency: total?.currency ?? null,
    dueAt: invoice.due_at ?? null,
    createdAt: invoice.created_at ?? null,
    autoCharge: Boolean(invoice.payment_method_id),
    payUrl: payUrl(invoice, env),
  }
}

export const deskStatus = createServerFn({ method: 'GET' }).handler(async () => {
  return {
    configured: Boolean(process.env.OFFICE_PASSCODE),
    sandbox: sandboxReady && Boolean(process.env.WHOP_SANDBOX_API_KEY),
  }
})

export const listJobs = createServerFn({ method: 'POST' })
  .validator((data: { passcode: string; env?: WhopEnv }) => data)
  .handler(async ({ data }): Promise<DeskResult<{ jobs: Job[]; invoices: InvoiceSummary[] }>> => {
    try {
      await unlock(data.passcode)
      const env = asWhopEnv(data.env)
      const account = accountId(env)
      const deposit = getOffer('deposit', env)

      const [setups, payments, invoices] = await Promise.all([
        whopApi<{ data: any[] }>('GET', '/setup_intents', {
          env,
          query: { account_id: account, status: 'succeeded', first: 40, order: 'created_at', direction: 'desc' },
        }),
        deposit?.planId
          ? whopApi<{ data: any[] }>('GET', '/payments', {
              env,
              query: { account_id: account, variant_id: deposit.planId, first: 60 },
            }).catch(() => ({ data: [] as any[] }))
          : Promise.resolve({ data: [] as any[] }),
        whopApi<{ data: any[] }>('GET', '/invoices', { env, query: { account_id: account, first: 15 } }),
      ])

      const depositByMember = new Map<string, string>()
      const addressByMember = new Map<string, BillingAddress>()
      const nameByMember = new Map<string, string>()
      for (const payment of payments.data) {
        if (!payment.member_id) continue
        if (!depositByMember.has(payment.member_id)) {
          depositByMember.set(payment.member_id, payment.substatus ?? payment.status)
        }
        const billing = payment.billing_address
        if (billing?.name && !nameByMember.has(payment.member_id)) nameByMember.set(payment.member_id, billing.name)
        if (billing?.line1 && billing?.postal_code && !addressByMember.has(payment.member_id)) {
          addressByMember.set(payment.member_id, {
            line1: billing.line1,
            city: billing.city ?? '',
            state: billing.state ?? '',
            postalCode: billing.postal_code,
          })
        }
      }

      const deposits = setups.data
        .filter((setup) => setup.metadata?.purpose === 'deposit' && setup.member_id && setup.payment_method_id)
        .slice(0, 12)

      const jobs = await Promise.all(
        deposits.map(async (setup): Promise<Job> => {
          const member = await whopApi<{ user?: { email?: string | null; name?: string | null } }>(
            'GET',
            `/members/${setup.member_id}`,
            { env, query: { account_id: account } },
          ).catch(() => null)
          return {
            setupIntentId: setup.id,
            memberId: setup.member_id,
            paymentMethodId: setup.payment_method_id,
            // The name typed at checkout beats the username Whop generates for a guest.
            customer: nameByMember.get(setup.member_id) || member?.user?.name || setup.user?.name || setup.user?.username || 'Customer',
            email: member?.user?.email ?? null,
            card: setup.payment_instrument?.display_name ?? 'Card on file',
            savedAt: setup.created_at,
            depositStatus: depositByMember.get(setup.member_id) ?? null,
            address: addressByMember.get(setup.member_id) ?? null,
          }
        }),
      )

      return {
        ok: true,
        jobs,
        invoices: invoices.data.filter((invoice) => invoice.metadata?.purpose !== 'lead_identity').map((invoice) => summarize(invoice, env)),
      }
    } catch (error) {
      return deskFailure(error)
    }
  })

export interface BillInput {
  passcode: string
  /** `charge` bills the card on file; `send` emails a pay link. */
  mode: 'charge' | 'send'
  amount: number
  memo?: string
  /** A job from listJobs... */
  setupIntentId?: string
  /** ...or a customer who has no card on file (send only). */
  email?: string
  name?: string
  dueInDays?: number
  /** Where the work was done. Whop uses it to work out sales tax on the invoice. */
  address: BillingAddress
  /** One ID per press of the bill button, so a double click never bills twice. */
  attemptId: string
  env?: WhopEnv
}

export const billBalance = createServerFn({ method: 'POST' })
  .validator((data: BillInput) => data)
  .handler(async ({ data }): Promise<DeskResult<{ invoice: InvoiceSummary; charged: boolean }>> => {
    try {
      await unlock(data.passcode)
      const env = asWhopEnv(data.env)
      const account = accountId(env)
      const balance = getOffer('balance', env)
      if (!balance?.productId) throw new InputError('Run `pnpm whop:sync` so the Final Balance product exists.')

      if (data.mode !== 'charge' && data.mode !== 'send') throw new InputError('Choose how to bill this balance.')
      const amount = Math.round(Number(data.amount) * 100) / 100
      if (!Number.isFinite(amount) || amount < 1 || amount > 250000) {
        throw new InputError('Enter a balance between $1 and $250,000.')
      }
      const memo = asOptionalString(data.memo, 'Note', 600)
      const attemptId = asString(data.attemptId, 'Request', { min: 8, max: 80 })
      const address = data.address ?? ({} as BillingAddress)
      const line1 = asString(address.line1, 'Street address', { min: 3, max: 160 })
      const city = asString(address.city, 'City', { min: 2, max: 80 })
      const state = asString(address.state, 'State', { min: 2, max: 2 }).toUpperCase()
      const postalCode = asString(address.postalCode, 'ZIP code', { min: 5, max: 10 })
      if (!/^[A-Z]{2}$/.test(state)) throw new InputError('Enter the two-letter state, such as OK.')
      if (!/^\d{5}(-\d{4})?$/.test(postalCode)) throw new InputError('Enter a 5-digit ZIP code.')

      const customer: Record<string, unknown> = {}
      let paymentMethodId: string | null = null
      let reference: string
      if (data.setupIntentId) {
        const setupIntentId = asString(data.setupIntentId, 'Job', { min: 6, max: 80 })
        const setup = await whopApi<any>('GET', `/setup_intents/${setupIntentId}`, { env })
        if (setup.account_id !== account || setup.status !== 'succeeded' || !setup.member_id) {
          throw new InputError('That job has no saved card.')
        }
        customer.member_id = setup.member_id
        paymentMethodId = setup.payment_method_id
        reference = setup.id
      } else {
        const email = asString(data.email, 'Email', { min: 5, max: 160 }).toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new InputError('Enter a valid email address.')
        customer.email_address = email
        customer.customer_name = asString(data.name, 'Customer name', { min: 2, max: 80 })
        reference = email
      }
      if (data.mode === 'charge' && !paymentMethodId) {
        throw new InputError('There is no card on file for this customer. Email the invoice instead.')
      }

      const dueInDays = Math.min(Math.max(Math.round(Number(data.dueInDays ?? 7)), 1), 60)
      const body: Record<string, unknown> = {
        account_id: account,
        ...customer,
        items: [
          {
            // A one-off price for this job, attached to the Final Balance product.
            variant: {
              product_id: balance.productId,
              billing_type: 'one_time',
              initial_price: amount,
              currency: balance.currency,
              title: 'Final balance',
              visibility: 'hidden',
            },
            description: memo || 'Remaining balance after final walkthrough. Deposit already applied.',
            quantity: 1,
          },
        ],
        // Whop works out sales tax from where the customer is, so an invoice
        // cannot be opened without an address.
        billing_address: { line1, city, state, postal_code: postalCode, country: 'US' },
        memo: memo || undefined,
        metadata: { purpose: 'final_balance', billed_via: data.mode, job: reference },
      }
      if (data.mode === 'charge') {
        body.payment_method_id = paymentMethodId
      } else {
        body.due_at = new Date(Date.now() + dueInDays * 86_400_000).toISOString()
      }

      const key = await sha256Hex(`${account}:${attemptId}`)
      const draft = await whopApi<any>('POST', '/invoices', { env, body, idempotencyKey: `balance-${key}` })

      // issue = open the invoice and charge the stored card off-session.
      // send  = open the invoice and email the customer a link to pay it.
      const action = data.mode === 'charge' ? 'issue' : 'send'
      let opened: any
      try {
        opened = await whopApi<any>('POST', `/invoices/${draft.id}/${action}`, {
          env,
          idempotencyKey: `balance-${action}-${draft.id}`,
        })
      } catch (error) {
        // Nothing was billed. Do not leave a half-made draft behind.
        await whopApi('POST', `/invoices/${draft.id}/void`, { env, idempotencyKey: `balance-void-${draft.id}` }).catch(() => undefined)
        throw error
      }
      return { ok: true, invoice: summarize(opened, env), charged: data.mode === 'charge' }
    } catch (error) {
      return deskFailure(error)
    }
  })
