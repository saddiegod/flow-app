import { useState, useEffect, useMemo } from "react";
// ─── Para activar sincronización en la nube, descomenta la siguiente línea: ───
// import { supabase } from "./supabase";

const FONT  = `'Plus Jakarta Sans', -apple-system, sans-serif`;
const SERIF = `'Fraunces', Georgia, serif`;

// ─── ESTILOS GLOBALES ─────────────────────────────────────────────────────────
function injectGlobal() {
  if (document.getElementById("pf-g")) return;
  const lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
  document.head.appendChild(lk);
  const s = document.createElement("style");
  s.id = "pf-g";
  s.innerHTML = `
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body{margin:0;background:#080B14;overscroll-behavior:none}
    ::-webkit-scrollbar{display:none}
    @keyframes su{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes fl{0%,100%{transform:scaleY(1) rotate(-2deg)}33%{transform:scaleY(1.1) rotate(2deg)}66%{transform:scaleY(.96) rotate(-1deg)}}
    @keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
    @keyframes ring{0%{transform:translate(-50%,-50%) scale(.3);opacity:.8}100%{transform:translate(-50%,-50%) scale(3.8);opacity:0}}
    @keyframes cf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(140px) rotate(720deg)}}
    @keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(50px,-40px)}}
    @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,50px)}}
    @keyframes dropDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes checkGlow{0%{box-shadow:0 0 0 0 rgba(48,209,88,.7)}70%{box-shadow:0 0 0 12px rgba(48,209,88,0)}100%{box-shadow:0 0 0 0 rgba(48,209,88,0)}}
    .su{animation:su .45s cubic-bezier(.16,1,.3,1) both}
    .fi{animation:fi .3s ease both}
    .card{transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
    .card:active{transform:scale(.965)!important}
    .float{animation:float 3s ease-in-out infinite}
    input::placeholder,textarea::placeholder{color:rgba(248,249,255,.22)}
    select option{background:#12131F;color:#F8F9FF}
  `;
  document.head.appendChild(s);
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const HOURS     = Array.from({ length: 19 }, (_, i) => i + 5); // 05–23
const DAYS_SH   = ["D","L","M","X","J","V","S"];
const MONTH_MAP = { ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11 };

const CATS = [
  { id: "trabajo",  label: "Trabajo",  color: "#7B68EE" },
  { id: "personal", label: "Personal", color: "#FF6B35" },
  { id: "salud",    label: "Salud",    color: "#30D158" },
  { id: "estudio",  label: "Estudio",  color: "#FFD60A" },
  { id: "otro",     label: "Otro",     color: "#8E8E93" },
];

const QUICK_TASKS = ["Escribir poema","Avanzar código","Sesión de póker","Jugar ajedrez","Hacer ejercicio","Leer","Estudiar GTO","Meditar","Tarea urgente"];

const ALL_TIMES = [
  "05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30",
];

const BADGES = [
  { days:3,   icon:"🔥", name:"Encendido",   color:"#FF6B35", glow:"rgba(255,107,53,.4)"  },
  { days:7,   icon:"⚡", name:"Una Semana",  color:"#FFD60A", glow:"rgba(255,214,10,.35)" },
  { days:14,  icon:"💪", name:"Dos Semanas", color:"#30D158", glow:"rgba(48,209,88,.35)"  },
  { days:30,  icon:"🏆", name:"Mensual",     color:"#007AFF", glow:"rgba(0,122,255,.35)"  },
  { days:60,  icon:"💎", name:"Diamante",    color:"#AF52DE", glow:"rgba(175,82,222,.35)" },
  { days:100, icon:"👑", name:"Centurion",   color:"#F4C430", glow:"rgba(244,196,48,.4)"  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtDate    = d => d.toLocaleDateString("es-MX", { day:"2-digit", month:"short" });
const todayStr   = () => fmtDate(new Date());
const daysClean  = ts => Math.floor((Date.now() - ts) / 86400000);
const currBadge  = d => [...BADGES].reverse().find(b => d >= b.days) || null;
const nextBadge  = d => BADGES.find(b => b.days > d) || null;
const catOf      = id => CATS.find(c => c.id === id);

function getDOW(dateStr) {
  try {
    const [day, mon] = dateStr.trim().split(" ");
    const d = new Date();
    d.setMonth(MONTH_MAP[mon.toLowerCase()]);
    d.setDate(parseInt(day));
    return d.getDay();
  } catch { return -1; }
}

function recurApplies(rec, dateStr) {
  if (!rec) return false;
  const dow = getDOW(dateStr);
  if (rec.type === "daily")    return true;
  if (rec.type === "weekdays") return dow >= 1 && dow <= 5;
  if (rec.type === "weekends") return dow === 0 || dow === 6;
  if (rec.type === "custom")   return (rec.days || []).includes(dow);
  return false;
}

function durLabel(s, e) {
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const total = (eh * 60 + em) - (sh * 60 + sm);
  if (total <= 0) return null;
  const h = Math.floor(total / 60), m = total % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function streakColor(d) {
  if (d === 0) return "#FF3B30";
  if (d < 3)   return "#FF9500";
  if (d < 7)   return "#FFD60A";
  if (d < 30)  return "#30D158";
  if (d < 60)  return "#007AFF";
  if (d < 100) return "#AF52DE";
  return "#F4C430";
}

function recurLabel(rec) {
  if (!rec) return "";
  if (rec.type === "daily")    return "Cada día";
  if (rec.type === "weekdays") return "L – V";
  if (rec.type === "weekends") return "Sáb – Dom";
  if (rec.type === "custom")   return (rec.days || []).map(i => DAYS_SH[i]).join(" · ");
  return "";
}

const calDays = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i - 3);
  return { str: fmtDate(d), num: d.getDate(), name: d.toLocaleDateString("es-MX", { weekday:"short" }).slice(0,2).toUpperCase() };
});

function load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let _ac = null;
function sfx(type) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    const t = _ac.currentTime;
    if (type === "done") {
      o.type = "sine";
      o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(560,t+.07); o.frequency.setValueAtTime(800,t+.15);
      g.gain.setValueAtTime(.045,t); g.gain.linearRampToValueAtTime(0,t+.28);
      o.start(t); o.stop(t+.28);
    } else {
      o.type = "sine"; o.frequency.setValueAtTime(520,t);
      g.gain.setValueAtTime(.02,t); g.gain.exponentialRampToValueAtTime(.001,t+.06);
      o.start(t); o.stop(t+.06);
    }
  } catch(_){}
}

