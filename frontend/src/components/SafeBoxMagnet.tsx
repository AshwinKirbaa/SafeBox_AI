import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type ElementType,
  type ComponentPropsWithoutRef,
} from 'react'
import './SafeBoxMagnet.css'

export interface SafeBoxMagnetProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  /** Interaction radius in pixels within which magnetic attraction begins. Default: 75 */
  range?: number
  /** Maximum displacement limit in pixels (subtle, restrained SafeBox default). Default: 6 */
  maxDisplacement?: number
  /** Magnetic attraction coefficient (0 to 1). Default: 0.35 */
  strength?: number
  /** Constrain motion to a specific axis. Default: 'both' */
  axis?: 'both' | 'x' | 'y'
  /** Explicitly disable magnetic interaction. Default: false */
  disabled?: boolean
  /** Spring stiffness coefficient. Default: 220 */
  stiffness?: number
  /** Spring damping coefficient. Default: 20 */
  damping?: number
  /** Polymorphic wrapper HTML tag. Default: 'div' */
  as?: ElementType
  /** Optional class name added when actively displaced. */
  activeClassName?: string
  className?: string
  style?: CSSProperties
}

const clamp = (val: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, val))
}

export const SafeBoxMagnet: React.FC<SafeBoxMagnetProps> = ({
  children,
  range = 75,
  maxDisplacement = 6,
  strength = 0.35,
  axis = 'both',
  disabled = false,
  stiffness = 220,
  damping = 20,
  as: Component = 'div',
  activeClassName = 'is-magnetized',
  className = '',
  style,
  ...restProps
}) => {
  const containerRef = useRef<HTMLElement | null>(null)

  // Track physics state in a ref to avoid re-renders during 60fps spring animation
  const physicsRef = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    vx: 0,
    vy: 0,
    animating: false,
    lastTime: 0,
    rafId: 0,
    isHovered: false,
  })

  const [isActive, setIsActive] = useState<boolean>(false)

  // Check user environment preferences
  const isReducedMotion = useCallback((): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(hover: none)').matches
    )
  }, [])

  // Apply CSS variables directly to avoid React re-render overhead
  const applyTransform = useCallback((x: number, y: number) => {
    const el = containerRef.current
    if (!el) return
    const roundedX = Math.round(x * 100) / 100
    const roundedY = Math.round(y * 100) / 100
    el.style.setProperty('--magnet-x', `${roundedX}px`)
    el.style.setProperty('--magnet-y', `${roundedY}px`)
  }, [])

  // Reference for frame callback to avoid self-reference during initialization
  const frameCallbackRef = useRef<((now: number) => void) | null>(null)

  useEffect(() => {
    frameCallbackRef.current = (now: number) => {
      const p = physicsRef.current
      if (!p.animating) return

      const dt = Math.min(0.033, p.lastTime ? (now - p.lastTime) / 1000 : 0.016)
      p.lastTime = now

      // Semi-implicit Euler spring step for X
      const ax = stiffness * (p.targetX - p.currentX) - damping * p.vx
      p.vx += ax * dt
      p.currentX += p.vx * dt

      // Semi-implicit Euler spring step for Y
      const ay = stiffness * (p.targetY - p.currentY) - damping * p.vy
      p.vy += ay * dt
      p.currentY += p.vy * dt

      // Clamp current values to max displacement bounds
      p.currentX = clamp(p.currentX, -maxDisplacement, maxDisplacement)
      p.currentY = clamp(p.currentY, -maxDisplacement, maxDisplacement)

      applyTransform(p.currentX, p.currentY)

      // Rest check: stop rAF loop when motion has settled
      const isSettled =
        Math.abs(p.targetX - p.currentX) < 0.02 &&
        Math.abs(p.targetY - p.currentY) < 0.02 &&
        Math.abs(p.vx) < 0.02 &&
        Math.abs(p.vy) < 0.02

      if (isSettled) {
        p.currentX = p.targetX
        p.currentY = p.targetY
        p.vx = 0
        p.vy = 0
        p.animating = false
        applyTransform(p.currentX, p.currentY)
        if (p.targetX === 0 && p.targetY === 0) {
          setIsActive(false)
        }
      } else {
        p.rafId = requestAnimationFrame((t) => {
          frameCallbackRef.current?.(t)
        })
      }
    }
  }, [stiffness, damping, maxDisplacement, applyTransform])

  const wakeAnimation = useCallback(() => {
    const p = physicsRef.current
    if (!p.animating) {
      p.animating = true
      p.lastTime = performance.now()
      p.rafId = requestAnimationFrame((t) => {
        frameCallbackRef.current?.(t)
      })
    }
  }, [])

  // Pointer position evaluator
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (disabled || isReducedMotion()) return
      const el = containerRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const dist = Math.hypot(dx, dy)

      const p = physicsRef.current

      if (dist < range && dist > 0) {
        // Smooth cosine falloff: 1 at center, smoothly decays to 0 at range boundary
        const factor = Math.cos((dist / range) * (Math.PI / 2))
        const pull = strength * factor

        const calcX = axis === 'y' ? 0 : clamp(dx * pull, -maxDisplacement, maxDisplacement)
        const calcY = axis === 'x' ? 0 : clamp(dy * pull, -maxDisplacement, maxDisplacement)

        p.targetX = calcX
        p.targetY = calcY
        p.isHovered = true

        if (!isActive) setIsActive(true)
        wakeAnimation()
      } else if (p.isHovered || p.targetX !== 0 || p.targetY !== 0) {
        // Pointer is outside range -> return to origin
        p.targetX = 0
        p.targetY = 0
        p.isHovered = false
        wakeAnimation()
      }
    },
    [disabled, range, maxDisplacement, strength, axis, isReducedMotion, isActive, wakeAnimation]
  )

  const handlePointerLeave = useCallback(() => {
    const p = physicsRef.current
    p.targetX = 0
    p.targetY = 0
    p.isHovered = false
    wakeAnimation()
  }, [wakeAnimation])

  // Reset to neutral on keyboard focus to ensure stable accessibility focus rings
  const handleFocus = useCallback(() => {
    const p = physicsRef.current
    p.targetX = 0
    p.targetY = 0
    applyTransform(0, 0)
    setIsActive(false)
  }, [applyTransform])

  // Setup window pointer listener with passive flag for efficiency
  useEffect(() => {
    const physics = physicsRef.current

    if (disabled || isReducedMotion()) {
      applyTransform(0, 0)
      return
    }

    const onPointerMove = (e: PointerEvent) => {
      handlePointerMove(e)
    }

    const onPointerLeaveWindow = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        handlePointerLeave()
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerout', onPointerLeaveWindow, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerLeaveWindow)
      if (physics.rafId) {
        cancelAnimationFrame(physics.rafId)
      }
    }
  }, [disabled, handlePointerMove, handlePointerLeave, applyTransform, isReducedMotion])

  // Cleanup on unmount
  useEffect(() => {
    const physics = physicsRef.current
    return () => {
      if (physics.rafId) {
        cancelAnimationFrame(physics.rafId)
      }
    }
  }, [])

  const reducedMotionClass = isReducedMotion() ? 'safebox-magnet--reduced-motion' : ''
  const disabledClass = disabled ? 'safebox-magnet--disabled' : ''
  const activeClass = isActive ? activeClassName : ''

  return (
    <Component
      ref={containerRef}
      className={`safebox-magnet ${disabledClass} ${reducedMotionClass} ${activeClass} ${className}`.trim()}
      onFocus={handleFocus}
      onBlur={handleFocus}
      style={style}
      {...restProps}
    >
      {children}
    </Component>
  )
}

export default SafeBoxMagnet
