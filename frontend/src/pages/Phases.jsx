import React, { useState } from 'react'
import { getPhaseSummary } from '../data/phaseStatus'

const STATUS_STYLE = {
  'Done':    { bg: '#dcfce7', color: '#15803d' },
  'In Work': { bg: '#fef3c7', color: '#b45309' },
  'Partial': { bg: '#ffedd5', color: '#c2410c' },
  'Planned': { bg: '#ecebe5', color: '#3a3a3e' },
}

export default function Phases() {
  const { groups, doneCount, inWorkCount, total } = getPhaseSummary()
  const [activeGroup, setActiveGroup] = useState('all')

  const visibleGroups = activeGroup === 'all' ? groups : groups.filter(g => g.id === activeGroup)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Build Status</div>
          <div style={S.sub}>MK Paper Mill ERP — every phase, every stone.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={S.kpi}><div style={{ ...S.kpiNum, color: '#15803d' }}>{doneCount}</div><div style={S.kpiLbl}>Done</div></div>
          <div style={S.kpi}><div style={{ ...S.kpiNum, color: '#b45309' }}>{inWorkCount}</div><div style={S.kpiLbl}>In Work</div></div>
          <div style={S.kpi}><div style={{ ...S.kpiNum, color: '#1b1b1d' }}>{total}</div><div style={S.kpiLbl}>Total</div></div>
        </div>
      </div>

      <div style={S.overallBar}>
        <div style={{ ...S.overallFill, width: `${Math.round(doneCount / total * 100)}%` }} />
      </div>
      <div style={{ fontSize: 12, color: '#8a8a90', marginBottom: 20, marginTop: 4 }}>
        {Math.round(doneCount / total * 100)}% complete — {total - doneCount - inWorkCount} planned
      </div>

      <div style={S.tabs}>
        {[['all', 'All'], ...groups.map(g => [g.id, g.title])].map(([id, label]) => (
          <button key={id} style={{ ...S.tab, ...(activeGroup === id ? S.tabA : {}) }} onClick={() => setActiveGroup(id)}>
            {label}
          </button>
        ))}
      </div>

      {visibleGroups.map(group => (
        <div key={group.id} style={{ marginBottom: 32 }}>
          <div style={{ ...S.groupTitle, borderLeftColor: group.color }}>
            {group.title}
            <span style={{ marginLeft: 10, fontSize: 12, color: '#8a8a90', fontWeight: 400 }}>
              {group.phases.filter(p => p.status === 'Done').length} / {group.phases.length} done
            </span>
          </div>
          <div style={S.grid}>
            {group.phases.map(phase => {
              const st = STATUS_STYLE[phase.status] || STATUS_STYLE['Planned']
              return (
                <div key={phase.id} style={S.card}>
                  <div style={S.cardTop}>
                    <div style={S.phaseTitle}>{phase.title}</div>
                    <span style={{ ...S.badge, background: st.bg, color: st.color }}>{phase.status}</span>
                  </div>
                  <div style={S.progressRow}>
                    <div style={S.progressBar}>
                      <div style={{ ...S.progressFill, width: `${phase.progress}%`, background: group.color }} />
                    </div>
                    <span style={S.progressText}>{phase.progress}%</span>
                  </div>
                  <div style={S.summary}>{phase.summary}</div>
                  <ul style={S.list}>
                    {phase.items.map(item => (
                      <li key={item} style={S.listItem}>
                        <span style={{ color: phase.status === 'Done' ? '#16a34a' : '#a0a0a6', marginRight: 6 }}>
                          {phase.status === 'Done' ? '✓' : '·'}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const S = {
  page:         { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 16, flexWrap: 'wrap' },
  title:        { fontSize: 24, fontWeight: 700, color: '#1b1b1d' },
  sub:          { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  kpi:          { background: '#fff', borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', minWidth: 64, textAlign: 'center' },
  kpiNum:       { fontSize: 22, fontWeight: 700 },
  kpiLbl:       { fontSize: 11, color: '#8a8a90', marginTop: 2 },
  overallBar:   { height: 8, background: '#ecebe5', borderRadius: 999, overflow: 'hidden' },
  overallFill:  { height: '100%', background: 'linear-gradient(90deg,#1b1b1d,#16a34a)', borderRadius: 999, transition: 'width 0.4s' },
  tabs:         { display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' },
  tab:          { padding: '6px 14px', background: '#ecebe5', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 12, color: '#3a3a3e', fontWeight: 500 },
  tabA:         { background: '#1b1b1d', color: '#fff' },
  groupTitle:   { fontSize: 15, fontWeight: 700, color: '#1b1b1d', marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid #1b1b1d' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  card:         { background: '#fff', border: '1px solid #ecebe5', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  phaseTitle:   { fontWeight: 700, color: '#1b1b1d', fontSize: 13, lineHeight: 1.4 },
  badge:        { fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },
  progressRow:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressBar:  { flex: 1, height: 6, background: '#ecebe5', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.4s' },
  progressText: { fontSize: 11, color: '#8a8a90', fontWeight: 600, minWidth: 28 },
  summary:      { fontSize: 12, color: '#3a3a3e', lineHeight: 1.5, marginBottom: 8 },
  list:         { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 },
  listItem:     { fontSize: 11, color: '#3a3a3e', display: 'flex', alignItems: 'flex-start' },
}
