import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PixelInspector } from '#/components/PixelInspector'
import { whopAccountId } from '#/config/offers'
import { site } from '#/config/site'
import appCss from '../styles.css?url'

// Whop hosting injects its pixel into every page. On any other host (Vercel,
// your own server) this installs the same pixel, scoped to the business in
// whop.generated.json. It does nothing when a pixel is already on the page,
// so page views are never counted twice.
const PIXEL_ACCOUNT = whopAccountId('production')
const PIXEL_SNIPPET = PIXEL_ACCOUNT
  ? `(function(){if(window.whop)return;!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope(${JSON.stringify(PIXEL_ACCOUNT)});whop.track("page");})();`
  : null

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: site.seo.title },
      { name: 'description', content: site.seo.description },
      { name: 'theme-color', content: '#0d0d0c' },
      { property: 'og:title', content: site.seo.title },
      { property: 'og:description', content: site.seo.description },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    scripts: PIXEL_SNIPPET ? [{ children: PIXEL_SNIPPET }] : [],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <PixelInspector />
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="shell flex min-h-screen flex-col items-start justify-center py-20">
      <h1 className="type-title">That page is not here</h1>
      <p className="type-lede mt-4 max-w-xl">
        The link may be old. Head back to the home page, or call {site.company.phone} and we will point you the right way.
      </p>
      <Link to="/" className="btn btn-primary mt-8">
        Go to the home page
      </Link>
    </main>
  )
}
