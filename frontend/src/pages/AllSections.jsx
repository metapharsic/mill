import React, { useState, useEffect, useCallback } from 'react'

const POLL_MS = 60_000
const API = '/api/sections'

const alarmColor = (c, w) => {
  if (c > 0) return '#ef4444'
  if (w > 0) return '#f59e0b'
  return '#22c55e'
}

export default function AllSections() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)

  const fetchSnapshot = useCallback(async () => {
    try {
      const r = await fetch(`${API}/all/kpi-snapshot`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      })
      const j = await r.json()
      if (j.success) { setSections(j.data); setLastSync(new Date()) }
    } catch (e) {
      console.error('AllSections fetch error', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const id = setInterval(fetchSnapshot, POLL_MS)
    return () => clearInterval(id)
  }, [fetchSnapshot])

  if (loading) return <div style={s.center}>Loading plant data...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>🌐 All Sections</h2>
          <p style={s.sub}>Plant-wide overview — live KPI aggregator</p>
        </div>
        <div style={s.syncBadge}>
          Last sync: {lastSync ? lastSync.toLocaleTimeString('en-IN') : '—'}
          <button onClick={fetchSnapshot} style={s.refreshBtn}>↻ Refresh</button>
        </div>
      </div>

      <div style={s.grid}>
        {sections.map(sec => {
          const crit = parseInt(sec.criticalAlarms) || 0
          const warn = parseInt(sec.warningAlarms) || 0
          const kpi = sec.kpiData || {}
          const topKeys = Object.keys(kpi).filter(k => k !== '_alarms').slice(0, 3)
          return (
            <div key={sec.sectionCode} style={{ ...s.card, borderLeft: `3px solid ${alarmColor(crit, warn)}` }}>
              <div style={s.cardHeader}>
                <span style={s.icon}>{sec.icon}</span>
                <span style={s.cardName}>{sec.name}</span>
                {(crit > 0 || warn > 0) && (
                  <span style={{ ...s.alarmBadge, background: alarmColor(crit, warn) }}>
                    {crit > 0 ? `🔴 ${crit}` : `⚠️ ${warn}`}
                  </span>
                )}
              </div>
              {topKeys.length > 0 ? (
                <div style={s.kpiList}>
                  {topKeys.map(k => (
                    <div key={k} style={s.kpiRow}>
                      <span style={s.kpiLabel}>{kpi[k].param || k}</span>
                      <span style={s.kpiVal}>{Number(kpi[k].avg).toFixed(2)} {kpi[k].uom || ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={s.noData}>No readings in last hour</div>
              )}
              <div style={s.snapTime}>
                {sec.snapshotTime
                  ? new Date(sec.snapshotTime).toLocaleTimeString('en-IN')
                  : 'No snapshot yet'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  page:       { padding: 24 },
  center:     { padding: 40, textAlign: 'center', color: '#8a8a90' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:      { margin: 0, fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub:        { margin: '4px 0 0', color: '#8a8a90', fontSize: 13 },
  syncBadge:  { display: 'flex', alignItems: 'center', gap: 8, color: '#8a8a90', fontSize: 12 },
  refreshBtn: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 },
  card:       { background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  icon:       { fontSize: 20 },
  cardName:   { fontWeight: 600, fontSize: 14, color: '#1b1b1d', flex: 1 },
  alarmBadge: { fontSize: 11, color: '#fff', borderRadius: 10, padding: '2px 8px', fontWeight: 600 },
  kpiList:    { display: 'flex', flexDirection: 'column', gap: 4 },
  kpiRow:     { display: 'flex', justifyContent: 'space-between', fontSize: 12 },
  kpiLabel:   { color: '#8a8a90', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  kpiVal:     { fontWeight: 600, color: '#1b1b1d' },
  noData:     { fontSize: 12, color: '#a0a0a6', fontStyle: 'italic' },
  snapTime:   { marginTop: 10, fontSize: 11, color: '#d8d6cc', textAlign: 'right' },
}
