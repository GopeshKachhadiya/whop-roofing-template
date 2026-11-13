#!/usr/bin/env node
// Creates the products and plans listed in src/config/offers.json on Whop and
// records their IDs for the site to use. Safe to re-run: an offer whose price
// and title are unchanged is left alone; a changed price gets a new plan.
//
//   pnpm whop:sync              live business, through the signed-in `whop` CLI
//                               -> src/config/whop.generated.json
//   pnpm whop:sync --sandbox    Whop sandbox (test cards, no real money), using
//                               WHOP_SANDBOX_API_KEY from sandbox.whop.com
//                               -> src/config/whop.sandbox.json
//   add --dry-run to print what would be created
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = process.argv.includes('--sandbox')
const dryRun = process.argv.includes('--dry-run')
const offersPath = join(root, 'src/config/offers.json')
const outPath = join(root, sandbox ? 'src/config/whop.sandbox.json' : 'src/config/whop.generated.json')

const { currency, offers } = JSON.parse(readFileSync(offersPath, 'utf8'))
const saved = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {}
const generated = { accountId: saved.accountId ?? null, currency, offers: saved.offers ?? {} }

// Two ways to reach Whop, one interface: createProduct / createPlan.
function cliBackend() {
  const whop = (args) =>
    JSON.parse(execFileSync('whop', [...args, '--format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  const auth = whop(['auth', 'status'])
  if (!auth.loggedIn || !auth.account?.id) {
    throw new Error('Not signed in. Run `whop login`, then `whop quickstart` to pick a business.')
  }
  return {
    accountId: auth.account.id,
    createProduct: (offer) =>
      whop([
        'products', 'create',
        '--title', offer.productTitle,
        '--headline', offer.productHeadline,
        '--description', offer.productDescription,
        '--visibility', 'hidden',
        '--idempotency-key', `sync-product-${auth.account.id}-${offer.sku}`,
      ]),
    createPlan: (offer, productId) =>
      whop([
        'variants', 'create',
        '--product_id', productId,
        '--title', offer.planTitle,
        '--description', offer.planDescription,
        '--billing_type', 'one_time',
        '--release_method', 'buy_now',
        '--initial_price', String(offer.price),
        '--currency', currency,
        '--unlimited_stock',
        '--visibility', 'visible',
        '--sku', offer.sku,
        '--idempotency-key', `sync-plan-${auth.account.id}-${offer.sku}-${offer.price}-${offer.planTitle}`,
      ]),
  }
}

async function sandboxBackend() {
  const key = process.env.WHOP_SANDBOX_API_KEY
  if (!key) {
    throw new Error(
      'Set WHOP_SANDBOX_API_KEY first. Create a sandbox business and an API key at https://sandbox.whop.com/dashboard/developer.',
    )
  }
  const api = async (method, path, body, idempotencyKey) => {
    const response = await fetch(`https://sandbox-api.whop.com/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Api-Version-Date': '2026-11-10',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`Sandbox ${method} ${path}: ${data?.error?.message ?? response.status}`)
    return data
  }
  const account = await api('GET', '/accounts/me')
  return {
    accountId: account.id,
    createProduct: (offer) =>
      api(
        'POST',
        '/products',
        { account_id: account.id, title: offer.productTitle, headline: offer.productHeadline, description: offer.productDescription, visibility: 'hidden' },
        `sync-product-${account.id}-${offer.sku}`,
      ),
    createPlan: (offer, productId) =>
      api(
        'POST',
        '/variants',
        {
          account_id: account.id,
          product_id: productId,
          title: offer.planTitle,
          description: offer.planDescription,
          billing_type: 'one_time',
          release_method: 'buy_now',
          initial_price: offer.price,
          currency,
          unlimited_stock: true,
          visibility: 'visible',
          sku: offer.sku,
        },
        `sync-plan-${account.id}-${offer.sku}-${offer.price}-${offer.planTitle}`,
      ),
  }
}

try {
  const backend = sandbox ? await sandboxBackend() : cliBackend()
  if (generated.accountId && generated.accountId !== backend.accountId) {
    throw new Error(
      `${outPath} belongs to ${generated.accountId}, but you are signed in to ${backend.accountId}.\n` +
        'Delete that file to set this template up on a different business.',
    )
  }
  generated.accountId = backend.accountId
  console.log(`${sandbox ? 'Sandbox' : 'Live'} business ${backend.accountId}`)

  for (const offer of offers) {
    const known = generated.offers[offer.key] ?? {}

    if (!known.productId) {
      console.log(`+ product  ${offer.productTitle}`)
      if (!dryRun) known.productId = (await backend.createProduct(offer)).id
    }

    const priced = typeof offer.price === 'number'
    const planIsCurrent = known.planId && known.price === offer.price && known.planTitle === offer.planTitle
    if (priced && !planIsCurrent) {
      console.log(`+ plan     ${offer.planTitle}  ${offer.price} ${currency.toUpperCase()}`)
      if (!dryRun) {
        known.planId = (await backend.createPlan(offer, known.productId)).id
        known.price = offer.price
        known.planTitle = offer.planTitle
      }
    }

    known.kind = offer.kind
    generated.offers[offer.key] = known
  }

  if (!dryRun) {
    writeFileSync(outPath, JSON.stringify(generated, null, 2) + '\n')
    console.log(`\nWrote ${outPath}`)
  }
  for (const [key, value] of Object.entries(generated.offers)) {
    console.log(`  ${key.padEnd(12)} ${value.productId ?? '-'}  ${value.planId ?? '(no fixed plan)'}`)
  }
  if (sandbox && !dryRun) {
    console.log('\nNext: whop apps secrets set --secret WHOP_SANDBOX_API_KEY=<the same key>, then whop apps deploy.')
    console.log('Test checkouts then work at https://<your-site>/checkout/deposit?mode=test')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
