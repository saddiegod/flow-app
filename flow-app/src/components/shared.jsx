import { FONT, SERIF } from "../utils/constants.js";

// ─── Global styles injected once ───────────────────────────────────────────────
export function injectGlobal() {
  if (document.getElementById("pf4-g")) return;
  const lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
  document.head.appendChild(lk);
  const s = document.createElement("style"); s.id = "pf4-g";
  s.innerHTML = `
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
    body{margin:0;background:#080B14;overscroll-behavior:none}
    ::-webkit-scrollbar{display:none}
    @keyframes su{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes dd{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
    @keyframes fl{0%,100%{transform:scaleY(1) rotate(-2deg)}33%{transform:scaleY(1.08) rotate(2deg)}66%{transform:scaleY(.95) rotate(-1deg)}}
    @keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.28)}100%{transform:scale(1)}}
    @keyframes ring{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(4.2);opacity:0}}
    @keyframes cf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(150px) rotate(720deg)}}
    @keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(55px,-40px)}}
    @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,55px)}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes cg{0%{box-shadow:0 0 0 0 rgba(48,209,88,.75)}70%{box-shadow:0 0 0 14px rgba(48,209,88,0)}100%{box-shadow:0 0 0 0 rgba(48,209,88,0)}}
    @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
    @keyframes pomopulse{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
    @keyframes swipeHint{0%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(0)}}
    .su{animation:su .42s cubic-bezier(.16,1,.3,1) both}
    .fi{animation:fi .28s ease both}
    .up{animation:up .38s cubic-bezier(.16,1,.3,1) both}
    .float{animation:float 3.2s ease-in-out infinite}
    .pulse{animation:pulse 2s ease-in-out infinite}
    .tap{transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .18s;cursor:pointer}
    .tap:active{transform:scale(.962)!important;opacity:.82}
    input::placeholder,textarea::placeholder{color:rgba(248,249,255,.2)}
    select option{background:#12131F;color:#F8F9FF}
    .pomo-running{animation:pomopulse 2s ease-in-out infinite}
  `;
  document.head.appendChild(s);
}

// ─── Progress Ring ─────────────────────────────────────────────────────────────
export function Ring({ pct=0, size=64, stroke=5, color="#7B68EE", bg="rgba(255,255,255,.06)", children }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", position:"absolute", inset:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ - (Math.min(Math.max(pct,0),100)/100)*circ}
          strokeLinecap="round"
          style={{ transition:"stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Flame ────────────────────────────────────────────────────────────────────
export function Flame({ days=0, size=32 }) {
  const i  = Math.min(days/30,1);
  const id = `fg${size}_${days}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ animation:"fl 1.9s ease-in-out infinite", flexShrink:0 }}>
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

// ─── Badge ────────────────────────────────────────────────────────────────────
export function BadgePill({ b, size=44 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`radial-gradient(circle at 38% 38%, ${b.color}26, ${b.color}08)`,
      border:`1.5px solid ${b.color}55`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*.42, boxShadow:`0 0 20px ${b.glow}`,
    }}>{b.icon}</div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
export function Confetti({ on }) {
  if (!on) return null;
  return (
    <div style={{ position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",borderRadius:"inherit" }}>
      {Array.from({length:14},(_,i)=>({
        id:i, x:12+Math.random()*76,
        col:["#F4C430","#FF6B35","#7B68EE","#30D158","#FF2D55","#00C7FF"][i%6],
        del:Math.random()*.2, dur:.5+Math.random()*.28, sz:4+Math.random()*7,
      })).map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.x}%`,top:"20%",
          width:p.sz,height:p.sz,background:p.col,
          borderRadius:p.id%3===0?"50%":"2px",
          animation:`cf ${p.dur}s ${p.del}s ease-in both`,
        }}/>
      ))}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
export function StatsBar({ all }) {
  const done = all.filter(t=>t.status==="done").length;
  const pct  = all.length ? Math.round((done/all.length)*100) : 0;
  if (!all.length) return null;
  return (
    <div style={{ display:"flex",marginBottom:20,background:"rgba(255,255,255,.03)",borderRadius:16,border:"1px solid rgba(255,255,255,.05)",overflow:"hidden" }}>
      {[
        { v:all.length, l:"Tareas",  c:"#F4C430" },
        { v:done,       l:"Hechas",  c:"#30D158" },
        { v:`${pct}%`,  l:"Logrado", c:"#7B68EE" },
      ].map((s,i)=>(
        <div key={i} style={{ flex:1,padding:"12px 0",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,.05)":"none" }}>
          <div style={{ fontSize:20,fontWeight:900,fontFamily:SERIF,color:s.c,lineHeight:1 }}>{s.v}</div>
          <div style={{ fontSize:9,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:.7,marginTop:3 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Input style (shared) ─────────────────────────────────────────────────────
export const IS = {
  width:"100%", padding:"11px 14px", borderRadius:13,
  background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
  color:"#F8F9FF", fontSize:14, fontWeight:600, fontFamily:FONT,
  outline:"none", boxSizing:"border-box",
};
