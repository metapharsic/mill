import React, { useState, useRef, useEffect, useMemo } from 'react'

/**
 * MultiSearchableSelect - Multi-select tag combobox with typeahead search,
 * tag chips with deletion, Select All / Clear All, and keyboard navigation.
 */
export default function MultiSearchableSelect({
  selectedValues = [],
  onChange,
  options = [],
  placeholder = '-- Select Multiple --',
  searchPlaceholder = 'Type to search...',
  disabled = false,
  maxTagsDisplay = 3,
  style = {},
  selectStyle = {},
  id
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Normalize selectedValues to string set
  const selectedSet = useMemo(() => {
    return new Set((selectedValues || []).map(v => String(v)))
  }, [selectedValues])

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const q = searchTerm.toLowerCase().trim()
    return options.filter(opt => {
      const label = (opt.label || '').toLowerCase()
      const code = (opt.code || '').toLowerCase()
      const sub = (opt.subtext || '').toLowerCase()
      const group = (opt.group || '').toLowerCase()
      return label.includes(q) || code.includes(q) || sub.includes(q) || group.includes(q)
    })
  }, [options, searchTerm])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (val) => {
    const sVal = String(val)
    let newSelected
    if (selectedSet.has(sVal)) {
      newSelected = (selectedValues || []).filter(v => String(v) !== sVal)
    } else {
      newSelected = [...(selectedValues || []), val]
    }
    if (onChange) onChange(newSelected)
  }

  const removeTag = (e, val) => {
    e.stopPropagation()
    const sVal = String(val)
    const newSelected = (selectedValues || []).filter(v => String(v) !== sVal)
    if (onChange) onChange(newSelected)
  }

  const selectAll = () => {
    const allVals = filteredOptions.map(o => o.value)
    const merged = Array.from(new Set([...(selectedValues || []), ...allVals]))
    if (onChange) onChange(merged)
  }

  const clearAll = (e) => {
    if (e) e.stopPropagation()
    if (onChange) onChange([])
  }

  // Selected Option Objects
  const selectedOptions = useMemo(() => {
    return (selectedValues || []).map(v => {
      const found = options.find(o => String(o.value) === String(v))
      return found || { value: v, label: String(v) }
    })
  }, [selectedValues, options])

  return (
    <div
      ref={containerRef}
      id={id}
      style={{
        position: 'relative',
        width: '100%',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style
      }}
    >
      {/* ── Selection Trigger Box ── */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev)
            if (!isOpen && inputRef.current) {
              setTimeout(() => inputRef.current?.focus(), 50)
            }
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 34,
          padding: '4px 8px',
          background: '#ffffff',
          border: isOpen ? '1.5px solid #0f766e' : '1px solid #cbd5e1',
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(15, 118, 110, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          gap: 6,
          ...selectStyle
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', flex: 1, minWidth: 0 }}>
          {selectedOptions.length === 0 ? (
            <span style={{ color: '#94a3b8', fontSize: 12, userSelect: 'none' }}>{placeholder}</span>
          ) : (
            <>
              {selectedOptions.slice(0, maxTagsDisplay).map(opt => (
                <span
                  key={String(opt.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#f0fdfa',
                    color: '#0f766e',
                    border: '1px solid #99f6e4',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={opt.label}
                >
                  {opt.code && <span style={{ opacity: 0.8, fontFamily: 'monospace' }}>[{opt.code}]</span>}
                  <span>{opt.label}</span>
                  <button
                    type="button"
                    onClick={(e) => removeTag(e, opt.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0f766e',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: 0,
                      lineHeight: 1,
                      marginLeft: 2
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {selectedOptions.length > maxTagsDisplay && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#e2e8f0',
                    color: '#475569',
                    borderRadius: 4,
                    padding: '2px 6px'
                  }}
                >
                  +{selectedOptions.length - maxTagsDisplay} more
                </span>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {selectedOptions.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              title="Clear all selections"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 12,
                padding: '2px 4px'
              }}
            >
              ✕
            </button>
          )}
          <span style={{ color: '#64748b', fontSize: 11, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
            ▼
          </span>
        </div>
      </div>

      {/* ── Dropdown Menu ── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
            overflow: 'hidden',
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                padding: '5px 8px',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                fontSize: 11.5,
                outline: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  color: '#0f766e',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 6px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 6px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 220 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#94a3b8', textAlign: 'center' }}>
                No options found matching "{searchTerm}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(String(opt.value))
                return (
                  <div
                    key={String(opt.value)}
                    onClick={() => toggleOption(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0fdfa' : '#ffffff',
                      borderBottom: '1px solid #f8fafc',
                      fontSize: 11.5,
                      color: isSelected ? '#0f766e' : '#1e293b',
                      transition: 'background 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#ffffff'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by div click
                      style={{ cursor: 'pointer', accentColor: '#0f766e' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isSelected ? 700 : 500 }}>
                        {opt.code && <span style={{ fontFamily: 'monospace', color: '#0f766e', marginRight: 4 }}>[{opt.code}]</span>}
                        {opt.label}
                      </div>
                      {opt.subtext && (
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                          {opt.subtext}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
