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
  green: "#5ef0b0",
  yellow: "#ffd166",
  red: "#ff6b6b",
};

const API_BASE = "https://aria-backend-production-176b.up.railway.app";
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "available", label: "Disponíveis" },
  { value: "reserved", label: "Reservadas" },
  { value: "occupied", label: "Ocupadas" },
];

const statusLabel = (s) => ({ available: "Disponível", reserved: "Reservada", occupied: "Ocupada" }[s] || "");
const statusColor = (s) => ({ available: C.green, reserved: C.yellow, occupied: C.red }[s] || C.red);

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Vagas() {
  const [shifts, setShifts] = useState([]);
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState("all");
  const [deleteBatch, setDeleteBatch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const [allDeleteShifts, setAllDeleteShifts] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [batches, setBatches] = useState([]);

  const deleteShifts = useMemo(() => {
    if (deleteFilter === "all") return allDeleteShifts;
    return allDeleteShifts.filter((s) => s.status === deleteFilter);
  }, [allDeleteShifts, deleteFilter]);

  const fetchShifts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (location) params.set("location", location);
      if (day) params.set("day", day);
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(API_BASE + "/shifts" + (params.toString() ? "?" + params : ""));
      if (!res.ok) throw new Error("Falha");
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch {
      setError("Não foi possível carregar as vagas agora.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDeleteShifts = async () => {
    setDeleteLoading(true);
    try {
      const params = new URLSearchParams();
      if (deleteBatch) params.set("batch_id", deleteBatch);
      const res = await fetch(API_BASE + "/shifts" + (params.toString() ? "?" + params : ""));
      if (!res.ok) throw new Error("Falha");
      const data = await res.json();
      setAllDeleteShifts(data.shifts || []);
    } catch {
      setAllDeleteShifts([]);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch(API_BASE + "/shifts/batches");
      if (!res.ok) return;
      const data = await res.json();
      setBatches(data.batches || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchShifts(); }, [location, day, status]);

  useEffect(() => {
    if (deleteMode) {
      fetchAllDeleteShifts();
      fetchBatches();
    }
  }, [deleteMode, deleteBatch]);

  const locations = useMemo(() => {
    return Array.from(new Set(shifts.map((s) => s.location).filter(Boolean))).sort();
  }, [shifts]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const doDelete = async () => {
    const ids = confirmDelete === "selected"
      ? Array.from(selectedIds)
      : deleteShifts.map((s) => s.id).filter(Boolean);
    if (!ids.length) return;
    setDeleting(true);
    setDeleteMsg("");
    try {
      for (const id of ids) {
        const res = await fetch(API_BASE + "/shifts/" + id, { method: "DELETE" });
        if (!res.ok) throw new Error("Falha ao remover");
      }
      setDeleteMsg(ids.length + " vaga(s) removida(s) com sucesso.");
      setSelectedIds(new Set());
      setConfirmDelete(null);
      fetchAllDeleteShifts();
      fetchBatches();
      fetchShifts();
    } catch {
      setDeleteMsg("Erro ao remover vagas.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteByBatch = async (batchId) => {
    try {
      setDeleting(true);
      const res = await fetch(API_BASE + "/shifts/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      if (!res.ok) throw new Error("Falha");
      const data = await res.json();
      setDeleteMsg(data.deleted + " vaga(s) removida(s) do lote.");
      setSelectedIds(new Set());
      fetchAllDeleteShifts();
      fetchBatches();
      fetchShifts();
    } catch {
      setDeleteMsg("Erro ao remover lote.");
    } finally {
      setDeleting(false);
    }
  };

  const countByStatus = (val) => {
    if (val === "all") return allDeleteShifts.length;
    return allDeleteShifts.filter((s) => s.status === val).length;
  };

  const pillStyle = (active, color) => ({
    padding: "9px 14px",
    borderRadius: 999,
    border: "1px solid " + (active ? color : C.glassBorder),
    background: active ? color + "20" : "transparent",
    color: active ? color : C.textSoft,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
        @media(max-width:860px){.table-view{display:none!important}.card-view{display:grid!important}}
        @media(min-width:861px){.table-view{display:block!important}.card-view{display:none!important}}
        .batch-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
        @media(max-width:640px){.batch-label{max-width:120px}}
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: C.text }}>Vagas de Plantão</h1>
          <p style={{ color: C.textMuted, marginTop: 8 }}>Filtre por unidade, dia e status.</p>
        </div>

        {/* Status filters + manage */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          {STATUS_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setStatus(o.value)} style={pillStyle(status === o.value, C.accent)}>{o.label}</button>
          ))}
          <button
            onClick={() => {
              const next = !deleteMode;
              setDeleteMode(next);
              if (next) { setDeleteFilter("all"); setDeleteBatch(""); setSelectedIds(new Set()); setDeleteMsg(""); }
            }}
            style={{ ...pillStyle(deleteMode, C.red), marginLeft: "auto" }}
          >
            {deleteMode ? "✕ Cancelar" : "🗑 Gerenciar exclusões"}
          </button>
        </div>

        {/* Location / Day */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ background: C.glass, border: "1px solid " + C.glassBorder, borderRadius: 14, padding: 14 }}>
            <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8 }}>Local</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.border, background: C.bgDeep, color: C.textSoft }}>
              <option value="">Todos</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ background: C.glass, border: "1px solid " + C.glassBorder, borderRadius: 14, padding: 14 }}>
            <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8 }}>Dia</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.border, background: C.bgDeep, color: C.textSoft }}>
              <option value="">Todos</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* ──── DELETE PANEL ──── */}
        {deleteMode && (
          <div style={{ background: C.red + "08", border: "1px solid " + C.red + "30", borderRadius: 16, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: C.red, marginBottom: 14, fontSize: 15 }}>Gerenciar exclusões</div>

            {/* Batch selector */}
            {batches.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Lote</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setDeleteBatch("")} style={pillStyle(!deleteBatch, C.textMuted)}>Todos os lotes</button>
                  {batches.map((b) => {
                    const name = b.source_file || b.batch_id.split("_").slice(0, -1).join("_") || b.batch_id;
                    return (
                      <button
                        key={b.batch_id}
                        onClick={() => setDeleteBatch(b.batch_id)}
                        style={pillStyle(deleteBatch === b.batch_id, C.yellow)}
                        title={name + " — " + b.count + " vagas — " + formatDate(b.created_at)}
                      >
                        <span className="batch-label" style={{ display: "inline-block", verticalAlign: "middle" }}>
                          📋 {name}
                        </span>
                        <span style={{ opacity: 0.6, marginLeft: 6 }}>({b.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status filter */}
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Status</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {STATUS_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => { setDeleteFilter(o.value); setSelectedIds(new Set()); }} style={pillStyle(deleteFilter === o.value, C.red)}>
                  {o.label} ({countByStatus(o.value)})
                </button>
              ))}
            </div>

            {deleteLoading && <div style={{ color: C.textMuted, padding: "12px 0" }}>Carregando...</div>}

            {!deleteLoading && deleteShifts.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setSelectedIds(new Set(deleteShifts.map((s) => s.id).filter(Boolean)))} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + C.glassBorder, background: "transparent", color: C.textSoft, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Selecionar todos ({deleteShifts.length})
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + C.glassBorder, background: "transparent", color: C.textSoft, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Desmarcar
                  </button>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 6 }}>
                  {deleteShifts.map((s) => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: selectedIds.has(s.id) ? C.red + "15" : C.bgDeep, border: "1px solid " + (selectedIds.has(s.id) ? C.red + "40" : C.border), cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: C.red, width: 16, height: 16, flexShrink: 0 }} />
                      <span style={{ color: C.textSoft, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{s.location}</span>
                      <span style={{ color: C.textMuted, flexShrink: 0 }}>({s.day_of_week} {s.time_slot || "-"})</span>
                      <span style={{ padding: "2px 8px", borderRadius: 99, background: statusColor(s.status) + "22", color: statusColor(s.status), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{statusLabel(s.status)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!deleteLoading && deleteShifts.length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 14, padding: "12px 0" }}>Nenhuma vaga para os filtros selecionados.</div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <button onClick={() => setConfirmDelete("selected")} disabled={selectedIds.size === 0} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: C.red, color: "#fff", fontWeight: 700, cursor: selectedIds.size === 0 ? "not-allowed" : "pointer", opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                Deletar selecionados ({selectedIds.size})
              </button>
              <button onClick={() => setConfirmDelete("filtered")} disabled={deleteShifts.length === 0} style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid " + C.red + "50", background: "transparent", color: C.red, fontWeight: 700, cursor: deleteShifts.length === 0 ? "not-allowed" : "pointer", opacity: deleteShifts.length === 0 ? 0.5 : 1 }}>
                Deletar todos do filtro ({deleteShifts.length})
              </button>
              {deleteBatch && (
                <button onClick={() => {
                  const b = batches.find((x) => x.batch_id === deleteBatch);
                  if (b) setConfirmDelete({ type: "batch", batchId: b.batch_id, label: b.source_file || b.batch_id, count: b.count });
                }} style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid " + C.yellow + "50", background: "transparent", color: C.yellow, fontWeight: 700, cursor: "pointer" }}>
                  🗑 Deletar lote inteiro
                </button>
              )}
            </div>

            {deleteMsg && <div style={{ marginTop: 12, color: deleteMsg.startsWith("Erro") ? C.red : C.green, fontWeight: 600 }}>{deleteMsg}</div>}
          </div>
        )}

        {/* Confirm modal */}
        {confirmDelete && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
            <div style={{ background: C.bgDeep, border: "1px solid " + C.glassBorder, borderRadius: 18, padding: 28, maxWidth: 420, width: "100%" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.red, marginBottom: 12 }}>Confirmar exclusão</div>
              <div style={{ color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                {confirmDelete === "selected" && ("Tem certeza que deseja deletar " + selectedIds.size + " vaga(s) selecionada(s)?")}
                {confirmDelete === "filtered" && ("Tem certeza que deseja deletar " + deleteShifts.length + " vaga(s) do filtro?")}
                {confirmDelete?.type === "batch" && ("Tem certeza que deseja deletar o lote \"" + confirmDelete.label + "\" (" + confirmDelete.count + " vagas)?")}
                <br /><strong style={{ color: C.red }}>Esta ação não pode ser desfeita.</strong>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid " + C.glassBorder, background: "transparent", color: C.textSoft, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                <button
                  onClick={() => {
                    if (confirmDelete?.type === "batch") { deleteByBatch(confirmDelete.batchId); setConfirmDelete(null); }
                    else doDelete();
                  }}
                  disabled={deleting}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.red, color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {deleting ? "Removendo..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──── SHIFT LIST ──── */}
        <div style={{ background: C.glass, border: "1px solid " + C.glassBorder, borderRadius: 18, padding: 18 }}>
          {loading && <div style={{ color: C.textMuted }}>Carregando...</div>}
          {!loading && error && <div style={{ color: C.red }}>{error}</div>}
          {!loading && !error && shifts.length === 0 && <div style={{ color: C.textMuted }}>Nenhuma vaga encontrada.</div>}

          {!loading && shifts.length > 0 && (
            <div className="table-view">
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 0.9fr 1.6fr 0.8fr", gap: 12, padding: "10px 6px", borderBottom: "1px solid " + C.border, fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <div>Local</div><div>Sala</div><div>Dia</div><div>Horário</div><div>Médico</div><div>Status</div>
              </div>
              {shifts.map((s, i) => (
                <div key={s.id || i} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 0.9fr 1.6fr 0.8fr", gap: 12, padding: "14px 6px", borderBottom: "1px solid " + C.border, alignItems: "center", fontSize: 14 }}>
                  <div style={{ color: C.textSoft, fontWeight: 600 }}>{s.location}</div>
                  <div style={{ color: C.textMuted }}>{s.room || "-"}</div>
                  <div style={{ color: C.textMuted }}>{s.day_of_week}</div>
                  <div style={{ color: C.textMuted }}>{s.time_slot || "-"}</div>
                  <div style={{ color: C.textSoft }}>{s.doctor_name || "-"}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 10px", borderRadius: 100, background: statusColor(s.status) + "22", color: statusColor(s.status), fontWeight: 700, fontSize: 12 }}>{statusLabel(s.status)}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && shifts.length > 0 && (
            <div className="card-view" style={{ gap: 12 }}>
              {shifts.map((s, i) => (
                <div key={s.id || i} style={{ background: C.bgDeep, border: "1px solid " + C.border, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: C.textSoft }}>{s.location}</div>
                    <div style={{ padding: "4px 10px", borderRadius: 100, background: statusColor(s.status) + "22", color: statusColor(s.status), fontWeight: 700, fontSize: 12 }}>{statusLabel(s.status)}</div>
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

        <div style={{ marginTop: 12, color: C.textMuted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Feito com ❤️ pela Comunidade eX · 2026</div>
      </div>
    </div>
  );
}
