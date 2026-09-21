import { dayPhaseAt, type DayPhase } from './dayPhase'

export interface GameClock {
  /** Hour of day, 0 <= hour < 24. */
  hour: number
  /** Real seconds one full game day takes. */
  daySeconds: number
}

/** A full day lasts 6 real minutes: enough to see dawn, dusk and night in one sitting. */
export const DEFAULT_DAY_SECONDS = 360
export const START_HOUR = 8

export const createClock = (hour = START_HOUR, daySeconds = DEFAULT_DAY_SECONDS): GameClock => ({
  hour: normalizeHour(hour),
  daySeconds,
})

export function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) return START_HOUR
  return ((hour % 24) + 24) % 24
}

export function advanceClock(clock: GameClock, dt: number): void {
  clock.hour = normalizeHour(clock.hour + (dt * 24) / clock.daySeconds)
}

export function formatClock(hour: number): string {
  const total = Math.floor(normalizeHour(hour) * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const LABEL: Record<DayPhase, string> = {
  morning: 'Morning',
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
}
export const phaseLabel = (hour: number): string => LABEL[dayPhaseAt(hour)]

/** Hours the time-of-day shortcuts jump to (roughly the middle of each phase). */
export const PHASE_START_HOUR: Record<DayPhase, number> = {
  morning: 7,
  day: 12,
  evening: 18,
  night: 22,
}