// ─── FLAME SVG ────────────────────────────────────────────────────────────────
function Flame({ days=0, size=32 }) {
  const i = Math.min(days/30,1), id=`fg${size}x${days}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{animation:"fl 1.8s ease-in-out infinite",flexShrink:0}}>
      <defs>
        <radialGradient id={id} cx="50%" cy="80%" r="65%">
          <stop offset="0%" stopColor="#FFE580"/>
          <stop offset="40%" stopColor={`hsl(${30-i*15},100%,55%)`}/>
          <stop offset="100%" stopColor="#E02020"/>
        </radialGradient>
      </defs>
      <path d="M16 2C16 2 21 9 18.5 13C22.5 10 25 5 25 5C25 5 31 13 29 21C27 27 22 31 16 31C10 31 5 27 3 21C1 13 7 7 7 7C7 7 9.5 11 12 13C9.5 8.5 16 2 16 2Z" fill={`url(#${id})`}/>
      <path d="M16 14C16 14 18.5 17.5 17.5 20C20 18.5 21 16 21 16C21 16 23 19.5 22 22.5C21 25 18.5 27 16 27C13.5 27 11 25 10 22.5C9 19.5 11 16 11 16C11 16 12.5 18.5 14 20C12.5 17 16 14 16 14Z" fill="rgba(255,240,100,.85)"/>
    </svg>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function BadgePill({ b, size=44 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`radial-gradient(circle at 38% 38%, ${b.color}28, ${b.color}0a)`,
      border:`1.5px solid ${b.color}55`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*.42,
      boxShadow:`0 0 18px ${b.glow}, inset 0 1px 1px rgba(255,255,255,.08)`,
    }}>{b.icon}</div>
  );
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti({ on }) {
  if (!on) return null;
  const ps = Array.from({length:16},(_,i)=>({
    id:i, x:15+Math.random()*70,
    col:["#F4C430","#FF6B35","#7B68EE","#30D158","#FF2D55","#00C7FF"][i%6],
    del:Math.random()*.22, dur:.5+Math.random()*.3, sz:5+Math.random()*7,
  }));
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",borderRadius:"inherit"}}>
      {ps.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.x}%`,top:"18%",
          width:p.sz,height:p.sz,background:p.col,
          borderRadius:p.id%3===0?"50%":"2px",
          animation:`cf ${p.dur}s ${p.del}s ease-in both`,
        }}/>
      ))}
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete }) {
  const done = task.status === "done";
  const [pop, setPop] = useState(false);
  const dur = durLabel(task.time_start, task.time_end);
  const cat = catOf(task.category);

  const handle = () => {
    if (!done) { setPop(true); setTimeout(()=>setPop(false),700); sfx("done"); }
    else sfx("click");
    onToggle(task.id, task.type, task.date);
  };

  return (
    <div className="card" onClick={handle} style={{
      position:"relative", overflow:"hidden",
      display:"flex", alignItems:"center", gap:12,
      padding:"14px 15px", borderRadius:17, marginBottom:8, cursor:"pointer",
      background: done ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.06)",
      border:`1px solid ${done ? "rgba(255,255,255,.04)" : cat ? `${cat.color}22` : "rgba(255,255,255,.09)"}`,
      borderLeft: cat && !done ? `3px solid ${cat.color}` : undefined,
      transition:"all .3s cubic-bezier(.16,1,.3,1)",
    }}>
      <Confetti on={pop}/>
      {pop && <div style={{position:"absolute",left:27,top:"50%",width:24,height:24,borderRadius:"50%",border:"2px solid rgba(255,255,255,.55)",animation:"ring .65s ease-out forwards",pointerEvents:"none"}}/>}

      {/* Checkbox */}
      <div style={{
        width:24, height:24, borderRadius:"50%", flexShrink:0,
        border: done?"none":"2px solid rgba(255,255,255,.18)",
        background: done?"#30D158":"transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
        animation: done ? "checkGlow .6s ease" : "none",
        boxShadow: done?"0 0 14px rgba(48,209,88,.4)":"none",
      }}>
        {done && <span style={{color:"#FFF",fontSize:12,fontWeight:800,animation:"pop .3s cubic-bezier(.34,1.56,.64,1)"}}>✓</span>}
      </div>

      <div style={{flex:1,minWidth:0}}>
        <div style={{
          fontSize:15, fontWeight:700,
          color: done?"rgba(255,255,255,.28)":"#F8F9FF",
          textDecoration: done?"line-through":"none",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          transition:"all .3s",
        }}>{task.title}</div>
        {!done && (task.time_start || task.notes) && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}>
            {task.time_start && (
              <span style={{fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600}}>
                🕐 {task.time_start}{task.time_end?` → ${task.time_end}`:""}{dur?` · ${dur}`:""}
              </span>
            )}
            {task.notes && !task.time_start && <span style={{fontSize:11,color:"rgba(255,255,255,.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.notes}</span>}
          </div>
        )}
      </div>

      {task.type==="recurring" && !done && (
        <div style={{fontSize:9,color:"rgba(255,255,255,.28)",background:"rgba(255,255,255,.06)",borderRadius:6,padding:"2px 7px",fontWeight:700,flexShrink:0}}>↻</div>
      )}
      <button onClick={e=>{e.stopPropagation();onDelete(task.id,task.type);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.13)",fontSize:16,padding:"2px 4px",flexShrink:0,lineHeight:1}}>×</button>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({ allTasks, date, onToggle, onDelete }) {
  const now=new Date(), isToday=date===todayStr(), ch=now.getHours();

  const byHour = useMemo(()=>{
    const m={};
    allTasks.forEach(t=>{
      const h=t.time_start?parseInt(t.time_start):null;
      if(h!==null)(m[h]=m[h]||[]).push(t);
    });
    return m;
  },[allTasks]);

  const noTime = allTasks.filter(t=>!t.time_start);

  return (
    <div>
      {noTime.length>0 && (
        <div style={{marginBottom:22}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Sin hora</div>
          {noTime.map(t=><TaskCard key={t.id+t.date} task={t} onToggle={onToggle} onDelete={onDelete}/>)}
        </div>
      )}
      {HOURS.map(h=>{
        const ts=byHour[h]||[], isCur=isToday&&h===ch, isPast=isToday&&h<ch&&!ts.length;
        return (
          <div key={h} style={{display:"flex",gap:14,marginBottom:ts.length?12:2,opacity:isPast?.16:1,transition:"opacity .3s"}}>
            <div style={{width:38,flexShrink:0,paddingTop:2,textAlign:"right",fontSize:11,fontWeight:700,fontFamily:SERIF,color:isCur?"#F4C430":"rgba(255,255,255,.18)",transition:"color .3s"}}>
              {String(h).padStart(2,"0")}
            </div>
            <div style={{flex:1,borderLeft:`1px solid ${isCur?"rgba(244,196,48,.45)":"rgba(255,255,255,.05)"}`,paddingLeft:14,minHeight:22,position:"relative"}}>
              {isCur&&<div style={{position:"absolute",left:-5,top:3,width:8,height:8,borderRadius:"50%",background:"#F4C430",boxShadow:"0 0 10px #F4C430"}}/>}
              {ts.map(t=><TaskCard key={t.id+t.date} task={t} onToggle={onToggle} onDelete={onDelete}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────
function StatsBar({ all }) {
  const done=all.filter(t=>t.status==="done").length;
  const pct=all.length?Math.round((done/all.length)*100):0;
  if(!all.length) return null;
  return (
    <div style={{display:"flex",marginBottom:20,background:"rgba(255,255,255,.03)",borderRadius:16,border:"1px solid rgba(255,255,255,.05)",overflow:"hidden"}}>
      {[{val:all.length,l:"Tareas",c:"#F4C430"},{val:done,l:"Hechas",c:"#30D158"},{val:`${pct}%`,l:"Progreso",c:"#7B68EE"}].map((s,i)=>(
        <div key={i} style={{flex:1,padding:"13px 0",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,.05)":"none"}}>
          <div style={{fontSize:21,fontWeight:900,fontFamily:SERIF,color:s.c,lineHeight:1}}>{s.val}</div>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.27)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── HABIT CARD ───────────────────────────────────────────────────────────────
function HabitCard({ habit, onReset, onDelete }) {
  const d=daysClean(habit.lastResetDate), cb=currBadge(d), nb=nextBadge(d);
  const pct=nb?Math.min((d/nb.days)*100,100):100;
  const sc=streakColor(d);
  return (
    <div className="card" style={{
      background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",
      borderRadius:22,padding:22,marginBottom:14,position:"relative",overflow:"hidden",
    }}>
      {d>0&&cb&&<div style={{position:"absolute",top:-50,right:-50,width:140,height:140,borderRadius:"50%",background:`radial-gradient(circle, ${cb.glow}, transparent 70%)`,pointerEvents:"none"}}/>}

      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Flame days={d} size={34}/>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#F8F9FF",marginBottom:6}}>{habit.name}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:7}}>
              {/* BIG counter */}
              <span style={{fontSize:52,fontWeight:900,fontFamily:SERIF,color:sc,lineHeight:1}}>{d}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.38)"}}>día{d!==1?"s":""}</div>
                <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.28)"}}>sin recaer</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          {cb&&<BadgePill b={cb} size={44}/>}
          <button onClick={e=>{e.stopPropagation();onDelete(habit.id);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.18)",fontSize:18,padding:"2px 6px",lineHeight:1}}>×</button>
        </div>
      </div>

      {nb&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.7}}>{nb.icon} {nb.name} — {nb.days} días</span>
            <span style={{fontSize:11,color:nb.color,fontWeight:700}}>{nb.days-d} restantes</span>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:4,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${nb.color}88,${nb.color})`,borderRadius:4,transition:"width .9s cubic-bezier(.16,1,.3,1)"}}/>
          </div>
        </div>
      )}
      {!nb&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{flex:1,height:3,background:`linear-gradient(90deg,${cb?.color||"#F4C430"}55,${cb?.color||"#F4C430"})`,borderRadius:3}}/>
        <span style={{fontSize:10,color:cb?.color||"#F4C430",fontWeight:700,flexShrink:0}}>¡NIVEL MÁXIMO! 👑</span>
      </div>}

      <button onClick={e=>{e.stopPropagation();sfx("click");onReset(habit.id);}} style={{
        padding:"9px 16px",borderRadius:11,
        background:"rgba(255,59,48,.07)",border:"1px solid rgba(255,59,48,.18)",
        color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT,
      }}>😔 Recaí — reiniciar contador</button>
    </div>
  );
}

