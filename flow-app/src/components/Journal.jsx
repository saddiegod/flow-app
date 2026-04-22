import { useState, useEffect, useCallback, useMemo } from "react";
import { MOODS, ENERGY_COLORS, FONT, SERIF } from "../utils/constants.js";
import { todayISO, fromISO, toISO, calDays } from "../utils/dates.js";
import { sfx, load, save } from "../utils/helpers.js";
import { IS } from "./shared.jsx";

const JOURNAL_KEY = "journal";

// ── Helpers ────────────────────────────────────────────────────────────────────
function emptyEntry() {
  return { mood:null, energy:0, wins:["","",""], challenge:"", gratitude:["","",""], freeWrite:"", intention:"", updatedAt:null };
}

function displayDay(iso) {
  return fromISO(iso).toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long" });
}

// ── Section label ──────────────────────────────────────────────────────────────
function SectionLabel({ children, color = "rgba(255,255,255,.3)" }) {
  return (
    <div style={{ fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12 }}>
      {children}
    </div>
  );
}

// ── Dot calendar strip ─────────────────────────────────────────────────────────
function JournalCalStrip({ date, setDate, journal }) {
  const cal = useMemo(() => calDays(), []);
  return (
    <div style={{ display:"flex",gap:6,marginBottom:24,overflowX:"auto",paddingBottom:4 }}>
      {cal.map(d => {
        const sel  = d.iso === date;
        const entry = journal[d.iso];
        const mood  = entry?.mood ? MOODS.find(m=>m.id===entry.mood) : null;
        return (
          <button key={d.iso} onClick={()=>{ sfx("click"); setDate(d.iso); }} style={{
            display:"flex",flexDirection:"column",alignItems:"center",
            padding:"9px 0",minWidth:44,borderRadius:16,border:"none",cursor:"pointer",
            background:sel?"#F4C430":"rgba(255,255,255,.04)",
            boxShadow:sel?"0 8px 20px rgba(244,196,48,.28)":"none",
            transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <span style={{ fontSize:9,fontWeight:700,color:sel?"#000":"rgba(255,255,255,.28)",textTransform:"uppercase",marginBottom:4,letterSpacing:.5 }}>{d.name}</span>
            <span style={{ fontSize:18,fontWeight:900,fontFamily:SERIF,color:sel?"#000":"#F8F9FF" }}>{d.num}</span>
            <div style={{ marginTop:5,fontSize:10 }}>
              {mood ? mood.emoji : <div style={{ width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,.07)",marginTop:1 }}/>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Monthly summary mini-stats ─────────────────────────────────────────────────
function MonthlySummary({ journal }) {
  const entries = Object.values(journal).filter(e => e.updatedAt);
  const moods   = entries.map(e => e.mood).filter(Boolean);
  const topMood = MOODS.find(m => m.id === (
    MOODS.map(m => [m.id, moods.filter(x=>x===m.id).length])
         .sort((a,b)=>b[1]-a[1])[0]?.[0]
  ));
  const avgEnergy = entries.length
    ? (entries.reduce((a,e)=>a+(e.energy||0),0)/entries.length).toFixed(1)
    : "—";

  if (!entries.length) return null;

  return (
    <div style={{ display:"flex",gap:1,marginBottom:24,background:"rgba(255,255,255,.03)",borderRadius:16,border:"1px solid rgba(255,255,255,.05)",overflow:"hidden" }}>
      {[
        { v:entries.length,             l:"Entradas",   c:"#7B68EE" },
        { v:topMood?.emoji||"—",        l:"Humor +",    c:"#30D158" },
        { v:`${avgEnergy}/5`,           l:"Energía",    c:"#F4C430" },
      ].map((s,i)=>(
        <div key={i} style={{ flex:1,padding:"12px 0",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,.05)":"none" }}>
          <div style={{ fontSize:20,fontWeight:900,fontFamily:SERIF,color:s.c,lineHeight:1 }}>{s.v}</div>
          <div style={{ fontSize:9,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:.7,marginTop:3 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Journal component ─────────────────────────────────────────────────────
export default function Journal({ date, setDate }) {
  const [journal, setJournal] = useState(() => load(JOURNAL_KEY, {}));

  // Auto-save on every change
  useEffect(() => { save(JOURNAL_KEY, journal); }, [journal]);

  const entry  = journal[date] || emptyEntry();
  const isToday = date === todayISO();

  const patch = useCallback(updates => {
    setJournal(prev => ({
      ...prev,
      [date]: { ...(prev[date] || emptyEntry()), ...updates, updatedAt: Date.now() },
    }));
  }, [date]);

  const setWin = (i, v) => {
    const wins = [...(entry.wins||["","",""])];
    wins[i] = v;
    patch({ wins });
  };
  const setGratitude = (i, v) => {
    const gratitude = [...(entry.gratitude||["","",""])];
    gratitude[i] = v;
    patch({ gratitude });
  };

  const completedWins      = (entry.wins||[]).filter(w=>w.trim()).length;
  const completedGratitude = (entry.gratitude||[]).filter(g=>g.trim()).length;
  const hasContent = entry.mood || completedWins || entry.freeWrite?.trim();

  return (
    <div className="fi">
      <JournalCalStrip date={date} setDate={setDate} journal={journal}/>
      <MonthlySummary journal={journal}/>

      {/* Date header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:4 }}>
          {isToday ? "📔 Hoy" : "📔 Entrada"}
        </div>
        <div style={{ fontSize:22,fontWeight:900,fontFamily:SERIF,color:"#F8F9FF",letterSpacing:"-.4px",textTransform:"capitalize" }}>
          {displayDay(date)}
        </div>
        {hasContent && (
          <div style={{ fontSize:11,color:"rgba(255,255,255,.22)",marginTop:4,fontWeight:600 }}>✓ Guardado automáticamente</div>
        )}
      </div>

      {/* ── Mood ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel>¿Cómo te sientes hoy?</SectionLabel>
        <div style={{ display:"flex",gap:10 }}>
          {MOODS.map(m=>(
            <button key={m.id} onClick={()=>{ sfx("click"); patch({ mood: entry.mood===m.id ? null : m.id }); }} style={{
              flex:1, padding:"12px 4px", borderRadius:16, border:"none", cursor:"pointer",
              background: entry.mood===m.id ? `${m.color}22` : "rgba(255,255,255,.04)",
              outline: entry.mood===m.id ? `1.5px solid ${m.color}` : "1.5px solid transparent",
              transition:"all .2s",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              <span style={{ fontSize:22 }}>{m.emoji}</span>
              <span style={{ fontSize:9,fontWeight:700,color:entry.mood===m.id?m.color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:.4 }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Energy ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel>Nivel de energía</SectionLabel>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>{ sfx("click"); patch({ energy: entry.energy===n ? 0 : n }); }} style={{
              flex:1, height:10, borderRadius:10, border:"none", cursor:"pointer",
              background: n <= (entry.energy||0) ? ENERGY_COLORS[n-1] : "rgba(255,255,255,.08)",
              transition:"all .2s",
              boxShadow: n <= (entry.energy||0) ? `0 0 8px ${ENERGY_COLORS[n-1]}55` : "none",
            }}/>
          ))}
          <span style={{ fontSize:13,fontWeight:800,color:entry.energy?ENERGY_COLORS[entry.energy-1]:"rgba(255,255,255,.2)",minWidth:24,textAlign:"right",fontFamily:SERIF }}>
            {entry.energy||"—"}
          </span>
        </div>
      </div>

      {/* ── Three wins ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel color="#30D158">🏆 Tres victorias de hoy · {completedWins}/3</SectionLabel>
        {[0,1,2].map(i=>(
          <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
            <div style={{
              width:22,height:22,borderRadius:"50%",flexShrink:0,
              border: (entry.wins||["","",""])[i]?.trim() ? "none" : "2px solid rgba(48,209,88,.25)",
              background: (entry.wins||["","",""])[i]?.trim() ? "#30D158" : "transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all .3s",
              boxShadow: (entry.wins||["","",""])[i]?.trim() ? "0 0 10px rgba(48,209,88,.35)" : "none",
            }}>
              {(entry.wins||[])[i]?.trim() && <span style={{ color:"#FFF",fontSize:11,fontWeight:800 }}>✓</span>}
            </div>
            <input
              type="text"
              placeholder={`Victoria ${i+1}...`}
              value={(entry.wins||["","",""])[i]||""}
              onChange={e=>setWin(i,e.target.value)}
              style={{ ...IS, flex:1, padding:"10px 13px" }}
            />
          </div>
        ))}
      </div>

      {/* ── Challenge ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel color="#FF9500">💪 Principal reto del día</SectionLabel>
        <input
          type="text"
          placeholder="¿Qué fue lo más difícil?"
          value={entry.challenge||""}
          onChange={e=>patch({challenge:e.target.value})}
          style={{ ...IS }}
        />
      </div>

      {/* ── Gratitude ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel color="#F4C430">✨ Gratitud · {completedGratitude}/3</SectionLabel>
        {[0,1,2].map(i=>(
          <input
            key={i}
            type="text"
            placeholder={["Agradezco...","También agradezco...","Y además..."][i]}
            value={(entry.gratitude||["","",""])[i]||""}
            onChange={e=>setGratitude(i,e.target.value)}
            style={{ ...IS, marginBottom:8 }}
          />
        ))}
      </div>

      {/* ── Free write ── */}
      <div style={{ marginBottom:24 }}>
        <SectionLabel>📝 Reflexión libre</SectionLabel>
        <textarea
          placeholder="Escribe lo que quieras sobre tu día. Sin filtros, sin juicios..."
          value={entry.freeWrite||""}
          onChange={e=>patch({freeWrite:e.target.value})}
          style={{ ...IS, minHeight:120, resize:"none", lineHeight:1.6 }}
        />
      </div>

      {/* ── Tomorrow's intention ── */}
      <div style={{ marginBottom:8 }}>
        <SectionLabel color="#7B68EE">🎯 {isToday ? "Intención de mañana" : "Intención del día siguiente"}</SectionLabel>
        <input
          type="text"
          placeholder="Una cosa que haré sí o sí mañana..."
          value={entry.intention||""}
          onChange={e=>patch({intention:e.target.value})}
          style={{ ...IS, color:"#A695FF", fontWeight:700 }}
        />
      </div>

      {/* Bottom breathing space */}
      <div style={{ height:24 }}/>
    </div>
  );
}
