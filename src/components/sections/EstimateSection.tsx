// "Request an estimate". Submissions go to the Whop Leads API through the
// requestEstimate server function, then fire the estimate_requested event.
import { useServerFn } from '@tanstack/react-start'
import { CircleCheck, Clock, LoaderCircle, MapPin, Phone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useEstimate } from '#/components/EstimateContext'
import { site } from '#/config/site'
import { track } from '#/lib/track'
import { requestEstimate } from '#/server/estimate.functions'

type Fields = 'name' | 'phone' | 'email' | 'zip' | 'address' | 'service' | 'message'
type Values = Record<Fields, string>
type Errors = Partial<Record<Fields, string>>

const empty: Values = { name: '', phone: '', email: '', zip: '', address: '', service: '', message: '' }

function validate(field: Fields, value: string): string | undefined {
  const text = value.trim()
  switch (field) {
    case 'name':
      return text.length < 2 ? 'Enter your name so we know who to ask for.' : undefined
    case 'phone':
      return text.replace(/\D/g, '').length < 10 ? 'Enter a 10-digit phone number.' : undefined
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) ? undefined : 'Enter an email like name@example.com.'
    case 'zip':
      return /^\d{5}$/.test(text) ? undefined : 'Enter the 5-digit ZIP code of the property.'
    case 'service':
      return text ? undefined : 'Choose the closest match. "Not sure yet" is fine.'
    default:
      return undefined
  }
}

const required: Fields[] = ['name', 'phone', 'email', 'zip', 'service']

