import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── SONIDOS NATIVOS (Web Audio API) ────────────────────────────────────────
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch(e) {}
};

// ─── CONSTANTES DE PRODUCTIVIDAD ────────────────────────────────────────────

const CATEGORIES = [
  { id: "work", label: "Trabajo / Proyecto", icon: "💻" },
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "itinerary", label: "Itinerario / Viaje", icon: "✈️" },
  { id: "study", label: "Estudio", icon: "📚" }
];

const HABITS_LIST = [
  { id: "meditar", label: "Meditar", icon: "🧘" },
  { id: "leer", label: "Leer 20m", icon: "📖" },
  { id: "agua", label: "Agua", icon: "💧" },
  { id: "ejercicio", label: "Ejercicio", icon: "🏃" }
];

const ACCENT_PRESETS = [
  { name: "Esmeralda", v: "#10b981" },
  { name: "Azul", v: "#3b82f6" },
  { name: "Oro", v: "#f59e0b" },
  { name: "Violeta", v: "#8b5cf6" },
  { name: "Rosa", v: "#ec4899" },
  { name: "Cyan", v: "#06b6d4" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const isValid = (hex) => /^#[0-9A-Fa-f]{6}$/.test(hex);

const fmtElapsed = (ms) => {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getTodayStr = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
const getMonthStr = () => new Date().toLocaleDateString("es-MX", { month: "short" });

// ─── COLOR SYSTEM ────────────────────────────────────────────────────────────

const makeC = (accent = "#10b981") => ({
  bg: "#0d1117", surface: "#161b22", card: "#1e242e", border: "#30363d",
  green: "#10b981", greenD: "#065f46", red: "#ef4444", redD: "#7f1d1d",
  accent, accentDim: accent + "25", accentMid: accent + "50",
  gold: "#f59e0b", muted: "#8b949e", text: "#f0f6fc", textDim: "#c9d1d9",
});

const fontClassic = "'Georgia', serif";
const fontClean   = "system-ui, -apple-system, sans-serif";

const INPUT_STYLE_BASE = {
  width: "100%", padding: "14px 16px", borderRadius: 10,
  fontSize: 15, fontFamily: fontClean, boxSizing: "border-box", outline: "none",
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

const StarRating = ({ value, onChange, C }) => (
  <div style={{ display: "flex", gap: 6 }}>
    {[1, 2, 3].map((n) => (
      <button key={n} type="button" onClick={(e) => { e.preventDefault(); playSound('click'); onChange(n === value ? 0 : n); }}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, color: n <= value ? C.gold : C.border, padding: "0", lineHeight: 1 }}>
        🔥
      </button>
    ))}
  </div>
);

const HeatmapCalendar = ({ tasks, monthStr, C }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDay   = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const today      = now.getDate();

  const completedByDay = useMemo(() => {
    const map = {};
    tasks.filter(t => t.status === "done").forEach((t) => {
      if (!t.date.toLowerCase().includes(monthStr.toLowerCase())) return;
      const day = parseInt(t.date, 10);
      if (!isNaN(day)) map[day] = (map[day] || 0) + 1;
    });
    return map;
  }, [tasks, monthStr]);

  const maxTasks = Math.max(...Object.values(completedByDay), 1);

  const getColor = (day) => {
    const p = completedByDay[day];
    if (!p) return C.surface; 
    const intensity = Math.min(p / maxTasks, 1);
    const alpha = Math.round(intensity * 155 + 100).toString(16).padStart(2, "0");
    return `${C.accent}${alpha}`;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {["D","L","M","M","J","V","S"].map((d, i) => (
          <div key={i} style={{ fontSize: 11, color: C.muted, textAlign: "center", paddingBottom: 6, fontWeight: "500" }}>{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} style={{
            aspectRatio: "1", borderRadius: 6, background: day ? getColor(day) : "transparent", border: day === today ? `2px solid ${C.text}` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: day ? (completedByDay[day] ? "#fff" : C.textDim) : "transparent",
            fontWeight: day === today ? "bold" : "normal", fontFamily: fontClean
          }}>{day || ""}</div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [session,      setSession]      = useState(null);
  const [authEmail,    setAuthEmail]    = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLogin,      setIsLogin]      = useState(true);
  const [authLoading,  setAuthLoading]  = useState(false);

  const [tab,          setTab]          = useState("dash");
  const [tasks,        setTasks]        = useState([]);
  const [habits,       setHabits]       = useState({ meditar: false, agua: false, leer: false, ejercicio: false });
  const [form,         setForm]         = useState({ title: "", category: "work", note: "", priority: 1, time: "" });
  const [loaded,       setLoaded]       = useState(false);
  const [flash,        setFlash]        = useState(null);

  const [timerActive,  setTimerActive]  = useState(false);
  const [timerStart,   setTimerStart]   = useState(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [currentFocus, setCurrentFocus] = useState("");
  const [journal,      setJournal]      = useState("");
  const [journalSaved, setJournalSaved] = useState(false);
  const [accent,       setAccent]       = useState("#10b981");
  const [customHex,    setCustomHex]    = useState("");
  const [dailyGoal,    setDailyGoal]    = useState(5);

  const C = useMemo(() => makeC(accent), [accent]);

  // ── Timer Logic
  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => setTimerElapsed(Date.now() - timerStart), 1000);
    return () => clearInterval(id);
  }, [timerActive, timerStart]);

  const toggleTimer = useCallback((e) => {
    if(e) e.preventDefault();
    playSound('click');
    if (timerActive) setTimerActive(false);
    else if (timerElapsed > 0) { setTimerStart(Date.now() - timerElapsed); setTimerActive(true); }
    else { setTimerStart(Date.now()); setTimerActive(true); }
  }, [timerActive, timerElapsed]);

  const resetTimer = useCallback((e) => {
    if(e) e.preventDefault();
    playSound('click');
    setTimerActive(false); setTimerElapsed(0); setTimerStart(null); setCurrentFocus("");
  }, []);

  // ── Auth & Load Logic
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = useCallback(async (e) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      if (isLogin) { const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); if (error) throw error; }
      else { const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword }); if (error) throw error; alert("Cuenta creada."); }
    } catch (err) { alert(err.message); } finally { setAuthLoading(false); }
  }, [isLogin, authEmail, authPassword]);

  const handleLogout = useCallback(async (e) => { if(e) e.preventDefault(); await supabase.auth.signOut(); setTasks([]); setLoaded(false); }, []);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const meta = session.user.user_metadata;
      if (meta?.accent) setAccent(meta.accent);
      if (meta?.daily_goal) setDailyGoal(meta.daily_goal);

      const today = getTodayStr();
      const lastDate = localStorage.getItem("bk_last_date");
      if (lastDate && lastDate !== today) await supabase.from("daily_habits").delete().eq("user_id", session.user.id).neq("id", "dummy");
      localStorage.setItem("bk_last_date", today);

      // Aquí asumimos que crearás una tabla "tasks" en Supabase en lugar de "sessions"
      const { data: tData } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("id", { ascending: false });
      const { data: hData } = await supabase.from("daily_habits").select("*").eq("user_id", session.user.id);

      if (tData) setTasks(tData);

      if (hData) {
        const lH = { meditar: false, agua: false, leer: false, ejercicio: false }; let lJ = "";
        hData.forEach((item) => {
          if (item.id === "journal") lJ = item.note || "";
          else if (lH[item.id] !== undefined) lH[item.id] = item.status;
        });
        setHabits(lH); setJournal(lJ);
      }
    } catch (err) { console.error(err); }
    setLoaded(true);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const saveConfig = useCallback(async (e) => {
    if(e) e.preventDefault();
    await supabase.auth.updateUser({ data: { accent, daily_goal: dailyGoal } });
    load(); playSound("success"); alert("Configuración guardada");
  }, [accent, dailyGoal, load]);

  const addTask = useCallback(async (e) => {
    if(e) e.preventDefault();
    if (!form.title.trim()) { playSound('error'); return; }
    
    const payload = {
      id: Date.now(), 
      user_id: session.user.id, title: form.title, category: form.category, note: form.note,
      date: getTodayStr(), time_target: form.time, priority: form.priority, status: "pending"
    };
    
    const { data, error } = await supabase.from("tasks").insert([payload]).select();
    if (error) { playSound('error'); alert(`Error: ${error.message}`); return; }

    if (data && data.length > 0) {
      playSound('success');
      setTasks((prev) => [data[0], ...prev]);
      setForm({ title: "", category: "work", note: "", priority: 1, time: "" });
      setFlash("win"); setTimeout(() => setFlash(null), 900); setTab("agenda");
    }
  }, [form, session]);

  const toggleTaskStatus = useCallback(async (task) => {
    playSound('click');
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  }, []);

  const deleteTask = useCallback(async (id) => {
    if (!window.confirm("¿Eliminar tarea?")) return;
    playSound('error');
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }, []);

  const toggleHabit = useCallback(async (e, k) => {
    e.preventDefault(); e.stopPropagation(); playSound('click');
    const nextStatus = !habits[k];
    setHabits((prev) => ({ ...prev, [k]: nextStatus }));
    supabase.from("daily_habits").upsert({ id: k, user_id: session.user.id, status: nextStatus }).catch(console.error);
  }, [habits, session]);

  const saveJournal = useCallback(async (e) => {
    if(e) e.preventDefault();
    playSound('success');
    await supabase.from("daily_habits").upsert({ id: "journal", user_id: session.user.id, status: false, note: journal });
    setJournalSaved(true); setTimeout(() => setJournalSaved(false), 2000);
  }, [session, journal]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DERIVADO
  // ═══════════════════════════════════════════════════════════════════════════

  const todayStr = getTodayStr();
  const monthStr = getMonthStr();
  
  const todaysTasks = useMemo(() => tasks.filter(t => t.date === todayStr), [tasks, todayStr]);
  const completedToday = useMemo(() => todaysTasks.filter(t => t.status === "done").length, [todaysTasks]);
  const progressPct = useMemo(() => Math.min((completedToday / dailyGoal) * 100, 100), [completedToday, dailyGoal]);

  const pendingTasks = useMemo(() => tasks.filter(t => t.status === "pending").sort((a,b) => b.priority - a.priority), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === "done").slice(0, 20), [tasks]);

  // ─── STYLE HELPERS ─────────────────────────────────────────────────────────

  const inputStyle = { ...INPUT_STYLE_BASE, border: `1px solid ${C.border}`, background: C.surface, color: C.text };

  const getPillStyle = (on, color) => ({
    padding: "10px 18px", borderRadius: 12, border: `2px solid ${on ? color : C.border}`,
    background: on ? color : "transparent", color: on ? "#ffffff" : C.muted,
    fontSize: 13, cursor: "pointer", fontFamily: fontClean, fontWeight: "bold",
    transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)", transform: on ? "scale(1.05)" : "scale(1)", 
    boxShadow: on ? `0 6px 12px ${color}40` : "none", display: "flex", alignItems: "center", gap: 6, outline: "none"
  });

  const getCategoryBtnStyle = (v) => ({
    flex: 1, padding: "12px 6px", borderRadius: 10, border: `1px solid ${form.category === v ? C.accent + "88" : C.border}`,
    cursor: "pointer", background: form.category === v ? C.accentDim : C.surface, color: form.category === v ? C.accent : C.muted,
    fontFamily: fontClean, fontSize: 13, fontWeight: "600", transition: "all 0.2s",
  });

  const cardStyle = {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
  };

  const sectionLabelStyle = {
    fontSize: 12, fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontFamily: fontClean
  };

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: fontClean }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, width: "100%", maxWidth: 380, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Productividad y Flujo</div>
            <div style={{ fontSize: 32, fontWeight: "bold", color: C.text, fontFamily: fontClassic }}>Flow & Focus 🌊</div>
          </div>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Correo electrónico" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ ...inputStyle, marginBottom: 16 }} />
            <input type="password" placeholder="Contraseña" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ ...inputStyle, marginBottom: 24 }} />
            <button type="submit" disabled={authLoading} onClick={() => playSound('click')} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: C.accentDim, color: C.accent, fontSize: 15, fontWeight: "bold", cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
              {authLoading ? "Cargando..." : isLogin ? "Acceder" : "Crear cuenta"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button type="button" onClick={() => { playSound('click'); setIsLogin(!isLogin); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              {isLogin ? "¿Sin cuenta? Regístrate" : "Ya tengo cuenta"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: fontClean, letterSpacing: 2, fontSize: 14 }}>CARGANDO...</div>;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 90 }}>
      {flash && <div style={{ position: "fixed", inset: 0, background: "rgba(16,185,129,0.08)", pointerEvents: "none", zIndex: 999 }} />}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Día: {todayStr}</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: C.text, fontFamily: fontClassic }}>Focus & Flow <span style={{ color: C.accent }}>🌊</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          {timerActive && (
            <div style={{ fontSize: 16, color: C.accent, fontWeight: "bold", marginTop: 4, fontFamily: "monospace", padding: "4px 8px", background: C.accentDim, borderRadius: 8 }}>
              ⏱ {fmtElapsed(timerElapsed)}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 20px", maxWidth: 540, margin: "0 auto" }}>

        {/* ══════════════════════════════════════════════════════════════
            DASHBOARD
        ══════════════════════════════════════════════════════════════ */}
        {tab === "dash" && <>

          {/* Meta del Día */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={sectionLabelStyle}>Progreso Diario</div>
              <div style={{ fontSize: 14, color: completedToday >= dailyGoal ? C.green : C.accent, fontWeight: "bold", fontFamily: fontClassic }}>
                {completedToday} / {dailyGoal} Tareas
              </div>
            </div>
            <div style={{ height: 8, background: C.surface, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 8, transition: "width 0.5s ease", width: `${progressPct}%`, background: progressPct >= 100 ? C.green : C.accent }} />
            </div>
            {progressPct >= 100 && <div style={{ fontSize: 12, color: C.green, marginTop: 8, fontWeight: "bold", textAlign: "center" }}>¡Meta diaria alcanzada! 🎉</div>}
          </div>

          {/* Timer Card */}
          <div style={{ ...cardStyle, border: `1px solid ${timerActive ? C.accentMid : C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>Sesión de Enfoque</div>
                <div style={{ fontSize: 36, fontWeight: "bold", color: timerActive ? C.accent : C.muted, fontFamily: "monospace" }}>
                  {fmtElapsed(timerElapsed)}
                </div>
                <input type="text" placeholder="¿En qué te enfocas?" value={currentFocus} onChange={(e) => setCurrentFocus(e.target.value)} style={{ background: "transparent", border: "none", color: C.text, fontSize: 14, marginTop: 8, outline: "none", width: "100%" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" onClick={toggleTimer} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${timerActive ? C.accent : C.border}`, background: timerActive ? C.accentDim : C.surface, color: timerActive ? C.accent : C.text, fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>
                  {timerActive ? "⏸ Pausa" : timerElapsed > 0 ? "▶ Seguir" : "▶ Iniciar"}
                </button>
                {timerElapsed > 0 && <button type="button" onClick={resetTimer} style={{ padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}>Detener</button>}
              </div>
            </div>
          </div>

          {/* Hábitos */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Hábitos de hoy</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {HABITS_LIST.map((h) => (
                <button type="button" key={h.id} onClick={(e) => toggleHabit(e, h.id)} style={getPillStyle(habits[h.id], C.accent)}>
                  {h.icon} {h.label} {habits[h.id] && <span style={{ marginLeft: 4 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Consistencia ({monthStr})</div>
            <HeatmapCalendar tasks={tasks} monthStr={monthStr} C={C} />
          </div>

          {/* Journal */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Notas / Pensamientos del día</div>
            <textarea
              placeholder="Ideas, reflexiones, cosas que no quiero olvidar..."
              value={journal} onChange={(e) => { setJournal(e.target.value); setJournalSaved(false); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: fontClean, boxSizing: "border-box", outline: "none", minHeight: 90, resize: "none", lineHeight: 1.6 }}
            />
            <button type="button" onClick={saveJournal} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, border: `1px solid ${journalSaved ? C.green : C.border}`, background: journalSaved ? C.greenD + "44" : C.surface, color: journalSaved ? C.green : C.text, fontSize: 13, cursor: "pointer", fontWeight: "600" }}>
              {journalSaved ? "✓ Guardado" : "Guardar nota"}
            </button>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════════════════
            AGENDA / LISTA
        ══════════════════════════════════════════════════════════════ */}
        {tab === "agenda" && (
          <div>
            <div style={{ ...sectionLabelStyle, marginBottom: 20 }}>Pendientes ({pendingTasks.length})</div>
            {pendingTasks.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Todo limpio por ahora. ✨</div>}
            
            {pendingTasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px", background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                <button onClick={() => toggleTaskStatus(t)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${C.accent}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2 }}></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                    {t.title} {t.priority > 1 && <span style={{ fontSize: 12 }}>{"🔥".repeat(t.priority)}</span>}
                  </div>
                  {(t.note || t.time_target) && (
                    <div style={{ fontSize: 13, color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>
                      {t.time_target && <span style={{ color: C.accent, fontWeight: "bold", marginRight: 8 }}>{t.time_target}</span>}
                      {t.note}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textTransform: "uppercase" }}>{CATEGORIES.find(c => c.id === t.category)?.label || t.category} · {t.date}</div>
                </div>
              </div>
            ))}

            {doneTasks.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ ...sectionLabelStyle, marginBottom: 20 }}>Completadas Recientes</div>
                {doneTasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, opacity: 0.6 }}>
                    <button onClick={() => toggleTaskStatus(t)} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>✓</button>
                    <div style={{ flex: 1, textDecoration: "line-through", color: C.muted, fontSize: 14 }}>{t.title}</div>
                    <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", padding: 4 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            AGREGAR NUEVA
        ══════════════════════════════════════════════════════════════ */}
        {tab === "add" && (
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Nueva Tarea o Evento</div>

            <input type="text" placeholder="¿Qué necesitas hacer?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inputStyle, fontSize: 18, fontWeight: "bold", marginBottom: 16 }} />
            
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={{ ...inputStyle, flex: 1, color: form.time ? C.text : C.muted }} />
            </div>

            <textarea placeholder="Notas adicionales, dirección, detalles..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, marginBottom: 20, minHeight: 80, resize: "none" }} />

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: "600", color: C.muted, textTransform: "uppercase", marginBottom: 12 }}>Categoría</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button type="button" key={c.id} onClick={() => { playSound('click'); setForm({ ...form, category: c.id }); }} style={getCategoryBtnStyle(c.id)}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: "600", color: C.muted, textTransform: "uppercase", marginBottom: 12 }}>Prioridad</div>
              <StarRating value={form.priority} onChange={(r) => setForm({ ...form, priority: r })} C={C} />
            </div>

            <button type="button" onClick={addTask} style={{ width: "100%", padding: 18, borderRadius: 12, border: "none", cursor: "pointer", background: C.accentDim, color: C.accent, fontSize: 16, fontWeight: "bold", letterSpacing: 1 }}>
              GUARDAR
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CONFIGURACIÓN
        ══════════════════════════════════════════════════════════════ */}
        {tab === "config" && (
          <div>
            <div style={cardStyle}>
              <div style={sectionLabelStyle}>⚙️ Preferencias</div>
              
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: "500" }}>Meta de tareas por día</div>
              <input type="number" min="1" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} style={{ ...inputStyle, fontFamily: fontClassic, fontSize: 18, marginBottom: 24 }} />

              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontWeight: "500" }}>Color del tema</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                {ACCENT_PRESETS.map((p) => (
                  <button type="button" key={p.v} onClick={(e) => { e.preventDefault(); setAccent(p.v); }}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${accent === p.v ? "#fff" : "transparent"}`, background: p.v, cursor: "pointer", boxShadow: accent === p.v ? `0 0 0 2px ${p.v}` : "none", transition: "all 0.2s" }} />
                ))}
              </div>

              <button type="button" onClick={saveConfig} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: C.accentDim, color: C.accent, fontSize: 14, cursor: "pointer", fontWeight: "bold", letterSpacing: 1 }}>
                GUARDAR AJUSTES
              </button>
            </div>

            <div style={{ marginTop: 32, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
              <button type="button" onClick={handleLogout} style={{ width: "100%", padding: 16, borderRadius: 12, background: "transparent", border: `1px solid ${C.muted}`, color: C.textDim, fontSize: 14, cursor: "pointer", fontWeight: "600" }}>
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 540 }}>
          {[
            { k: "dash",   icon: "◈", l: "Inicio" },
            { k: "agenda", icon: "≡", l: "Agenda" },
            { k: "add",    icon: "+", l: "Crear"  },
            { k: "config", icon: "⚙", l: "Ajustes"}
          ].map((t) => (
            <button type="button" key={t.k} onClick={(e) => { e.preventDefault(); playSound('click'); setTab(t.k); }}
              style={{ flex: 1, padding: "16px 4px 12px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.k ? C.accent : C.muted, transition: "color 0.2s" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 10, fontWeight: "600", textTransform: "uppercase" }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}