import React, { useState } from 'react'

export default function AgentStatusBanner({ currentModule = 'indent' }) {
  const [expanded, setExpanded] = useState(false)
  const [inspectAgent, setInspectAgent] = useState(null)

  const agents = [
    {
      id: 'indent',
      name: 'Requisition & PR Agent',
      icon: '📋',
      stepNum: 1,
      role: 'Dept Request → Store Indent',
      status: 'Active',
      color: '#0891b2',
      bg: '#cffafe',
      responsibilities: [
        'Ingests indent requisitions from all 11+ plant departments (Production, Mech, Elec, Lab, Boiler, Rewinder, Admin, Stores, Housekeeping, EHS, Other)',
        'Performs real-time stock balance & minimum reorder level checks across warehouse bins',
        'Validates mandatory fields: machine context, reason code, required date & technical justification'
      ],
      makerChecker: 'Step 1: Department Requester creates ticket with status "Submitted". Hands off to SM Approval Agent.',
      telemetry: 'Monitoring live indent intake across 26 plant departments'
    },
    {
      id: 'sm_approval',
      name: 'SM Approval Agent',
      icon: '🛡️',
      stepNum: 2,
      role: 'Store Manager Approval Gate',
      status: 'Active',
      color: '#7c3aed',
      bg: '#ede9fe',
      responsibilities: [
        'Enforces mandatory Store Manager approval gatekeeper verification before physical issuance',
        'Prioritizes critical plant breakdown spares vs routine maintenance',
        'Directs approved tickets to Store Keeper Issuance Desk with immutable audit logging'
      ],
      makerChecker: 'Step 2: Store Manager approves ticket, advancing status from "Submitted" to "Approved".',
      telemetry: 'Active gatekeeper — blocking unapproved issuance attempts across all desks'
    },
    {
      id: 'store_keeper',
      name: 'Store Keeper Issuance Agent',
      icon: '📦',
      stepNum: 3,
      role: 'Physical SIV Issue & Stock Ledger',
      status: 'Active',
      color: '#0f766e',
      bg: '#ccfbf1',
      responsibilities: [
        'Verifies material bin location (e.g. Rack M-01) and lot/batch allocations',
        'Performs atomic stock deduction on materials table and creates audit entry in stock_ledger',
        'Generates official A3 Store Issue Voucher (SIV Slip) with background watermark and QR code'
      ],
      makerChecker: 'Step 3: Store Keeper issues physical stock, advancing status to "Issued". Requires SM approval.',
      telemetry: 'Syncing live stock ledger balances & batch movements'
    },
    {
      id: 'receiver_sign',
      name: 'Receiver Handover & Sign Agent',
      icon: '✍️',
      stepNum: 4,
      role: 'Receiver Sign → Out & Auto-Close',
      status: 'Active',
      color: '#16a34a',
      bg: '#dcfce7',
      responsibilities: [
        'Enforces digital department receiver signature and employee ID verification',
        'Captures machine fitment date, plant section location, and technical operational feedback',
        'Marks indent as "Closed" and links installed assets to machine digital twin'
      ],
      makerChecker: 'Step 4: Department Receiver signs for physical goods. Completes the 4-step cycle and marks "Closed".',
      telemetry: 'Verifying receiver handovers and digital twin asset linkage'
    },
    {
      id: 'procurement',
      name: 'Procurement PO Agent',
      icon: '🛒',
      stepNum: 'PO',
      role: '1-Click Direct PO & Vendor Sync',
      status: 'Active',
      color: '#0284c7',
      bg: '#e0f2fe',
      responsibilities: [
        'Converts out-of-stock indents into formal Purchase Orders with 1 click',
        'Computes dynamic commercial GST taxes (CGST/SGST/IGST), pack sizes, and payment terms',
        'Tracks expected delivery dates and updates department requesters automatically'
      ],
      makerChecker: 'Generates PO from approved requisition and logs 3-way matching contract.',
      telemetry: 'Tracking vendor dispatch schedules & PO delivery timelines'
    },
    {
      id: 'security',
      name: 'Logistics & DC Agent',
      icon: '🚛',
      stepNum: 'DC',
      role: 'Delivery Challan & Gate Pass',
      status: 'Active',
      color: '#d97706',
      bg: '#fef3c7',
      responsibilities: [
        'Generates Returnable (RGP) and Non-Returnable (NRGP) Delivery Challans',
        'Records vehicle number, driver name, gross weight, and e-way bill references',
        'Secures mill perimeter by verifying outward material exits against authorized gate passes'
      ],
      makerChecker: 'Authorizes gate security exit upon storekeeper & manager sign-off.',
      telemetry: 'Real-time security gate verification active'
    },
    {
      id: 'finance',
      name: 'Finance & Tax AP Agent',
      icon: '🧾',
      stepNum: 'AP',
      role: 'A3 GRN Invoice 3-Way Matching',
      status: 'Active',
      color: '#059669',
      bg: '#ecfdf5',
      responsibilities: [
        'Performs automated 3-way matching: PO vs GRN vs Commercial Vendor Invoice',
        'Renders full A3 Landscape GRN commercial invoices with 12-column line items & tax breakdowns',
        'Syncs payable ledgers with bank accounts and verifies TCS/Roundoff calculations'
      ],
      makerChecker: 'Audits commercial invoices and updates accounts payable vouchers.',
      telemetry: 'Enforcing 100% A3 landscape commercial GRN invoice printing'
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
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ animation: 'pulse 2s infinite', display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }}></span>
            7-AGENT MULTI-AGENT ORCHESTRATION
          </div>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            Mandatory Flow: Dept Request → Approval SM → Store Keeper Issue → Receiver Sign → Out
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Click any agent to inspect rules</span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            {expanded ? '▲ Compact View' : '▼ Expand Agent Descriptions'}
          </button>
        </div>
      </div>

      {/* Agents Strip / Expanded Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid #f1f5f9'
      }}>
        {agents.map(ag => {
          const isFocused = ag.id === currentModule || (currentModule === 'store' && (ag.id === 'store_keeper' || ag.id === 'sm_approval')) || (currentModule === 'indent' && (ag.id === 'indent' || ag.id === 'receiver_sign'))
          return (
            <div
              key={ag.id}
              onClick={() => setInspectAgent(ag)}
              style={{
                background: isFocused ? ag.bg : '#f8fafc',
                border: `1.5px solid ${isFocused ? ag.color : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              title="Click to view live agent verification rules & telemetry"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>{ag.icon}</span> {ag.name}
                </span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: ag.color,
                  background: '#ffffff',
                  border: `1px solid ${ag.color}`,
                  padding: '1px 5px',
                  borderRadius: 10
                }}>
                  {ag.status}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 600 }}>{ag.role}</div>
              {expanded && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1', lineHeight: 1.35 }}>
                  {ag.responsibilities[0]}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── AGENT INSPECTION MODAL ── */}
      {inspectAgent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setInspectAgent(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 620,
              padding: 24,
              border: `2px solid ${inspectAgent.color}`,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>{inspectAgent.icon}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: inspectAgent.color }}>
                    {inspectAgent.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Role: {inspectAgent.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectAgent(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  color: '#64748b',
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: inspectAgent.bg, padding: '10px 14px', borderRadius: 8, border: `1px solid ${inspectAgent.color}44`, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: inspectAgent.color, textTransform: 'uppercase' }}>
                Maker-Checker Governance Rule
              </div>
              <div style={{ fontSize: 12, color: '#0f172a', marginTop: 2, fontWeight: 600 }}>
                {inspectAgent.makerChecker}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Core Autonomous Responsibilities:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                {inspectAgent.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', marginBottom: 16 }}>
              <strong>Live Telemetry:</strong> {inspectAgent.telemetry}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setInspectAgent(null)}
                style={{
                  background: '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
