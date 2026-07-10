'use client'

import { useLayoutEffect, useRef } from 'react'
import styles from './oryzo.module.css'

type MediaItem = {
  id: string
  label: string
  background: string
  magazine?: boolean
}

/*
 * Placeholder media in the exact sequence of the reference video.
 * Each gradient stands in for the real image/video and will be swapped
 * for actual assets in Phase 5.
 */
const MEDIA: MediaItem[] = [
  {
    id: '01',
    label: 'Hoodie',
    background: 'linear-gradient(165deg, #4b3a2b 0%, #201812 62%, #120d0a 100%)',
  },
  {
    id: '02',
    label: 'Fitness',
    background: 'linear-gradient(160deg, #8a7057 0%, #4a352a 70%, #241a14 100%)',
  },
  {
    id: '03',
    label: 'Hat',
    background: 'linear-gradient(150deg, #caa87c 0%, #8a6a45 55%, #4a3623 100%)',
  },
  {
    id: '04',
    label: 'Swimwear',
    background: 'linear-gradient(155deg, #c07a4a 0%, #7c452b 60%, #3c2317 100%)',
  },
  {
    id: '05',
    label: 'Coaster',
    background: 'linear-gradient(165deg, #5c4633 0%, #2e2119 65%, #171210 100%)',
  },
  {
    id: '06',
    label: 'Portrait',
    background: 'linear-gradient(160deg, #9b8163 0%, #5f4a37 60%, #2c2119 100%)',
  },
  {
    id: '07',
    label: 'Red fabric',
    background: 'linear-gradient(150deg, #a3342a 0%, #6e1f1c 55%, #38100f 100%)',
  },
  {
    id: '08',
    label: 'Magazine',
    background: 'linear-gradient(170deg, #efe6d6 0%, #d9c8ac 70%, #bda887 100%)',
    magazine: true,
  },
  {
    id: '09',
    label: 'Desk scene',
    background: 'linear-gradient(160deg, #3f3a2e 0%, #241f18 60%, #131009 100%)',
  },
]

/*
 * Static preview state only. Phase 3 replaces this constant with the
 * scroll-driven center-distance focus math that grows/shrinks every card.
 */
const ACTIVE_INDEX = 3

const NAV_ITEMS = ['Intro', 'Features', 'Product', 'Contact']

export default function OryzoPage() {
  const trackRef = useRef<HTMLDivElement>(null)

  // Align the active card's center with the viewport center. offsetLeft is
  // layout-based (unaffected by the transform we set), so this stays exact
  // across resizes and becomes the Phase 3 track-position formula.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const align = () => {
      const active = track.children[ACTIVE_INDEX] as HTMLElement | undefined
      if (!active) return
      const cardCenter = active.offsetLeft + active.offsetWidth / 2
      const x = window.innerWidth / 2 - cardCenter
      track.style.transform = `translate3d(${x}px, -50%, 0)`
    }

    align()
    window.addEventListener('resize', align)
    return () => window.removeEventListener('resize', align)
  }, [])

  return (
    <main className={styles.stage}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <span className={styles.wordmark}>
          ORYZO<sup>R</sup>
        </span>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <a key={item} className={styles.navLink} href="#">
              {item}
            </a>
          ))}
        </nav>
      </header>

      <h1 className={styles.title}>
        <span className={styles.titleLine1}>So portable,</span>
        <span className={styles.titleLine2}>it&apos;s wearable</span>
      </h1>

      <div ref={trackRef} className={styles.track}>
        {MEDIA.map((item, index) => (
          <figure
            key={item.id}
            className={[
              styles.card,
              index === ACTIVE_INDEX ? styles.cardActive : '',
              item.magazine ? styles.cardMagazine : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: item.background }}
          >
            {item.magazine ? (
              <span className={styles.magazineTitle}>RISE</span>
            ) : null}
            <span className={styles.cardIndex}>{item.id}</span>
            <figcaption className={styles.cardLabel}>{item.label}</figcaption>
          </figure>
        ))}
      </div>

      <div className={styles.frame} aria-hidden />

      <p className={styles.scrollHint}>
        <span aria-hidden>v</span> Scroll to continue
      </p>

      <div className={styles.grain} aria-hidden />
    </main>
  )
}
