import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const C = {
  bg: "#001a2b", bgDeep: "#002233", glass: "rgba(192,214,234,0.07)", glassBorder: "rgba(192,214,234,0.15)", border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8", textSoft: "#C0D6EA", textMuted: "#8ba8c4", textDim: "#5a7d9a", accent: "#DDFF55", accentSoft: "rgba(221,255,85,0.08)",
  green: "#5ef0b0", yellow: "#ffd166", red: "#ff6b6b",
};

const API_BASE = "https://aria-backend-production-176b.up.railway.app";
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const statusLabel = (s) => s === "available" ? "Disponível" : s === "reserved" ? "Em andamento" : "Encerrada";
const statusColor = (s) => s === "available" ? C.green : s === "reserved" ? C.yellow : C.red;

export default function Vagas() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editShift, setEditShift] = useState(null);
  const [batches, setBatches] = useState([]);
  const [showBatches, setShowBatches] = useState(true);

  const fetchShifts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (location) params.set("location", location);
      if (day) params.set("day", day);
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(`${API_BASE}/shifts${params.toString() ? `?${params}` : ""}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch {
      setError("Não foi possível carregar as vagas agora.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/shifts/batches`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch {}
  };

  useEffect(() => { fetchShifts(); fetchBatches(); }, [location, day, status]);

  const locations = useMemo(() => Array.from(new Set(shifts.map((s) => s.location).filter(Boolean))).sort(), [shifts]);

  const saveShift = async () => {
    if (!editShift?.id) return;
    try {
      const res = await fetch(`${API_BASE}/shifts/${editShift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editShift),
      });
      if (!res.ok) throw new Error();
      setEditShift(null);
      fetchShifts();
    } catch {
      alert("Não foi possível salvar a vaga agora.");
    }
  };

  const deleteShift = async (shiftId) => {
    if (!shiftId) return;
    const ok = window.confirm("Remover esta vaga?");
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/shifts/${shiftId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEditShift(null);
      fetchShifts();
    } catch {
      alert("Não foi possível remover a vaga agora.");
    }
  };

  const deleteBatch = async (batchId) => {
    if (!batchId) return;
    const batch = batches.find(b => b.batch_id === batchId);
    const label = batch?.source_file || batchId;
    const ok = window.confirm(`Excluir todas as ${batch?.count || '?'} vagas do lote "${label}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/shifts?batch_id=${batchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      fetchShifts();
      fetchBatches();
    } catch {
      alert("Não foi possível remover o lote agora.");
    }
  };

  if (!isStaff) {
    return <LegacyRedirect navigate={navigate} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "90px 20px 50px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Link to="/" style={{ textDecoration: "none", color: C.textSoft, fontWeight: 800 }}>← RadioeXperience</Link>
              <span style={{ color: C.textDim }}>•</span>
              <span style={{ color: C.textDim, fontSize: 13 }}>Área legada de gestão</span>
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800 }}>Gestão interna de vagas</h1>
            <p style={{ color: C.textMuted, marginTop: 8, maxWidth: 760 }}>
              O feed/comunidade não publica mais vagas. O portal oficial agora é o <strong style={{ color: C.textSoft }}>eX Teams</strong>. Esta tela fica apenas para administração e revisão rápida do dataset legado.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate('/teams')} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.bgDeep, padding: '10px 14px', fontWeight: 800 }}>Abrir eX Teams</button>
            <button onClick={() => navigate('/admin/upload')} style={{ borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, padding: '10px 14px', fontWeight: 700 }}>Upload de escalas</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Filter label="Local"><select value={location} onChange={(e) => setLocation(e.target.value)} style={sel}><option value="">Todos</option>{locations.map((l) => <option key={l}>{l}</option>)}</select></Filter>
          <Filter label="Dia"><select value={day} onChange={(e) => setDay(e.target.value)} style={sel}><option value="">Todos</option>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></Filter>
          <Filter label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}><option value="all">Todas</option><option value="available">Disponíveis</option><option value="reserved">Em andamento</option><option value="occupied">Encerradas</option></select></Filter>
        </div>

        {/* Batch management panel */}
        {batches.length > 0 && (
          <div style={{ marginBottom: 16, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, overflow: 'hidden' }}>
            <button
              onClick={() => setShowBatches(v => !v)}
              style={{
                width: '100%', padding: '14px 18px', background: 'transparent', border: 'none',
                color: C.textSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: 'inherit',
              }}
            >
              <span>📁 Lotes de upload ({batches.length}) · {batches.reduce((sum, b) => sum + (b.count || 0), 0)} vagas</span>
              <span style={{ fontSize: 12, color: C.textDim }}>{showBatches ? '▲ Ocultar' : '▼ Gerenciar'}</span>
            </button>
            {showBatches && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {batches.map((b) => (
                  <div key={b.batch_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 12,
                    border: `1px solid ${C.border}`, background: 'rgba(0,26,43,0.4)',
                    flexWrap: 'wrap', gap: 8,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: C.textSoft, fontSize: 13 }}>{b.source_file || 'Upload antigo'}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{b.count} vaga{b.count !== 1 ? 's' : ''} • {b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : ''}</div>
                    </div>
                    <button
                      onClick={() => deleteBatch(b.batch_id)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: b.batch_id === 'legacy' ? 'rgba(255,107,107,0.15)' : C.red,
                        color: b.batch_id === 'legacy' ? C.red : C.bgDeep,
                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        opacity: b.batch_id === 'legacy' ? 0.6 : 1,
                      }}
                    >Excluir lote</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 16 }}>
          {loading && <div style={{ color: C.textMuted }}>Carregando...</div>}
          {!loading && error && <div style={{ color: C.red }}>{error}</div>}
          {!loading && !error && shifts.length === 0 && <div style={{ color: C.textMuted }}>Nenhuma vaga encontrada.</div>}

          {!loading && shifts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shifts.map((s) => (
                <div key={s.id} style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(0,26,43,0.35)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: C.textSoft, fontWeight: 800, fontSize: 17 }}>{s.location}</div>
                      <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>{s.specialty || 'Radiologia'} • {s.day_of_week} • {s.time_slot || 'A definir'}</div>
                      {s.source_file && <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>📄 {s.source_file}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ padding: "4px 10px", borderRadius: 999, background: `${statusColor(s.status)}22`, color: statusColor(s.status), fontWeight: 800, textAlign: 'center', fontSize: 12 }}>{statusLabel(s.status)}</div>
                      <button onClick={() => setEditShift({ ...s })} style={{ borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: "transparent", color: C.textSoft, padding: "8px 10px", fontWeight: 700 }}>Editar</button>
                      <button onClick={() => deleteShift(s.id)} style={{ borderRadius: 10, border: 'none', background: C.red, color: C.bgDeep, padding: "8px 10px", fontWeight: 800 }}>Excluir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editShift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', zIndex: 500 }}>
          <div style={{ width: 'min(760px,92vw)', borderRadius: 16, border: `1px solid ${C.glassBorder}`, background: C.bgDeep, padding: 18 }}>
            <h3 style={{ marginBottom: 12 }}>Editar vaga</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 10 }}>
              {[
                ['location', 'Local'], ['room', 'Sala'], ['day_of_week', 'Dia'], ['time_slot', 'Horário'], ['specialty', 'Especialidade'], ['doctor_name', 'Contato interno']
              ].map(([k, l]) => (
                <div key={k}><label style={{ fontSize: 11, color: C.textDim }}>{l}</label><input value={editShift[k] || ''} onChange={(e) => setEditShift((p) => ({ ...p, [k]: e.target.value }))} style={inp} /></div>
              ))}
              <div><label style={{ fontSize: 11, color: C.textDim }}>Status</label><select value={editShift.status || 'available'} onChange={(e) => setEditShift((p) => ({ ...p, status: e.target.value }))} style={inp}><option value='available'>Disponível</option><option value='reserved'>Em andamento</option><option value='occupied'>Encerrada</option></select></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => deleteShift(editShift.id)} style={{ borderRadius: 10, border: 'none', background: C.red, color: C.bgDeep, padding: '8px 12px', fontWeight: 800 }}>Excluir vaga</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditShift(null)} style={{ borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, padding: '8px 12px' }}>Cancelar</button>
                <button onClick={saveShift} style={{ borderRadius: 10, border: 'none', background: C.accent, color: C.bgDeep, padding: '8px 12px', fontWeight: 800 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegacyRedirect({ navigate }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center', padding: 24, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 620, borderRadius: 22, border: `1px solid ${C.glassBorder}`, background: C.glass, padding: 28, textAlign: 'center' }}>
        <Link to='/' style={{ textDecoration: 'none', color: C.textSoft, fontWeight: 800 }}>RadioeXperience</Link>
        <h1 style={{ margin: '14px 0 10px', fontSize: 32 }}>As vagas migraram para o eX Teams</h1>
        <p style={{ color: C.textMuted, lineHeight: 1.7, marginBottom: 20 }}>
          O fluxo de vagas não é mais publicado no feed/comunidade. Use o portal eX Teams para navegar e demonstrar interesse nas oportunidades.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/teams')} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.bgDeep, padding: '10px 14px', fontWeight: 800 }}>Ir para eX Teams</button>
          <button onClick={() => navigate('/dashboard')} style={{ borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'transparent', color: C.textSoft, padding: '10px 14px', fontWeight: 700 }}>Voltar ao dashboard</button>
        </div>
      </div>
    </div>
  )
}

function Filter({ label, children }) {
  return <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: 12 }}><label style={{ fontSize: 12, color: C.textDim, display: 'block', marginBottom: 8 }}>{label}</label>{children}</div>;
}

const sel = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgDeep, color: C.textSoft };
const inp = { width: '100%', marginTop: 4, borderRadius: 10, border: `1px solid ${C.glassBorder}`, background: 'rgba(0,26,43,0.5)', padding: '10px 12px', color: C.text };
