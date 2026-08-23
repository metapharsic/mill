import React from 'react'

export default function SequenceEnforcementModal({
  isOpen,
  onClose,
  violationType = 'sm_approval_required', // 'sm_approval_required' | 'stock_issue_required' | 'receiver_sign_required' | 'custom'
  currentStep = 1,
  requiredStep = 2,
  indentNumber = '',
  deptName = '',
  onAction
}) {
  if (!isOpen) return null

  const steps = [
    {
      num: 1,
      name: 'Department Request',
      sub: 'Material Requisition for Store Indent',
      desc: '11+ Departments (Production, Mech, Elec, Lab, Boiler, Rewinder, Admin, Stores, Housekeeping, Other)',
      agent: '📋 Requisition & PR Agent'
    },
    {
      num: 2,
      name: 'Approval SM',
      sub: 'Store Manager Approval Gate',
      desc: 'Store Manager maker-checker validation, priority check & category stock verification',
      agent: '🛡️ SM Approval Agent'
    },
    {
      num: 3,
      name: 'Issued Store Keeper',
      sub: 'Approval Given To Store Keeper → Physical Issue',
      desc: 'Store Keeper allocates batch/bin location, atomically deducts stock & generates A3 SIV Voucher',
      agent: '📦 Store Keeper Issuance Agent'
    },
    {
      num: 4,
      name: 'Receiver Sign → Out',
      sub: 'Receiver Digital Signature & Handover',
      desc: 'Department receiver signs physical receipt, acknowledges fitment date & closes indent',
      agent: '✍️ Receiver Handover & Sign Agent'
    }
  ]

  const getViolationDetails = () => {
    switch (violationType) {
      case 'sm_approval_required':
        return {
          title: 'Mandatory Store Manager (SM) Approval Required',
          message: `Indent ${indentNumber ? `(${indentNumber})` : ''} has been submitted by the Department but has NOT yet been approved by the Store Manager. Physical stock cannot be issued by the Store Keeper until SM approval is officially recorded.`,
          actionLabel: '🛡️ Request / Perform SM Approval',
          actionStep: 2
        }
      case 'stock_issue_required':
        return {
          title: 'Physical Stock Issuance Pending',
          message: `Indent ${indentNumber ? `(${indentNumber})` : ''} is approved, but materials have NOT been physically issued and deducted from the store by the Store Keeper. Receiver cannot sign off before materials are issued.`,
          actionLabel: '📦 Proceed to Store Issuance',
          actionStep: 3
        }
      case 'receiver_sign_required':
        return {
          title: 'Receiver Signature & Fitment Handover Required',
          message: `Indent ${indentNumber ? `(${indentNumber})` : ''} has been issued from the store. To complete the cycle and mark Out/Closed, the Department Receiver must sign for the handover.`,
          actionLabel: '✍️ Department Receiver Sign-off',
          actionStep: 4
        }
      default:
        return {
          title: 'Sequential Process Flow Violation',
          message: `The mill standard operating procedure (SOP) requires following the 4-step sequence in strict order without skipping steps.`,
          actionLabel: 'Follow Sequence',
          actionStep: requiredStep || 2
        }
    }
  }

  const details = getViolationDetails()

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      zIndex: 100000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        width: '100%',
        maxWidth: 720,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '2px solid #ef4444',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header Warning Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          color: '#ffffff',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Process Sequence Enforcement Alert
              </div>
              <div style={{ fontSize: 12, color: '#fee2e2', fontWeight: 600 }}>
                Standard Operating Procedure (SOP): Strict Maker-Checker 4-Step Requisition Lifecycle
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Explanation Banner */}
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 18
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>
              🚫 {details.title}
            </div>
            <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.45 }}>
              {details.message}
            </div>
            {deptName && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontWeight: 600 }}>
                Target Department: <strong>{deptName}</strong>
              </div>
            )}
          </div>

          {/* 4-Step Mandatory Process Pipeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#0f766e',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>🔄</span> Mandatory 4-Step Workflow Sequence
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {steps.map((st) => {
                const isPassed = st.num < requiredStep
                const isCurrent = st.num === requiredStep
                const isBlocked = st.num > requiredStep

                return (
                  <div
                    key={st.num}
                    style={{
                      background: isCurrent ? '#f0fdfa' : (isPassed ? '#f8fafc' : '#fef2f2'),
                      border: `1.5px solid ${isCurrent ? '#0f766e' : (isPassed ? '#cbd5e1' : '#fca5a5')}`,
                      borderRadius: 8,
                      padding: 10,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 120
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          background: isCurrent ? '#0f766e' : (isPassed ? '#64748b' : '#ef4444'),
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: 10
                        }}>
                          STEP {st.num}
                        </span>
                        <span style={{ fontSize: 13 }}>
                          {isPassed ? '✓' : (isCurrent ? '⚡' : '🔒')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: isCurrent ? '#0f766e' : '#0f172a' }}>
                        {st.name}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#475569', marginTop: 3, lineHeight: 1.25 }}>
                        {st.sub}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: isCurrent ? '#0f766e' : (isPassed ? '#16a34a' : '#94a3b8'),
                      marginTop: 6,
                      borderTop: '1px dashed #cbd5e1',
                      paddingTop: 4
                    }}>
                      {st.agent}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #e2e8f0',
            paddingTop: 16
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              MK Paper Mill ERP · Multi-Agent Governance
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Understood / Close
              </button>
              {onAction && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onAction(details.actionStep)
                  }}
                  style={{
                    background: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15, 118, 110, 0.3)'
                  }}
                >
                  {details.actionLabel} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
