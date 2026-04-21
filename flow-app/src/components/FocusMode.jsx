import { useState, useEffect, useRef, useCallback } from "react";
import { FONT, SERIF, POMODORO_PRESETS } from "../utils/constants.js";
import { sfx, fireNotif } from "../utils/helpers.js";
import { Ring } from "./shared.jsx";

const MODES = [
  { id:"work",  label:"Foco",        color:"#7B68EE" },
  { id:"short", label:"Descanso",    color:"#30D158" },
  { id:"long",  label:"Descanso +",  color:"#007AFF" },
];

function fmtTime(secs) {
  const m = String(Math.floor(secs/60)).padStart(2,"0");
  const s = String(secs%60).padStart(2,"0");
  return `${m}:${s}`;
}

export default function FocusMode({ task, onClose }) {
  const [preset,    setPreset]    = useState(0);
  const [modeIdx,   setModeIdx]   = useState(0); // 0=work,1=short,2=long
  const [running,   setRunning]   = useState(false);
  const [sessions,  setSessions]  = useState(0); // completed pomodoros
  const [secs,      setSecs]      = useState(null); // null = not initialized
  const [showOpts,  setShowOpts]  = useState(false);
  const intervalRef = useRef(null);

  const pr   = POMODORO_PRESETS[preset];
  const mode = MODES[modeIdx];

  // ── Durations ───────────────────────────────────────────────────────────────
  const durSecs = useCallback(() => {
    if (modeIdx === 0) return pr.work  * 60;
    if (modeIdx === 1) return pr.brk   * 60;
    return pr.long * 60;
  }, [modeIdx, pr]);

  const totalSecs = durSecs();
  const current   = secs ?? totalSecs;
  const pct       = Math.round(((totalSecs - current) / totalSecs) * 100);

  // ── Timer tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setSecs(s => {
        const next = (s ?? totalSecs) - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current);
          setRunning(false);
          sfx("pomodoro");
          if (modeIdx === 0) {
            const ns = sessions + 1;
            setSessions(ns);
            fireNotif("🍅 ¡Pomodoro completado!", `${ns} sesión${ns!==1?"es":""} hoy. Hora de descansar.`, "pomo");
          } else {
            fireNotif("⚡ ¡Descanso terminado!", "Vuelve al foco.", "pomo");
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // ── Reset when mode/preset changes ────────────────────────────────────────
  useEffect(() => { setSecs(null); setRunning(false); }, [modeIdx, preset]);

  const toggle = () => {
    sfx("click");
    if (current === 0) { setSecs(null); }
    setRunning(r => !r);
  };
  const reset  = () => { sfx("click"); setRunning(false); setSecs(null); };
  const goMode = idx => { setModeIdx(idx); };

  // ── Keep screen on (Wake Lock API) ────────────────────────────────────────
  const wakeLock = useRef(null);
  useEffect(() => {
    if (running && "wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(l => { wakeLock.current = l; }).catch(()=>{});
    } else if (wakeLock.current) {
      wakeLock.current.release(); wakeLock.current = null;
    }
    return () => { if(wakeLock.current){ wakeLock.current.release(); } };
  }, [running]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:400,
      background:"#080B14",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:FONT,
    }}>
      {/* Ambient glow */}
      <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 40%, ${mode.color}15, transparent 65%)`,pointerEvents:"none",transition:"background .8s" }}/>

      {/* Close */}
      <button onClick={onClose} style={{ position:"absolute",top:52,right:22,background:"rgba(255,255,255,.07)",border:"none",borderRadius:"50%",width:40,height:40,cursor:"pointer",color:"rgba(255,255,255,.45)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>

      {/* Sessions dots */}
      {sessions > 0 && (
        <div style={{ position:"absolute",top:58,left:22,display:"flex",gap:6 }}>
          {Array.from({length:Math.min(sessions,8)},(_,i)=>(
            <div key={i} style={{ width:7,height:7,borderRadius:"50%",background:mode.color,boxShadow:`0 0 6px ${mode.color}` }}/>
          ))}
          {sessions > 8 && <span style={{ fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:700,lineHeight:"7px" }}>+{sessions-8}</span>}
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display:"flex",gap:6,marginBottom:52 }}>
        {MODES.map((m,i)=>(
          <button key={m.id} onClick={()=>goMode(i)} style={{
            padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer",
            fontWeight:700, fontSize:12, fontFamily:FONT,
            background: modeIdx===i ? m.color : "rgba(255,255,255,.06)",
            color: modeIdx===i ? "#FFF" : "rgba(255,255,255,.35)",
            transition:"all .25s",
          }}>{m.label}</button>
        ))}
      </div>

      {/* Timer ring */}
      <div className={running ? "pomo-running" : ""}>
        <Ring pct={pct} size={260} stroke={6} color={mode.color} bg="rgba(255,255,255,.05)">
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:64, fontWeight:900, fontFamily:SERIF, color:"#F8F9FF", lineHeight:1, letterSpacing:"-2px" }}>
              {fmtTime(current)}
            </div>
            <div style={{ fontSize:12, color:`${mode.color}cc`, fontWeight:700, marginTop:8, textTransform:"uppercase", letterSpacing:1.5 }}>
              {mode.label}
            </div>
          </div>
        </Ring>
      </div>

      {/* Task name */}
      {task && (
        <div style={{ marginTop:36, textAlign:"center", maxWidth:280 }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.28)",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8 }}>Trabajando en</div>
          <div style={{ fontSize:17,fontWeight:800,color:"rgba(255,255,255,.75)",letterSpacing:"-.2px" }}>{task.title}</div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display:"flex",gap:16,marginTop:44,alignItems:"center" }}>
        <button onClick={reset} style={{
          width:52,height:52,borderRadius:"50%",border:"1px solid rgba(255,255,255,.1)",
          background:"rgba(255,255,255,.06)",cursor:"pointer",color:"rgba(255,255,255,.45)",
          fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",
        }}>↺</button>

        <button onClick={toggle} style={{
          width:76,height:76,borderRadius:"50%",border:"none",cursor:"pointer",
          background:mode.color,color:"#FFF",fontSize:24,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 0 32px ${mode.color}60`,
          transition:"transform .15s,box-shadow .15s",
          transform: running ? "scale(.96)" : "scale(1)",
        }}>
          {running ? "⏸" : current===0 ? "↺" : "▶"}
        </button>

        <button onClick={()=>setShowOpts(p=>!p)} style={{
          width:52,height:52,borderRadius:"50%",border:"1px solid rgba(255,255,255,.1)",
          background:"rgba(255,255,255,.06)",cursor:"pointer",color:"rgba(255,255,255,.45)",
          fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",
        }}>⚙</button>
      </div>

      {/* Preset picker */}
      {showOpts && (
        <div style={{ marginTop:28,display:"flex",gap:8 }}>
          {POMODORO_PRESETS.map((p,i)=>(
            <button key={i} onClick={()=>{setPreset(i);setShowOpts(false);}} style={{
              padding:"9px 16px",borderRadius:14,border:"none",cursor:"pointer",
              fontWeight:700,fontSize:12,fontFamily:FONT,
              background: preset===i ? "#F8F9FF" : "rgba(255,255,255,.08)",
              color: preset===i ? "#080B14" : "rgba(255,255,255,.5)",
              transition:"all .2s",
            }}>{p.label}</button>
          ))}
        </div>
      )}

      <div style={{ position:"absolute",bottom:40,fontSize:11,color:"rgba(255,255,255,.15)",fontWeight:600 }}>
        Desliza hacia arriba para cerrar
      </div>
    </div>
  );
}
