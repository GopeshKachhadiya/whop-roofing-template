import { FlaskConical } from 'lucide-react'

export function TestModeBanner() {
  return (
    <div className="border-b border-line bg-accent-wash">
      <div className="shell flex flex-col gap-1 py-2.5 text-[0.9375rem] sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 font-semibold">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 flex-none text-accent" />
          <span>
            Test mode. Payments here run in Whop's sandbox, so no money moves. Use card 4242 4242 4242 4242 with any future
            date and any CVC.
          </span>
        </p>
        <a href="?mode=live" className="link flex-none">
          Leave test mode
        </a>
      </div>
    </div>
  )
}

/** Shown when ?mode=test is on the URL but the sandbox isn't set up. */
export function LiveModeWarning() {
  return (
    <div className="border-b border-line bg-danger-wash">
      <div className="shell py-2.5 text-[0.9375rem] font-semibold text-danger">
        Test mode is not set up on this site, so this page takes real payments. Do not use it for testing.
      </div>
    </div>
  )
}
