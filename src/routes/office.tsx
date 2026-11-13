// The job desk. A roofer's office uses this after the final walkthrough to
// bill the remaining balance through the Whop Invoices API: either charge the
// card saved at deposit checkout, or email an invoice the customer pays
// through Whop's hosted checkout (where pay-over-time options appear).
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CreditCard, ExternalLink, LoaderCircle, Lock, Mail, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Brand } from '#/components/Brand'
import { TestModeBanner } from '#/components/checkout/TestModeBanner'
import { site } from '#/config/site'
import { cx, money, shortDate } from '#/lib/format'
import { useWhopEnv } from '#/lib/whopEnv'
import { billBalance, deskStatus, listJobs } from '#/server/office.functions'
import type { BillingAddress, InvoiceSummary, Job } from '#/server/office.functions'

export const Route = createFileRoute('/office')({
  loader: () => deskStatus(),
  head: () => ({ meta: [{ title: `Job desk | ${site.company.name}` }, { name: 'robots', content: 'noindex' }] }),
  component: OfficePage,
})

const PASS_KEY = 'office-passcode'

function OfficePage() {
  const { configured } = Route.useLoaderData()
  const { env, ready } = useWhopEnv()
  const load = useServerFn(listJobs)
  const [passcode, setPasscode] = useState('')
  const [typed, setTyped] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async (code: string, quiet = false) => {
    if (!quiet) setUnlocking(true)
    setRefreshing(true)
    setGateError(null)
    const result = await load({ data: { passcode: code, env } }).catch(() => ({ ok: false as const, error: 'Could not reach the server. Try again.' }))
    setUnlocking(false)
    setRefreshing(false)
    if (!result.ok) {
      if (!quiet || ('locked' in result && result.locked)) {
        setPasscode('')
        setJobs(null)
        try {
          window.sessionStorage.removeItem(PASS_KEY)
        } catch {
          // ignore
        }
      }
      setGateError(result.error)
      return
    }
    setPasscode(code)
    setJobs(result.jobs)
    setInvoices(result.invoices)
    try {
      window.sessionStorage.setItem(PASS_KEY, code)
    } catch {
      // Private windows may refuse storage; the desk still works until reload.
    }
  }

  // Stay unlocked across reloads in this tab.
  useEffect(() => {
    if (!ready || !configured) return
    let saved: string | null = null
    try {
      saved = window.sessionStorage.getItem(PASS_KEY)
    } catch {
      saved = null
    }
    if (saved) void refresh(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, configured, env])

  const unlock = (event: FormEvent) => {
    event.preventDefault()
    if (typed) void refresh(typed)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label={`${site.company.name} home`} className="no-underline">
            <Brand />
          </Link>
          <p className="type-note flex items-center gap-2 text-ink-soft">
            <Lock aria-hidden="true" className="size-4" />
            Job desk, staff only
          </p>
        </div>
      </header>
      {ready && env === 'sandbox' ? <TestModeBanner /> : null}

      <main className="shell py-10 lg:py-14">
        {!configured ? (
          <div className="max-w-2xl">
            <h1 className="type-title">The job desk is locked</h1>
            <p className="type-lede mt-4">
              Set a passcode to open it. From the project folder, run the command below with a passcode of your own, then deploy again.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-[12px] border border-line bg-surface p-4 text-[0.9375rem]">
              <code>whop apps secrets set --secret OFFICE_PASSCODE=choose-a-long-passcode</code>
            </pre>
          </div>
        ) : jobs === null ? (
          <form onSubmit={unlock} className="max-w-md" noValidate>
            <h1 className="type-title">Job desk</h1>
            <p className="type-lede mt-4">Bill final balances for finished jobs. Enter the office passcode to continue.</p>
            <div className="field mt-8">
              <label htmlFor="office-passcode" className="field-label">
                Office passcode
              </label>
              <input
                id="office-passcode"
                className="field-input"
                type="password"
                autoComplete="current-password"
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value)
                  setGateError(null)
                }}
                aria-invalid={Boolean(gateError)}
                aria-describedby={gateError ? 'office-passcode-error' : undefined}
              />
              {gateError ? (
                <p id="office-passcode-error" role="alert" className="field-error">
                  {gateError}
                </p>
              ) : null}
            </div>
            <button type="submit" className="btn btn-primary mt-5" disabled={!typed || unlocking} aria-busy={unlocking}>
              {unlocking ? <LoaderCircle aria-hidden="true" className="animate-spin-slow size-[1.125rem]" /> : null}
              Open the job desk
            </button>
          </form>
        ) : (
          <Desk
            passcode={passcode}
            jobs={jobs}
            invoices={invoices}
            refreshing={refreshing}
            onRefresh={() => refresh(passcode, true)}
            notice={gateError}
          />
        )}
      </main>
    </div>
  )
}

