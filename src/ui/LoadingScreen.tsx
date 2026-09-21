import { useEffect, useState } from 'react'
import { describeLoadError, loadCity } from '@/cities/loader'
import { createSession, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const STEPS = [
  'Loading city…',
  'Loading roads…',
  'Loading buildings…',
  'Building the world…',
  'Spawning wildlife…',
]

export function LoadingScreen({ onLoaded }: { onLoaded: (session: GameSession) => void }) {
  const cityId = useAppStore((s) => s.cityId)
  const [message, setMessage] = useState(STEPS[0] as string)

  useEffect(() => {
    let cancelled = false
    const say = (m: string): void => {
      if (!cancelled) setMessage(m)
    }
    void (async () => {
      try {
        const city = await loadCity(cityId, say)
        say('Building the world…')
        await nextFrame() // let the message paint before the synchronous world/nav build
        await nextFrame()
        say('Spawning wildlife…')
        await nextFrame()
        const session = createSession(city)
        if (!cancelled) onLoaded(session)
      } catch (e) {
        console.error('[wildcity] city load failed', e)
        if (!cancelled) useAppStore.getState().failLoading(describeLoadError(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cityId, onLoaded])

  const step = Math.max(0, STEPS.indexOf(message))
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <h2 className="text-2xl font-semibold tracking-widest">WILDCITY</h2>
      <p aria-live="polite">{message}</p>
      <div className="h-1.5 w-64 overflow-hidden rounded bg-white/15">
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  )
}
