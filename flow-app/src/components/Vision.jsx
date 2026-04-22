import { useState, useCallback } from "react";
import { BOARD_COLORS, BOARD_EMOJIS, FONT, SERIF } from "../utils/constants.js";
import { uid } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import { Ring, IS } from "./shared.jsx";

// ─── Board Card (list item) ───────────────────────────────────────────────────
export function BoardCard({ board, onClick }) {
  const total = board.milestones?.length || 0;
  const done  = board.milestones?.filter(m=>m.done).length || 0;
  const pct   = total ? Math.round((done/total)*100) : 0;

  return (
    <div className="tap" onClick={onClick} style={{
      background:"rgba(255,255,255,.04)", border:`1px solid ${board.color}26`,
      borderRadius:22, padding:20, cursor:"pointer",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",background:`radial-gradient(circle, ${board.color}18, transparent 70%)`,pointerEvents:"none" }}/>

      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:pct>0?14:0 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:26,marginBottom:8 }}>{board.emoji}</div>
          <div style={{ fontSize:16,fontWeight:800,color:"#F8F9FF",marginBottom:2 }}>{board.title}</div>
          {board.description && (
            <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180 }}>{board.description}</div>
          )}
        </div>
        <Ring pct={pct} size={58} stroke={4} color={board.color}>
          <span style={{ fontSize:12,fontWeight:900,fontFamily:SERIF,color:board.color }}>{pct}%</span>
        </Ring>
      </div>

      {total > 0 && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
            <span style={{ fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600 }}>{done}/{total} hitos</span>
            {pct === 100 && <span style={{ fontSize:11,color:board.color,fontWeight:800 }}>✓ Completado</span>}
          </div>
          <div style={{ height:3,background:"rgba(255,255,255,.06)",borderRadius:3 }}>
            <div style={{ width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${board.color}88,${board.color})`,borderRadius:3,transition:"width .9s cubic-bezier(.16,1,.3,1)" }}/>
          </div>
        </div>
      )}
      {!total && <div style={{ fontSize:12,color:"rgba(255,255,255,.22)",fontStyle:"italic",marginTop:8 }}>Toca para añadir hitos →</div>}
    </div>
  );
}

// ─── Board Detail modal (bottom sheet) ───────────────────────────────────────
export function BoardDetail({ board, onChange, onClose, onDelete }) {
  const [newM,     setNewM]     = useState("");
  const [showPick, setShowPick] = useState(false);

  const milestones = board.milestones || [];
  const done  = milestones.filter(m=>m.done).length;
  const total = milestones.length;
  const pct   = total ? Math.round((done/total)*100) : 0;

  const push = useCallback(changes => onChange({ ...board, ...changes }), [board, onChange]);

  const addMilestone = () => {
    if (!newM.trim()) return;
    sfx("click");
    push({ milestones:[...milestones,{id:uid(),text:newM.trim(),done:false}] });
    setNewM("");
  };

  const toggleM = id => {
    const updated = milestones.map(m => m.id===id ? {...m,done:!m.done} : m);
    const wasDone = milestones.find(m=>m.id===id)?.done;
    if (!wasDone) sfx("milestone"); else sfx("click");
    push({ milestones:updated });
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(16px)",zIndex:200,overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0E1120", border:`1px solid ${board.color}22`,
        borderRadius:"28px 28px 0 0", padding:"28px 22px 48px",
        minHeight:"60vh", marginTop:80,
        animation:"up .4s cubic-bezier(.16,1,.3,1) both",
      }}>
        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={()=>setShowPick(p=>!p)} style={{
              fontSize:26,background:"rgba(255,255,255,.06)",
              border:`1px solid ${board.color}44`,borderRadius:14,
              width:52,height:52,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            }}>{board.emoji}</button>
            <div>
             <input value={board.title} onChange={e=>push({title:e.target.value||board.title})}
                style={{ ...IS,padding:"5px 0",background:"transparent",border:"none",fontSize:19,fontWeight:900,fontFamily:SERIF,letterSpacing:"-.3px",width:"auto",minWidth:100 }}
              />
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={onDelete} style={{ background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.18)",borderRadius:10,padding:"8px 12px",color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT }}>Eliminar</button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.06)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",color:"rgba(255,255,255,.5)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
          </div>
        </div>

        {/* Emoji/color picker */}
        {showPick && (
          <div style={{ background:"rgba(255,255,255,.05)",borderRadius:18,padding:16,marginBottom:20 }}>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:12 }}>
              {BOARD_EMOJIS.map(e=>(
                <button key={e} onClick={()=>{push({emoji:e});setShowPick(false);}} style={{
                  fontSize:22,background:board.emoji===e?`${board.color}33`:"transparent",
                  border:board.emoji===e?`1px solid ${board.color}`:"1px solid transparent",
                  borderRadius:11,width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                }}>{e}</button>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {BOARD_COLORS.map(c=>(
                <button key={c} onClick={()=>push({color:c})} style={{ width:26,height:26,borderRadius:"50%",background:c,border:board.color===c?"2.5px solid #FFF":"2px solid transparent",cursor:"pointer" }}/>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        <div style={{ display:"flex",alignItems:"center",gap:20,marginBottom:24,background:"rgba(255,255,255,.03)",border:`1px solid ${board.color}22`,borderRadius:20,padding:18 }}>
          <Ring pct={pct} size={72} stroke={6} color={board.color}>
            <span style={{ fontSize:15,fontWeight:900,fontFamily:SERIF,color:board.color }}>{pct}%</span>
          </Ring>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17,fontWeight:900,fontFamily:SERIF,color:"#F8F9FF",marginBottom:3 }}>
              {pct===100?"✨ Meta lograda":pct>50?"¡Vas muy bien!":pct>0?"En progreso":"Empieza hoy"}
            </div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.35)" }}>{done} de {total} hitos completados</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8 }}>Descripción</div>
          <textarea placeholder="¿Qué significa esta meta para ti?" value={board.description||""}
            onChange={e=>push({description:e.target.value})}
            style={{ ...IS,minHeight:64,resize:"none" }}
          />
        </div>

        {/* Daily action */}
        <div style={{ marginBottom:24,background:`${board.color}12`,border:`1px solid ${board.color}28`,borderRadius:16,padding:16 }}>
          <div style={{ fontSize:10,fontWeight:700,color:board.color,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8 }}>⚡ ¿Qué hice hoy?</div>
          <textarea placeholder="Tu acción de hoy..." value={board.action||""}
            onChange={e=>push({action:e.target.value})}
            style={{ ...IS,background:"rgba(0,0,0,.2)",minHeight:56,resize:"none" }}
          />
        </div>

        {/* Milestones */}
        <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14 }}>Hitos y pasos clave</div>

        {milestones.map(m=>(
          <div key={m.id} className="tap" onClick={()=>toggleM(m.id)} style={{
            display:"flex",alignItems:"center",gap:12,
            padding:"13px 14px",borderRadius:14,marginBottom:8,cursor:"pointer",
            background:m.done?"rgba(48,209,88,.06)":"rgba(255,255,255,.04)",
            border:`1px solid ${m.done?"rgba(48,209,88,.2)":"rgba(255,255,255,.07)"}`,
          }}>
            <div style={{
              width:22,height:22,borderRadius:"50%",flexShrink:0,
              border:m.done?"none":"2px solid rgba(255,255,255,.18)",
              background:m.done?"#30D158":"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:m.done?"0 0 10px rgba(48,209,88,.35)":"none",
              transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
            }}>
              {m.done && <span style={{ color:"#FFF",fontSize:11,fontWeight:800 }}>✓</span>}
            </div>
            <div style={{ flex:1,fontSize:14,fontWeight:600,color:m.done?"rgba(255,255,255,.38)":"#F8F9FF",textDecoration:m.done?"line-through":"none",transition:"all .3s" }}>{m.text}</div>
            <button onClick={e=>{e.stopPropagation();push({milestones:milestones.filter(x=>x.id!==m.id)});}} style={{ background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.13)",fontSize:16,lineHeight:1 }}>×</button>
          </div>
        ))}

        <div style={{ display:"flex",gap:10,marginTop:8 }}>
          <input type="text" placeholder="Nuevo hito..." value={newM} onChange={e=>setNewM(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addMilestone()}
            style={{ ...IS,flex:1 }}
          />
          <button onClick={addMilestone} style={{ padding:"0 20px",borderRadius:12,border:"none",background:"#F8F9FF",color:"#080B14",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:FONT }}>+</button>
        </div>
      </div>
    </div>
  );
}