// ─── ADD FORM ─────────────────────────────────────────────────────────────────
function AddForm({ onSave }) {
  const [mode,      setMode]      = useState("once");
  const [title,     setTitle]     = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd,   setTimeEnd]   = useState("");
  const [cat,       setCat]       = useState("");
  const [notes,     setNotes]     = useState("");
  const [rType,     setRType]     = useState("daily");
  const [rDays,     setRDays]     = useState([1,2,3,4,5]);

  const IS = {
    width:"100%",padding:"12px 15px",borderRadius:13,
    background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.09)",
    color:"#F8F9FF",fontSize:15,fontWeight:600,fontFamily:FONT,
    outline:"none",boxSizing:"border-box",
  };

  const toggleDay = d => setRDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);

  const handleSubmit = e => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title:title.trim(), timeStart, timeEnd, cat, notes, mode, rType, rDays });
    setTitle(""); setTimeStart(""); setTimeEnd(""); setCat(""); setNotes("");
  };

  return (
    <div className="su" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:28,padding:24}}>
      <div style={{fontSize:24,fontWeight:900,fontFamily:SERIF,marginBottom:22,letterSpacing:"-.4px"}}>Nueva tarea</div>
      <form onSubmit={handleSubmit}>

        {/* Title */}
        <input type="text" placeholder="¿Qué harás?" autoFocus value={title} onChange={e=>setTitle(e.target.value)}
          style={{...IS,fontSize:20,fontWeight:800,padding:"12px 0",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.1)",borderRadius:0,marginBottom:22}}
        />

        {/* Quick tasks */}
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Un clic</div>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12,marginBottom:20}}>
          {QUICK_TASKS.map(t=>(
            <button key={t} type="button" onClick={()=>{sfx("click");setTitle(t);}} style={{
              padding:"8px 13px",borderRadius:12,border:"none",whiteSpace:"nowrap",
              cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:FONT,
              background:title===t?"#F4C430":"rgba(255,255,255,.06)",
              color:title===t?"#000":"rgba(255,255,255,.65)",transition:"all .2s",
            }}>{t}</button>
          ))}
        </div>

        {/* Mode toggle */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {[["once","📌 Una vez"],["recurring","↻ Repetir"]].map(([m,l])=>(
            <button key={m} type="button" onClick={()=>{sfx("click");setMode(m);}} style={{
              flex:1,padding:"11px",borderRadius:14,border:"none",cursor:"pointer",
              fontWeight:700,fontSize:13,fontFamily:FONT,
              background:mode===m?"#F8F9FF":"rgba(255,255,255,.05)",
              color:mode===m?"#080B14":"rgba(255,255,255,.5)",transition:"all .2s",
            }}>{l}</button>
          ))}
        </div>

        {/* Recurring options */}
        {mode==="recurring"&&(
          <div style={{background:"rgba(123,104,238,.08)",border:"1px solid rgba(123,104,238,.18)",borderRadius:18,padding:18,marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(123,104,238,.8)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Frecuencia</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:rType==="custom"?14:0}}>
              {[["daily","Cada día"],["weekdays","L – V"],["weekends","S – D"],["custom","Elegir días"]].map(([k,l])=>(
                <button key={k} type="button" onClick={()=>{sfx("click");setRType(k);}} style={{
                  padding:"8px 13px",borderRadius:10,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,fontFamily:FONT,whiteSpace:"nowrap",
                  background:rType===k?"#7B68EE":"rgba(255,255,255,.07)",
                  color:rType===k?"#FFF":"rgba(255,255,255,.5)",transition:"all .2s",
                }}>{l}</button>
              ))}
            </div>
            {rType==="custom"&&(
              <div style={{display:"flex",gap:7}}>
                {DAYS_SH.map((d,i)=>(
                  <button key={i} type="button" onClick={()=>toggleDay(i)} style={{
                    width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:800,fontFamily:FONT,
                    background:rDays.includes(i)?"#7B68EE":"rgba(255,255,255,.08)",
                    color:rDays.includes(i)?"#FFF":"rgba(255,255,255,.4)",transition:"all .2s",
                  }}>{d}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start / End time */}
        <div style={{display:"flex",gap:12,marginBottom:20}}>
          {[["start","Inicio",timeStart,setTimeStart],["end","Fin",timeEnd,setTimeEnd]].map(([k,l,val,set])=>(
            <div key={k} style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{l}</div>
              <select value={val} onChange={e=>set(e.target.value)} style={{...IS,padding:"11px 12px"}}>
                <option value="">— sin hora —</option>
                {ALL_TIMES.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Category */}
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Categoría</div>
        <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>
          {CATS.map(c=>(
            <button key={c.id} type="button" onClick={()=>{sfx("click");setCat(cat===c.id?"":c.id);}} style={{
              padding:"7px 13px",borderRadius:10,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:FONT,
              background:cat===c.id?c.color:"rgba(255,255,255,.06)",
              color:cat===c.id?"#FFF":"rgba(255,255,255,.5)",transition:"all .2s",
            }}>● {c.label}</button>
          ))}
        </div>

        {/* Notes */}
        <input type="text" placeholder="Nota rápida (opcional)" value={notes} onChange={e=>setNotes(e.target.value)}
          style={{...IS,marginBottom:24}}
        />

        <button type="submit" style={{
          width:"100%",padding:18,borderRadius:18,border:"none",
          background:"#F8F9FF",color:"#080B14",fontSize:16,fontWeight:800,
          cursor:"pointer",fontFamily:FONT,letterSpacing:"-.2px",
          boxShadow:"0 8px 24px rgba(248,249,255,.08)",
        }}>Guardar ✓</button>
      </form>
    </div>
  );
}

// ─── SETTINGS PANEL ───────────────────────────────────────────────────────────
function Settings({ onClose, session, onLogin, onLogout }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");

  const IS = {
    width:"100%",padding:"12px 15px",borderRadius:13,
    background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",
    color:"#F8F9FF",fontSize:14,fontWeight:600,fontFamily:FONT,
    outline:"none",boxSizing:"border-box",marginBottom:10,
  };

  const doLogin = async () => {
    if (!email||!pass) return;
    setLoading(true); setMsg("");
    try { await onLogin(email,pass); setMsg("✓ Conectado"); }
    catch(e) { setMsg("Error: "+(e.message||"intenta de nuevo")); }
    finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(14px)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#12131F",border:"1px solid rgba(255,255,255,.1)",
        borderRadius:"0 0 28px 28px",padding:"28px 22px 32px",
        width:"100%",maxWidth:480,animation:"dropDown .3s ease both",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <span style={{fontSize:18,fontWeight:800,fontFamily:SERIF}}>Configuración</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,.4)",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>☁ Sincronización en la nube</div>

        {session ? (
          <div style={{background:"rgba(48,209,88,.07)",border:"1px solid rgba(48,209,88,.2)",borderRadius:16,padding:"16px 18px"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#30D158",marginBottom:4}}>✓ Sincronizado</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:14}}>{session.user?.email}</div>
            <button onClick={onLogout} style={{background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.2)",borderRadius:10,padding:"8px 16px",color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>Cerrar sesión</button>
          </div>
        ) : (
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:18,padding:18}}>
            <input type="email"    placeholder="Correo electrónico" value={email} onChange={e=>setEmail(e.target.value)} style={IS}/>
            <input type="password" placeholder="Contraseña"         value={pass}  onChange={e=>setPass(e.target.value)}  style={{...IS,marginBottom:msg?10:0}}/>
            {msg&&<div style={{fontSize:12,color:msg.startsWith("✓")?"#30D158":"#FF6B6B",marginBottom:10}}>{msg}</div>}
            <button onClick={doLogin} disabled={loading} style={{
              width:"100%",padding:"12px",borderRadius:13,border:"none",
              background:"#F8F9FF",color:"#080B14",fontSize:14,fontWeight:800,
              cursor:"pointer",fontFamily:FONT,opacity:loading?.6:1,marginTop:8,
            }}>{loading?"Conectando...":"Iniciar sesión"}</button>
            <div style={{fontSize:11,color:"rgba(255,255,255,.22)",textAlign:"center",marginTop:12}}>Sincroniza entre dispositivos de forma segura</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.18)",textAlign:"center",marginTop:4}}>— o usa la app sin cuenta, todo se guarda localmente —</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  useEffect(()=>{ injectGlobal(); },[]);

  const [tab,      setTab]      = useState("today");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [date,     setDate]     = useState(todayStr);
  const [showCfg,  setShowCfg]  = useState(false);
  const [session,  setSession]  = useState(null);

  // Datos
  const [tasks,     setTasks]     = useState(()=>load("pf_tasks",     []));
  const [recurring, setRecurring] = useState(()=>load("pf_recurring", []));
  const [habits,    setHabits]    = useState(()=>load("pf_habits",    []));
  const [vision,    setVision]    = useState(()=>load("pf_vision",    {goal:"",action:""}));

  const cal = useMemo(()=>calDays(),[]);

  // Persistencia automática
  useEffect(()=>{ localStorage.setItem("pf_tasks",     JSON.stringify(tasks));     },[tasks]);
  useEffect(()=>{ localStorage.setItem("pf_recurring", JSON.stringify(recurring)); },[recurring]);
  useEffect(()=>{ localStorage.setItem("pf_habits",    JSON.stringify(habits));    },[habits]);
  useEffect(()=>{ localStorage.setItem("pf_vision",    JSON.stringify(vision));    },[vision]);

  // Merge one-time + recurring tasks para la fecha seleccionada
  const allTasksForDate = useMemo(()=>{
  const filteredTasks = useMemo(() => {
  return allTasksForDate
    .filter(t =>
      (!filterCat || t.category === filterCat) &&
      (!search || t.title.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a,b)=>{
      if(a.status !== b.status){
        return a.status === "pending" ? -1 : 1;
      }
      return 0;
    });
}, [allTasksForDate, search, filterCat]);
    const reg = tasks.filter(t=>t.date===date).map(t=>({...t,type:"once"}));
    const rec = recurring
      .filter(rt=>rt.active&&recurApplies(rt.recurrence,date))
      .map(rt=>({
        id:rt.id, type:"recurring", title:rt.title, date,
        time_start:rt.time_start, time_end:rt.time_end,
        category:rt.category, notes:rt.notes,
        status: rt.completions?.[date]==="done"?"done":"pending",
      }));
    return [...reg,...rec].sort((a,b)=>{
      if(!a.time_start&&!b.time_start) return 0;
      if(!a.time_start) return 1;
      if(!b.time_start) return -1;
      return a.time_start.localeCompare(b.time_start);
    });
  },[tasks,recurring,date]);

  // Dot de completitud para el calendario
  const calDots = useMemo(()=>{
    const m={};
    cal.forEach(d=>{
      const reg=tasks.filter(t=>t.date===d.str);
      const rec=recurring.filter(rt=>rt.active&&recurApplies(rt.recurrence,d.str));
      const total=reg.length+rec.length;
      if(!total){m[d.str]=null;return;}
      const done=reg.filter(t=>t.status==="done").length+rec.filter(rt=>rt.completions?.[d.str]==="done").length;
      m[d.str]=Math.round((done/total)*100);
    });
    return m;
  },[tasks,recurring,cal]);

  // Toggle tarea
  const toggleTask = (id,type,taskDate) => {
    if(type==="recurring"){
      setRecurring(p=>p.map(rt=>{
        if(rt.id!==id) return rt;
        const cur=rt.completions?.[taskDate];
        return {...rt,completions:{...rt.completions,[taskDate]:cur==="done"?null:"done"}};
      }));
    } else {
      setTasks(p=>p.map(t=>t.id===id?{...t,status:t.status==="done"?"pending":"done"}:t));
    }
  };

  // Eliminar tarea
  const deleteTask = (id,type) => {
  if(!confirm("¿Eliminar esta tarea?")) return;

  if(type==="recurring") setRecurring(p=>p.filter(rt=>rt.id!==id));
  else setTasks(p=>p.filter(t=>t.id!==id));
};
    if(type==="recurring") setRecurring(p=>p.filter(rt=>rt.id!==id));
    else setTasks(p=>p.filter(t=>t.id!==id));
  };

  // Guardar nueva tarea / rutina
  const saveTask = ({title,timeStart,timeEnd,cat,notes,mode,rType,rDays}) => {
    sfx("click");
    if(mode==="recurring"){
      setRecurring(p=>[...p,{
        id:Date.now(), title, active:true,
        time_start:timeStart||null, time_end:timeEnd||null,
        category:cat||null, notes:notes||"",
        recurrence:{type:rType,days:rType==="custom"?(rDays||[1,2,3,4,5]):[]},
        completions:{},
      }]);
    } else {
      setTasks(p=>[...p,{
        id:Date.now(), title, date, status:"pending",
        time_start:timeStart||null, time_end:timeEnd||null,
        category:cat||null, notes:notes||"",
      }]);
    }
    setTab("today");
  };

  // Auth stubs — descomenta + conecta supabase para activar
  const handleLogin = async(email,pass)=>{
    // const {error}=await supabase.auth.signInWithPassword({email,password:pass});
    // if(error) throw error;
    // const {data:{session}}=await supabase.auth.getSession();
    // setSession(session);
    throw new Error("Descomenta el import de Supabase para activar la sincronización.");
  };
  const handleLogout = ()=>setSession(null);

  const IS = {
    width:"100%",padding:"12px 15px",borderRadius:13,
    background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.09)",
    color:"#F8F9FF",fontSize:15,fontWeight:600,fontFamily:FONT,
    outline:"none",boxSizing:"border-box",
  };

  return (
    <div style={{fontFamily:FONT,background:"#080B14",minHeight:"100vh",color:"#F8F9FF",position:"relative",overflowX:"hidden",maxWidth:480,margin:"0 auto"}}>

      {/* Orbes ambientales */}
      <div style={{position:"fixed",width:420,height:420,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,104,238,.1),transparent)",top:-160,left:-140,pointerEvents:"none",animation:"orb1 9s ease-in-out infinite"}}/>
      <div style={{position:"fixed",width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,rgba(244,196,48,.07),transparent)",bottom:60,right:-100,pointerEvents:"none",animation:"orb2 11s ease-in-out infinite"}}/>

      {showCfg&&<Settings onClose={()=>setShowCfg(false)} session={session} onLogin={handleLogin} onLogout={handleLogout}/>}

      {/* ── HEADER ── */}
      <div style={{padding:"50px 22px 14px",position:"sticky",top:0,zIndex:50,background:"rgba(8,11,20,.9)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:30,fontWeight:900,fontFamily:SERIF,letterSpacing:"-.5px"}}>Focus.</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {session&&<div style={{width:8,height:8,borderRadius:"50%",background:"#30D158",boxShadow:"0 0 8px rgba(48,209,88,.6)"}}/>}
            <button onClick={()=>setShowCfg(true)} style={{
              background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",
              borderRadius:"50%",width:38,height:38,cursor:"pointer",
              color:"rgba(255,255,255,.5)",fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>⚙</button>
          </div>
        </div>
      </div>

      <div style={{padding:"18px 18px 110px"}}>

        {/* ════ HOY ════ */}
        {tab==="today"&&(
          <div className="fi">
            {/* Calendario con dots de completitud */}
            <div style={{display:"flex",gap:6,marginBottom:22,overflowX:"auto",paddingBottom:4}}>
              {cal.map(d=>{
                const sel=d.str===date, pct=calDots[d.str];
                return (
                  <button key={d.str} onClick={()=>{sfx("click");setDate(d.str);}} style={{
                    display:"flex",flexDirection:"column",alignItems:"center",
                    padding:"10px 0",minWidth:46,borderRadius:18,border:"none",cursor:"pointer",
                    background:sel?"#F4C430":"rgba(255,255,255,.04)",
                    boxShadow:sel?"0 8px 22px rgba(244,196,48,.3)":"none",
                    transition:"all .25s cubic-bezier(.34,1.56,.64,1)",
                  }}>
                    <span style={{fontSize:9,fontWeight:700,color:sel?"#000":"rgba(255,255,255,.3)",textTransform:"uppercase",marginBottom:5,letterSpacing:.5}}>{d.name}</span>
                    <span style={{fontSize:19,fontWeight:900,fontFamily:SERIF,color:sel?"#000":"#F8F9FF"}}>{d.num}</span>
                    <div style={{marginTop:5,width:6,height:6,borderRadius:"50%",
                      background:pct===null?(sel?"rgba(0,0,0,.2)":"rgba(255,255,255,.08)"):
                                 sel?"rgba(0,0,0,.4)":
                                 pct===100?"#30D158":pct>50?"#FFD60A":"#FF9500",
                    }}/>
                  </button>
                );
              })}
            </div>

            <StatsBar all={allTasksForDate}/>
            <div style={{marginBottom:14}}>
  <input
    placeholder="Buscar tarea..."
    value={search}
    onChange={e=>setSearch(e.target.value)}
    style={{
      width:"100%",
      padding:"10px 14px",
      borderRadius:12,
      border:"1px solid rgba(255,255,255,.08)",
      background:"rgba(255,255,255,.05)",
      color:"#fff"
    }}
  />
</div>

            {allTasksForDate.length===0?(
              <div style={{textAlign:"center",padding:"64px 20px"}}>
                <div className="float" style={{fontSize:52,marginBottom:18}}>🌙</div>
                <div style={{fontSize:19,fontWeight:800,fontFamily:SERIF,color:"rgba(255,255,255,.45)"}}>Día despejado</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.22)",marginTop:8}}>Añade tareas o disfruta el descanso</div>
              </div>
            ):(
              <Timeline allTasks={filteredTasks} date={date} onToggle={toggleTask} onDelete={deleteTask}/>
            )}
          </div>
        )}

        {/* ════ AGREGAR ════ */}
        {tab==="add"&&<AddForm onSave={saveTask}/>}

        {/* ════ METAS ════ */}
        {tab==="goals"&&(
          <div className="fi">
            {/* Vision Board con guardado automático */}
            <div style={{background:"linear-gradient(135deg,rgba(123,104,238,.13),rgba(244,196,48,.05))",border:"1px solid rgba(123,104,238,.18)",borderRadius:26,padding:24,marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,color:"#7B68EE",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>👁 Visión</div>
              <input type="text" placeholder="Mi gran objetivo..."
                value={vision.goal} onChange={e=>setVision(v=>({...v,goal:e.target.value}))}
                style={{...IS,background:"rgba(0,0,0,.2)",marginBottom:12,fontSize:18,fontWeight:800,color:"#A695FF"}}
              />
              <textarea placeholder="¿Qué hice hoy para lograrlo?"
                value={vision.action} onChange={e=>setVision(v=>({...v,action:e.target.value}))}
                style={{...IS,minHeight:80,resize:"none"}}
              />
              <div style={{fontSize:11,color:"rgba(123,104,238,.5)",marginTop:10,fontWeight:600}}>
                {vision.goal?"✓ Guardado automáticamente":"Escribe tu objetivo y se guardará solo"}
              </div>
            </div>

            {/* Rutinas activas */}
            {recurring.filter(r=>r.active).length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>↻ Rutinas activas</div>
                {recurring.filter(r=>r.active).map(r=>(
                  <div key={r.id} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"14px 16px",borderRadius:16,marginBottom:8,
                    background:"rgba(123,104,238,.08)",border:"1px solid rgba(123,104,238,.15)",
                  }}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"#F8F9FF"}}>{r.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:3,fontWeight:600}}>
                        {recurLabel(r.recurrence)}{r.time_start?`  ·  ${r.time_start}${r.time_end?` → ${r.time_end}`:""}`:""}
                      </div>
                    </div>
                    <button onClick={()=>{sfx("click");setRecurring(p=>p.map(x=>x.id===r.id?{...x,active:false}:x));}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",fontSize:16,padding:"4px 8px",lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Hábitos */}
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>🔥 Hábitos a superar</div>

            {habits.length===0&&(
              <div style={{textAlign:"center",padding:"36px 20px",color:"rgba(255,255,255,.2)",marginBottom:20}}>
                <div className="float" style={{fontSize:44,marginBottom:12}}>🚫</div>
                <div style={{fontWeight:700}}>Agrega hábitos que quieras eliminar</div>
              </div>
            )}
            {habits.map(h=>(
              <HabitCard key={h.id} habit={h}
                onReset={id=>setHabits(p=>p.map(x=>x.id===id?{...x,lastResetDate:Date.now()}:x))}
                onDelete={id=>setHabits(p=>p.filter(x=>x.id!==id))}
              />
            ))}

            {/* Añadir hábito */}
            <form onSubmit={e=>{
              e.preventDefault();
              const v=e.target.h.value.trim();
              if(!v) return;
              setHabits(p=>[...p,{id:Date.now(),name:v,lastResetDate:Date.now()}]);
              e.target.h.value=""; sfx("done");
            }} style={{display:"flex",gap:10,marginTop:8}}>
              <input name="h" type="text" placeholder="Ej: Fumar, azúcar, redes..." style={{...IS,flex:1}}/>
              <button type="submit" style={{padding:"0 22px",borderRadius:14,border:"none",background:"#F8F9FF",color:"#080B14",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:FONT}}>+</button>
            </form>
          </div>
        )}

      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:480,
        background:"rgba(8,11,20,.95)",backdropFilter:"blur(28px)",
        borderTop:"1px solid rgba(255,255,255,.05)",
        display:"flex",padding:"8px 20px calc(env(safe-area-inset-bottom,0px) + 8px)",
        zIndex:60,
      }}>
        {[
          {k:"today",icon:"📅",l:"Hoy"},
          {k:"add",  icon:"✦", l:"Añadir"},
          {k:"goals",icon:"🔥",l:"Metas"},
        ].map(({k,icon,l})=>(
          <button key={k} onClick={()=>{sfx("click");setTab(k);}} style={{
            flex:1,padding:"10px 4px",border:"none",background:"transparent",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:4,
          }}>
            <div style={{fontSize:22,opacity:tab===k?1:.28,transform:tab===k?"scale(1.18)":"scale(1)",transition:"all .25s cubic-bezier(.34,1.56,.64,1)"}}>{icon}</div>
            <div style={{fontSize:9,fontWeight:700,fontFamily:FONT,letterSpacing:.5,color:tab===k?"#F4C430":"rgba(255,255,255,.28)"}}>{l.toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}