'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'

export function SparklesCore() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = resolvedTheme === 'dark'

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none">
      {/* Subtle Noise Texture */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />
      
      {/* Ambient Radial Mesh Gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="absolute inset-0"
        style={{
          background: isDark 
            ? 'radial-gradient(circle at 15% 50%, rgba(255,255,255,0.03) 0%, transparent 40%), radial-gradient(circle at 85% 30%, rgba(255,255,255,0.02) 0%, transparent 50%)'
            : 'radial-gradient(circle at 15% 50%, rgba(24,24,27,0.03) 0%, transparent 40%), radial-gradient(circle at 85% 30%, rgba(24,24,27,0.02) 0%, transparent 50%)',
        }}
      />
    </div>
  )
}
