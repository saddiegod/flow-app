import { BADGES, FONT, SERIF } from "../constants.js";
import { daysClean, streakColor } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import { Flame, BadgePill } from "./shared.jsx";

const currBadge = d => [...BADGES].reverse().find(b => d >= b.days) || null;
const nextBadge = d => BADGES.find(b => b.days > d) || null;

// ── Effective days accounting for frozen time ─────────────────────────────────
function effectiveDays(habit) {
  // accumulatedMs = total time the counter was paused (frozen)
  const pausedMs = habit.pausedMs || 0;
  // If currently frozen, also exclude time since we froze
  const currentFrozenMs = (habit.frozen && habit.frozenAt)
    ? (Date.now() - habit.frozenAt)
    : 0;
  return Math.max(0, Math.floor(
    (Date.now() - habit.lastResetDate - pausedMs - currentFrozenMs) / 86400000
  ));
}

export default function HabitCard({ habit, onReset, onDelete, onTogglePause }) {
  const d  = effectiveDays(habit);
  const cb = currBadge(d);
  const nb = nextBadge(d);
  const pct = nb ? Math.min((d/nb.days)*100,100) : 100;
  const sc  = streakColor(d);

  return (
    <div className="tap" style={{
      background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)",
      borderRadius:22, padding:22, marginBottom:14, position:"relative", overflow:"hidden",
      opacity: habit.frozen ? .75 : 1,
      transition:"opacity .3s",
    }}>
      {d>0&&cb&&<div style={{position:"absolute",top:-50,right:-50,width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle, ${cb.glow}, transparent 70%)`,pointerEvents:"none"}}/>}

      {/* Frozen banner */}
      {habit.frozen && (
        <div style={{ background:"rgba(0,199,255,.08)",border:"1px solid rgba(0,199,255,.2)",borderRadius:10,padding:"7px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:14 }}>🧊</span>
          <span style={{ fontSize:12,fontWeight:700,color:"#00C7FF" }}>Racha congelada — los días no corren</span>
        </div>
      )}

      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <Flame days={habit.frozen ? 0 : d} size={32}/>
          <div>
            <div style={{ fontSize:15,fontWeight:800,color:"#F8F9FF",marginBottom:6 }}>{habit.name}</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
              <span style={{ fontSize:52,fontWeight:900,fontFamily:SERIF,color:habit.frozen?"#00C7FF":sc,lineHeight:1 }}>{d}</span>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:"rgba(255,255,255,.38)" }}>día{d!==1?"s":""}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"rgba(255,255,255,.24)" }}>
                  {habit.frozen ? "congelados" : "sin recaer"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
          {cb && <BadgePill b={cb} size={42}/>}
          <button onClick={()=>onDelete(habit.id)} style={{ background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.16)",fontSize:17,lineHeight:1 }}>×</button>
        </div>
      </div>

      {nb && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
            <span style={{ fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.6 }}>{nb.icon} {nb.name} — {nb.days}d</span>
            <span style={{ fontSize:11,color:nb.color,fontWeight:700 }}>{nb.days-d} restantes</span>
          </div>
          <div style={{ height:4,background:"rgba(255,255,255,.06)",borderRadius:4,overflow:"hidden" }}>
            <div style={{ width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${nb.color}88,${nb.color})`,borderRadius:4,transition:"width .9s cubic-bezier(.16,1,.3,1)" }}/>
          </div>
        </div>
      )}
      {!nb && cb && (
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
          <div style={{ flex:1,height:3,background:`linear-gradient(90deg,${cb.color}44,${cb.color})`,borderRadius:3 }}/>
          <span style={{ fontSize:10,color:cb.color,fontWeight:700,flexShrink:0 }}>👑 NIVEL MÁXIMO</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={()=>{ sfx("click"); onReset(habit.id); }} style={{
          flex:1, padding:"9px 10px", borderRadius:11,
          background:"rgba(255,59,48,.07)", border:"1px solid rgba(255,59,48,.18)",
          color:"#FF6B6B", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:FONT,
        }}>😔 Recaí</button>

        <button onClick={()=>{ sfx("click"); onTogglePause(habit.id); }} style={{
          padding:"9px 14px", borderRadius:11,
          background: habit.frozen ? "rgba(0,199,255,.12)" : "rgba(255,255,255,.06)",
          border: `1px solid ${habit.frozen ? "rgba(0,199,255,.3)" : "rgba(255,255,255,.1)"}`,
          color: habit.frozen ? "#00C7FF" : "rgba(255,255,255,.45)",
          fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:FONT,
          whiteSpace:"nowrap",
        }}>{habit.frozen ? "🔥 Reanudar" : "🧊 Pausar"}</button>
      </div>
    </div>
  );
}
