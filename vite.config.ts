import { whop } from '@whop/cli/vite'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// Two ways to ship the same app:
//  - Whop hosting (`whop apps deploy`, the default): Cloudflare Workers build,
//    packed by the whop() plugin.
//  - Vercel (or any Node host): a Nitro build. Vercel sets VERCEL=1 during its
//    build, and DEPLOY_TARGET=node builds a plain Node server for local checks.
const target = process.env.DEPLOY_TARGET ?? (process.env.VERCEL ? 'vercel' : 'whop')

const hostPlugins =
  target === 'whop'
    ? [whop({ disableTanstackDevtools: true }), cloudflare({ viteEnvironment: { name: 'ssr' } })]
    : [nitro({ preset: target === 'node' ? 'node-server' : 'vercel' })]

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [...hostPlugins, tailwindcss(), tanstackStart(), viteReact()],
})

export default config
