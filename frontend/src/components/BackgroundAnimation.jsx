import { useEffect, useRef } from 'react'

export default function BackgroundAnimation({ theme = 'dark' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    // Handle high DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Mouse tracking for subtle interactive reaction
    const mouse = {
      x: null,
      y: null,
      radius: 140
    }

    const handleMouseMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const handleMouseLeave = () => {
      mouse.x = null
      mouse.y = null
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }

    window.addEventListener('resize', handleResize)

    // Palette configuration (Solid colors only, dynamic per theme)
    const isDark = theme === 'dark'
    const particleColors = isDark
      ? ['#3b82f6', '#10b981', '#60a5fa', '#34d399']
      : ['#2563eb', '#059669', '#4f46e5', '#0284c7']

    const nodeCount = Math.min(Math.floor((width * height) / 22000), 55)
    const particles = []

    for (let i = 0; i < nodeCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        radius: Math.random() * 2 + 1.5,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        baseAlpha: Math.random() * 0.4 + 0.35,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseOffset: Math.random() * Math.PI * 2
      })
    }

    let time = 0

    const render = () => {
      time += 0.02
      ctx.clearRect(0, 0, width, height)

      // 1. Draw connecting lines between nearby vector nodes
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 125) {
            const lineAlpha = (1 - dist / 125) * (isDark ? 0.16 : 0.11)
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = isDark
              ? `rgba(59, 130, 246, ${lineAlpha})`
              : `rgba(37, 99, 235, ${lineAlpha})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      // 2. Connect particles to mouse cursor if nearby
      if (mouse.x !== null && mouse.y !== null) {
        for (let i = 0; i < particles.length; i++) {
          const dx = mouse.x - particles[i].x
          const dy = mouse.y - particles[i].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < mouse.radius) {
            const mouseAlpha = (1 - dist / mouse.radius) * (isDark ? 0.28 : 0.18)
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = isDark
              ? `rgba(16, 185, 129, ${mouseAlpha})`
              : `rgba(5, 150, 105, ${mouseAlpha})`
            ctx.lineWidth = 1.2
            ctx.stroke()

            // Gentle repulsion away from mouse
            const force = (1 - dist / mouse.radius) * 0.8
            particles[i].x -= (dx / dist) * force
            particles[i].y -= (dy / dist) * force
          }
        }
      }

      // 3. Update & Draw individual particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.x += p.vx
        p.y += p.vy

        // Wrap around boundaries
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10

        // Subtle alpha pulsation
        const dynamicAlpha = p.baseAlpha + Math.sin(time + p.pulseOffset) * 0.15

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0.1, Math.min(1, dynamicAlpha))
        ctx.fill()
        ctx.globalAlpha = 1
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
    }
  }, [theme])

  return (
    <div className="background-animation-container" aria-hidden="true">
      {/* Interactive Vector Neural Network Canvas */}
      <canvas ref={canvasRef} className="ambient-background-canvas" />

      {/* Floating Outcrowd-Style Ambient Tech Badges */}
      <div className="floating-element float-element-1">
        <span className="float-badge-dot blue"></span>
        <span className="float-badge-text">&lt;DocuRAG::VectorEngine /&gt;</span>
      </div>

      <div className="floating-element float-element-2">
        <span className="float-badge-dot green"></span>
        <span className="float-badge-text">384-Dim Neural Embeddings</span>
      </div>

      <div className="floating-element float-element-3">
        <span className="float-badge-dot purple"></span>
        <span className="float-badge-text">ChromaDB Vector Store</span>
      </div>

      <div className="floating-element float-element-4">
        <span className="float-badge-dot orange"></span>
        <span className="float-badge-text">Semantic Retrieval Active</span>
      </div>
    </div>
  )
}
