import { Link } from '@tanstack/react-router'
import { Menu, Phone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { site } from '#/config/site'
import { Brand } from './Brand'
import { useEstimate } from './EstimateContext'

const links = [
  { href: '#services', label: 'Services' },
  { href: '#billing', label: 'Billing' },
  { href: '#financing', label: 'Financing' },
  { href: '#area', label: 'Service area' },
  { href: '#reviews', label: 'Reviews' },
]

/** A floating bar that stays dark over every section. */
export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { openEstimate } = useEstimate()
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="fixed inset-x-3 top-3 z-40 overflow-hidden rounded-[18px] border border-white/10 bg-[#0d0d0c]/80 text-[#eeece7] shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <a href="#services" className="btn btn-primary absolute top-1 left-1 z-50 -translate-y-20 focus-visible:translate-y-0">
        Skip to services
      </a>
      <div className="flex h-[3.75rem] items-center justify-between gap-4 pr-2.5 pl-4">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label={`${site.company.name} home`} className="no-underline">
            <Brand />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-[0.9375rem] font-medium whitespace-nowrap text-[#eeece7]/85 no-underline transition-colors duration-150 hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <a href={site.company.phoneHref} className="type-note hidden min-h-11 items-center gap-2 px-2 whitespace-nowrap no-underline hover:text-white xl:flex">
            <Phone aria-hidden="true" className="size-3.5" />
            {site.company.phone}
          </a>
          <a href={site.company.phoneHref} aria-label={`Call ${site.company.phone}`} className="flex size-11 items-center justify-center rounded-[12px] border border-white/15 xl:hidden">
            <Phone aria-hidden="true" className="size-[1.0625rem]" />
          </a>
          <button type="button" className="btn btn-primary !min-h-11 hidden sm:inline-flex" onClick={() => openEstimate()}>
            Request an estimate
          </button>
          <button
            ref={toggle}
            type="button"
            className="flex size-11 items-center justify-center rounded-[12px] border border-white/15 bg-transparent text-inherit lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="animate-panel border-t border-white/10 lg:hidden">
          <div className="flex flex-col px-4 py-2">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="type-heading flex min-h-12 items-center border-b border-white/10 no-underline last:border-0">
                {link.label}
              </a>
            ))}
            <button
              type="button"
              className="btn btn-primary mt-3 mb-2 sm:hidden"
              onClick={() => {
                setOpen(false)
                openEstimate()
              }}
            >
              Request an estimate
            </button>
          </div>
        </nav>
      ) : null}
    </header>
  )
}
