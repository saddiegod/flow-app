import { useState, useCallback } from "react";
import { CATS, DAYS_SH, ALL_TIMES, QUICK_TASKS, PRIORITIES, FONT, SERIF } from "../utils/constants.js";
import { todayISO, toISO } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import { IS } from "./shared.jsx";

// ── Natural language time parser ───────────────────────────────────────────────
function parseNL(text) {
  if (!text) return { title:text, time_start:null };
  let title = text;
  let time_start = null;

  // "a las HH" or "a las HH:MM"
  const tMatch = text.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (tMatch) {
    const h = parseInt(tMatch[1]);
    const m = tMatch[2] ? parseInt(tMatch[2]) : 0;
    if (h >= 0 && h <= 23) {
      time_start = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      title = text.replace(tMatch[0], "").replace(/\s{2,}/g," ").trim();
    }
  }
  return { title, time_start };
}

// ── Section label ──────────────────────────────────────────────────────────────
function SL({ children }) {
  return <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10 }}>{children}</div>;
}

export default function AddForm({ onSave, selectedDate }) {
  const [mode,     setMode]     = useState("once");
  const [title,    setTitle]    = useState("");
  const [ts,       setTs]       = useState("");
  const [te,       setTe]       = useState("");
  const [cat,      setCat]      = useState("");
  const [notes,    setNotes]    = useState("");
  const [rType,    setRType]    = useState("daily");
  const [rDays,    setRDays]    = useState([1,2,3,4,5]);
  const [priority, setPriority] = useState(3); // default: Normal

  const toggleDay = useCallback(i => {
    const n = Number(i);
    setRDays(p => p.includes(n) ? p.filter(x=>x!==n) : [...p,n]);
  }, []);

  // Handle title change: try NL parse for time
  const handleTitleChange = e => {
    const v = e.target.value;
    setTitle(v);
    const { time_start } = parseNL(v);
    if (time_start && !ts) setTs(time_start);
  };

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    if (!title.trim()) return;
    const parsed = parseNL(title);
    
    // 🔔 OBTENEMOS LA SUSCRIPCIÓN DEL DISPOSITIVO
    let sub = null;
    try {
      const storedSub = localStorage.getItem('push_subscription');
      if (storedSub) sub = JSON.parse(storedSub);
    } catch (err) {
      console.warn("No se pudo leer la suscripción push:", err);
    }

    onSave({
      title:     parsed.title.trim() || title.trim(),
      timeStart: ts || parsed.time_start || null,
      timeEnd:   te || null,
      category:  cat || null,
      notes:     notes || "",
      priority,
      mode,
      rType,
      rDays:     rDays.map(Number),
      // 👇 AÑADIDO PARA EL CARTERO INTELIGENTE 👇
      notified_start: false,
      notified_half: false,
      notified_end: false,
      subscription: sub 
    });
    
    setTitle(""); setTs(""); setTe(""); setCat(""); setNotes(""); setPriority(3);
  }, [title, ts, te, cat, notes, priority, mode, rType, rDays, onSave]);

  const pr = PRIORITIES.find(p=>p.id===priority);

  return (
    <div className="su">

      {/* ── Title ── */}
      <div style={{ marginBottom:26 }}>
        <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14 }}>
          📌 Nueva Tarea
        </div>
        <form onSubmit={handleSubmit} id="task-form">
          <div style={{ position:"relative" }}>
            <input
              type="text"
              placeholder='¿Qué harás? · prueba "a las 9 leer"'
              value={title}
              onChange={handleTitleChange}
              style={{
                ...IS,
                fontSize:18, fontWeight:800, padding:"14px 16px",
                borderRadius:16,
                background:"rgba(255,255,255,.055)",
                border:"1px solid rgba(255,255,255,.1)",
              }}
            />
            {ts && (
              <div style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:700,background:"rgba(123,104,238,.25)",padding:"3px 9px",borderRadius:8 }}>
                🕐 {ts}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Quick tasks ── */}
      <div style={{ marginBottom:24 }}>
        <SL>Un clic</SL>
        <div style={{ display:"flex",gap:7,overflowX:"auto",paddingBottom:4 }}>
          {QUICK_TASKS.map(t=>(
            <button key={t} type="button" onClick={()=>{sfx("click");setTitle(t);}} style={{
              padding:"8px 13px",borderRadius:11,border:"none",whiteSpace:"nowrap",
              cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:FONT,
              background:title===t?"#F4C430":"rgba(255,255,255,.06)",
              color:title===t?"#000":"rgba(255,255,255,.6)",transition:"all .18s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Priority ── */}
      <div style={{ marginBottom:24 }}>
        <SL>Prioridad</SL>
        <div style={{ display:"flex",gap:8 }}>
          {PRIORITIES.map(p=>(
            <button key={p.id} type="button" onClick={()=>{sfx("click");setPriority(p.id);}} style={{
              flex:1, padding:"10px 4px", borderRadius:13, border:"none", cursor:"pointer",
              background: priority===p.id ? p.bg : "rgba(255,255,255,.04)",
              outline: priority===p.id ? `1.5px solid ${p.color}55` : "1.5px solid transparent",
              transition:"all .18s",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              <span style={{ fontSize:16 }}>{p.icon}</span>
              <span style={{ fontSize:9,fontWeight:700,color:priority===p.id?p.color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:.4 }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Once / Repeat mode ── */}
      <div style={{ marginBottom:24 }}>
        <SL>Frecuencia</SL>
        <div style={{ display:"flex",gap:8 }}>
          {[["once","📌 Una vez"],["recurring","↻ Repetir"]].map(([m,l])=>(
            <button key={m} type="button" onClick={()=>{sfx("click");setMode(m);}} style={{
              flex:1, padding:"11px", borderRadius:13, border:"none", cursor:"pointer",
              fontWeight:700, fontSize:13, fontFamily:FONT,
              background:mode===m?"#F8F9FF":"rgba(255,255,255,.06)",
              color:mode===m?"#080B14":"rgba(255,255,255,.45)",transition:"all .2s",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Recurring options ── */}
      {mode === "recurring" && (
        <div style={{ background:"rgba(123,104,238,.08)",border:"1px solid rgba(123,104,238,.18)",borderRadius:16,padding:16,marginBottom:24 }}>
          <SL>Repetir</SL>
          <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginBottom:rType==="custom"?14:0 }}>
            {[["daily","Cada día"],["weekdays","L – V"],["weekends","S – D"],["custom","Elegir"]].map(([k,l])=>(
              <button key={k} type="button" onClick={()=>{sfx("click");setRType(k);}} style={{
                padding:"8px 13px",borderRadius:10,border:"none",cursor:"pointer",
                fontSize:12,fontWeight:700,fontFamily:FONT,whiteSpace:"nowrap",
                background:rType===k?"#7B68EE":"rgba(255,255,255,.07)",
                color:rType===k?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
              }}>{l}</button>
            ))}
          </div>
          {rType === "custom" && (
            <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginTop:12 }}>
              {["D","L","M","X","J","V","S"].map((d,i)=>(
                <button key={i} type="button" onClick={()=>toggleDay(i)} style={{
                  width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:800,fontFamily:FONT,
                  background:rDays.includes(i)?"#7B68EE":"rgba(255,255,255,.08)",
                  color:rDays.includes(i)?"#FFF":"rgba(255,255,255,.35)",transition:"all .18s",
                }}>{d}</button>
              ))}
            </div>
          )}
          <div style={{ marginTop:12,fontSize:11,color:"rgba(163,149,255,.55)",fontWeight:700 }}>
            {rType==="daily"?"Todos los días":rType==="weekdays"?"Lun – Vie":rType==="weekends"?"Sáb – Dom":rDays.length?rDays.sort((a,b)=>a-b).map(i=>["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][i]).join(", "):"Selecciona días"}
          </div>
        </div>
      )}

      {/* ── Start / End ── */}
      <div style={{ marginBottom:24 }}>
        <SL>Horario personalizado</SL>
        <div style={{ display:"flex",gap:10 }}>
          {[["Inicio",ts,setTs],["Fin",te,setTe]].map(([l,val,set])=>(
            <div key={l} style={{ flex:1 }}>
              <div style={{ fontSize:10,fontWeight:600,color:"rgba(255,255,255,.22)",marginBottom:7 }}>{l}</div>
              <input 
                type="time" 
                value={val} 
                onChange={e=>set(e.target.value)} 
                style={{ 
                  ...IS, 
                  padding:"12px",
                  colorScheme: "dark", // 👈 Esto hace que el reloj sea oscuro y elegante
                  fontSize: "15px",
                  fontWeight: "600"
                }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Category ── */}
      <div style={{ marginBottom:24 }}>
        <SL>Categoría</SL>
        <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
          {CATS.map(c=>(
            <button key={c.id} type="button" onClick={()=>{sfx("click");setCat(cat===c.id?"":c.id);}} style={{
              padding:"7px 12px",borderRadius:10,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:FONT,
              background:cat===c.id?c.color:"rgba(255,255,255,.06)",
              color:cat===c.id?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
            }}>● {c.label}</button>
          ))}
        </div>
      </div>

      {/* ── Notes ── */}
      <div style={{ marginBottom:28 }}>
        <SL>Nota (opcional)</SL>
        <input type="text" placeholder="Agrega contexto..." value={notes} onChange={e=>setNotes(e.target.value)}
          style={{ ...IS }}
        />
      </div>

      {/* ── Submit ── */}
      <button type="submit" form="task-form" style={{
        width:"100%", padding:18, borderRadius:18, border:"none",
        background:"#F8F9FF", color:"#080B14", fontSize:16, fontWeight:800,
        cursor:"pointer", fontFamily:FONT, letterSpacing:"-.2px",
        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        boxShadow:"0 8px 24px rgba(248,249,255,.07)",
      }}>
        <span style={{ fontSize:14 }}>{pr?.icon}</span>
        Guardar tarea ✓
      </button>
    </div>
  );
}