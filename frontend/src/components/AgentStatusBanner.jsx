import React, { useState } from 'react'

export default function AgentStatusBanner({ currentModule = 'indent' }) {
  const [expanded, setExpanded] = useState(false)

  const agents = [
    {
      id: 'indent',
      name: 'Requisition & PR Agent',
      icon: '📋',
      role: 'Indent → Multi-Tier Approval Chain',
      status: 'Active',
      color: '#0891b2',
      bg: '#cffafe',
      detail: 'Validates BOM requirements, routes L1/L2/L3 approval matrix, and checks stock availability before procurement.'
    },
    {
      id: 'procurement',
      name: 'Procurement PO Agent',
      icon: '🛒',
      role: '1-Click Direct PO & Vendor Sync',
      status: 'Active',
      color: '#0284c7',
      bg: '#e0f2fe',
      detail: 'Converts Indents into formal POs, assigns vendor contracts, computes GST breakdowns, and tracks delivery dates.'
    },
    {
      id: 'security',
      name: 'Logistics & DC Agent',
      icon: '🚛',
      role: 'Delivery Challan & Gate Pass Dispatch',
      status: 'Active',
      color: '#d97706',
      bg: '#fef3c7',
      detail: 'Generates Returnable/Non-Returnable Delivery Challans, records vehicle numbers, and tracks outward material dispatch.'
    },
    {
      id: 'store',
      name: 'Store & Issuance Agent',
      icon: '📦',
      role: 'Immediate SIV Issue & Stock Ledger',
      status: 'Active',
      color: '#0f766e',
      bg: '#ccfbf1',
      detail: 'Performs direct store issuance, deducts physical stock atomically, logs stock ledger entries, and generates SIV vouchers.'
    },
    {
      id: 'finance',
      name: 'Finance & Tax Agent',
      icon: '🧾',
      role: 'Full GST Breakdown & AP Clearance',
      status: 'Active',
      color: '#16a34a',
      bg: '#dcfce7',
      detail: 'Performs 3-way matching across Indent, PO, GRN, and Invoice, verifying CGST/SGST/IGST and budget allocations.'
    }
  ]


  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 16px',
      marginBottom: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f766e, #0369a1)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ animation: 'pulse 2s infinite', display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }}></span>
            MULTI-AGENT ORCHESTRATION
          </div>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            Unified ERP Pipeline: PR → PO → Gate Pass → Single GRN → QC → AP Settlement
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            {expanded ? '▲ Hide Agent Status' : '▼ View 5 Active Agents'}
          </button>
        </div>
      </div>

      {/* Agents Strip / Expanded Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid #f1f5f9'
      }}>
        {agents.map(ag => {
          const isFocused = ag.id === currentModule
          return (
            <div
              key={ag.id}
              style={{
                background: isFocused ? ag.bg : '#f8fafc',
                border: `1px solid ${isFocused ? ag.color : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '8px 12px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{ag.icon}</span> {ag.name}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: ag.color,
                  background: '#ffffff',
                  border: `1px solid ${ag.color}`,
                  padding: '1px 6px',
                  borderRadius: 10
                }}>
                  {ag.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{ag.role}</div>
              {expanded && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1', lineHeight: 1.4 }}>
                  {ag.detail}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
