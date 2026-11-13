// A sentence that lights up word by word as it scrolls through the viewport.
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useRef } from 'react'

function Word({ word, index, total, progress }: { word: string; index: number; total: number; progress: MotionValue<number> }) {
  const start = index / total
  const opacity = useTransform(progress, [start, Math.min(1, start + 2.5 / total)], [0.2, 1])
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {word}{' '}
    </motion.span>
  )
}

export function ScrollWords({ text, className, as: Tag = 'p' }: { text: string; className?: string; as?: 'p' | 'h2' }) {
  const holder = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: holder, offset: ['start 82%', 'end 48%'] })
  const words = text.split(' ')

  return (
    <div ref={holder}>
      <Tag className={className}>
        {reduce ? (
          text
        ) : (
          <>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
              {words.map((word, index) => (
                <Word key={`${word}-${index}`} word={word} index={index} total={words.length} progress={scrollYProgress} />
              ))}
            </span>
          </>
        )}
      </Tag>
    </div>
  )
}
