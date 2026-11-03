import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'

import { cn } from '../lib/cn'

export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** 入场用的统一缓动；统一在这里改，别各页自己写曲线。 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  amount = 0.25,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  amount?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

/** 数字从 0 滚到目标值；直接写 textContent，避免每帧触发 React 重渲染。 */
export function CountUp({
  value,
  format = (v: number) => String(Math.round(v)),
  className,
}: {
  value: number
  format?: (v: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)

  useEffect(() => {
    if (!ref.current) return
    if (reduce) {
      ref.current.textContent = format(value)
      return
    }
    const stopText = mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = format(v)
    })
    const controls = animate(mv, value, { duration: 0.9, ease: EASE_OUT })
    return () => {
      stopText()
      controls.stop()
    }
    // format 是行内函数时故意不追踪，数值变才重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}

/**
 * 指针跟随的高光卡片。
 * 动效的意义：把「这张卡可以点」这层信息挂在鼠标位置上，是反馈，不是装饰。
 */
export function SpotlightCard({
  children,
  className,
  tone = '#38e2ff',
}: {
  children: ReactNode
  className?: string
  tone?: string
}) {
  const reduce = useReducedMotion()
  const mx = useMotionValue(-400)
  const my = useMotionValue(-400)
  const glow = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, ${tone}22, transparent 70%)`
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        mx.set(e.clientX - r.left)
        my.set(e.clientY - r.top)
      }}
      onPointerLeave={() => {
        mx.set(-400)
        my.set(-400)
      }}
      className={cn(
        'group relative overflow-hidden transition-colors duration-200',
        className,
      )}
    >
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glow }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}

/** 页面转场的统一变体：进出场只动 transform / opacity。 */
export const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export const pageTransition = { duration: 0.34, ease: EASE_OUT }
