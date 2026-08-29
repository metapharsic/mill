import React, { useEffect, useState } from 'react'

/**
 * Fixed, always-on digital clock + date widget.
 * Mounted once at the top-level app shell so it appears on every route.
 */
export default function DigitalClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('en-GB', { hour12: false })
  const date = now.toLocaleDateString('en-US', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div style={styles.wrap} title="Current date & time">
      <div style={styles.time}>{time}</div>
      <div style={styles.date}>{date}</div>
    </div>
  )
}

const styles = {
  wrap: {
    position: 'fixed',
    bottom: 14,
    right: 14,
    zIndex: 900,
    minWidth: 120,
    maxWidth: 160,
    padding: '7px 12px',
    borderRadius: 12,
    background: 'rgba(24,24,27,0.88)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(244,200,75,0.25)',
    boxShadow: '0 6px 18px rgba(0,0,0,.25)',
    textAlign: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  time: {
    fontSize: 15,
    fontWeight: 800,
    color: '#f4c84b',
    letterSpacing: '.03em',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.3,
  },
  date: {
    fontSize: 10.5,
    fontWeight: 600,
    color: 'rgba(255,255,255,.75)',
    marginTop: 1,
    letterSpacing: '.01em',
  },
}
