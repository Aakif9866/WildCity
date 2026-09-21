import { emptyInput, type InputFrame, type InputSource } from './types'

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  interact: ['KeyE'],
  stopFollow: ['KeyF'],
} as const

/** Keyboard + mouse. Pointer lock for look when available, drag-to-look as a fallback. */
export class KeyboardMouseInput implements InputSource {
  private readonly down = new Set<string>()
  private interactPressed = false
  private stopFollowPressed = false
  private lookDX = 0
  private lookDY = 0
  private zoom = 0
  private dragging = false
  private expectedUnlock = false

  /** Called when the pointer lock is lost without us asking (Esc) — the game pauses. */
  onUnexpectedUnlock: (() => void) | null = null

  private readonly element: HTMLElement

  constructor(element: HTMLElement) {
    this.element = element
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    element.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('mousemove', this.onMouseMove)
    element.addEventListener('wheel', this.onWheel, { passive: true })
    document.addEventListener('pointerlockchange', this.onLockChange)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.element.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    this.element.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    if (document.pointerLockElement === this.element) {
      this.expectedUnlock = true
      document.exitPointerLock()
    }
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element
  }

  requestLock(): void {
    // Some browsers reject lock requests (or headless has none); drag-look keeps working then.
    void Promise.resolve(this.element.requestPointerLock?.()).catch(() => {})
  }

  releaseLock(): void {
    if (this.locked) {
      this.expectedUnlock = true
      document.exitPointerLock()
    }
  }

  /** Forget held keys, e.g. when a menu opens, so nothing stays "stuck". */
  reset(): void {
    this.down.clear()
    this.dragging = false
  }

  private held = (codes: readonly string[]): boolean => codes.some((c) => this.down.has(c))

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return
    this.down.add(e.code)
    if ((KEYS.interact as readonly string[]).includes(e.code)) this.interactPressed = true
    if ((KEYS.stopFollow as readonly string[]).includes(e.code)) this.stopFollowPressed = true
    if (e.code === 'Space') e.preventDefault()
  }
  private onKeyUp = (e: KeyboardEvent): void => void this.down.delete(e.code)
  private onBlur = (): void => this.reset()

  private onMouseDown = (e: MouseEvent): void => {
    this.dragging = true
    if (e.button === 0 && !this.locked) this.requestLock()
  }
  private onMouseUp = (): void => void (this.dragging = false)
  private onMouseMove = (e: MouseEvent): void => {
    if (this.locked || this.dragging) {
      this.lookDX += e.movementX
      this.lookDY += e.movementY
    }
  }
  private onWheel = (e: WheelEvent): void => void (this.zoom += e.deltaY)

  private onLockChange = (): void => {
    if (this.locked) return
    if (this.expectedUnlock) this.expectedUnlock = false
    else this.onUnexpectedUnlock?.()
  }

  poll(): InputFrame {
    const f = emptyInput()
    f.moveX = (this.held(KEYS.right) ? 1 : 0) - (this.held(KEYS.left) ? 1 : 0)
    f.moveY = (this.held(KEYS.forward) ? 1 : 0) - (this.held(KEYS.back) ? 1 : 0)
    f.run = this.held(KEYS.run)
    f.jump = this.held(KEYS.jump)
    f.interact = this.interactPressed
    f.stopFollow = this.stopFollowPressed
    f.lookDX = this.lookDX
    f.lookDY = this.lookDY
    f.zoom = this.zoom
    this.interactPressed = false
    this.stopFollowPressed = false
    this.lookDX = this.lookDY = this.zoom = 0
    return f
  }
}
