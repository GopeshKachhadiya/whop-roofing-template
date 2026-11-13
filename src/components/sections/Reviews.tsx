// Reviews on cards that swing into a shallow arc as the section arrives.
import { ShieldCheck, Star } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { ScrollWords } from '#/components/ScrollWords'
import { site } from '#/config/site'

const ARC = [
  { rotate: -3.5, y: 26 },
  { rotate: -1, y: 0 },
  { rotate: 1, y: 0 },
  { rotate: 3.5, y: 26 },
]

export function Reviews() {
  const { trust } = site
  const reduce = useReducedMotion()
  return (
    <section id="reviews" className="overflow-hidden py-24 lg:py-40" aria-label="Reviews">
      <div className="shell text-center">
        <ScrollWords as="h2" text="What the neighbors say. In their own words." className="type-title mx-auto max-w-4xl" />
        <p className="type-note mt-6 flex items-center justify-center gap-2 text-ink-soft">
          <Star aria-hidden="true" className="size-3.5 fill-brand text-brand" strokeWidth={1} />
          {trust.rating} of 5 from {trust.reviewCount} {trust.reviewSource}
        </p>
      </div>

      <ul className="m-0 mt-14 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-10 lg:mt-20 lg:justify-center lg:gap-5 lg:overflow-visible lg:px-6">
        {trust.reviews.map((review, index) => (
          <motion.li
            key={review.name}
            initial={reduce ? false : { rotate: ARC[index % 4].rotate * 3, y: 90, opacity: 0 }}
            whileInView={{ rotate: ARC[index % 4].rotate, y: ARC[index % 4].y, opacity: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ type: 'spring', stiffness: 70, damping: 16, delay: index * 0.08 }}
            whileHover={reduce ? undefined : { rotate: 0, y: ARC[index % 4].y - 10 }}
            className="panel flex w-[min(20rem,82vw)] flex-none snap-center flex-col p-6 lg:w-[clamp(15.5rem,22vw,21rem)]"
          >
            <div className="flex gap-0.5" role="img" aria-label="5 out of 5 stars">
              {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} aria-hidden="true" className="size-4 fill-brand text-brand" strokeWidth={1} />
              ))}
            </div>
            <blockquote className="m-0 mt-4 flex-1 text-[1.0313rem] leading-snug">
              <p>{review.text}</p>
            </blockquote>
            <p className="mt-6 border-t border-line pt-4">
              <span className="block font-bold">{review.name}</span>
              <span className="type-note mt-1 block text-ink-soft">
                {review.job}, {review.place}
              </span>
            </p>
          </motion.li>
        ))}
      </ul>

      <div className="shell mt-8">
        <ul className="m-0 flex list-none flex-wrap justify-center gap-x-8 gap-y-3 p-0">
          {trust.credentials.map((line) => (
            <li key={line} className="flex items-center gap-2 text-[0.9688rem] font-medium text-ink-soft">
              <ShieldCheck aria-hidden="true" className="size-4 flex-none text-accent" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
