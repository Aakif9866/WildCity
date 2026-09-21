import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
  label: string
}

/**
 * A missing/corrupt animal model must never take the game down: on any load error render the
 * fallback (the procedural rig) instead and log once.
 */
export class AnimalErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn(`[wildcity] model for ${this.props.label} failed to load; using fallback.`, error)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
