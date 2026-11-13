// The time of day where the company works, for the clock and the 3D sky.
import { useEffect, useState } from 'react'
import { site } from '#/config/site'

export type Phase = 'morning' | 'day' | 'dusk' | 'night'

export interface LocalTime {
  clock: string
  phase: Phase
}

function read(): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: site.company.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 12)
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  // ?sky=dusk (or morning, day, night) previews another time of day.
  const preview = new URLSearchParams(window.location.search).get('sky')
  const phase: Phase =
    preview && preview in skies ? (preview as Phase) : hour >= 21 || hour < 6 ? 'night' : hour < 10 ? 'morning' : hour < 17 ? 'day' : 'dusk'
  return { clock: `${String(hour).padStart(2, '0')}:${minute}`, phase }
}

/** Null on the server and first paint, so the markup hydrates cleanly. */
export function useLocalTime(): LocalTime | null {
  const [time, setTime] = useState<LocalTime | null>(null)
  useEffect(() => {
    setTime(read())
    const timer = window.setInterval(() => setTime(read()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  return time
}

export const skies: Record<Phase, string> = {
  morning: 'linear-gradient(180deg, #27324a 0%, #7f6a80 55%, #dca47a 100%)',
  day: 'linear-gradient(180deg, #1c3a5e 0%, #4c7ca3 60%, #a8c2c9 100%)',
  dusk: 'linear-gradient(180deg, #1b2233 0%, #54436b 55%, #c78a5f 100%)',
  night: 'linear-gradient(180deg, #0c121c 0%, #1f2743 60%, #4b3852 100%)',
}
