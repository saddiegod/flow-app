import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── ESTILOS GLOBALES Y ANIMACIONES ─────────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;
  const style = document.createElement("style");
  style.id = "app-styles";
  style.innerHTML = `
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes popIn { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .task-item { transition: all 0.3s ease; }
    .task-done { opacity: 0.5; transform: scale(0.98); filter: grayscale(100%); }
    ::-webkit-scrollbar { width: 0px; background: transparent; }
    body { margin: 0; background-color: #F2F2F7; }
  `;
  document.head.appendChild(style);
};

// ─── SONIDOS NATIVOS ────────────────────────────────────────────────────────
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'notify') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(500, now); osc.frequency.setValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  } catch(e) {}
};

// ─── CONSTANTES Y CONFIGURACIÓN iOS ─────────────────────────────────────────
const CATEGORIES = [
  { id: "work", label: "Trabajo", icon: "💻" },
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "itinerary", label: "Itinerario", icon: "✈️" },
  { id: "study", label: "Estudio", icon: "📚" }
];

const QUICK_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const ACCENT_PRESETS = [
  { name: "Blue iOS", v: "#007AFF" }, { name: "Green iOS", v: "#34C759" },
  { name: "Orange iOS", v: "#FF9500" }, { name: "Purple iOS", v: "#AF52DE" },
  { name: "Pink iOS", v: "#FF2D55" }, { name: "Teal iOS", v: "#5AC8FA" },
];

const getTodayStr = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

const makeC = (accent = "#007AFF") => ({
  bg: "#F2F2F7", surface: "#FFFFFF", border: "#E5E5EA",
  green: "#34C759", red: "#FF3B30",
  accent, accentDim: accent + "1A", gold: "#FF9500", 
  text: "#1C1C1E", textDim: "#8E8E93", muted: "#C7C7CC",
});

