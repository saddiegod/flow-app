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
  { id: "work", label: "Trabajo", icon: "💻" },
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "itinerary", label: "Itinerario", icon: "✈️" },
  { id: "study", label: "Estudio", icon: "📚" }
];

const HABITS_LIST = [
  { id: "meditar", label: "Meditar", icon: "🧘" },
  { id: "leer", label: "Leer 20m", icon: "📖" },
  { id: "agua", label: "Agua", icon: "💧" },
  { id: "ejercicio", label: "Ejercicio", icon: "🏃" }
];

const ACCENT_PRESETS = [
  { name: "Blue iOS", v: "#007AFF" },
  { name: "Green iOS", v: "#34C759" },
  { name: "Orange iOS", v: "#FF9500" },
  { name: "Purple iOS", v: "#AF52DE" },
  { name: "Pink iOS", v: "#FF2D55" },
  { name: "Teal iOS", v: "#5AC8FA" },
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

// ─── COLOR SYSTEM (ESTÉTICA IOS CLEAN) ───────────────────────────────────────

const makeC = (accent = "#007AFF") => ({
  bg: "#F2F2F7",          // Fondo general del sistema iOS
  surface: "#FFFFFF",     // Color de las tarjetas
  card: "#FFFFFF",        
  border: "#E5E5EA",      // Bordes grises muy suaves
  green: "#34C759", greenD: "#E5F9EA", 
  red: "#FF3B30", redD: "#FFECEB",
  accent, accentDim: accent + "1A", accentMid: accent + "33",
  gold: "#FF9500", 
  text: "#1C1C1E",        // Texto principal (Casi negro)
  textDim: "#8E8E93",     // Texto secundario
  muted: "#AEAEB2",       // Detalles inactivos
});

// Tipografía nativa de Apple para una sensación perfecta en iPhone
const fontClean   = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const INPUT_STYLE_BASE = {
  width: "100%", padding: "16px", borderRadius: 14,
  fontSize: 16, fontFamily: fontClean, boxSizing: "border-box", outline: "none",
  background: "#F2F2F7", border: "none", color: "#1C1C1E", transition: "all 0.2s"
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES
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
    if (!p) return C.bg; 
    const intensity = Math.min(p / maxTasks, 1);
    const alpha = Math.round(intensity * 155 + 100).toString(16).padStart(2, "0");
    return `${C.accent}${alpha}`;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {["D","L","M","M","J","V","S"].map((d, i) => (
          <div key={i} style={{ fontSize: 12, color: C.textDim, textAlign: "center", paddingBottom: 8, fontWeight: "600" }}>{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} style={{
            aspectRatio: "1", borderRadius: 8, background: day ? getColor(day) : "transparent", 
            border: day === today && !completedByDay[day] ? `1px solid ${C.accent}` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, 
            color: day ? (completedByDay[day] ? "#fff" : C.text) : "transparent",
            fontWeight: day === today ? "bold" : "500", fontFamily: fontClean
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
  const [accent,       setAccent]       = useState("#007AFF");
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

  const getPillStyle = (on, color) => ({
    padding: "12px 20px", borderRadius: 20, border: "none",
    background: on ? color : C.bg, color: on ? "#ffffff" : C.textDim,
    fontSize: 14, cursor: "pointer", fontFamily: fontClean, fontWeight: "600",
    transition: "all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)", transform: on ? "scale(1.02)" : "scale(1)", 
    boxShadow: on ? `0 4px 12px ${color}40` : "none", display: "flex", alignItems: "center", gap: 8, outline: "none"
  });

  const getCategoryBtnStyle = (v) => ({
    flex: 1, padding: "14px 8px", borderRadius: 14, border: "none",
    cursor: "pointer", background: form.category === v ? C.accentDim : C.bg, 
    color: form.category === v ? C.accent : C.textDim,
    fontFamily: fontClean, fontSize: 13, fontWeight: "600", transition: "all 0.2s",
  });

  const cardStyle = {
    background: C.card, borderRadius: 20, padding: 24, marginBottom: 20, 
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)" // Sombra ultra suave tipo Apple
  };

  const sectionLabelStyle = {
    fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 16, fontFamily: fontClean
  };

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: fontClean }}>
        <div style={{ background: C.surface, borderRadius: 24, padding: 40, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌊</div>
            <div style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>Flow & Focus</div>
            <div style={{ fontSize: 14, color: C.textDim, marginTop: 8, fontWeight: "500" }}>Tu sistema de productividad</div>
          </div>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Correo electrónico" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 16 }} />
            <input type="password" placeholder="Contraseña" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 28 }} />
            <button type="submit" disabled={authLoading} onClick={() => playSound('click')} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "700", cursor: "pointer", transition: "opacity 0.2s", opacity: authLoading ? 0.7 : 1 }}>
              {authLoading ? "Cargando..." : isLogin ? "Acceder" : "Crear cuenta"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button type="button" onClick={() => { playSound('click'); setIsLogin(!isLogin); }} style={{ background: "none", border: "none", color: C.accent, fontSize: 14, fontWeight: "600", cursor: "pointer" }}>
              {isLogin ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: fontClean, fontWeight: "600", fontSize: 15 }}>Cargando datos...</div>;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 100 }}>
      {flash && <div style={{ position: "fixed", inset: 0, background: "rgba(52,199,89,0.1)", pointerEvents: "none", zIndex: 999, transition: "background 0.5s" }} />}

      {/* ── HEADER IOS STYLE ─────────────────────────────────────────────── */}
      <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}88` }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{todayStr}</div>
          <div style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>Focus <span style={{ color: C.accent }}>🌊</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          {timerActive && (
            <div style={{ fontSize: 16, color: C.accent, fontWeight: "700", fontFamily: "monospace", padding: "6px 12px", background: C.accentDim, borderRadius: 12 }}>
              {fmtElapsed(timerElapsed)}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={sectionLabelStyle}>Progreso Diario</div>
              <div style={{ fontSize: 15, color: completedToday >= dailyGoal ? C.green : C.textDim, fontWeight: "700" }}>
                {completedToday} de {dailyGoal}
              </div>
            </div>
            <div style={{ height: 10, background: C.bg, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 10, transition: "width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)", width: `${progressPct}%`, background: progressPct >= 100 ? C.green : C.accent }} />
            </div>
          </div>

          {/* Timer Card */}
          <div style={{ ...cardStyle, border: timerActive ? `2px solid ${C.accent}` : "none", boxShadow: timerActive ? `0 8px 30px ${C.accent}22` : cardStyle.boxShadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>Sesión de Enfoque</div>
                <div style={{ fontSize: 40, fontWeight: "800", color: timerActive ? C.accent : C.text, fontFamily: "monospace", letterSpacing: "-1px" }}>
                  {fmtElapsed(timerElapsed)}
                </div>
                <input type="text" placeholder="¿En qué te enfocas?" value={currentFocus} onChange={(e) => setCurrentFocus(e.target.value)} style={{ background: "transparent", border: "none", color: C.text, fontSize: 15, marginTop: 8, outline: "none", width: "100%", fontWeight: "500" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button type="button" onClick={toggleTimer} style={{ padding: "14px 24px", borderRadius: 16, border: "none", background: timerActive ? C.accentDim : C.accent, color: timerActive ? C.accent : "#fff", fontSize: 15, cursor: "pointer", fontWeight: "700", transition: "all 0.2s" }}>
                  {timerActive ? "Pausa" : timerElapsed > 0 ? "Seguir" : "Iniciar"}
                </button>
                {timerElapsed > 0 && <button type="button" onClick={resetTimer} style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: C.bg, color: C.textDim, fontSize: 13, cursor: "pointer", fontWeight: "600" }}>Detener</button>}
              </div>
            </div>
          </div>

          {/* Hábitos */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Hábitos</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {HABITS_LIST.map((h) => (
                <button type="button" key={h.id} onClick={(e) => toggleHabit(e, h.id)} style={getPillStyle(habits[h.id], C.accent)}>
                  <span style={{ fontSize: 18 }}>{h.icon}</span> {h.label}
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
            <div style={sectionLabelStyle}>Notas del día</div>
            <textarea
              placeholder="Reflexiones, ideas pendientes..."
              value={journal} onChange={(e) => { setJournal(e.target.value); setJournalSaved(false); }}
              style={{ ...INPUT_STYLE_BASE, minHeight: 100, resize: "none", lineHeight: 1.5 }}
            />
            <button type="button" onClick={saveJournal} style={{ marginTop: 16, width: "100%", padding: "14px 20px", borderRadius: 14, border: "none", background: journalSaved ? C.greenD : C.bg, color: journalSaved ? C.green : C.text, fontSize: 15, cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}>
              {journalSaved ? "✓ Guardado correctamente" : "Guardar nota"}
            </button>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════════════════
            AGENDA / LISTA
        ══════════════════════════════════════════════════════════════ */}
        {tab === "agenda" && (
          <div>
            <div style={{ ...sectionLabelStyle, marginBottom: 20, color: C.textDim }}>Pendientes ({pendingTasks.length})</div>
            {pendingTasks.length === 0 && <div style={{ textAlign: "center", padding: 60, color: C.muted, fontWeight: "500", fontSize: 15 }}>Todo limpio por ahora. ✨</div>}
            
            {pendingTasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "20px", background: C.surface, borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", marginBottom: 12 }}>
                <button onClick={() => toggleTaskStatus(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${C.accent}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, transition: "background 0.2s" }}></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: "700", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                    {t.title} {t.priority > 1 && <span style={{ fontSize: 14 }}>{"🔥".repeat(t.priority)}</span>}
                  </div>
                  {(t.note || t.time_target) && (
                    <div style={{ fontSize: 14, color: C.textDim, marginTop: 6, lineHeight: 1.4, fontWeight: "500" }}>
                      {t.time_target && <span style={{ color: C.accent, fontWeight: "700", marginRight: 8, background: C.accentDim, padding: "2px 6px", borderRadius: 6 }}>{t.time_target}</span>}
                      {t.note}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 12, fontWeight: "600" }}>{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</div>
                </div>
              </div>
            ))}

            {doneTasks.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div style={{ ...sectionLabelStyle, marginBottom: 20, color: C.textDim }}>Completadas</div>
                {doneTasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "transparent", borderRadius: 16, marginBottom: 8, opacity: 0.6 }}>
                    <button onClick={() => toggleTaskStatus(t)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: "bold" }}>✓</button>
                    <div style={{ flex: 1, textDecoration: "line-through", color: C.textDim, fontSize: 15, fontWeight: "500" }}>{t.title}</div>
                    <button onClick={() => deleteTask(t.id)} style={{ background: C.bg, border: "none", color: C.textDim, cursor: "pointer", padding: "8px 12px", borderRadius: 10, fontWeight: "600", fontSize: 12 }}>Borrar</button>
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
            <div style={sectionLabelStyle}>Nueva Tarea</div>

            <input type="text" placeholder="¿Qué necesitas hacer?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...INPUT_STYLE_BASE, fontSize: 20, fontWeight: "700", marginBottom: 16, padding: "20px 16px", background: "transparent", borderBottom: `2px solid ${C.bg}`, borderRadius: 0 }} />
            
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={{ ...INPUT_STYLE_BASE, flex: 1, color: form.time ? C.text : C.muted, fontWeight: "600" }} />
            </div>

            <textarea placeholder="Notas, lugar o detalles extra..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...INPUT_STYLE_BASE, marginBottom: 24, minHeight: 100, resize: "none" }} />

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Categoría</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {CATEGORIES.map(c => (
                  <button type="button" key={c.id} onClick={() => { playSound('click'); setForm({ ...form, category: c.id }); }} style={getCategoryBtnStyle(c.id)}>
                    <span style={{ fontSize: 16 }}>{c.icon}</span> <span style={{ marginTop: 4, display: "block" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Nivel de Prioridad</div>
              <StarRating value={form.priority} onChange={(r) => setForm({ ...form, priority: r })} C={C} />
            </div>

            <button type="button" onClick={addTask} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", cursor: "pointer", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "700", boxShadow: `0 8px 20px ${C.accent}40` }}>
              Guardar Tarea
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CONFIGURACIÓN
        ══════════════════════════════════════════════════════════════ */}
        {tab === "config" && (
          <div>
            <div style={cardStyle}>
              <div style={{ ...sectionLabelStyle, marginBottom: 24 }}>Ajustes de la App</div>
              
              <div style={{ fontSize: 14, color: C.text, marginBottom: 10, fontWeight: "600" }}>Meta de tareas por día</div>
              <input type="number" min="1" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} style={{ ...INPUT_STYLE_BASE, fontSize: 18, marginBottom: 28, fontWeight: "700" }} />

              <div style={{ fontSize: 14, color: C.text, marginBottom: 14, fontWeight: "600" }}>Color de Acento</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
                {ACCENT_PRESETS.map((p) => (
                  <button type="button" key={p.v} onClick={(e) => { e.preventDefault(); setAccent(p.v); }}
                    style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${accent === p.v ? C.surface : "transparent"}`, background: p.v, cursor: "pointer", boxShadow: accent === p.v ? `0 0 0 2px ${p.v}` : "none", transition: "all 0.2s" }} />
                ))}
              </div>

              <button type="button" onClick={saveConfig} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: C.accentDim, color: C.accent, fontSize: 15, cursor: "pointer", fontWeight: "700" }}>
                Guardar Ajustes
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="button" onClick={handleLogout} style={{ width: "100%", padding: 16, borderRadius: 14, background: C.surface, border: "none", color: C.red, fontSize: 15, cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV (IOS BLUR EFFECT) ───────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}88`, display: "flex", justifyContent: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 540 }}>
          {[
            { k: "dash",   icon: "◈", l: "Inicio" },
            { k: "agenda", icon: "≡", l: "Agenda" },
            { k: "add",    icon: "+", l: "Crear"  },
            { k: "config", icon: "⚙", l: "Ajustes"}
          ].map((t) => (
            <button type="button" key={t.k} onClick={(e) => { e.preventDefault(); playSound('click'); setTab(t.k); }}
              style={{ flex: 1, padding: "14px 4px 10px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.k ? C.accent : C.muted, transition: "color 0.2s" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}