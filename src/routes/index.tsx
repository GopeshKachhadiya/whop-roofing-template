import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

const FONT_FACES = [400, 500, 600, 700]
  .map(
    (weight) =>
      `@font-face{font-family:'Inter Display';font-weight:${weight};font-display:swap;src:url(https://content.whop.com/fonts/inter-display-${{ 400: 'regular', 500: 'medium', 600: 'semi-bold', 700: 'bold' }[weight]}.ttf) format('truetype')}`,
  )
  .join('')

function Home() {
  return (
    <main className="min-h-screen bg-[#F0F0F0] text-[#202020]" style={{ fontFamily: "'Inter Display', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{FONT_FACES}</style>
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <span className="size-2 rounded-full bg-[#FA4616]" />
          Built with Whop
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-7xl">
          Your website <span className="text-[#FA4616]">starts here</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-pretty text-[#202020]/60 sm:text-lg">
          This page is a placeholder. Describe your business to Whop AI and it will design every page for you.
        </p>
      </section>
    </main>
  )
}
