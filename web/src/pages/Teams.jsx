import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const C = {
  bg: '#001a2b',
  bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)',
  glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)',
  border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8',
  textSoft: '#C0D6EA',
  textMuted: '#8ba8c4',
  textDim: '#5a7d9a',
  accent: '#DDFF55',
  accentGlow: 'rgba(221,255,85,0.15)',
  accentSoft: 'rgba(221,255,85,0.08)',
  green: '#5ef0b0',
  yellow: '#ffd166',
  red: '#ff6b6b',
  teams: '#5ef0b0',
}

const API_BASE = 'https://aria-backend-production-176b.up.railway.app'
const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const statusMeta = {
  available: { label: 'Disponível', color: C.green },
  reserved: { label: 'Em andamento', color: C.yellow },
  occupied: { label: 'Encerrada', color: C.red },
}

function EX({ color = C.accent, size = 16 }) {
  return (
    <span style={{ color, fontWeight: 800, fontStyle: 'italic' }}>
      <span style={{ fontSize: size * 0.85 }}>e</span>
      <span style={{ fontSize: size * 1.12, fontWeight: 900 }}>X</span>
    </span>
  )
}

function Logo({ size = 18, showIcon = true }) {
  return (
    <Link to='/' style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none' }}>
      {showIcon && (
        <div style={{
          width: size * 1.8,
          height: size * 1.8,
          borderRadius: size * 0.5,
          background: `linear-gradient(135deg, ${C.accent}, #b8ff33)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 20px ${C.accentGlow}`,
        }}>
          <span style={{ fontWeight: 900, fontSize: size * 0.65, color: C.bgDeep, fontStyle: 'italic', letterSpacing: '-0.06em' }}>
            <span style={{ fontSize: size * 0.55 }}>e</span>
            <span style={{ fontSize: size * 0.75 }}>X</span>
          </span>
        </div>
      )}
      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: size, fontWeight: 700, letterSpacing: '-0.03em', color: C.text }}>
        Radio<EX color={C.accent} size={size} />perience
      </span>
    </Link>
  )
}

function FloatingOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[ 
        { top:'6%', left:'8%', w:460, h:460, color:'rgba(221,255,85,0.05)', blur:60 },
        { top:'10%', right:'8%', w:380, h:380, color:'rgba(94,240,176,0.08)', blur:70 },
        { top:'42%', left:'55%', w:420, h:420, color:'rgba(126,203,255,0.05)', blur:60 },
        { bottom:'-5%', left:'18%', w:560, h:420, color:'rgba(17,66,93,0.55)', blur:80 },
      ].map((orb, i) => (
        <div key={i} style={{
          position:'absolute', ...orb,
          borderRadius:'50%',
          background:`radial-gradient(circle, ${orb.color} 0%, transparent 65%)`,
          filter:`blur(${orb.blur}px)`,
        }} />
      ))}
    </div>
  )
}

function statusPill(status) {
  const meta = statusMeta[status] || statusMeta.available
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 999,
      background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
      color: meta.color, fontSize: 12, fontWeight: 800,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
      {meta.label}
    </span>
  )
}

