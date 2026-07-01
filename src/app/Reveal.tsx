'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'left' | 'right' | 'none'
  as?: 'div' | 'article' | 'li'
}

const distanceByDirection = {
  up: { y: 28, x: 0 },
  left: { y: 0, x: -28 },
  right: { y: 0, x: 28 },
  none: { y: 0, x: 0 },
}

export function Reveal({ children, className, delay = 0, direction = 'up', as = 'div' }: RevealProps) {
  const shouldReduceMotion = useReducedMotion()
  const offset = distanceByDirection[direction]

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : offset.y,
      x: shouldReduceMotion ? 0 : offset.x,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
    },
  }

  const MotionTag = motion[as]

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants}
    >
      {children}
    </MotionTag>
  )
}

type RevealGroupProps = {
  children: ReactNode
  className?: string
  stagger?: number
}

export function RevealGroup({ children, className, stagger = 0.08 }: RevealGroupProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className, direction = 'up' }: Omit<RevealProps, 'delay' | 'as'>) {
  const shouldReduceMotion = useReducedMotion()
  const offset = distanceByDirection[direction]

  return (
    <motion.div
      className={className}
      variants={{
        hidden: {
          opacity: 0,
          y: shouldReduceMotion ? 0 : offset.y,
          x: shouldReduceMotion ? 0 : offset.x,
        },
        visible: {
          opacity: 1,
          y: 0,
          x: 0,
          transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
