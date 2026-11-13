import { createFileRoute } from '@tanstack/react-router'
import { EstimateProvider } from '#/components/EstimateContext'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { Billing } from '#/components/sections/Billing'
import { EstimateSection } from '#/components/sections/EstimateSection'
import { Financing } from '#/components/sections/Financing'
import { HeroChapter } from '#/components/sections/HeroChapter'
import { Marquee } from '#/components/sections/Marquee'
import { Reviews } from '#/components/sections/Reviews'
import { ServiceArea } from '#/components/sections/ServiceArea'
import { Services } from '#/components/sections/Services'
import { Statement } from '#/components/sections/Statement'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <EstimateProvider>
      <SiteHeader />
      <main>
        <HeroChapter />
        <Statement />
        <Services />
        <Billing />
        <div className="theme-sage">
          <Financing />
          <Marquee />
          <ServiceArea />
        </div>
        <Reviews />
        <EstimateSection />
      </main>
      <SiteFooter />
    </EstimateProvider>
  )
}