function Desk({
  passcode,
  jobs,
  invoices,
  refreshing,
  onRefresh,
  notice,
}: {
  passcode: string
  jobs: Job[]
  invoices: InvoiceSummary[]
  refreshing: boolean
  onRefresh: () => void
  notice: string | null
}) {
  const { env } = useWhopEnv()
  const bill = useServerFn(billBalance)
  const [selected, setSelected] = useState<string>(jobs[0]?.setupIntentId ?? 'new')
  const [mode, setMode] = useState<'charge' | 'send'>(jobs.length > 0 ? 'charge' : 'send')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState<BillingAddress>({ line1: '', city: site.company.city, state: site.company.state, postalCode: '' })
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ invoice: InvoiceSummary; charged: boolean } | null>(null)

  const job = jobs.find((item) => item.setupIntentId === selected)
  const canCharge = Boolean(job)
  const effectiveMode = canCharge ? mode : 'send'
  const value = Number(amount)
  const addressValid =
    address.line1.trim().length > 2 && address.city.trim().length > 1 && /^[A-Za-z]{2}$/.test(address.state.trim()) && /^\d{5}$/.test(address.postalCode.trim())
  const valid =
    Number.isFinite(value) && value >= 1 && addressValid && (job ? true : name.trim().length > 1 && /\S+@\S+\.\S+/.test(email))

  // A job's card usually comes with the address the customer typed at checkout.
  useEffect(() => {
    if (job?.address) setAddress(job.address)
  }, [job])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    const result = await bill({
      data: {
        passcode,
        env,
        mode: effectiveMode,
        amount: value,
        memo,
        setupIntentId: job?.setupIntentId,
        email: job ? undefined : email,
        name: job ? undefined : name,
        address,
        attemptId,
      },
    }).catch(() => ({ ok: false as const, error: 'Could not reach the server. Nothing was billed.' }))
    setBusy(false)
    // The next press is a new request, whatever happened to this one.
    setAttemptId(crypto.randomUUID())
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone({ invoice: result.invoice, charged: result.charged })
    setAmount('')
    setMemo('')
    onRefresh()
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <section aria-labelledby="bill-title">
        <h1 id="bill-title" className="type-title">
          Bill a final balance
        </h1>
        <p className="type-lede mt-4">Creates a Whop invoice for the amount still owed after the deposit.</p>

        <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
          <div className="field">
            <label htmlFor="bill-job" className="field-label">
              Customer
            </label>
            <select id="bill-job" className="field-input" value={selected} onChange={(event) => setSelected(event.target.value)}>
              {jobs.map((item) => (
                <option key={item.setupIntentId} value={item.setupIntentId}>
                  {item.customer} ({item.card})
                </option>
              ))}
              <option value="new">Someone without a card on file</option>
            </select>
            {job ? (
              <p className="field-hint">
                {job.email ? `${job.email}. ` : ''}Card saved {shortDate(job.savedAt)}
                {job.depositStatus ? `, deposit ${job.depositStatus.replace(/_/g, ' ')}` : ''}.
              </p>
            ) : null}
          </div>

          {!job ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="bill-name" className="field-label">
                  Customer name
                </label>
                <input id="bill-name" className="field-input" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="bill-email" className="field-label">
                  Customer email
                </label>
                <input id="bill-email" className="field-input" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
          ) : null}

          <fieldset className="m-0 grid gap-5 border-0 p-0">
            <legend className="field-label mb-2 p-0">Property address</legend>
            <div className="field">
              <label htmlFor="bill-street" className="field-hint">
                Street
              </label>
              <input
                id="bill-street"
                className="field-input"
                autoComplete="off"
                value={address.line1}
                onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))}
                aria-describedby="bill-address-hint"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem] gap-3">
              <div className="field">
                <label htmlFor="bill-city" className="field-hint">
                  City
                </label>
                <input id="bill-city" className="field-input" autoComplete="off" value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="bill-state" className="field-hint">
                  State
                </label>
                <input
                  id="bill-state"
                  className="field-input uppercase"
                  autoComplete="off"
                  maxLength={2}
                  value={address.state}
                  onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value.replace(/[^A-Za-z]/g, '').toUpperCase() }))}
                />
              </div>
              <div className="field">
                <label htmlFor="bill-zip" className="field-hint">
                  ZIP
                </label>
                <input
                  id="bill-zip"
                  className="field-input"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  value={address.postalCode}
                  onChange={(event) => setAddress((current) => ({ ...current, postalCode: event.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>
            <p id="bill-address-hint" className="field-hint -mt-2">
              Whop uses the address to work out any sales tax on the invoice.
            </p>
          </fieldset>

          <div className="field">
            <label htmlFor="bill-amount" className="field-label">
              Balance to bill, in dollars
            </label>
            <input
              id="bill-amount"
              className="field-input type-figure !text-[1.25rem]"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
              aria-describedby="bill-amount-hint"
            />
            <p id="bill-amount-hint" className="field-hint">
              The contract price less the deposit already paid.
            </p>
          </div>

          <div className="field">
            <label htmlFor="bill-memo" className="field-label">
              Note on the invoice <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea id="bill-memo" className="field-input min-h-20 resize-y" maxLength={600} value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>

          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="field-label mb-2 p-0">How should it be collected?</legend>
            <label className={cx('flex gap-3 rounded-[12px] border p-4 transition-colors duration-150', effectiveMode === 'charge' ? 'border-accent bg-accent-wash' : 'border-line-strong', !canCharge && 'opacity-55')}>
              <input type="radio" name="mode" className="mt-1 size-4 accent-[var(--color-accent)]" checked={effectiveMode === 'charge'} disabled={!canCharge} onChange={() => setMode('charge')} />
              <span>
                <span className="flex items-center gap-2 font-bold">
                  <CreditCard aria-hidden="true" className="size-4" />
                  Charge the card on file
                </span>
                <span className="mt-1 block text-[0.9375rem] text-ink-soft">
                  Issues the invoice and charges the card saved at deposit checkout. If the bank declines, Whop emails the customer a pay link.
                </span>
              </span>
            </label>
            <label className={cx('flex gap-3 rounded-[12px] border p-4 transition-colors duration-150', effectiveMode === 'send' ? 'border-accent bg-accent-wash' : 'border-line-strong')}>
              <input type="radio" name="mode" className="mt-1 size-4 accent-[var(--color-accent)]" checked={effectiveMode === 'send'} onChange={() => setMode('send')} />
              <span>
                <span className="flex items-center gap-2 font-bold">
                  <Mail aria-hidden="true" className="size-4" />
                  Email the invoice
                </span>
                <span className="mt-1 block text-[0.9375rem] text-ink-soft">
                  Sends a numbered invoice due in 7 days. The customer pays on Whop's checkout by card, wallet or a pay-over-time option.
                </span>
              </span>
            </label>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-[12px] bg-danger-wash px-4 py-3 text-[0.9688rem] font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary" disabled={!valid || busy} aria-busy={busy}>
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin-slow size-[1.125rem]" /> : null}
            {effectiveMode === 'charge'
              ? `Charge ${valid ? money(value) : 'the balance'} to the card on file`
              : `Email an invoice${valid ? ` for ${money(value)}` : ''}`}
          </button>
        </form>

        {done ? (
          <div role="status" className="animate-panel mt-6 rounded-[12px] border border-ok bg-ok-wash p-5">
            <p className="font-bold text-ok">
              Invoice {done.invoice.number} {done.charged ? 'issued. The card on file is being charged.' : 'sent to the customer.'}
            </p>
            <p className="mt-1 text-[0.9375rem]">
              {done.invoice.total ? `${money(Number(done.invoice.total), done.invoice.currency ?? 'usd')}, ` : ''}status {done.invoice.status}. Whop confirms payment with a
              payment.succeeded webhook.
            </p>
            {done.invoice.payUrl ? (
              <a href={done.invoice.payUrl} target="_blank" rel="noreferrer" className="link mt-3 inline-flex items-center gap-1.5 text-[0.9375rem]">
                Open the customer's pay link
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="invoices-title">
        <div className="flex items-center justify-between gap-4">
          <h2 id="invoices-title" className="type-heading">
            Recent invoices
          </h2>
          <button type="button" className="btn btn-quiet !min-h-10 !px-3 !text-[0.9375rem]" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={cx('size-4', refreshing && 'animate-spin-slow')} />
            Refresh
          </button>
        </div>
        {notice ? <p className="field-error mt-3">{notice}</p> : null}

        {invoices.length === 0 ? (
          <p className="mt-6 rounded-[12px] border border-dashed border-line-strong p-6 text-ink-soft">
            No invoices yet. Bill a balance and it will show up here with its status.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.9688rem]">
              <thead>
                <tr className="type-note border-b border-line-strong text-ink-soft">
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Invoice</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Customer</th>
                  <th scope="col" className="py-2.5 pr-4 text-right font-semibold">Total</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Status</th>
                  <th scope="col" className="py-2.5 font-semibold">Collected by</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-line">
                    <td className="py-3 pr-4">
                      <span className="type-note block">{invoice.number}</span>
                      <span className="text-sm text-ink-soft">{shortDate(invoice.createdAt)}</span>
                    </td>
                    <td className="py-3 pr-4">{invoice.customer ?? 'Customer'}</td>
                    <td className="type-figure py-3 pr-4 text-right">
                      {invoice.total ? money(Number(invoice.total), invoice.currency ?? 'usd') : ''}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cx(
                          'type-note inline-block rounded-full px-2 py-0.5',
                          invoice.status === 'paid' ? 'bg-ok-wash text-ok' : invoice.status === 'void' ? 'bg-line text-ink-soft' : 'bg-accent-wash text-accent',
                        )}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {invoice.payUrl ? (
                        <a href={invoice.payUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5">
                          Pay link
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                        </a>
                      ) : invoice.autoCharge ? (
                        'Card on file'
                      ) : (
                        'Emailed invoice'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="type-heading mt-12">Cards on file from deposits</h2>
        {jobs.length === 0 ? (
          <p className="mt-5 rounded-[12px] border border-dashed border-line-strong p-6 text-ink-soft">
            When a customer pays a deposit on the site, their saved card appears here ready to bill.
          </p>
        ) : (
          <ul className="m-0 mt-4 list-none p-0">
            {jobs.map((item) => (
              <li key={item.setupIntentId} className="flex items-center justify-between gap-4 border-b border-line py-3.5">
                <span>
                  <span className="block font-bold">{item.customer}</span>
                  <span className="text-[0.9375rem] text-ink-soft">
                    {item.card}, saved {shortDate(item.savedAt)}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-quiet !min-h-10 !px-3 !text-[0.9375rem]"
                  onClick={() => {
                    setSelected(item.setupIntentId)
                    setMode('charge')
                    document.getElementById('bill-amount')?.focus()
                  }}
                >
                  Bill this job
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
