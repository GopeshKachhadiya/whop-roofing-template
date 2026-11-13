import { Link } from '@tanstack/react-router'
import { site } from '#/config/site'
import { Brand } from './Brand'

export function SiteFooter() {
  const { company } = site
  return (
    <footer className="theme-bone">
      <div className="shell grid gap-10 border-t border-line-strong py-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-5 max-w-sm text-[0.9688rem] text-ink-soft">
            {company.legalName}
            <br />
            {company.license}
            <br />
            Roofing the {company.region} since {company.founded}
          </p>
        </div>
        <div>
          <h2 className="type-note text-ink-soft">Visit or call</h2>
          <address className="mt-3 text-[1.0625rem] not-italic">
            {company.street}
            <br />
            {company.city}, {company.state} {company.zip}
            <br />
            <a href={company.phoneHref} className="link">
              {company.phone}
            </a>
          </address>
        </div>
        <div>
          <h2 className="type-note text-ink-soft">Hours</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[1.0625rem]">
            {company.hours.map((row) => (
              <div key={row.days} className="contents">
                <dt className="text-ink-soft">{row.days}</dt>
                <dd className="m-0">{row.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="shell flex flex-col gap-2 border-t border-line py-5 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <p>{site.demoNotice}</p>
        <p className="flex gap-5">
          <span>Payments run on Whop</span>
          <Link to="/office" className="link !font-medium !text-ink-soft">
            Job desk
          </Link>
        </p>
      </div>
    </footer>
  )
}
