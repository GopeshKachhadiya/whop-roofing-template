// "Request an estimate" -> Whop Leads API.
//
// POST /leads records a Whop user's interest in the account, so it needs a
// `user_id`. A homeowner filling in a form only has an email, so we first
// resolve that email to a Whop user:
//   1. someone who has asked before is matched to their earlier lead;
//   2. an existing customer of the account is found through /members;
//   3. otherwise a zero-charge draft invoice is created with `email_address`,
//      which finds or creates the user, and is voided right away. This is the
//      only API that turns an email into a Whop user, and it uses up one
//      invoice number per new contact.
// The lead then carries the request details as metadata.
import { createServerFn } from '@tanstack/react-start'
import { getOffer } from '#/config/offers'
import { site } from '#/config/site'
import { InputError, asOptionalString, asString, sha256Hex, siteOrigin } from './guards.server'
import { WhopApiError, accountId, whopApi } from './whop.server'

export interface EstimateInput {
  name: string
  email: string
  phone: string
  zip: string
  address?: string
  service: string
  message?: string
  landingUrl?: string
  /** Honeypot: real visitors never fill this. */
  company?: string
  /** Milliseconds the form was open before submit. */
  elapsedMs?: number
}

export type EstimateResult =
  | { ok: true; leadId: string | null }
  | { ok: false; error: string; field: string | null }

function parse(raw: unknown): EstimateInput {
  const data = (raw ?? {}) as Record<string, unknown>
  const name = asString(data.name, 'Name', { min: 2, max: 80 })
  const email = asString(data.email, 'Email', { min: 5, max: 160 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new InputError('Enter a valid email address.', 'email')
  const phone = asString(data.phone, 'Phone', { min: 7, max: 30 })
  if (phone.replace(/\D/g, '').length < 10) throw new InputError('Enter a 10-digit phone number.', 'phone')
  const zip = asString(data.zip, 'ZIP code', { min: 5, max: 10 })
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new InputError('Enter a 5-digit ZIP code.', 'zip')
  const service = asString(data.service, 'Service', { min: 1, max: 40 })
  const known = site.services.some((item) => item.key === service) || service === 'not-sure'
  if (!known) throw new InputError('Choose a service.', 'service')
  return {
    name,
    email,
    phone,
    zip,
    service,
    address: asOptionalString(data.address, 'Address', 160),
    message: asOptionalString(data.message, 'Message', 1000),
    landingUrl: asOptionalString(data.landingUrl, 'Page', 500),
    company: typeof data.company === 'string' ? data.company : '',
    elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : undefined,
  }
}

/** A stable, non-reversible tag for an email, stored on leads so repeat requests can be matched. */
async function emailKey(email: string): Promise<string> {
  return (await sha256Hex(`${accountId()}:${email}`)).slice(0, 24)
}

async function resolveUserId(email: string, name: string): Promise<string> {
  const account = accountId()

  // Someone who has asked before: reuse the user on their earlier lead.
  try {
    const key = await emailKey(email)
    const leads = await whopApi<{ data: Array<{ metadata?: Record<string, unknown> | null; user?: { id?: string } }> }>('GET', '/leads', {
      query: { account_id: account, first: 50 },
    })
    const earlier = leads.data.find((lead) => lead.metadata?.email_key === key)
    if (earlier?.user?.id) return earlier.user.id
  } catch (error) {
    if (!(error instanceof WhopApiError)) throw error
  }

  // An existing customer of the account.
  try {
    const members = await whopApi<{ data: Array<{ user?: { id?: string; email?: string | null } }> }>('GET', '/members', {
      query: { account_id: account, query: email, first: 1 },
    })
    const match = members.data.find((member) => member.user?.email?.toLowerCase() === email)
    if (match?.user?.id) return match.user.id
  } catch (error) {
    if (!(error instanceof WhopApiError)) throw error
  }

  // A new contact: a draft invoice finds or creates the Whop user for this
  // email. It charges nothing, emails no one, and is voided straight away.
  const placeholder = getOffer('inspection')
  if (!placeholder?.planId) throw new Error('Run `pnpm whop:sync` so the inspection plan exists.')
  const day = new Date().toISOString().slice(0, 10)
  const draft = await whopApi<{ id: string; member_id: string }>('POST', '/invoices', {
    body: {
      account_id: account,
      email_address: email,
      customer_name: name,
      items: [{ variant_id: placeholder.planId, quantity: 1 }],
      metadata: { purpose: 'lead_identity' },
    },
    idempotencyKey: `lead-identity-${await sha256Hex(`${account}:${email}:${day}`)}`,
  })
  try {
    // A native invoice is a payment, and the payment names its buyer.
    const payment = await whopApi<{ user?: { id?: string } | null }>('GET', `/payments/${draft.id}`)
    if (payment.user?.id) return payment.user.id
    const member = await whopApi<{ user: { id: string } }>('GET', `/members/${draft.member_id}`, {
      query: { account_id: account },
    })
    return member.user.id
  } finally {
    await whopApi('POST', `/invoices/${draft.id}/void`, { idempotencyKey: `lead-identity-void-${draft.id}` }).catch(() => undefined)
  }
}

export const requestEstimate = createServerFn({ method: 'POST' })
  .validator((data: EstimateInput) => data)
  .handler(async ({ data: raw }): Promise<EstimateResult> => {
    let input: EstimateInput
    try {
      input = parse(raw)
    } catch (error) {
      if (error instanceof InputError) return { ok: false, error: error.message, field: error.field }
      throw error
    }

    // Bots fill hidden fields and submit instantly. Answer as if it worked.
    if (input.company || (input.elapsedMs !== undefined && input.elapsedMs < 2500)) {
      return { ok: true, leadId: null }
    }

    try {
      const origin = siteOrigin()
      const service = site.services.find((item) => item.key === input.service)
      const product = service ? getOffer(service.offerKey ?? '') : undefined
      const userId = await resolveUserId(input.email, input.name)
      const lead = await whopApi<{ id: string }>('POST', '/leads', {
        body: {
          account_id: accountId(),
          user_id: userId,
          product_id: product?.productId ?? undefined,
          referrer: input.landingUrl?.startsWith(origin) ? input.landingUrl : origin,
          metadata: {
            source: 'website_estimate_form',
            name: input.name,
            email: input.email,
            email_key: await emailKey(input.email),
            phone: input.phone,
            zip: input.zip,
            address: input.address || '',
            service: service?.name ?? 'Not sure yet',
            message: input.message || '',
            submitted_at: new Date().toISOString(),
          },
        },
      })
      return { ok: true, leadId: lead.id }
    } catch (error) {
      console.error('[estimate] lead not created', error instanceof Error ? error.message : error)
      if (error instanceof InputError) return { ok: false, error: error.message, field: error.field }
      return {
        ok: false,
        error: `We couldn't send your request. Call us at ${site.company.phone} and we'll take it by phone.`,
        field: null,
      }
    }
  })
