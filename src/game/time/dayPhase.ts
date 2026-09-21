export type DayPhase = 'morning' | 'day' | 'evening' | 'night'

export const DAY_PHASES: readonly DayPhase[] = ['morning', 'day', 'evening', 'night']

/** Map an hour of day (0..24) to a coarse phase. */
export function dayPhaseAt(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24
  if (h >= 5 && h < 10) return 'morning'
  if (h >= 10 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}
