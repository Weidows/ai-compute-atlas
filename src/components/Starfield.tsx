import { useEffect, useRef } from 'react'

/** Sparse parallax starfield; static frame when the user prefers reduced motion. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let w = 0
    let h = 0
    const stars: { x: number; y: number; z: number; p: number }[] = []

    const seed = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars.length = 0
      const count = Math.round((w * h) / 14000)
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random() * 0.8 + 0.2,
          p: Math.random() * Math.PI * 2,
        })
      }
    }

    let t = 0
    const draw = () => {
      t += 0.006
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const tw = reduce ? 0.7 : 0.55 + Math.sin(t * 1.6 + s.p) * 0.35
        ctx.beginPath()
        ctx.fillStyle = `rgba(180, 220, 255, ${0.06 + tw * 0.32 * s.z})`
        ctx.arc(s.x, s.y, s.z * 1.15, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    seed()
    draw()
    const onResize = () => {
      seed()
      if (reduce) draw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-80"
    />
  )
}
