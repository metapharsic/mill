import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

/**
 * SearchableSelect
 * Universal accessible combobox & searchable dropdown component.
 * Allows typeahead text searching, first-letter key jumping, category grouping, and clear selection.
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  children,
  placeholder = '-- Select Option --',
  searchPlaceholder = 'Type to search or press letter...',
  disabled = false,
  required = false,
  allowClear = true,
  style = {},
  selectStyle = {},
  dropdownStyle = {},
  renderOption,
  id,
  name,
  className
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Normalize options from props or children
  const normalizedOptions = useMemo(() => {
    if (options && options.length > 0) {
      return options.map(opt => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          return { value: String(opt), label: String(opt) }
        }
        return {
          value: opt.value !== undefined ? String(opt.value) : '',
          label: opt.label || opt.name || opt.text || String(opt.value || ''),
          code: opt.code,
          subtext: opt.subtext || opt.desc || opt.description,
          badge: opt.badge,
          group: opt.group || opt.category,
          disabled: opt.disabled || false,
          raw: opt
        }
      })
    }

    // Extract from children <option> elements if provided
    if (children) {
      const extracted = []
      React.Children.forEach(children, child => {
        if (React.isValidElement(child) && child.type === 'option') {
          extracted.push({
            value: child.props.value !== undefined ? String(child.props.value) : '',
            label: child.props.children ? String(child.props.children) : String(child.props.value || ''),
            disabled: child.props.disabled || false
          })
        }
      })
      return extracted
    }

    return []
  }, [options, children])

  // Current selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find(opt => String(opt.value) === String(value)) || null
  }, [normalizedOptions, value])

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions

    const q = searchQuery.toLowerCase().trim()
    return normalizedOptions.filter(opt => {
      const labelMatch = (opt.label || '').toLowerCase().includes(q)
      const codeMatch = opt.code ? String(opt.code).toLowerCase().includes(q) : false
      const valMatch = (opt.value || '').toLowerCase().includes(q)
      const subMatch = opt.subtext ? String(opt.subtext).toLowerCase().includes(q) : false
      const groupMatch = opt.group ? String(opt.group).toLowerCase().includes(q) : false
      return labelMatch || codeMatch || valMatch || subMatch || groupMatch
    })
  }, [normalizedOptions, searchQuery])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0)
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus()
      }, 30)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && filteredOptions.length > 0) {
      const el = listRef.current.children[highlightedIndex]
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex, isOpen, filteredOptions.length])

  // Handle select action
  const handleSelect = useCallback((opt) => {
    if (opt.disabled) return
    if (onChange) {
      onChange(opt.value, opt)
    }
    setIsOpen(false)
    setSearchQuery('')
  }, [onChange])

  // Handle clear selection
  const handleClear = useCallback((e) => {
    e.stopPropagation()
    if (disabled) return
    if (onChange) {
      onChange('', null)
    }
    setSearchQuery('')
  }, [disabled, onChange])

  // First-letter jumping and key navigation
  const handleKeyDown = useCallback((e) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ' || (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/))) {
        e.preventDefault()
        setIsOpen(true)
        if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
          setSearchQuery(e.key)
        }
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setSearchQuery('')
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setSearchQuery('')
    }
  }, [disabled, isOpen, filteredOptions, highlightedIndex, handleSelect])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', userSelect: 'none', ...style }}
      className={className}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for form standard validation */}
      {required && (
        <input
          tabIndex={-1}
          required={required}
          value={value || ''}
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
            bottom: 0
          }}
        />
      )}

      {/* Main Select Button Box */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 10px',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: isOpen ? '1px solid #0f766e' : '1px solid #cbd5e1',
          borderRadius: 6,
          fontSize: 13,
          color: selectedOption ? '#0f172a' : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(15, 118, 110, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          minHeight: 34,
          ...selectStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selectedOption ? (
            <>
              {selectedOption.code && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  {selectedOption.code}
                </span>
              )}
              <span style={{ fontWeight: 500, color: '#1e293b' }}>
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span style={{
                  fontSize: 10,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 700
                }}>
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#94a3b8' }}>{placeholder}</span>
          )}
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
          {allowClear && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              title="Clear selection"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={14}
            color={isOpen ? '#0f766e' : '#94a3b8'}
            style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
          />
        </div>
      </div>

      {/* Dropdown Floating Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            ...dropdownStyle
          }}
        >
          {/* Search Input Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc'
          }}>
            <Search size={13} color="#64748b" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(0)
              }}
              placeholder={searchPlaceholder}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                color: '#0f172a',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedOption && String(selectedOption.value) === String(opt.value)
                const isHighlighted = highlightedIndex === idx

                if (renderOption) {
                  return (
                    <div
                      key={opt.value + '_' + idx}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      {renderOption(opt, { isSelected, isHighlighted })}
                    </div>
                  )
                }

                return (
                  <div
                    key={opt.value + '_' + idx}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      fontSize: 12,
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      background: isSelected ? '#f0fdfa' : isHighlighted ? '#f8fafc' : 'transparent',
                      color: opt.disabled ? '#94a3b8' : isSelected ? '#0f766e' : '#1e293b',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {opt.code && (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 10,
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontWeight: 700
                          }}>
                            {opt.code}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span style={{
                            fontSize: 10,
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontWeight: 700
                          }}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtext && (
                        <span style={{ fontSize: 10, color: '#64748b' }}>
                          {opt.subtext}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check size={13} color="#0f766e" />}
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
