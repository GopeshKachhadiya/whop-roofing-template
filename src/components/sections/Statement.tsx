import { ScrollWords } from '#/components/ScrollWords'
import { site } from '#/config/site'

export function Statement() {
  return (
    <section className="py-28 lg:py-44" aria-label="What we do">
      <div className="shell">
        <ScrollWords
          text={`${site.statement.lead} ${site.statement.rest}`}
          className="type-title mx-auto max-w-[68rem] text-right !leading-[1.06] lg:!text-[clamp(3rem,1.5rem+3.6vw,5.25rem)]"
        />
      </div>
    </section>
  )
}
