import React from 'react'

/**
 * Sortable Table Header Component (SortableTh)
 * Provides intuitive, clickable ASC / DESC indicators with accessible tooltips and clear visual feedback.
 */
export default function SortableTh({
  label,
  columnKey,
  currentSortKey,
  currentSortOrder = 'asc',
  onSort,
  align = 'left',
  width,
  style = {}
}) {
  const isActive = currentSortKey === columnKey
  const isAsc = currentSortOrder?.toLowerCase() === 'asc'

  const handleClick = () => {
    if (!onSort) return
    if (isActive) {
      onSort(columnKey, isAsc ? 'desc' : 'asc')
    } else {
      onSort(columnKey, 'asc')
    }
  }

  const nextOrder = isActive ? (isAsc ? 'descending' : 'ascending') : 'ascending'

  return (
    <th
      onClick={handleClick}
      title={`Click to sort ${label} ${nextOrder}`}
      style={{
        padding: '10px 12px',
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: isActive ? '#0f766e' : '#8a8a90',
        background: isActive ? '#f0fdfa' : 'transparent',
        borderBottom: isActive ? '2px solid #0f766e' : '1px solid #e7e6df',
        transition: 'all 0.15s ease',
        width: width || 'auto',
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%'
      }}>
        <span>{label}</span>
        <span style={{
          display: 'inline-block',
          fontSize: 10,
          lineHeight: 1,
          color: isActive ? '#0f766e' : '#cbd5e1',
          fontWeight: 700,
          transform: isActive && !isAsc ? 'scaleY(1)' : 'scaleY(1)'
        }}>
          {isActive ? (isAsc ? '▲' : '▼') : '⇅'}
        </span>
      </div>
    </th>
  )
}
