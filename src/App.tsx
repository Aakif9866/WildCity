import { GameCanvas } from '@/render/GameCanvas'
import { useAppStore } from '@/state/appStore'
import { MainMenu } from '@/ui/MainMenu'

export default function App() {
  const phase = useAppStore((s) => s.phase)

  return (
    <div className="relative h-full w-full">
      <GameCanvas />
      {phase === 'menu' && <MainMenu />}
    </div>
  )
}