function GlassModal({ title, onClose, children, width = 560 }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, display:'grid', placeItems:'center', background:'rgba(0,10,20,0.7)', backdropFilter:'blur(12px)', padding:20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:'100%', maxWidth:width, maxHeight:'90vh', overflowY:'auto', background:'rgba(0,26,43,0.92)', border:`1px solid ${C.glassBorder}`, borderRadius:22, boxShadow:'0 24px 80px rgba(0,0,0,0.45)', padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:12, color:C.teams, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em' }}>eX Teams</div>
            <h3 style={{ marginTop:4, fontSize:22 }}>{title}</h3>
          </div>
          <button onClick={onClose} style={{ borderRadius:10, border:`1px solid ${C.glassBorder}`, background:'transparent', color:C.textMuted, padding:'8px 12px', cursor:'pointer', fontWeight:700 }}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function VacancyCard({ shift, isStaff, onEdit, onInterest }) {
  const meta = statusMeta[shift.status] || statusMeta.available
  return (
    <article style={{
      borderRadius: 22,
      border: `1px solid ${C.glassBorder}`,
      background: C.glass,
      padding: 18,
      backdropFilter: 'blur(24px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:12, color:C.teams, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
            {shift.location || 'Local a definir'}
          </div>
          <h3 style={{ fontSize:22, lineHeight:1.2, margin:0 }}>{shift.specialty || 'Radiologia'} </h3>
        </div>
        {statusPill(shift.status)}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:10 }}>
        <Info label='Dia' value={shift.day_of_week || 'A definir'} />
        <Info label='Horário' value={shift.time_slot || 'A combinar'} />
        <Info label='Sala / setor' value={shift.room || 'A definir'} />
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', paddingTop:12, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:12, color:C.textDim }}>
          {shift.status === 'available' ? 'Candidatura aberta no eX Teams.' : `Status atual: ${meta.label.toLowerCase()}.`}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {isStaff && (
            <button onClick={() => onEdit(shift)} style={secondaryButton}>
              Editar vaga
            </button>
          )}
          <button onClick={() => onInterest(shift)} style={primaryButton}>
            {shift.status === 'available' ? 'Tenho interesse' : 'Ver contato'}
          </button>
        </div>
      </div>
    </article>
  )
}

function Info({ label, value }) {
  return (
    <div style={{ borderRadius:14, border:`1px solid ${C.border}`, background:'rgba(0,26,43,0.34)', padding:'12px 14px' }}>
      <div style={{ fontSize:10, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:13, color:C.textSoft, fontWeight:700 }}>{value}</div>
    </div>
  )
}

const inputStyle = {
  width:'100%',
  borderRadius:12,
  border:`1px solid ${C.glassBorder}`,
  background:'rgba(0,26,43,0.5)',
  color:C.text,
  padding:'11px 12px',
  outline:'none',
}

const primaryButton = {
  border: 'none',
  borderRadius: 12,
  background: C.accent,
  color: C.bgDeep,
  padding: '11px 14px',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: `0 0 20px ${C.accentGlow}`,
}

const secondaryButton = {
  border: `1px solid ${C.glassBorder}`,
  borderRadius: 12,
  background: 'transparent',
  color: C.textSoft,
  padding: '11px 14px',
  fontWeight: 700,
  cursor: 'pointer',
}

export default function Teams() {
  const { user, isStaff } = useAuth()
  const navigate = useNavigate()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [day, setDay] = useState('')
  const [status, setStatus] = useState('available')
  const [interestShift, setInterestShift] = useState(null)
  const [editShift, setEditShift] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkFilterType, setBulkFilterType] = useState('location')
  const [bulkFilterValue, setBulkFilterValue] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkCount, setBulkCount] = useState(null)

  const fetchShifts = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (location) params.set('location', location)
      if (day) params.set('day', day)
      if (status && status !== 'all') params.set('status', status)
      const res = await fetch(`${API_BASE}/shifts${params.toString() ? `?${params.toString()}` : ''}`)
      if (!res.ok) throw new Error('Falha ao carregar vagas')
      const data = await res.json()
      setShifts(data.shifts || [])
    } catch {
      setError('Não foi possível carregar as vagas do eX Teams agora.')
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchShifts() }, [location, day, status])

  const locations = useMemo(() => Array.from(new Set(shifts.map((s) => s.location).filter(Boolean))).sort(), [shifts])
  const specialties = useMemo(() => Array.from(new Set(shifts.map((s) => s.specialty).filter(Boolean))).sort(), [shifts])
  const batches = useMemo(() => Array.from(new Set(shifts.map((s) => s.batch_id).filter(Boolean))).sort(), [shifts])

  const filteredShifts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return shifts
    return shifts.filter((shift) => {
      const haystack = `${shift.location || ''} ${shift.specialty || ''} ${shift.day_of_week || ''} ${shift.room || ''} ${shift.time_slot || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [shifts, search])

  const stats = useMemo(() => ({
    total: filteredShifts.length,
    open: filteredShifts.filter((s) => s.status === 'available').length,
    locations: new Set(filteredShifts.map((s) => s.location).filter(Boolean)).size,
    specialties: new Set(filteredShifts.map((s) => s.specialty).filter(Boolean)).size,
  }), [filteredShifts])

  const saveShift = async () => {
    setSaving(true)
    try {
      const isNew = !editShift?.id
      const payload = { ...editShift }
      const url = isNew ? `${API_BASE}/shifts` : `${API_BASE}/shifts/${editShift.id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setEditShift(null)
      fetchShifts()
    } catch {
      alert('Não foi possível salvar a vaga agora. Se a criação ainda não estiver habilitada no backend, mantenha a edição das vagas existentes.')
    } finally {
      setSaving(false)
    }
  }

  const deleteShift = async (shiftId) => {
    if (!shiftId) return
    const ok = window.confirm('Remover esta vaga do eX Teams?')
    if (!ok) return
    try {
      const res = await fetch(`${API_BASE}/shifts/${shiftId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEditShift(null)
      fetchShifts()
    } catch {
      alert('Não foi possível remover a vaga agora.')
    }
  }

  const getBulkFilterLabel = () => {
    const labels = { location: 'Local', specialty: 'Especialidade', batch_id: 'Lote', before_date: 'Data' }
    return labels[bulkFilterType] || bulkFilterType
  }

  const getMatchingCount = () => {
    if (!bulkFilterValue) return 0
    if (bulkFilterType === 'location') return shifts.filter((s) => s.location === bulkFilterValue).length
    if (bulkFilterType === 'specialty') return shifts.filter((s) => s.specialty === bulkFilterValue).length
    if (bulkFilterType === 'batch_id') return shifts.filter((s) => s.batch_id === bulkFilterValue).length
    if (bulkFilterType === 'before_date') return shifts.filter((s) => (s.source_date || s.created_at?.split('T')[0] || '') < bulkFilterValue).length
    return 0
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    setBulkResult(null)
    try {
      const body = {}
      body[bulkFilterType] = bulkFilterValue
      const res = await fetch(`${API_BASE}/shifts/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBulkResult(data.deleted)
      setBulkConfirm(false)
      setBulkFilterValue('')
      fetchShifts()
    } catch {
      setBulkResult(-1)
    } finally {
      setBulkDeleting(false)
    }
  }

  const resetBulkDelete = () => {
    setShowBulkDelete(false)
    setBulkFilterType('location')
    setBulkFilterValue('')
    setBulkConfirm(false)
    setBulkResult(null)
    setBulkCount(null)
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Inter',sans-serif", position:'relative', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        body{margin:0;background:${C.bg}}
        @media(max-width:900px){
          .teams-hero{grid-template-columns:1fr!important}
          .teams-header{padding:14px 16px!important}
          .teams-main{padding:90px 16px 40px!important}
        }
      `}</style>
      <FloatingOrbs />

      <header className='teams-header' style={{ position:'fixed', inset:'0 0 auto 0', zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'18px 24px', borderBottom:`1px solid ${C.border}`, background:'rgba(0,26,43,0.86)', backdropFilter:'blur(22px)' }}>
        <Logo size={17} />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button onClick={() => navigate('/dashboard')} style={secondaryButton}>Dashboard</button>
          {isStaff && <button onClick={() => navigate('/admin/upload')} style={secondaryButton}>Upload de escalas</button>}
        </div>
      </header>

      <main className='teams-main' style={{ maxWidth:1440, margin:'0 auto', padding:'96px 24px 48px', position:'relative', zIndex:1 }}>
        <section className='teams-hero' style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap:18, marginBottom:20 }}>
          <div style={{ borderRadius:28, border:`1px solid rgba(94,240,176,0.2)`, background:'linear-gradient(135deg, rgba(94,240,176,0.10), rgba(0,26,43,0.3) 52%, rgba(221,255,85,0.06))', padding:'28px 26px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'6px 14px', borderRadius:999, background:'rgba(94,240,176,0.12)', border:'1px solid rgba(94,240,176,0.18)', color:C.teams, fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:18 }}>
              <EX color={C.teams} size={12} /> Teams
            </div>
            <h1 style={{ fontSize:'clamp(34px, 5vw, 62px)', lineHeight:1.03, margin:'0 0 12px', letterSpacing:'-0.04em' }}>
              O portal de vagas da <EX color={C.accent} size={62} />periência
            </h1>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button onClick={() => document.getElementById('teams-vagas')?.scrollIntoView({ behavior:'smooth' })} style={primaryButton}>Explorar vagas</button>
              {isStaff && <button onClick={() => setEditShift({ location:'', room:'', day_of_week:'SEG', time_slot:'', specialty:'', doctor_name:'', status:'available' })} style={secondaryButton}>Nova vaga</button>}
              {isStaff && <button onClick={() => setShowBulkDelete(true)} style={{ ...secondaryButton, border:'1px solid rgba(255,107,107,0.35)', color:'#ffb3b3' }}>Gerenciar Vagas</button>}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12 }}>
            {[
              { label:'Vagas abertas', value: stats.open },
              { label:'Resultados', value: stats.total },
              { label:'Locais', value: stats.locations },
              { label:'Especialidades', value: stats.specialties },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius:22, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:'18px 16px', backdropFilter:'blur(24px)' }}>
                <div style={{ fontSize:12, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{item.label}</div>
                <div style={{ fontSize:36, fontWeight:900, color:C.textSoft, letterSpacing:'-0.04em' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:20 }}>
          <div style={{ borderRadius:18, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:12 }}>
            <label style={{ display:'block', fontSize:11, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Buscar</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Especialidade, local, sala...' style={inputStyle} />
          </div>
          <div style={{ borderRadius:18, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:12 }}>
            <label style={{ display:'block', fontSize:11, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Local</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle}>
              <option value=''>Todos</option>
              {locations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div style={{ borderRadius:18, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:12 }}>
            <label style={{ display:'block', fontSize:11, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Dia</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={inputStyle}>
              <option value=''>Todos</option>
              {DAYS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div style={{ borderRadius:18, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:12 }}>
            <label style={{ display:'block', fontSize:11, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value='all'>Todos</option>
              <option value='available'>Disponíveis</option>
              <option value='reserved'>Em andamento</option>
              <option value='occupied'>Encerradas</option>
            </select>
          </div>
        </section>

        <section id='teams-vagas'>
          {loading && <div style={{ color:C.textMuted, padding:'26px 0' }}>Carregando vagas...</div>}
          {!loading && error && <div style={{ color:C.red, padding:'10px 0' }}>{error}</div>}
          {!loading && !error && filteredShifts.length === 0 && (
            <div style={{ borderRadius:22, border:`1px solid ${C.glassBorder}`, background:C.glass, padding:'26px 22px', color:C.textMuted }}>
              Nenhuma vaga encontrada com os filtros atuais.
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:14 }}>
            {filteredShifts.map((shift) => (
              <VacancyCard
                key={shift.id}
                shift={shift}
                isStaff={isStaff}
                onEdit={setEditShift}
                onInterest={setInterestShift}
              />
            ))}
          </div>
        </section>
      </main>

      {interestShift && (
        <GlassModal title={interestShift.specialty || 'Tenho interesse'} onClose={() => setInterestShift(null)} width={560}>
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ borderRadius:16, border:`1px solid ${C.border}`, background:'rgba(0,26,43,0.36)', padding:16 }}>
              <div style={{ fontSize:12, color:C.teams, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{interestShift.location || 'Local a definir'}</div>
              <div style={{ fontSize:24, fontWeight:800, marginBottom:10 }}>{interestShift.specialty || 'Radiologia'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10 }}>
                <Info label='Dia' value={interestShift.day_of_week || 'A definir'} />
                <Info label='Horário' value={interestShift.time_slot || 'A combinar'} />
              </div>
            </div>
            <div style={{ borderRadius:16, border:`1px solid rgba(221,255,85,0.28)`, background:C.accentSoft, padding:16 }}>
              <div style={{ fontSize:12, color:C.accent, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Contato placeholder</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text, wordBreak:'break-word' }}>
                radioexperience.project@gmail.com
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              {!user ? (
                <button onClick={() => navigate('/login')} style={primaryButton}>Entrar para aplicar</button>
              ) : (
                <button onClick={() => navigate('/dashboard')} style={primaryButton}>Ir para o dashboard</button>
              )}
              <button onClick={() => setInterestShift(null)} style={secondaryButton}>Fechar</button>
            </div>
          </div>
        </GlassModal>
      )}

      {editShift && isStaff && (
        <GlassModal title={editShift.id ? 'Editar vaga' : 'Nova vaga'} onClose={() => setEditShift(null)} width={760}>
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
              {[
                ['location', 'Local'],
                ['room', 'Sala / setor'],
                ['day_of_week', 'Dia'],
                ['time_slot', 'Horário'],
                ['specialty', 'Especialidade'],
                ['doctor_name', 'Contato interno'],
              ].map(([key, label]) => (
                <div key={key} style={{ display:'grid', gap:6 }}>
                  <label style={{ fontSize:12, color:C.textDim }}>{label}</label>
                  <input value={editShift[key] || ''} onChange={(e) => setEditShift((prev) => ({ ...prev, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div style={{ display:'grid', gap:6 }}>
                <label style={{ fontSize:12, color:C.textDim }}>Status</label>
                <select value={editShift.status || 'available'} onChange={(e) => setEditShift((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
                  <option value='available'>Disponível</option>
                  <option value='reserved'>Em andamento</option>
                  <option value='occupied'>Encerrada</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {editShift.id && (
                  <button onClick={() => deleteShift(editShift.id)} style={{ ...secondaryButton, border:'1px solid rgba(255,107,107,0.35)', color:'#ffb3b3' }}>Excluir vaga</button>
                )}
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={() => setEditShift(null)} style={secondaryButton}>Cancelar</button>
                <button onClick={saveShift} disabled={saving} style={{ ...primaryButton, opacity:saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar vaga'}</button>
              </div>
            </div>
          </div>
        </GlassModal>
      )}

      {showBulkDelete && isStaff && (
        <GlassModal title='Gerenciar Vagas' onClose={resetBulkDelete} width={520}>
          <div style={{ display:'grid', gap:16 }}>
            {bulkResult !== null && (
              <div style={{
                borderRadius:16,
                border:`1px solid ${bulkResult >= 0 ? 'rgba(94,240,176,0.3)' : 'rgba(255,107,107,0.3)'}`,
                background: bulkResult >= 0 ? 'rgba(94,240,176,0.08)' : 'rgba(255,107,107,0.08)',
                padding:16,
                textAlign:'center',
              }}>
                <div style={{ fontSize:28, fontWeight:900, color: bulkResult >= 0 ? C.green : C.red, marginBottom:6 }}>
                  {bulkResult >= 0 ? `${bulkResult} vagas excluídas` : 'Erro ao excluir vagas'}
                </div>
                <div style={{ fontSize:13, color:C.textMuted }}>{bulkResult >= 0 ? 'A lista foi atualizada.' : 'Tente novamente.'}</div>
                <button onClick={resetBulkDelete} style={{ ...primaryButton, marginTop:12 }}>Fechar</button>
              </div>
            )}
            {bulkResult === null && !bulkConfirm && (
              <>
                <div style={{ display:'grid', gap:6 }}>
                  <label style={{ fontSize:12, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em' }}>Filtrar por</label>
                  <select value={bulkFilterType} onChange={(e) => { setBulkFilterType(e.target.value); setBulkFilterValue('') }} style={inputStyle}>
                    <option value='location'>Por Local</option>
                    <option value='specialty'>Por Especialidade</option>
                    <option value='batch_id'>Por Lote</option>
                    <option value='before_date'>Por Data</option>
                  </select>
                </div>
                <div style={{ display:'grid', gap:6 }}>
                  <label style={{ fontSize:12, color:C.textDim, textTransform:'uppercase', letterSpacing:'0.08em' }}>{getBulkFilterLabel()}</label>
                  {bulkFilterType === 'location' && (
                    <select value={bulkFilterValue} onChange={(e) => setBulkFilterValue(e.target.value)} style={inputStyle}>
                      <option value=''>Selecione um local...</option>
                      {locations.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
                  {bulkFilterType === 'specialty' && (
                    <select value={bulkFilterValue} onChange={(e) => setBulkFilterValue(e.target.value)} style={inputStyle}>
                      <option value=''>Selecione uma especialidade...</option>
                      {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
                  {bulkFilterType === 'batch_id' && (
                    <select value={bulkFilterValue} onChange={(e) => setBulkFilterValue(e.target.value)} style={inputStyle}>
                      <option value=''>Selecione um lote...</option>
                      {batches.map((item) => <option key={item} value={item}>{item.slice(0, 8)}...</option>)}
                    </select>
                  )}
                  {bulkFilterType === 'before_date' && (
                    <input type='date' value={bulkFilterValue} onChange={(e) => setBulkFilterValue(e.target.value)} style={inputStyle} />
                  )}
                </div>
                {bulkFilterValue && (
                  <div style={{ borderRadius:14, border:`1px solid ${C.border}`, background:'rgba(0,26,43,0.34)', padding:14, textAlign:'center' }}>
                    <div style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>Vagas correspondentes</div>
                    <div style={{ fontSize:32, fontWeight:900, color:C.textSoft }}>{getMatchingCount()}</div>
                  </div>
                )}
                <button
                  onClick={() => { setBulkCount(getMatchingCount()); setBulkConfirm(true) }}
                  disabled={!bulkFilterValue}
                  style={{
                    ...primaryButton,
                    background: C.red,
                    color: '#fff',
                    boxShadow: '0 0 20px rgba(255,107,107,0.2)',
                    opacity: bulkFilterValue ? 1 : 0.4,
                    width:'100%',
                    textAlign:'center',
                  }}
                >
                  Excluir vagas
                </button>
              </>
            )}
            {bulkResult === null && bulkConfirm && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, color:C.text, marginBottom:8, fontWeight:700 }}>Tem certeza?</div>
                <div style={{ fontSize:14, color:C.textMuted, marginBottom:16 }}>
                  Você vai excluir <strong style={{ color:C.red }}>{bulkCount} vagas</strong> de {getBulkFilterLabel().toLowerCase()}: <strong>{bulkFilterValue}</strong>
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <button onClick={() => setBulkConfirm(false)} style={secondaryButton}>Cancelar</button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    style={{
                      ...primaryButton,
                      background: C.red,
                      color: '#fff',
                      boxShadow: '0 0 20px rgba(255,107,107,0.2)',
                      opacity: bulkDeleting ? 0.7 : 1,
                    }}
                  >
                    {bulkDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </GlassModal>
      )}
    </div>
  )
}
