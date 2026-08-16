import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })

export default function FGWarehouse() {
  const [reels, setReels] = useState([])
  const [grades, setGrades] = useState([])
  const [summary, setSummary] = useState({})
  const [filter, setFilter] = useState({ gradeId: '', from: '', to: '' })
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [filter])

  async function load() {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([,v])=>v))).toString()
    const [r1, r2] = await Promise.all([
      fetch(`${API}/warehouse/reels?${params}`, { headers: h() }),
      fetch(`${API}/warehouse/grades`, { headers: h() }),
    ])
    const d1 = await r1.json()
    setReels(d1.data || [])
    setSummary(d1.summary || {})
    setGrades((await r2.json()).data || [])
  }

  const filtered = reels.filter(r => !search || r.reel_number.toLowerCase().includes(search.toLowerCase()))

  const byGrade = grades.map(g => ({
    ...g,
    count: reels.filter(r => r.grade_id === g.id).length,
    weight: reels.filter(r => r.grade_id === g.id).reduce((s,r) => s + parseFloat(r.net_weight_kg || r.weight_kg || 0), 0),
  })).filter(g => g.count > 0)

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>FG Warehouse</div>
          <div style={S.sub}>Finished goods in warehouse</div>
        </div>
      </div>

      <div style={S.kpis}>
        {[
          ['Total Reels', summary.totalreels||0, '#1b1b1d'],
          ['Total Weight (kg)', Number(summary.totalweight||0).toLocaleString('en-IN'), '#1b1b1d'],
          ['Grade Types', summary.grades||0, '#16a34a'],
        ].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      {byGrade.length > 0 && (
        <div style={S.gradeGrid}>
          {byGrade.map(g => (
            <div key={g.id} style={S.gradeCard}>
              <div style={S.gradeName}>{g.name}</div>
              <div style={S.gradeCount}>{g.count} reels</div>
              <div style={S.gradeWt}>{g.weight.toLocaleString('en-IN')} kg</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input style={{ ...S.sel, flex:1, minWidth:160 }} placeholder='Search reel number...' value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.sel} value={filter.gradeId} onChange={e => setFilter({...filter, gradeId: e.target.value})}>
          <option value=''>All Grades</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input style={S.sel} type='date' value={filter.from} onChange={e => setFilter({...filter, from: e.target.value})} />
        <input style={S.sel} type='date' value={filter.to} onChange={e => setFilter({...filter, to: e.target.value})} />
      </div>

      <table style={S.tbl}>
        <thead><tr>{['Reel No','Grade','Machine','Net Wt (kg)','QC Status','Pack No','Pack Type','Date'].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              <td style={S.td}><b>{r.reel_number}</b></td>
              <td style={S.td}>{r.gradename}</td>
              <td style={S.td}>{r.machinename}</td>
              <td style={S.td}>{Number(r.net_weight_kg || r.weight_kg || 0).toLocaleString('en-IN')}</td>
              <td style={S.td}><span style={{ ...S.badge, background: r.quality_status==='Approved'?'#dcfce7':'#fef9c3', color: r.quality_status==='Approved'?'#15803d':'#854d0e' }}>{r.quality_status||'Pending'}</span></td>
              <td style={S.td}>{r.packnumber||'—'}</td>
              <td style={S.td}>{r.packingtype||'—'}</td>
              <td style={S.td}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No reels in warehouse</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  kpis: { display: 'flex', gap: 12, marginBottom: 20 },
  kpi: { background: 'white', borderRadius: 10, padding: '14px 20px', flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiVal: { fontSize: 26, fontWeight: 700 },
  kpiLbl: { fontSize: 12, color: '#8a8a90', marginTop: 2 },
  gradeGrid: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  gradeCard: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', minWidth: 120 },
  gradeName: { fontWeight: 700, color: '#1b1b1d', fontSize: 13 },
  gradeCount: { fontSize: 12, color: '#1b1b1d', marginTop: 2 },
  gradeWt: { fontSize: 11, color: '#8a8a90' },
  sel: { padding: '7px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13 },
  tbl: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td: { padding: '10px 14px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
}