const fontClean = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const INPUT_STYLE_BASE = {
  width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontFamily: fontClean, 
  boxSizing: "border-box", outline: "none", background: "#F2F2F7", border: "none", color: "#1C1C1E", transition: "all 0.2s"
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════
const StarRating = ({ value, onChange, C }) => (
  <div style={{ display: "flex", gap: 8 }}>
    {[1, 2, 3].map((n) => (
      <button key={n} type="button" onClick={(e) => { e.preventDefault(); playSound('click'); onChange(n === value ? 0 : n); }}
        style={{ background: n <= value ? C.gold + "22" : C.bg, border: "none", cursor: "pointer", fontSize: 22, color: n <= value ? C.gold : C.muted, padding: "10px", borderRadius: "50%", lineHeight: 1, transition: "all 0.2s" }}>
        🔥
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: "", category: "work", priority: 1, time: "" });
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accent, setAccent] = useState("#007AFF");
  const notifiedTasks = useRef(new Set());

  const C = useMemo(() => makeC(accent), [accent]);

  useEffect(() => { injectStyles(); }, []);

  // ── Permisos de Notificación
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // ── Alertas de Horario (Se ejecuta cada 30 seg)
  useEffect(() => {
    const checkAlarms = setInterval(() => {
      if (!tasks || tasks.length === 0) return;
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = getTodayStr();

      tasks.forEach(t => {
        if (t.date === todayStr && t.time_target === currentHM && t.status === "pending" && !notifiedTasks.current.has(t.id)) {
          playSound('notify');
          if (Notification.permission === "granted") {
            new Notification("¡Hora de empezar!", { body: t.title, icon: "/favicon.ico" });
          }
          notifiedTasks.current.add(t.id);
        }
      });
    }, 30000);
    return () => clearInterval(checkAlarms);
  }, [tasks]);

  // ── Autenticación y Carga
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      if (isLogin) { const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); if (error) throw error; }
      else { const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword }); if (error) throw error; alert("Cuenta creada."); }
    } catch (err) { alert(err.message); } finally { setAuthLoading(false); }
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      const meta = session.user.user_metadata;
      if (meta?.accent) setAccent(meta.accent);

      const { data: tData, error } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("id", { ascending: false });
      if (!error && tData) setTasks(tData);
    } catch (err) { console.error(err); }
    setLoaded(true);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Lógica CRUD Robusta ──
  const addTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { playSound('error'); return; }
    
    const newId = Date.now();
    const payload = {
      id: newId, 
      user_id: session.user.id, 
      title: form.title.trim(), 
      category: form.category || "work", 
      date: getTodayStr(), 
      time_target: form.time || null, 
      priority: form.priority || 1, 
      status: "pending"
    };
    
    // UI Instantánea
    setTasks(prev => [payload, ...prev]);
    playSound('success');
    setForm({ title: "", category: "work", priority: 1, time: "" });

    // Base de datos
    const { error } = await supabase.from("tasks").insert([payload]);
    if (error) {
      alert("Error en la nube. Revisa RLS: " + error.message);
      setTasks(prev => prev.filter(t => t.id !== newId));
    }
  };

  const toggleTaskStatus = async (task) => {
    playSound('click');
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  };

  const deleteTask = async (id) => {
    playSound('error');
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const saveConfig = async (newAccent) => {
    playSound('success');
    setAccent(newAccent);
    await supabase.auth.updateUser({ data: { accent: newAccent } });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTasks([]);
  };

  // ── Derivados para el renderizado ──
  const todayStr = getTodayStr();
  const pendingTasks = tasks.filter(t => t.status === "pending").sort((a,b) => b.priority - a.priority);
  const doneTasks = tasks.filter(t => t.status === "done").slice(0, 15);
  const timetableTasks = tasks.filter(t => t.date === todayStr && t.time_target).sort((a, b) => a.time_target.localeCompare(b.time_target));

  // ── ESTILOS COMPARTIDOS ──
  const cardStyle = { background: C.surface, borderRadius: 24, padding: 24, marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.03)" };
  const sectionLabelStyle = { fontSize: 15, fontWeight: "700", color: C.textDim, marginBottom: 16, fontFamily: fontClean, textTransform: "uppercase", letterSpacing: 0.5 };

  // ── LOGIN SCREEN ──
  if (!session) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: fontClean }}>
        <div className="animate-pop" style={{ background: C.surface, borderRadius: 24, padding: 40, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌊</div>
            <div style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>Focus</div>
          </div>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Correo electrónico" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 16 }} />
            <input type="password" placeholder="Contraseña" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 28 }} />
            <button type="submit" disabled={authLoading} onClick={() => playSound('click')} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "700", cursor: "pointer", opacity: authLoading ? 0.7 : 1 }}>
              {authLoading ? "Cargando..." : isLogin ? "Acceder" : "Crear cuenta"}
            </button>
          </form>
          <button type="button" onClick={() => { playSound('click'); setIsLogin(!isLogin); }} style={{ width: "100%", background: "none", border: "none", marginTop: 24, color: C.accent, fontSize: 14, fontWeight: "600", cursor: "pointer" }}>
            {isLogin ? "Registrarme" : "Ya tengo cuenta"}
          </button>
        </div>
      </div>
    );
  }

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: fontClean, fontWeight: "600" }}>Cargando datos...</div>;

  // ── RENDER PRINCIPAL (TODO EN UNA PÁGINA) ──
  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text }}>
      
      {/* CABECERA FLOTANTE */}
      <div style={{ background: "rgba(242, 242, 247, 0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{todayStr}</div>
          <div style={{ fontSize: 32, fontWeight: "800", color: C.text, letterSpacing: "-1px" }}>Focus.</div>
        </div>
        <button onClick={() => { playSound('click'); setShowSettings(true); }} style={{ background: C.surface, border: "none", width: 44, height: 44, borderRadius: 22, fontSize: 20, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>⚙️</button>
      </div>

      <div style={{ padding: "10px 20px 60px", maxWidth: 600, margin: "0 auto" }}>
        
        {/* SECCIÓN 1: CREAR TAREA (FORMULARIO ROBUSTO) */}
        <div className="animate-pop" style={cardStyle}>
          <form onSubmit={addTask}>
            <input type="text" placeholder="¿Qué vamos a hacer hoy?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} 
              style={{ ...INPUT_STYLE_BASE, fontSize: 22, fontWeight: "700", padding: "10px 0", background: "transparent", borderRadius: 0, marginBottom: 20 }} />
            
            <div style={{ fontSize: 12, fontWeight: "700", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Atajos de Horario</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
              {QUICK_TIMES.map(time => (
                <button key={time} type="button" onClick={() => { playSound('click'); setForm({ ...form, time }); }}
                  style={{ padding: "8px 16px", borderRadius: 12, border: "none", background: form.time === time ? C.accent : C.bg, color: form.time === time ? "#fff" : C.textDim, fontWeight: "700", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {time}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={{ ...INPUT_STYLE_BASE, flex: 1, padding: "12px 16px", color: form.time ? C.text : C.muted, fontWeight: "700" }} />
              <StarRating value={form.priority} onChange={(r) => setForm({ ...form, priority: r })} C={C} />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto" }}>
              {CATEGORIES.map(c => (
                <button type="button" key={c.id} onClick={() => { playSound('click'); setForm({ ...form, category: c.id }); }} 
                  style={{ padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", background: form.category === c.id ? C.accentDim : C.bg, color: form.category === c.id ? C.accent : C.textDim, fontSize: 13, fontWeight: "600", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>

            <button type="submit" style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", cursor: "pointer", background: C.text, color: "#fff", fontSize: 16, fontWeight: "700", transition: "transform 0.1s" }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
              + Agregar a la lista
            </button>
          </form>
        </div>

        {/* SECCIÓN 2: ITINERARIO VISUAL (TIMELINE) */}
        {timetableTasks.length > 0 && (
          <div className="animate-slide-up" style={{ marginBottom: 32 }}>
            <div style={{ ...sectionLabelStyle, paddingLeft: 8 }}>Horario del Día</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {timetableTasks.map((t) => (
                <div key={`time-${t.id}`} className={`task-item ${t.status === "done" ? "task-done" : ""}`} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                  <div style={{ width: 50, textAlign: "right", color: t.status === "done" ? C.muted : C.text, fontWeight: "800", fontSize: 16, paddingTop: 16 }}>
                    {t.time_target}
                  </div>
                  <div style={{ width: 4, background: t.status === "done" ? C.border : C.accent, borderRadius: 4, opacity: 0.6 }} />
                  <div style={{ flex: 1, background: C.surface, padding: "16px 20px", borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: "700", color: C.text, fontSize: 16 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, fontWeight: "600" }}>{CATEGORIES.find(c => c.id === t.category)?.label}</div>
                    </div>
                    <div onClick={() => toggleTaskStatus(t)} style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${t.status === "done" ? C.accent : C.border}`, background: t.status === "done" ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
                      {t.status === "done" && "✓"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN 3: TAREAS PENDIENTES */}
        <div className="animate-slide-up">
          <div style={{ ...sectionLabelStyle, paddingLeft: 8 }}>Pendientes ({pendingTasks.length})</div>
          {pendingTasks.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.muted, fontWeight: "500" }}>Nada pendiente. Tómate un descanso. ☕</div>}
          
          {pendingTasks.map((t) => (
            <div key={t.id} className="task-item" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px", background: C.surface, borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", marginBottom: 12 }}>
              <button onClick={() => toggleTaskStatus(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${C.text}`, background: "transparent", cursor: "pointer", flexShrink: 0 }}></button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: "700", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                  {t.title} {t.priority > 1 && <span style={{ fontSize: 14 }}>{"🔥".repeat(t.priority)}</span>}
                </div>
                <div style={{ fontSize: 13, color: C.textDim, marginTop: 6, fontWeight: "600", display: "flex", gap: 8 }}>
                  {t.time_target && <span style={{ color: C.accent, background: C.accentDim, padding: "2px 6px", borderRadius: 6 }}>{t.time_target}</span>}
                  <span>{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SECCIÓN 4: COMPLETADAS */}
        {doneTasks.length > 0 && (
          <div className="animate-slide-up" style={{ marginTop: 40 }}>
            <div style={{ ...sectionLabelStyle, paddingLeft: 8 }}>Completadas Recientes</div>
            {doneTasks.map((t) => (
              <div key={t.id} className="task-done" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "transparent", borderRadius: 16, marginBottom: 8 }}>
                <button onClick={() => toggleTaskStatus(t)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: C.text, cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: "bold" }}>✓</button>
                <div style={{ flex: 1, textDecoration: "line-through", color: C.textDim, fontSize: 16, fontWeight: "500" }}>{t.title}</div>
                <button onClick={() => deleteTask(t.id)} style={{ background: C.bg, border: "none", color: C.red, cursor: "pointer", padding: "8px 12px", borderRadius: 10, fontWeight: "600", fontSize: 12 }}>Borrar</button>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* MODAL DE AJUSTES (FLOTANTE) */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "flex-end", zIndex: 100 }} onClick={() => setShowSettings(false)}>
          <div className="animate-slide-up" style={{ width: "100%", maxWidth: 600, background: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: "32px 24px 40px", boxSizing: "border-box", boxShadow: "0 -10px 40px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: "800", color: C.text }}>Ajustes</div>
              <button onClick={() => setShowSettings(false)} style={{ background: C.bg, border: "none", width: 36, height: 36, borderRadius: 18, color: C.textDim, fontSize: 16, fontWeight: "bold", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ fontSize: 14, color: C.text, marginBottom: 16, fontWeight: "700" }}>Color de Acento</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
              {ACCENT_PRESETS.map((p) => (
                <button type="button" key={p.v} onClick={() => saveConfig(p.v)}
                  style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${accent === p.v ? C.surface : "transparent"}`, background: p.v, cursor: "pointer", boxShadow: accent === p.v ? `0 0 0 3px ${p.v}66` : "none", transition: "all 0.2s" }} />
              ))}
            </div>

            <button onClick={handleLogout} style={{ width: "100%", padding: 18, borderRadius: 16, background: C.redD, border: "none", color: C.red, fontSize: 16, cursor: "pointer", fontWeight: "700" }}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}