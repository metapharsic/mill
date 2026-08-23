import React, { useMemo } from 'react'
import MultiSearchableSelect from './MultiSearchableSelect'

// Standard icon name mapping for all paper mill process sections
export const SECTION_ICON_MAP = {
  '🏭': 'Plant & Boiler House',
  '🌀': 'Centricleaner & Screening',
  '🕸️': 'Wire Part (Fourdrinier)',
  '💨': 'Vacuum System & Suction',
  '🔄': 'Press Section & Nips',
  '☀️': 'Dryer Group & Hood',
  '🔘': 'Calender & Reel Drum',
  '💧': 'ETP & Water Clarifier',
  '🌿': 'Pulp Mill & Digesters',
  '🔬': 'QC Laboratory & Testing',
  '📦': 'Finishing & Warehouse',
  '⚡': 'Electrical Substation & MCC',
  '⚙️': 'Mechanical Workshop',
  '🛢️': 'Chemical Yard & Dosing'
}

export function getSectionIconDesc(icon) {
  return SECTION_ICON_MAP[icon] || 'Plant Process Section'
}

/**
 * Universal Plant Section & Machinery Allocation Component
 * Used across Materials, Inventory, Raw Materials, Chemical Store, Store Desks, and Indents
 */
export default function SectionMachineAllocator({
  sectionIds = [],
  onSectionIdsChange,
  equipmentIds = [],
  onEquipmentIdsChange,
  machineId = '',
  onMachineIdChange,
  sectionContext = '',
  onSectionContextChange,
  sections = [],
  sectionEquipment = [],
  machines = [],
  onAddSection,
  onAddEquipment,
  required = false,
  errors = {},
  disabled = false,
  compact = false,
  style = {}
}) {
  // Normalize sectionIds
  const normalizedSectionIds = useMemo(() => {
    if (Array.isArray(sectionIds)) return sectionIds.map(String)
    if (sectionIds) return [String(sectionIds)]
    return []
  }, [sectionIds])

  // Normalize equipmentIds
  const normalizedEquipmentIds = useMemo(() => {
    if (Array.isArray(equipmentIds)) return equipmentIds.map(String)
    if (equipmentIds) return [String(equipmentIds)]
    return []
  }, [equipmentIds])

  // Filtered equipment options based on selected sections
  const filteredEquipment = useMemo(() => {
    if (normalizedSectionIds.length === 0) return sectionEquipment
    return sectionEquipment.filter(eq => {
      if (!eq.sectionId && !eq.section_id) return true
      const sId = String(eq.sectionId || eq.section_id)
      return normalizedSectionIds.includes(sId)
    })
  }, [sectionEquipment, normalizedSectionIds])

  // Prepare section options for MultiSearchableSelect
  const sectionOptions = useMemo(() => {
    return sections
      .filter(s => s.sectionCode !== 'ALL' && s.code !== 'ALL')
      .sort((a, b) => (a.sortOrder || a.sort_order || 99) - (b.sortOrder || b.sort_order || 99))
      .map(s => {
        const icon = s.icon || '🏭'
        const iconDesc = getSectionIconDesc(icon)
        return {
          value: String(s.id),
          label: `${icon} ${s.name || s.sectionCode || s.code}`,
          code: s.sectionCode || s.code || '',
          group: s.departmentName || s.department_name || 'Plant Process',
          subtext: `[${s.sectionCode || s.code}] • ${iconDesc}`
        }
      })
  }, [sections])

  // Prepare equipment options for MultiSearchableSelect
  const equipmentOptions = useMemo(() => {
    return filteredEquipment.map(eq => {
      const sec = sections.find(s => String(s.id) === String(eq.sectionId || eq.section_id))
      const secLabel = sec ? `${sec.icon || '🏭'} ${sec.name || sec.sectionCode}` : (eq.sectionName || eq.section_name || 'Plant Equipment')
      const specs = [
        eq.bearingSize || eq.bearing_size ? `Brg: ${eq.bearingSize || eq.bearing_size}` : null,
        eq.shaftSize || eq.shaft_size ? `Shaft: ${eq.shaftSize || eq.shaft_size}` : null,
        eq.beltNo || eq.belt_no ? `Belt: ${eq.beltNo || eq.belt_no}` : null
      ].filter(Boolean).join(' | ')

      return {
        value: String(eq.id),
        label: eq.equipmentName || eq.equipment_name || eq.name,
        code: eq.tagName || eq.tag_name || '',
        group: secLabel,
        subtext: specs ? `⚙️ ${specs}` : (eq.sectionCode || eq.section_code ? `[${eq.sectionCode || eq.section_code}]` : '')
      }
    })
  }, [filteredEquipment, sections])

  // Collect selected equipment specs for Digital Twin Preview
  const selectedEquipDetails = useMemo(() => {
    return sectionEquipment.filter(eq => normalizedEquipmentIds.includes(String(eq.id)))
  }, [sectionEquipment, normalizedEquipmentIds])

  return (
    <div
      style={{
        background: '#f8fafc',
        border: errors.section || errors.equipment ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
        borderRadius: 8,
        padding: compact ? '8px 10px' : '12px 16px',
        marginBottom: compact ? 8 : 14,
        fontFamily: 'inherit',
        ...style
      }}
    >
      {/* ── Section Header ── */}
      <div
        style={{
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: '#0f766e',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: compact ? 14 : 16 }}>🏭</span>
          <span>Plant Section &amp; Machinery Allocation (Multi-Section &amp; Multi-Machine Support)</span>
          {required && <span style={{ color: '#dc2626', fontWeight: 800 }}>*</span>}
        </div>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
          💡 One item can be allocated to multiple sections &amp; machines across the mill
        </span>
      </div>

      {/* ── Multi-Selectors Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Multi-Section Selector */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Allocated Plant Section(s)</span>
              {required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            {onAddSection && (
              <button
                type="button"
                onClick={onAddSection}
                disabled={disabled}
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #0f766e',
                  color: '#0f766e',
                  borderRadius: 4,
                  fontSize: 10.5,
                  padding: '1px 7px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
                title="Create a new plant section on the fly"
              >
                + Add Section
              </button>
            )}
          </div>
          <MultiSearchableSelect
            selectedValues={normalizedSectionIds}
            onChange={(vals) => {
              if (onSectionIdsChange) onSectionIdsChange(vals)
              // Auto-clean equipment that does not belong to new section selection
              if (onEquipmentIdsChange && vals.length > 0) {
                const validEquipIds = normalizedEquipmentIds.filter(eqId => {
                  const eq = sectionEquipment.find(x => String(x.id) === String(eqId))
                  return !eq || !eq.sectionId || vals.includes(String(eq.sectionId))
                })
                if (validEquipIds.length !== normalizedEquipmentIds.length) {
                  onEquipmentIdsChange(validEquipIds)
                }
              }
            }}
            placeholder="— Select One or Multiple Plant Sections —"
            searchPlaceholder="Search plant sections (Wire, Press, Boiler, ETP, Pulp...)..."
            options={sectionOptions}
            disabled={disabled}
          />
          {errors.section && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3, fontWeight: 600 }}>⚠️ {errors.section}</div>
          )}
        </div>

        {/* Multi-Equipment / Machinery Selector */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
              Allocated Machine(s) / Roll(s)
            </label>
            {onAddEquipment && (
              <button
                type="button"
                onClick={onAddEquipment}
                disabled={disabled}
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #0f766e',
                  color: '#0f766e',
                  borderRadius: 4,
                  fontSize: 10.5,
                  padding: '1px 7px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
                title="Create a new equipment / machine roll on the fly"
              >
                + Add Equipment
              </button>
            )}
          </div>
          <MultiSearchableSelect
            selectedValues={normalizedEquipmentIds}
            onChange={(vals) => {
              if (onEquipmentIdsChange) onEquipmentIdsChange(vals)
            }}
            placeholder="— Select One or Multiple Machinery / Rolls —"
            searchPlaceholder="Search equipment, rolls, bearings (e.g. Couch Roll, 23234K)..."
            options={equipmentOptions}
            disabled={disabled}
          />
          {errors.equipment && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3, fontWeight: 600 }}>⚠️ {errors.equipment}</div>
          )}
        </div>
      </div>

      {/* ── Primary Machine Unit & Technical Context Row ── */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 2fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
            Primary Machine Unit
          </label>
          <select
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: disabled ? '#f1f5f9' : '#ffffff',
              fontSize: 13,
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
            value={String(machineId || '')}
            onChange={(e) => onMachineIdChange && onMachineIdChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— General / Any Machine —</option>
            {machines.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.name || m.code || `Machine #${m.id}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
            Section Context / Technical Placement Notes
          </label>
          <input
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: disabled ? '#f1f5f9' : '#ffffff',
              fontSize: 13,
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
            value={sectionContext || ''}
            onChange={(e) => onSectionContextChange && onSectionContextChange(e.target.value)}
            placeholder="e.g. Wire Section Couch Roll & Press Section Drive Roller (Dosing point #2)"
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Digital Twin Mechanical Specifications Sheet Preview ── */}
      {selectedEquipDetails.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selectedEquipDetails.map(eq => {
            const hasSpecs = eq.bearingSize || eq.lockNut || eq.washer || eq.beltNo || eq.shaftSize || eq.impellerSize || eq.sleeve || eq.couplings || eq.pulleys || eq.remarks
            if (!hasSpecs) return null

            return (
              <div
                key={eq.id}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ fontWeight: 800 }}>⚙️ {eq.equipmentName || eq.equipment_name}:</span>
                {eq.bearingSize && <span><b>Bearing:</b> {eq.bearingSize}</span>}
                {eq.lockNut && <span><b>Lock Nut:</b> {eq.lockNut}</span>}
                {eq.washer && <span><b>Washer:</b> {eq.washer}</span>}
                {eq.beltNo && <span><b>Belt:</b> {eq.beltNo}</span>}
                {eq.shaftSize && <span><b>Shaft:</b> {eq.shaftSize}</span>}
                {eq.impellerSize && <span><b>Impeller:</b> {eq.impellerSize}</span>}
                {eq.sleeve && <span><b>Sleeve:</b> {eq.sleeve}</span>}
                {eq.couplings && <span><b>Coupling:</b> {eq.couplings}</span>}
                {eq.pulleys && <span><b>Pulley:</b> {eq.pulleys}</span>}
                {eq.remarks && <span style={{ color: '#047857' }}>({eq.remarks})</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
