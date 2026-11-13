// Server-only client for the Whop REST API.
//
// Live: on Whop hosting, server-side fetches to the Whop API pass through an
// outbound proxy that attaches the app's own API key, so no key lives in this
// code. `whop apps dev` injects a short-lived token as WHOP_API_KEY instead,
// and a site owner can set their own WHOP_API_KEY app secret to use a key
// with broader permissions. When a key is present we send it ourselves and
// tell the proxy not to add its own.
//
// Sandbox: test checkouts talk to Whop's sandbox API with the
// WHOP_SANDBOX_API_KEY app secret. No real money moves there.
import { whopAccountId } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'

const API_VERSION = '2026-11-10'
const SANDBOX_ORIGIN = 'https://sandbox-api.whop.com'

export class WhopApiError extends Error {
  status: number
  code: string | null
  type: string | null
  constructor(status: number, message: string, type: string | null, code: string | null) {
    super(message)
    this.name = 'WhopApiError'
    this.status = status
    this.type = type
    this.code = code
  }
}

export function accountId(env: WhopEnv = 'production'): string {
  if (env === 'sandbox') {
    const id = whopAccountId('sandbox')
    if (!id) throw new Error('Sandbox is not set up. Run `pnpm whop:sync --sandbox`.')
    return id
  }
  return process.env.WHOP_ACCOUNT_ID || whopAccountId('production') || ''
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface WhopRequest {
  body?: unknown
  idempotencyKey?: string
  query?: Record<string, string | number | undefined>
  env?: WhopEnv
}

export async function whopApi<T = any>(method: Method, path: string, options: WhopRequest = {}): Promise<T> {
  const env = options.env ?? 'production'
  const origin = env === 'sandbox' ? SANDBOX_ORIGIN : process.env.WHOP_API_ORIGIN || 'https://api.whop.com'
  const url = new URL(`${origin}/api/v1${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-Version-Date': API_VERSION,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  const key = env === 'sandbox' ? process.env.WHOP_SANDBOX_API_KEY : process.env.WHOP_API_KEY
  if (env === 'sandbox' && !key) {
    throw new WhopApiError(503, 'Test mode is not set up on this site yet.', 'sandbox_unconfigured', null)
  }
  if (key) {
    headers.Authorization = `Bearer ${key}`
    headers['x-whop-inject-key'] = 'none'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = data?.error ?? {}
    throw new WhopApiError(
      response.status,
      error.message ?? `Whop API ${method} ${path} failed with ${response.status}`,
      error.type ?? null,
      error.code ?? null,
    )
  }
  return data as T
}
