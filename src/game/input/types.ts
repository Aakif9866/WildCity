/**
 * One frame of player intent, independent of device. Keyboard/mouse fills it today; a touch
 * joystick + drag-look can fill the same shape later without touching gameplay code.
 */
export interface InputFrame {
  /** -1 (left) .. 1 (right) */
  moveX: number
  /** -1 (back) .. 1 (forward) */
  moveY: number
  run: boolean
  jump: boolean
  /** True only on the frame the interact key went down. */
  interact: boolean
  /** True only on the frame the follow/stop key went down. */
  stopFollow: boolean
  /** Accumulated look delta in pixels since the last frame. */
  lookDX: number
  lookDY: number
  /** Accumulated zoom (wheel) delta since the last frame; positive = zoom out. */
  zoom: number
}

export interface InputSource {
  poll(): InputFrame
}

export const emptyInput = (): InputFrame => ({
  moveX: 0,
  moveY: 0,
  run: false,
  jump: false,
  interact: false,
  stopFollow: false,
  lookDX: 0,
  lookDY: 0,
  zoom: 0,
})
