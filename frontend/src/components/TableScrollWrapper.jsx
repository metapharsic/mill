import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react'

/**
 * TableScrollWrapper
 * Wraps wide data tables and content with smooth sliding controls (◀ / ▶)
 * and edge gradient indicators to effortlessly reveal columns on the right.
 */
export default function TableScrollWrapper({
  children,
  title = 'Table',
  showSliderControls = true,
  maxHeight,
  style = {},
  contentStyle = {}
}) {
  const containerRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  const checkScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(maxScroll > 5 && scrollLeft < maxScroll - 5)
    setScrollProgress(maxScroll > 0 ? Math.round((scrollLeft / maxScroll) * 100) : 0)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = containerRef.current
    if (!el) return

    const handleScroll = () => checkScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })

    const observer = new ResizeObserver(() => checkScroll())
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  const scroll = (direction) => {
    const el = containerRef.current
    if (!el) return
    const offset = direction === 'left' ? -380 : 380
    el.scrollBy({ left: offset, behavior: 'smooth' })
  }

  const scrollToRightEdge = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }

  const scrollToLeftEdge = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ left: 0, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: 12, ...style }}>
      {/* Top Slider Bar (Only visible when table can scroll horizontally) */}
      {showSliderControls && (canScrollLeft || canScrollRight) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          borderLeft: '1px solid #e2e8f0',
          borderRight: '1px solid #e2e8f0',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          fontSize: 12,
          color: '#475569',
          userSelect: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span style={{ fontSize: 13 }}>↔️</span>
            <span>Horizontal Slide Controls</span>
            <span style={{
              fontSize: 11,
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 700
            }}>
              {scrollProgress}% viewed
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {canScrollLeft && (
              <button
                type="button"
                onClick={scrollToLeftEdge}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
                title="Slide all the way to start (Left)"
              >
                ⇤ Start
              </button>
            )}

            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              style={{
                background: canScrollLeft ? '#0f766e' : '#e2e8f0',
                color: canScrollLeft ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: canScrollLeft ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Slide Left"
            >
              <ChevronLeft size={14} /> Slide Left
            </button>

            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              style={{
                background: canScrollRight ? '#0f766e' : '#e2e8f0',
                color: canScrollRight ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: canScrollRight ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: canScrollRight ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Slide Right to see more options & actions"
            >
              Slide Right <ChevronRight size={14} />
            </button>

            {canScrollRight && (
              <button
                type="button"
                onClick={scrollToRightEdge}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
                title="Slide directly to rightmost actions"
              >
                End (Actions) ⇥
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Scroll Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: maxHeight ? 'auto' : 'visible',
          maxHeight: maxHeight || 'none',
          position: 'relative',
          scrollbarWidth: 'thin',
          scrollbarColor: '#0f766e #f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: (showSliderControls && (canScrollLeft || canScrollRight)) ? '0 0 8px 8px' : 8,
          background: '#ffffff',
          ...contentStyle
        }}
      >
        {children}
      </div>

      {/* Floating Quick Right-Slide Pill Button (Hovering at bottom right if more columns exist) */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            zIndex: 10,
            background: 'rgba(15, 118, 110, 0.92)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(15, 118, 110, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Click to slide table right and view more columns"
        >
          <span>More columns 👉</span>
          <ChevronRight size={14} />
        </button>
      )}

      {/* Floating Quick Left-Slide Pill Button (Hovering at bottom left if scrolled right) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 10,
            background: 'rgba(51, 65, 85, 0.9)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Click to slide table back to left"
        >
          <ChevronLeft size={14} />
          <span>👈 Slide left</span>
        </button>
      )}
    </div>
  )
}
