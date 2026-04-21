import { useState, useCallback } from "react";
import { CATS, DAYS_SH, ALL_TIMES, QUICK_TASKS, FONT, SERIF } from "../utils/constants.js";
import { sfx } from "../utils/helpers.js";
import { IS } from "./shared.jsx";

export default function AddForm({ onSave }) {
  const [mode,  setMode]  = useState("once");
  const [title, setTitle] = useState("");
  const [ts,    setTs]    = useState("");
  const [te,    setTe]    = useState("");
  const [cat,   setCat]   = useState("");
  const [notes, setNotes] = useState("");
  const [rType, setRType] = useState("daily");
  // Store as actual numbers, not strings
  const [rDays, setRDays] = useState([1,2,3,4,5]);

  const toggleDay = useCallback(i => {
    const num = Number(i);
    setRDays(p => p.includes(num) ? p.filter(x => x !== num) : [...p, num]);
  }, []);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      timeStart: ts || null,
      timeEnd:   te || null,
      category:  cat || null,
      notes:     notes || "",
      mode,
      rType,
      // Always persist as number array — the root of the recurring bug
      rDays: rDays.map(Number),
    });
    setTitle(""); setTs(""); setTe(""); setCat(""); setNotes("");
  }, [title, ts, te, cat, notes, mode, rType, rDays, onSave]);

  return (
    <div className="su" style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:28,padding:24 }}>
      <div style={{ fontSize:22,fontWeight:900,fontFamily:SERIF,marginBottom:20,letterSpacing:"-.4px" }}>Nueva tarea</div>
      <form onSubmit={handleSubmit}>

        {/* Title */}
        <input type="text" placeholder="¿Qué harás?" autoFocus value={title} onChange={e=>setTitle(e.target.value)}
          style={{ ...IS,fontSize:19,fontWeight:800,padding:"11px 0",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.09)",borderRadius:0,marginBottom:20 }}
        />

        {/* Quick tasks */}
        <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10 }}>Un clic</div>
        <div style={{ display:"flex",gap:7,overflowX:"auto",paddingBottom:12,marginBottom:18 }}>
          {QUICK_TASKS.map(t=>(
            <button key={t} type="button" onClick={()=>{sfx("click");setTitle(t);}} style={{
              padding:"8px 13px",borderRadius:11,border:"none",whiteSpace:"nowrap",
              cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:FONT,
              background:title===t?"#F4C430":"rgba(255,255,255,.06)",
              color:title===t?"#000":"rgba(255,255,255,.6)",transition:"all .18s",
            }}>{t}</button>
          ))}
        </div>

        {/* Mode */}
        <div style={{ display:"flex",gap:8,marginBottom:18 }}>
          {[["once","📌 Una vez"],["recurring","↻ Repetir"]].map(([m,l])=>(
            <button key={m} type="button" onClick={()=>{sfx("click");setMode(m);}} style={{
              flex:1,padding:"11px",borderRadius:13,border:"none",cursor:"pointer",
              fontWeight:700,fontSize:13,fontFamily:FONT,
              background:mode===m?"#F8F9FF":"rgba(255,255,255,.05)",
              color:mode===m?"#080B14":"rgba(255,255,255,.45)",transition:"all .2s",
            }}>{l}</button>
          ))}
        </div>

        {/* Recurring options */}
        {mode === "recurring" && (
          <div style={{ background:"rgba(123,104,238,.08)",border:"1px solid rgba(123,104,238,.18)",borderRadius:16,padding:16,marginBottom:18 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"rgba(163,149,255,.8)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12 }}>Frecuencia</div>
            <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginBottom:rType==="custom"?14:0 }}>
              {[["daily","Cada día"],["weekdays","L – V"],["weekends","S – D"],["custom","Elegir días"]].map(([k,l])=>(
                <button key={k} type="button" onClick={()=>{sfx("click");setRType(k);}} style={{
                  padding:"8px 13px",borderRadius:10,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,fontFamily:FONT,whiteSpace:"nowrap",
                  background:rType===k?"#7B68EE":"rgba(255,255,255,.07)",
                  color:rType===k?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
                }}>{l}</button>
              ))}
            </div>
            {rType === "custom" && (
              <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
                {DAYS_SH.map((d,i)=>(
                  <button key={i} type="button" onClick={()=>toggleDay(i)} style={{
                    width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:800,fontFamily:FONT,
                    background:rDays.includes(i)?"#7B68EE":"rgba(255,255,255,.08)",
                    color:rDays.includes(i)?"#FFF":"rgba(255,255,255,.35)",transition:"all .18s",
                  }}>{d}</button>
                ))}
              </div>
            )}
            {/* Live preview */}
            <div style={{ marginTop:12,fontSize:11,color:"rgba(163,149,255,.6)",fontWeight:700 }}>
              Vista previa: {rType==="daily"?"Todos los días":rType==="weekdays"?"Lunes a viernes":rType==="weekends"?"Sábados y domingos":rDays.length?rDays.sort((a,b)=>a-b).map(i=>["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][i]).join(", "):"Ningún día seleccionado"}
            </div>
          </div>
        )}

        {/* Start / End time */}
        <div style={{ display:"flex",gap:10,marginBottom:18 }}>
          {[["Inicio",ts,setTs],["Fin",te,setTe]].map(([l,val,set])=>(
            <div key={l} style={{ flex:1 }}>
              <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:7 }}>{l}</div>
              <select value={val} onChange={e=>set(e.target.value)} style={{ ...IS,padding:"10px 12px" }}>
                <option value="">— sin hora —</option>
                {ALL_TIMES.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Category */}
        <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10 }}>Categoría</div>
        <div style={{ display:"flex",gap:7,marginBottom:18,flexWrap:"wrap" }}>
          {CATS.map(c=>(
            <button key={c.id} type="button" onClick={()=>{sfx("click");setCat(cat===c.id?"":c.id);}} style={{
              padding:"7px 12px",borderRadius:10,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:FONT,
              background:cat===c.id?c.color:"rgba(255,255,255,.06)",
              color:cat===c.id?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
            }}>● {c.label}</button>
          ))}
        </div>

        {/* Notes */}
        <input type="text" placeholder="Nota opcional" value={notes} onChange={e=>setNotes(e.target.value)}
          style={{ ...IS,marginBottom:22 }}
        />

        <button type="submit" style={{
          width:"100%",padding:17,borderRadius:17,border:"none",
          background:"#F8F9FF",color:"#080B14",fontSize:15,fontWeight:800,
          cursor:"pointer",fontFamily:FONT,letterSpacing:"-.2px",
          boxShadow:"0 8px 22px rgba(248,249,255,.07)",
        }}>Guardar ✓</button>
      </form>
    </div>
  );
}
