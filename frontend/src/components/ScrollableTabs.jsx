import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * ScrollableTabs
 * Wraps long horizontal tab bars with interactive Left/Right sliding buttons (◀ / ▶)
 * ensuring all tabs and options can be revealed easily on any screen size.
 */
export default function ScrollableTabs({
  tabs = [],
  activeTab,
  onSelectTab,
  renderTab,
  style = {},
  tabStyle = {},
  activeTabStyle = {}
}) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 5)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => checkScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })

    const observer = new ResizeObserver(() => checkScroll())
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [checkScroll, tabs])

  const slide = (direction) => {
    const el = scrollRef.current
    if (!el) return
    const offset = direction === 'left' ? -260 : 260
    el.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', ...style }}>
      {/* Left Slider Arrow Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => slide('left')}
          style={{
            position: 'absolute',
            left: 0,
            zIndex: 5,
            height: '100%',
            width: 32,
            background: 'linear-gradient(to right, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            cursor: 'pointer',
            color: '#0f766e'
          }}
          title="Slide tabs left"
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '50%',
            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #cbd5e1'
          }}>
            <ChevronLeft size={16} />
          </div>
        </button>
      )}

      {/* Tabs Container */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '4px 0',
          width: '100%',
          scrollBehavior: 'smooth'
        }}
      >
        {tabs.map((t) => {
          if (renderTab) return renderTab(t, t.id === activeTab)

          const isActive = t.id === activeTab
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0f766e' : '#475569',
                background: isActive ? '#f0fdfa' : '#ffffff',
                border: isActive ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                ...tabStyle,
                ...(isActive ? activeTabStyle : {})
              }}
            >
              {Icon && <Icon size={15} />}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? '#0f766e' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#475569',
                  fontWeight: 700
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right Slider Arrow Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => slide('right')}
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 5,
            height: '100%',
            width: 32,
            background: 'linear-gradient(to left, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            cursor: 'pointer',
            color: '#0f766e'
          }}
          title="Slide tabs right to reveal more options"
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '50%',
            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #cbd5e1'
          }}>
            <ChevronRight size={16} />
          </div>
        </button>
      )}
    </div>
  )
}