export function EstimateSection() {
  const { service, setService } = useEstimate()
  const send = useServerFn(requestEstimate)
  const [values, setValues] = useState<Values>(empty)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [reference, setReference] = useState<string | null>(null)
  const openedAt = useRef(0)
  const honeypot = useRef<HTMLInputElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  // A service picked elsewhere on the page arrives through context.
  useEffect(() => {
    if (service) setValues((current) => ({ ...current, service }))
  }, [service])

  useEffect(() => {
    if (state === 'sent') successRef.current?.focus()
  }, [state])

  const set = (field: Fields, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'service') setService(value)
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const blur = (field: Fields) => {
    const message = validate(field, values[field])
    setErrors((current) => ({ ...current, [field]: message }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (state === 'sending') return
    const found: Errors = {}
    for (const field of required) {
      const message = validate(field, values[field])
      if (message) found[field] = message
    }
    setErrors(found)
    const first = required.find((field) => found[field])
    if (first) {
      document.getElementById(`estimate-${first}`)?.focus()
      return
    }

    setState('sending')
    setFormError(null)
    try {
      const result = await send({
        data: {
          ...values,
          landingUrl: window.location.href.split('#')[0],
          company: honeypot.current?.value ?? '',
          elapsedMs: Date.now() - openedAt.current,
        },
      })
      if (!result.ok) {
        setState('idle')
        if (result.field && result.field in empty) {
          setErrors((current) => ({ ...current, [result.field as Fields]: result.error }))
          document.getElementById(`estimate-${result.field}`)?.focus()
        } else {
          setFormError(result.error)
        }
        return
      }
      setReference(result.leadId)
      setState('sent')
      // The lead ID makes the event safe to count once even if it is re-sent.
      const eventId = result.leadId ?? undefined
      track('estimate_requested', { event_id: eventId, service: values.service, zip: values.zip })
      track('lead', { event_id: eventId })
    } catch {
      setState('idle')
      setFormError(`We couldn't send your request. Check your connection and try again, or call ${site.company.phone}.`)
    }
  }

  const describedBy = (field: Fields, hint?: boolean) =>
    [errors[field] ? `estimate-${field}-error` : null, hint ? `estimate-${field}-hint` : null].filter(Boolean).join(' ') || undefined

  const { company, estimate } = site

  return (
    <section id="estimate" className="theme-bone overflow-hidden pt-24 pb-20 lg:pt-36 lg:pb-28" aria-labelledby="estimate-title">
      <div className="shell">
        <p className="type-display text-center !text-[clamp(3.75rem,1rem+11.5vw,12.5rem)]" aria-hidden="true">
          {estimate.bigLines.map((line, index) => (
            <span key={line} className="block" style={{ paddingLeft: index % 2 ? '0.8em' : 0 }}>
              {line}
            </span>
          ))}
        </p>
      </div>
      <div id="estimate-form" className="shell mt-16 grid scroll-mt-24 gap-12 lg:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 id="estimate-title" className="type-title !text-[clamp(2rem,1.3rem+2.4vw,3.5rem)]">
            {estimate.headline}
          </h2>
          <p className="type-lede mt-4">{estimate.body}</p>

          <dl className="mt-10 grid gap-6">
            <div className="flex gap-4">
              <Phone aria-hidden="true" className="mt-1 size-5 flex-none text-accent" />
              <div>
                <dt className="type-note text-ink-soft">Call or text</dt>
                <dd className="m-0 mt-0.5">
                  <a href={company.phoneHref} className="type-figure text-[1.5rem] no-underline hover:text-accent">
                    {company.phone}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <MapPin aria-hidden="true" className="mt-1 size-5 flex-none text-accent" />
              <div>
                <dt className="type-note text-ink-soft">Yard and office</dt>
                <dd className="m-0 mt-0.5">
                  {company.street}, {company.city}, {company.state} {company.zip}
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <Clock aria-hidden="true" className="mt-1 size-5 flex-none text-accent" />
              <div>
                <dt className="type-note text-ink-soft">Hours</dt>
                <dd className="m-0 mt-0.5">
                  {company.hours.map((row) => (
                    <span key={row.days} className="block">
                      {row.days}, {row.time.toLowerCase()}
                    </span>
                  ))}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="panel p-6 sm:p-9">
          {state === 'sent' ? (
            <div ref={successRef} tabIndex={-1} role="status" className="animate-panel py-6 outline-none">
              <CircleCheck aria-hidden="true" className="size-11 text-ok" strokeWidth={1.75} />
              <h3 className="type-heading mt-5 !text-[1.75rem]">{estimate.success.title}</h3>
              <p className="mt-3 max-w-lg text-ink-soft">{estimate.success.body}</p>
              {reference ? <p className="type-note mt-6 text-ink-soft">Reference {reference}</p> : null}
              <a href={company.phoneHref} className="btn btn-quiet mt-7">
                <Phone aria-hidden="true" className="size-[1.125rem]" />
                Call the storm line
              </a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-describedby={formError ? 'estimate-form-error' : undefined}>
              {/* Hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[200vw] h-0 w-0 overflow-hidden">
                <label>
                  Company
                  <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label htmlFor="estimate-name" className="field-label">
                    Full name
                  </label>
                  <input
                    id="estimate-name"
                    className="field-input"
                    autoComplete="name"
                    value={values.name}
                    onChange={(event) => set('name', event.target.value)}
                    onBlur={() => blur('name')}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={describedBy('name')}
                    required
                  />
                  {errors.name ? (
                    <p id="estimate-name-error" className="field-error">
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="estimate-phone" className="field-label">
                    Phone
                  </label>
                  <input
                    id="estimate-phone"
                    className="field-input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={site.company.phoneExample}
                    value={values.phone}
                    onChange={(event) => set('phone', event.target.value)}
                    onBlur={() => blur('phone')}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={describedBy('phone')}
                    required
                  />
                  {errors.phone ? (
                    <p id="estimate-phone-error" className="field-error">
                      {errors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="estimate-email" className="field-label">
                    Email
                  </label>
                  <input
                    id="estimate-email"
                    className="field-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={values.email}
                    onChange={(event) => set('email', event.target.value)}
                    onBlur={() => blur('email')}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={describedBy('email')}
                    required
                  />
                  {errors.email ? (
                    <p id="estimate-email-error" className="field-error">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="estimate-zip" className="field-label">
                    Property ZIP code
                  </label>
                  <input
                    id="estimate-zip"
                    className="field-input"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    placeholder={site.company.zip}
                    value={values.zip}
                    onChange={(event) => set('zip', event.target.value.replace(/\D/g, ''))}
                    onBlur={() => blur('zip')}
                    aria-invalid={Boolean(errors.zip)}
                    aria-describedby={describedBy('zip')}
                    required
                  />
                  {errors.zip ? (
                    <p id="estimate-zip-error" className="field-error">
                      {errors.zip}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="estimate-service" className="field-label">
                    What do you need?
                  </label>
                  <select
                    id="estimate-service"
                    className="field-input"
                    value={values.service}
                    onChange={(event) => set('service', event.target.value)}
                    onBlur={() => blur('service')}
                    aria-invalid={Boolean(errors.service)}
                    aria-describedby={describedBy('service')}
                    required
                  >
                    <option value="" disabled>
                      Choose a service
                    </option>
                    {site.services.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                    <option value="not-sure">Not sure yet</option>
                  </select>
                  {errors.service ? (
                    <p id="estimate-service-error" className="field-error">
                      {errors.service}
                    </p>
                  ) : null}
                </div>

                <div className="field sm:col-span-2">
                  <label htmlFor="estimate-address" className="field-label">
                    Street address <span className="font-normal text-ink-soft">(optional)</span>
                  </label>
                  <input
                    id="estimate-address"
                    className="field-input"
                    autoComplete="street-address"
                    value={values.address}
                    onChange={(event) => set('address', event.target.value)}
                  />
                </div>

                <div className="field sm:col-span-2">
                  <label htmlFor="estimate-message" className="field-label">
                    Anything we should know? <span className="font-normal text-ink-soft">(optional)</span>
                  </label>
                  <textarea
                    id="estimate-message"
                    className="field-input min-h-28 resize-y"
                    maxLength={1000}
                    value={values.message}
                    onChange={(event) => set('message', event.target.value)}
                    aria-describedby="estimate-message-hint"
                  />
                  <p id="estimate-message-hint" className="field-hint">
                    Where it leaks, the age of the roof, or an insurance claim number all help.
                  </p>
                </div>
              </div>

              {formError ? (
                <p id="estimate-form-error" role="alert" className="mt-6 rounded-[12px] bg-danger-wash px-4 py-3 text-[0.9688rem] font-semibold text-danger">
                  {formError}
                </p>
              ) : null}

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
                <button type="submit" className="btn btn-primary min-w-56" aria-busy={state === 'sending'}>
                  {state === 'sending' ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="animate-spin-slow size-[1.125rem]" />
                      Sending your request
                    </>
                  ) : (
                    'Request my estimate'
                  )}
                </button>
                <p className="field-hint">No charge for estimates. We call within one business hour.</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
