// Small request helpers shared by the server functions.
import { getRequestHeader } from '@tanstack/react-start/server'

export class InputError extends Error {
  field: string | null
  constructor(message: string, field: string | null = null) {
    super(message)
    this.name = 'InputError'
    this.field = field
  }
}

/**
 * The site's public origin, taken from the browser's Origin header on the
 * RPC call. Whop serves the worker from an internal host, so the request URL
 * is not the address visitors see.
 */
export function siteOrigin(): string {
  const origin = getRequestHeader('origin')
  if (!origin) throw new InputError('This request must come from the site.')
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new InputError('This request must come from the site.')
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !local) throw new InputError('This request must come from the site.')
  return url.origin
}

export function clientIp(): string | undefined {
  const ip = getRequestHeader('cf-connecting-ip') || getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim()
  return ip || undefined
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Constant-time string comparison (compares digests, so length is not leaked). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256Hex(a), sha256Hex(b)])
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return diff === 0
}

export function asString(value: unknown, field: string, limits: { min?: number; max: number }): string {
  if (typeof value !== 'string') throw new InputError(`${field} is required.`, field)
  const trimmed = value.trim()
  if (trimmed.length < (limits.min ?? 0)) throw new InputError(`${field} is required.`, field)
  if (trimmed.length > limits.max) throw new InputError(`${field} is too long.`, field)
  return trimmed
}

export function asOptionalString(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null || value === '') return ''
  return asString(value, field, { max })
}
