import { useRef, useState } from "react";
import { FONT, SERIF } from "../utils/constants.js";
import { exportBackup, importBackup, requestNotifPerm, fireNotif, load, save } from "../utils/helpers.js";
import { migrateTasks } from "../utils/dates.js";
import { IS } from "./shared.jsx";

export default function Settings({ onClose, session, onLogin, onLogout, notifPerm, setNotifPerm, onImport }) {
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState("");
  const [importing,setImporting]= useState(false);
  const fileRef = useRef(null);

  const doLogin = async () => {
    if (!email || !pass) return;
    setLoading(true); setMsg("");
    try { await onLogin(email, pass); setMsg("✓ Conectado"); }
    catch(e) { setMsg("Error: " + (e.message || "verifica tus datos")); }
    finally { setLoading(false); }
  };

  const handleExport = () => { exportBackup(); sfxClick(); };

  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await importBackup(file);
      // Migrate dates if old format
      if (data.tasks)     data.tasks     = migrateTasks(data.tasks);
      if (data.recurring) data.recurring = data.recurring; // already uses no dates
      onImport(data);
      setMsg("✓ Datos restaurados correctamente");
    } catch(e) {
      setMsg("Error: " + e.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleNotif = async () => {
    const p = await requestNotifPerm();
    setNotifPerm(p);
    if (p === "granted") fireNotif("✅ Focus App", "Notificaciones activas. Te avisaré 10 min antes.");
  };

  // Inline sfx to avoid import cycle
  function sfxClick() { try { new Audio(); } catch {} /* sfx is imported in App */ }

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:26 }}>
      <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(18px)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center" }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0E1120", border:"1px solid rgba(255,255,255,.08)",
        borderRadius:"0 0 28px 28px", padding:"28px 22px 36px",
        width:"100%", maxWidth:480, animation:"dd .3s ease both",
        maxHeight:"85vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28 }}>
          <span style={{ fontSize:18,fontWeight:800,fontFamily:SERIF }}>Configuración</span>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:"rgba(255,255,255,.35)",fontSize:24,cursor:"pointer",lineHeight:1 }}>×</button>
        </div>

        {/* ── Notificaciones ── */}
        <Section title="🔔 Notificaciones">
          {notifPerm === "unsupported" && (
            <div style={{ background:"rgba(255,255,255,.04)",borderRadius:14,padding:16,fontSize:13,color:"rgba(255,255,255,.4)" }}>
              Tu navegador no soporta notificaciones nativas.
            </div>
          )}
          {notifPerm === "granted" && (
            <div style={{ background:"rgba(48,209,88,.07)",border:"1px solid rgba(48,209,88,.2)",borderRadius:14,padding:"14px 16px" }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#30D158",marginBottom:4 }}>🔔 Activas</div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>Recibirás recordatorios 10 min antes de cada tarea con hora.</div>
            </div>
          )}
          {(notifPerm === "default" || notifPerm === "denied") && (
            <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:16 }}>
              {notifPerm === "denied" && <div style={{ fontSize:12,color:"#FF9500",marginBottom:10,fontWeight:600 }}>⚠ Bloqueadas. Actívalas en Ajustes del sistema.</div>}
              <button onClick={handleNotif} disabled={notifPerm==="denied"} style={{
                width:"100%",padding:"12px",borderRadius:12,border:"none",
                background:notifPerm==="denied"?"rgba(255,255,255,.05)":"#F8F9FF",
                color:notifPerm==="denied"?"rgba(255,255,255,.35)":"#080B14",
                fontSize:14,fontWeight:800,cursor:notifPerm==="denied"?"not-allowed":"pointer",fontFamily:FONT,
              }}>Activar notificaciones</button>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.2)",textAlign:"center",marginTop:10 }}>
                📱 iPhone: Compartir → Añadir a pantalla de inicio → notificaciones de fondo activas.
              </div>
            </div>
          )}
        </Section>

        {/* ── Backup & Restore ── */}
        <Section title="💾 Backup y restauración">
          <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:18 }}>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.45)",marginBottom:16,lineHeight:1.6 }}>
              Exporta todos tus datos a un archivo JSON. Úsalo para hacer backup o transferir entre dispositivos.
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={handleExport} style={{
                flex:1,padding:"12px",borderRadius:12,border:"none",
                background:"rgba(123,104,238,.15)",border:"1px solid rgba(123,104,238,.3)",
                color:"#A695FF",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:FONT,
              }}>⬇ Exportar datos</button>

              <button onClick={()=>fileRef.current?.click()} disabled={importing} style={{
                flex:1,padding:"12px",borderRadius:12,border:"none",
                background:"rgba(48,209,88,.1)",border:"1px solid rgba(48,209,88,.25)",
                color:"#30D158",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:FONT,
                opacity:importing?.6:1,
              }}>{importing ? "Importando..." : "⬆ Importar"}</button>
            </div>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
            {msg && <div style={{ fontSize:12,color:msg.startsWith("✓")?"#30D158":"#FF6B6B",marginTop:12,fontWeight:600 }}>{msg}</div>}
          </div>
        </Section>

        {/* ── Sincronización ── */}
        <Section title="☁ Sincronización en la nube">
          {session ? (
            <div style={{ background:"rgba(48,209,88,.07)",border:"1px solid rgba(48,209,88,.2)",borderRadius:14,padding:"14px 16px" }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#30D158",marginBottom:4 }}>✓ Sincronizado</div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,.38)",marginBottom:12 }}>{session.user?.email}</div>
              <button onClick={onLogout} style={{ background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.2)",borderRadius:10,padding:"8px 16px",color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT }}>Cerrar sesión</button>
            </div>
          ) : (
            <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:16 }}>
              <input type="email"    placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)} style={{ ...IS, marginBottom:10 }}/>
              <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} style={{ ...IS, marginBottom:msg?8:0 }}/>
              {msg && <div style={{ fontSize:12,color:msg.startsWith("✓")?"#30D158":"#FF6B6B",marginBottom:8 }}>{msg}</div>}
              <button onClick={doLogin} disabled={loading} style={{
                width:"100%",padding:"11px",borderRadius:12,border:"none",
                background:"#F8F9FF",color:"#080B14",fontSize:14,fontWeight:800,
                cursor:loading?"default":"pointer",fontFamily:FONT,opacity:loading?.6:1,marginTop:6,
              }}>{loading ? "Conectando..." : "Iniciar sesión"}</button>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.18)",textAlign:"center",marginTop:10 }}>
                La app funciona perfectamente sin cuenta.<br/>Todo se guarda en tu dispositivo.
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
