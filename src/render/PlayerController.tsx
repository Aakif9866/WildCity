import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect } from 'react'
import { updateCameraRig } from '@/game/camera/orbitRig'
import { KeyboardMouseInput } from '@/game/input/KeyboardMouseInput'
import { stepPlayer } from '@/game/player/movement'
import { attachInput, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

/** Owns input + the per-frame loop for player and camera. Contains no rules itself. */
export function PlayerController({ session }: { session: GameSession }) {
  const dom = useThree((s) => s.gl.domElement)

  useEffect(() => {
    const input = new KeyboardMouseInput(dom)
    input.onUnexpectedUnlock = () => useAppStore.getState().pause()
    attachInput(session, input)
    const onKey = (e: KeyboardEvent): void => {
      // Escape only reaches us when the pointer isn't locked (a locked Esc goes via onUnexpectedUnlock).
      if (e.code === 'Escape') useAppStore.getState().pause()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      input.dispose()
      attachInput(session, null)
    }
  }, [dom, session])

  // Place the camera correctly before the first frame so it never flashes from the origin.
  useLayoutEffect(() => {
    const { camera: rig, player, world } = session
    updateCameraRig(rig, 0, 0, 0, player, 0, world, true)
  }, [session])

  useFrame((state, delta) => {
    const input = session.input
    if (!input) return
    const frame = input.poll()
    if (useAppStore.getState().phase !== 'playing') {
      input.reset()
      return
    }
    const dt = Math.min(delta, 0.05)
    const { player, camera: rig, world } = session
    stepPlayer(player, frame, rig.yaw, dt, world)
    updateCameraRig(rig, frame.lookDX, frame.lookDY, frame.zoom, player, dt, world)
    state.camera.position.set(rig.px, rig.py, rig.pz)
    state.camera.lookAt(rig.tx, rig.ty, rig.tz)
  })

  return null
}
