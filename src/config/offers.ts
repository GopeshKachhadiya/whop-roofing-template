// Joins the pricing you edit (offers.json) with the Whop IDs that
// `pnpm whop:sync` writes. There are two sets of IDs: the live business
// (whop.generated.json) and, optionally, a Whop sandbox business used for
// test checkouts (whop.sandbox.json, written by `pnpm whop:sync --sandbox`).
import offersJson from './offers.json'
import live from './whop.generated.json'
import sandbox from './whop.sandbox.json'

export type WhopEnv = 'production' | 'sandbox'
export type OfferKind = 'service' | 'deposit' | 'balance'

export interface Offer {
  key: string
  kind: OfferKind
  title: string
  description: string
  price: number | null
  currency: string
  productId: string | null
  planId: string | null
}

type Ids = { accountId: string | null; offers: Record<string, { productId?: string; planId?: string } | undefined> }
const ids: Record<WhopEnv, Ids> = {
  production: live as Ids,
  sandbox: sandbox as Ids,
}

export const currency = offersJson.currency

/** True once `pnpm whop:sync --sandbox` has created the test catalog. */
export const sandboxReady = Boolean(ids.sandbox.accountId)

export function whopAccountId(env: WhopEnv = 'production'): string | null {
  return ids[env].accountId
}

export function listOffers(env: WhopEnv = 'production'): Offer[] {
  return offersJson.offers.map((offer) => {
    const match = ids[env].offers[offer.key]
    return {
      key: offer.key,
      kind: offer.kind as OfferKind,
      title: offer.planTitle ?? offer.productTitle,
      description: offer.planDescription ?? offer.productHeadline,
      price: typeof offer.price === 'number' ? offer.price : null,
      currency: offersJson.currency,
      productId: match?.productId ?? null,
      planId: match?.planId ?? null,
    }
  })
}

export function getOffer(key: string, env: WhopEnv = 'production'): Offer | undefined {
  return listOffers(env).find((offer) => offer.key === key)
}

/** An offer a visitor can check out: it has a fixed price and a synced plan. */
export function getPurchasableOffer(key: string, env: WhopEnv = 'production'): (Offer & { price: number; planId: string }) | undefined {
  const offer = getOffer(key, env)
  if (!offer || offer.price === null || !offer.planId || offer.kind === 'balance') return undefined
  return offer as Offer & { price: number; planId: string }
}

export function asWhopEnv(value: unknown): WhopEnv {
  return value === 'sandbox' && sandboxReady ? 'sandbox' : 'production'
}
