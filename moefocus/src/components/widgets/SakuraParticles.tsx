// ===== Phase 7: 樱花粒子特效 =====
// Canvas overlay, requestAnimationFrame 驱动 ~20 片花瓣飘落
// 每片花瓣有独立的 x/y/size/speed/drift/rotation/opacity

import { useEffect, useRef } from 'react'

interface Petal
{
  x: number
  y: number
  size: number
  speed: number
  drift: number
  rotation: number
  rotation_speed: number
  opacity: number
}

export function SakuraParticles(): JSX.Element
{
  const canvas_ref = useRef<HTMLCanvasElement>(null)

  useEffect(() =>
  {
    const canvas = canvas_ref.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animation_id: number
    let petals: Petal[] = []
    const max_petals = 20

    function resize(): void
    {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function create_petal(): Petal
    {
      return {
        x: Math.random() * (canvas?.width || window.innerWidth),
        y: -10 - Math.random() * 100,
        size: 4 + Math.random() * 8,
        speed: 0.5 + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotation_speed: (Math.random() - 0.5) * 0.02,
        opacity: 0.3 + Math.random() * 0.4
      }
    }

    function draw_petal(petal: Petal): void
    {
      if (!ctx) return
      ctx.save()
      ctx.translate(petal.x, petal.y)
      ctx.rotate(petal.rotation)
      ctx.globalAlpha = petal.opacity

      // Draw a simple sakura petal shape
      const s = petal.size
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(-s * 0.5, -s * 0.4, -s * 0.8, -s * 0.1, -s * 0.7, s * 0.3)
      ctx.bezierCurveTo(-s * 0.5, s * 0.4, 0, s * 0.6, 0, s * 0.6)
      ctx.bezierCurveTo(0, s * 0.6, s * 0.5, s * 0.4, s * 0.7, s * 0.3)
      ctx.bezierCurveTo(s * 0.8, -s * 0.1, s * 0.5, -s * 0.4, 0, 0)
      ctx.fillStyle = '#FFB7C5'
      ctx.fill()

      ctx.restore()
    }

    function animate(): void
    {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn new petals
      if (petals.length < max_petals && Math.random() < 0.05)
      {
        petals.push(create_petal())
      }

      // Update and draw
      for (let i = petals.length - 1; i >= 0; i--)
      {
        const p = petals[i]
        p.y += p.speed
        p.x += p.drift
        p.rotation += p.rotation_speed

        draw_petal(p)

        // Remove if off screen
        if (p.y > (canvas?.height || 0) + 20)
        {
          petals.splice(i, 1)
        }
      }

      animation_id = requestAnimationFrame(animate)
    }

    resize()
    // Initialize with some petals
    for (let i = 0; i < 8; i++)
    {
      const petal = create_petal()
      petal.y = Math.random() * window.innerHeight
      petals.push(petal)
    }

    window.addEventListener('resize', resize)
    animate()

    return () =>
    {
      cancelAnimationFrame(animation_id)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvas_ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    />
  )
}
