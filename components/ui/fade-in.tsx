'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  fullWidth?: boolean
  style?: React.CSSProperties
}

export function FadeIn({
  children,
  delay = 0,
  className,
  direction = 'up',
  fullWidth = false,
  style,
}: FadeInProps) {
  const directions = {
    up: { y: 16 },
    down: { y: -16 },
    left: { x: 16 },
    right: { x: -16 },
    none: { x: 0, y: 0 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction], filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }}
      transition={{
        duration: 0.4,
        ease: [0.21, 0.47, 0.32, 0.98], // Custom spring-like easing
        delay: delay,
      }}
      className={cn(fullWidth ? 'w-full' : '', className)}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({
  children,
  className,
  delayChildren = 0.1,
  staggerChildren = 0.05,
}: {
  children: React.ReactNode
  className?: string
  delayChildren?: number
  staggerChildren?: number
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: staggerChildren,
            delayChildren: delayChildren,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
        show: { 
          opacity: 1, 
          y: 0, 
          filter: 'blur(0px)',
          transition: { type: 'spring', stiffness: 300, damping: 24 }
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
