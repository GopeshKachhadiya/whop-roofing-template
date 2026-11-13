// Which Whop environment this browser tab is using.
//
// Live by default. Opening any page with ?mode=test switches the tab to
// Whop's sandbox (test cards, no real money) until ?mode=live or the tab is
// closed. Test mode only exists once `pnpm whop:sync --sandbox` has run.
import { useEffect, useState } from 'react'
import { sandboxReady } from '#/config/offers'
import type { WhopEnv } from '#/config/offers'

const STORAGE_KEY = 'whop-env'

function read(): WhopEnv {
  if (typeof window === 'undefined' || !sandboxReady) return 'production'
  try {
    const mode = new URLSearchParams(window.location.search).get('mode')
    if (mode === 'test') window.sessionStorage.setItem(STORAGE_KEY, 'sandbox')
    if (mode === 'live') window.sessionStorage.removeItem(STORAGE_KEY)
    return window.sessionStorage.getItem(STORAGE_KEY) === 'sandbox' ? 'sandbox' : 'production'
  } catch {
    return new URLSearchParams(window.location.search).get('mode') === 'test' ? 'sandbox' : 'production'
  }
}

/** `ready` is false until the browser has been asked, so nothing mounts against the wrong environment. */
export function useWhopEnv(): { env: WhopEnv; ready: boolean } {
  const [state, setState] = useState<{ env: WhopEnv; ready: boolean }>({ env: 'production', ready: false })
  useEffect(() => setState({ env: read(), ready: true }), [])
  return state
}

/** True when the URL asks for test mode but this site has no sandbox set up, so payments would be real. */
export function useTestModeUnavailable(): boolean {
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    setUnavailable(!sandboxReady && new URLSearchParams(window.location.search).get('mode') === 'test')
  }, [])
  return unavailable
}
