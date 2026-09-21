import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { updateCameraRig } from '@/game/camera/orbitRig'
import { KeyboardMouseInput } from '@/game/input/KeyboardMouseInput'
import { nearestAnimal, PANEL_CLOSE_RANGE } from '@/game/interaction'
import { stepPlayer } from '@/game/player/movement'
import { attachInput, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

// Small animals are far below the default 1.5 m look-at height; lower the target so they stay framed.
const FOLLOW_HEIGHT_OFFSET = 1

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

  const promptTimer = useRef(0)

  useFrame((state, delta) => {
    const input = session.input
    if (!input) return
    const frame = input.poll()
    const store = useAppStore.getState()
    if (store.phase !== 'playing') {
      input.reset()
      return
    }
    const dt = Math.min(delta, 0.05)
    const { player, camera: rig, world, animals } = session

    // Which animal could the player inspect? Re-checked ~5x/s and only pushed to React on change.
    promptTimer.current += dt
    if (promptTimer.current > 0.2) {
      promptTimer.current = 0
      const near = nearestAnimal(animals, player.x, player.z)
      if ((near?.id ?? null) !== store.promptAnimalId) store.setPrompt(near?.id ?? null)
      const open = store.panelAnimalId ? animals.find((a) => a.id === store.panelAnimalId) : null
      if (
        open &&
        Math.hypot(open.position.x - player.x, open.position.z - player.z) > PANEL_CLOSE_RANGE
      )
        store.closePanel()
    }

    if (frame.interact) {
      if (store.panelAnimalId) store.closePanel()
      else if (store.promptAnimalId) {
        store.openPanel(store.promptAnimalId)
        input.releaseLock() // free the cursor so the panel buttons can be clicked
      }
    }

    // Following: camera tracks the animal; F or any movement key ends it.
    const followed = store.followAnimalId
      ? animals.find((a) => a.id === store.followAnimalId)
      : null
    if (
      store.followAnimalId &&
      (!followed || frame.stopFollow || frame.moveX !== 0 || frame.moveY !== 0)
    )
      store.stopFollow()
    const following = store.followAnimalId ? followed : null

    stepPlayer(
      player,
      following ? { ...frame, moveX: 0, moveY: 0, jump: false } : frame,
      rig.yaw,
      dt,
      world,
    )
    const target = following
      ? {
          x: following.position.x,
          y: following.position.y - FOLLOW_HEIGHT_OFFSET,
          z: following.position.z,
        }
      : player
    updateCameraRig(rig, frame.lookDX, frame.lookDY, frame.zoom, target, dt, world)
    state.camera.position.set(rig.px, rig.py, rig.pz)
    state.camera.lookAt(rig.tx, rig.ty, rig.tz)
  })

  return null
}
