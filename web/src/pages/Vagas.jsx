import { useEffect, useMemo, useState } from "react";

const C = {
  bg: "#001a2b",
  bgDeep: "#002233",
  glass: "rgba(192,214,234,0.07)",
  glassHover: "rgba(192,214,234,0.13)",
  glassBorder: "rgba(192,214,234,0.15)",
  border: "rgba(192,214,234,0.1)",
  text: "#F6F2E8",
  textSoft: "#C0D6EA",
  textMuted: "#8ba8c4",
  textDim: "#5a7d9a",
  accent: "#DDFF55",
  accentGlow: "rgba(221,255,85,0.15)",
  accentSoft: "rgba(221,255,85,0.08)",
  green: "#5ef0b0",
  yellow: "#ffd166",
  red: "#ff6b6b",
};

const API_BASE = "https://aria-backend-production-176b.up.railway.app";
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const statusLabel = (s) => {
  if (s === "available") return "Disponível";
  if (s === "reserved") return "Reservada";
  if (s === "occupied") return "Ocupada";
  return "";
};

const statusColor = (s) => {
  if (s === "available") return C.green;
  if (s === "reserved") return C.yellow;
  return C.red;
};

export default function Vagas() {
  const [shifts, setShifts] = useState([]);
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchShifts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (location) params.set("location", location);
      if (day) params.set("day", day);
      if (status && status !== "all") params.set("status", status);
      const url = `${API_BASE}/shifts${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao carregar vagas");
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (e) {
      setError("Não foi possível carregar as vagas agora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [location, day, status]);

  const locations = useMemo(() => {
    const all = shifts.map((s) => s.location).filter(Boolean);
    return Array.from(new Set(all)).sort();
  }, [shifts]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:${C.bg}}
      @media(max-width:860px){
        .table-view{display:none!important}
        .card-view{display:grid!important}
      }
      @media(min-width:861px){
        .table-view{display:block!important}
        .card-view{display:none!important}
      }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: C.text }}>Vagas de Plantão</h1>
          <p style={{ color: C.textMuted, marginTop: 8 }}>Filtre por unidade, dia e status para encontrar vagas disponíveis.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: 14 }}>
            <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8 }}>Local</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgDeep, color: C.textSoft }}>
              <option value="">Todos</option>
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: 14 }}>
            <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8 }}>Dia</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgDeep, color: C.textSoft }}>
              <option value="">Todos</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: 14 }}>
            <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8 }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgDeep, color: C.textSoft }}>
              <option value="all">Todas</option>
              <option value="available">Disponíveis</option>
              <option value="reserved">Reservadas</option>
              <option value="occupied">Ocupadas</option>
            </select>
          </div>
        </div>

        <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 18 }}>
          {loading && <div style={{ color: C.textMuted }}>Carregando...</div>}
          {!loading && error && <div style={{ color: C.red }}>{error}</div>}
          {!loading && !error && shifts.length === 0 && (
            <div style={{ color: C.textMuted }}>Nenhuma vaga encontrada para os filtros selecionados.</div>
          )}

          {!loading && shifts.length > 0 && (
            <div className="table-view">
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 0.9fr 1.6fr 0.8fr", gap: 12, padding: "10px 6px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <div>Local</div>
                <div>Sala</div>
                <div>Dia</div>
                <div>Horário</div>
                <div>Médico</div>
                <div>Status</div>
              </div>
              {shifts.map((s, i) => (
                <div key={`${s.id || i}`} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 0.9fr 1.6fr 0.8fr", gap: 12, padding: "14px 6px", borderBottom: `1px solid ${C.border}`, alignItems: "center", fontSize: 14 }}>
                  <div style={{ color: C.textSoft, fontWeight: 600 }}>{s.location}</div>
                  <div style={{ color: C.textMuted }}>{s.room || "-"}</div>
                  <div style={{ color: C.textMuted }}>{s.day_of_week}</div>
                  <div style={{ color: C.textMuted }}>{s.time_slot || "-"}</div>
                  <div style={{ color: C.textSoft }}>{s.doctor_name || "-"}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 10px", borderRadius: 100, background: `${statusColor(s.status)}22`, color: statusColor(s.status), fontWeight: 700, fontSize: 12 }}>
                    {statusLabel(s.status)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && shifts.length > 0 && (
            <div className="card-view" style={{ gap: 12 }}>
              {shifts.map((s, i) => (
                <div key={`${s.id || i}`} style={{ background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: C.textSoft }}>{s.location}</div>
                    <div style={{ padding: "4px 10px", borderRadius: 100, background: `${statusColor(s.status)}22`, color: statusColor(s.status), fontWeight: 700, fontSize: 12 }}>
                      {statusLabel(s.status)}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: C.textMuted }}>
                    <div><strong style={{ color: C.textSoft }}>Sala:</strong> {s.room || "-"}</div>
                    <div><strong style={{ color: C.textSoft }}>Dia:</strong> {s.day_of_week}</div>
                    <div><strong style={{ color: C.textSoft }}>Horário:</strong> {s.time_slot || "-"}</div>
                    <div><strong style={{ color: C.textSoft }}>Médico:</strong> {s.doctor_name || "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
