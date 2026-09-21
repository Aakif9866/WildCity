/**
 * Dynamic resolution: when frames get slow, render at a lower pixel ratio; when there is plenty of
 * headroom, climb back. Fill rate is what breaks weak GPUs (phones at 3x DPR), and dropping
 * resolution is the cheapest, least noticeable lever.
 */
export const DPR_STEPS = [0.6, 0.75, 1, 1.25, 1.5, 2] as const

/** Above this average frame time (~38 fps) we step down; below FAST_MS (~75 fps) we step up. */
export const SLOW_MS = 26
export const FAST_MS = 13

export function dprSteps(maxDpr: number): number[] {
  const steps: number[] = DPR_STEPS.filter((s) => s < maxDpr)
  steps.push(Math.max(DPR_STEPS[0], maxDpr))
  return steps
}

/**
 * Pick the next pixel ratio from the average frame time. The gap between SLOW_MS and FAST_MS
 * is deliberate hysteresis: without it the resolution would flip back and forth.
 */
export function decideDpr(current: number, avgFrameMs: number, maxDpr: number): number {
  const steps = dprSteps(maxDpr)
  // Snap to the nearest known step first (the current value may come from a different device).
  let i = 0
  for (let k = 0; k < steps.length; k++)
    if (Math.abs((steps[k] as number) - current) < Math.abs((steps[i] as number) - current)) i = k
  if (avgFrameMs > SLOW_MS && i > 0) i--
  else if (avgFrameMs < FAST_MS && i < steps.length - 1) i++
  return steps[i] as number
}
