import { useState, useRef, useEffect } from "react";

/* ─── SUPABASE SYNC ──────────────────────────────────── */
async function loadFromCloud() {
  try {
    const res = await fetch('/api/sync');
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}
async function saveToCloud(data) {
  try {
    await fetch('/api/sync', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data),
    });
  } catch(e) {}
}

/* ─── CONFIG ─────────────────────────────────────────── */
const DEFAULT_COMPANIES = [
  { id:"bgh",     name:"BGH Tech Partner", short:"BGH",       color:"#0057FF", accent:"#E8F0FF", dark:"#002B80", emoji:"🔵" },
  { id:"valion",  name:"Valion SAS",        short:"Valion",    color:"#F5A623", accent:"#FFF8E8", dark:"#0A1628", emoji:"🟡" },
  { id:"talktec", name:"Talk Tech SAS",     short:"Talk Tech", color:"#1A1A1A", accent:"#F5F5F5", dark:"#000000", emoji:"⚫" },
];

function loadCompanies() {
  try {
    const r = localStorage.getItem("roadmap_companies");
    if (r) return JSON.parse(r);
  } catch(e) {}
  return DEFAULT_COMPANIES;
}
function saveCompanies(c) { try { localStorage.setItem("roadmap_companies", JSON.stringify(c)); } catch(e){} }

// Use dynamic companies — will be set from App state
let COMPANIES = loadCompanies();
const STAGES = ["Prospecto","Contactado","Propuesta","Negociación","Cerrado ✓","Perdido ✗"];
const STAGE_COLORS = {
  "Prospecto":"#9B9B9B","Contactado":"#3B82F6","Propuesta":"#F59E0B",
  "Negociación":"#8B5CF6","Cerrado ✓":"#10B981","Perdido ✗":"#EF4444",
};
const STORAGE_KEY = "roadmap_pm_v2";
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function today() { return new Date().toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"}); }
const EMPTY = { bgh:{clients:[]}, valion:{clients:[]}, talktec:{clients:[]} };
function loadData() {
  try { const r=localStorage.getItem(STORAGE_KEY); if(r) return JSON.parse(r); } catch(e){}
  return EMPTY;
}
function saveData(d) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch(e){} }

/* ─── AI EXTRACT TODOS ───────────────────────────────── */
async function aiExtractTodos(text, clientName, companyName) {
  try {
    const res = await fetch("/api/extract", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ text, clientName, companyName }),
    });
    const data = await res.json();
    return (data.todos||[]).map(t=>({
      id:uid(), text:t.text||t, owner:t.owner||"Wilmer", done:false
    }));
  } catch(e) {
    // Fallback: basic line extraction
    return text.split("\n")
      .filter(l=>l.match(/^[-*•]/))
      .map(l=>({id:uid(),text:l.replace(/^[-*•]\s*/,"").trim(),done:false,owner:"Wilmer"}))
      .filter(t=>t.text.length>3);
  }
}

/* ─── SMALL COMPONENTS ───────────────────────────────── */
function StagePill({stage,onClick}) {
  const c=STAGE_COLORS[stage]||"#999";
  return <span onClick={onClick} style={{background:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:20,fontSize:11,fontWeight:700,padding:"3px 10px",cursor:onClick?"pointer":"default",whiteSpace:"nowrap"}}>{stage}</span>;
}
function Btn({children,onClick,color,outline,small,disabled}) {
  return <button onClick={onClick} disabled={disabled} style={{background:outline?"transparent":(disabled?"#DDD":color),color:outline?color:"#fff",border:`1.5px solid ${disabled?"#DDD":color}`,borderRadius:8,padding:small?"6px 12px":"9px 16px",cursor:disabled?"not-allowed":"pointer",fontSize:small?12:13,fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{children}</button>;
}

/* ─── TODO ITEM ──────────────────────────────────────── */
function TodoItem({todo,color,onToggle,onDelete,onOwnerChange}) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",borderRadius:8,marginBottom:4,background:todo.done?"#F8F8F8":"#fff",border:`1px solid ${todo.done?"#E5E5E5":color+"33"}`}}>
      <button onClick={onToggle} style={{width:18,height:18,borderRadius:5,flexShrink:0,marginTop:2,border:`2px solid ${todo.done?"#BBB":color}`,background:todo.done?"#BBB":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {todo.done&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:todo.done?"#AAA":"#222",textDecoration:todo.done?"line-through":"none",lineHeight:1.5}}>{todo.text}</div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
          <span style={{fontSize:10,color:"#BBB"}}>👤</span>
          <input value={todo.owner||"Wilmer"} onChange={e=>onOwnerChange(e.target.value)}
            style={{fontSize:11,color:color,fontWeight:600,border:"none",background:"transparent",outline:"none",fontFamily:"inherit",width:80,cursor:"text"}}/>
        </div>
      </div>
      <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",color:"#CCC",fontSize:15,padding:0,lineHeight:1,flexShrink:0}}>×</button>
    </div>
  );
}

/* ─── CONV ENTRY ─────────────────────────────────────── */
function ConvEntry({conv,color,onDelete}) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{borderRadius:10,border:`1px solid ${color}22`,marginBottom:6,overflow:"hidden"}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",cursor:"pointer",background:open?color+"10":"#FAFAFA"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span>{conv.transcribed?"🎙️":"💬"}</span>
          <div>
            <span style={{fontSize:13,fontWeight:600,color:"#222"}}>{conv.title}</span>
            <span style={{fontSize:11,color:"#999",marginLeft:8}}>{conv.date}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {conv.todos?.filter(t=>!t.done).length>0&&<span style={{fontSize:11,background:color+"22",color,padding:"1px 7px",borderRadius:10,fontWeight:700}}>{conv.todos.filter(t=>!t.done).length} pendiente{conv.todos.filter(t=>!t.done).length>1?"s":""}</span>}
          <span style={{color:"#BBB",fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{padding:"10px 12px",background:"#fff",borderTop:`1px solid ${color}18`}}>
          <p style={{margin:"0 0 8px",fontSize:13,color:"#444",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{conv.notes}</p>
          {conv.todos?.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,color:"#AAA",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>To-Do's extraídos</div>
              {conv.todos.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",fontSize:12,color:t.done?"#AAA":"#333",textDecoration:t.done?"line-through":"none"}}>
                  <span style={{color:t.done?"#BBB":color}}>{t.done?"✓":"○"}</span>
                  <span style={{flex:1}}>{t.text}</span>
                  {t.owner&&<span style={{fontSize:10,color:color,fontWeight:600}}>👤 {t.owner}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{marginTop:8,textAlign:"right"}}>
            <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",color:"#CCC",fontSize:12,fontFamily:"inherit"}}>🗑 Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── VOICE RECORDER ─────────────────────────────────── */
function VoiceRecorder({color,accent,onTranscript}) {
  const [mode,setMode]=useState(null); // null | 'recording' | 'processing' | 'done' | 'upload'
  const [transcript,setTranscript]=useState("");
  const [elapsed,setElapsed]=useState(0);
  const mediaRef=useRef(null);
  const chunksRef=useRef([]);
  const timerRef=useRef(null);

  const startLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const mr = new MediaRecorder(stream, {mimeType:'audio/webm'});
      chunksRef.current=[];
      mr.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRef.current=mr;
      setElapsed(0);
      setMode("recording");
      timerRef.current=setInterval(()=>setElapsed(p=>p+1),1000);
    } catch(e) {
      alert("No se pudo acceder al micrófono. Verifica los permisos en Safari.");
    }
  };

  const stopLive = () => {
    clearInterval(timerRef.current);
    if(mediaRef.current && mediaRef.current.state!=="inactive"){
      mediaRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current,{type:'audio/webm'});
        mediaRef.current.stream.getTracks().forEach(t=>t.stop());
        await processAudio(blob,'audio/webm');
      };
      mediaRef.current.stop();
    }
    setMode("processing");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setMode("processing");
    await processAudio(file, file.type);
  };

  const processAudio = async (blob, mimeType) => {
    setMode("processing");
    try {
      const base64 = await new Promise((res,rej)=>{
        const reader = new FileReader();
        reader.onload=()=>res(reader.result.split(',')[1]);
        reader.onerror=rej;
        reader.readAsDataURL(blob);
      });
      const response = await fetch('/api/transcribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({audioBase64:base64, mimeType}),
      });
      const data = await response.json();
      if(data.text){
        setTranscript(data.text);
        setMode("done");
      } else {
        setMode("upload");
      }
    } catch(e) {
      setMode("upload");
    }
  };

  const confirmTranscript = () => {
    if(transcript.trim()) onTranscript(transcript.trim());
    setMode(null); setTranscript(""); setElapsed(0);
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  if(mode===null) return (
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <button onClick={startLive} style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${color}44`,background:accent,color,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        🎙️ Grabar reunión
      </button>
      <label style={{flex:1,padding:"10px",borderRadius:10,border:`1.5px solid ${color}44`,background:accent,color,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📎 Subir audio
        <input type="file" accept="audio/*" onChange={handleFileUpload} style={{display:"none"}}/>
      </label>
    </div>
  );

  if(mode==="recording") return (
    <div style={{background:accent,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1.5px solid #EF444444`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",display:"inline-block",animation:"pulse 1s infinite"}}/>
        <span style={{fontSize:13,fontWeight:700,color:"#EF4444"}}>Grabando {fmt(elapsed)}</span>
        <span style={{fontSize:11,color:"#AAA",marginLeft:4}}>Identificando hablantes con IA...</span>
        <button onClick={stopLive} style={{marginLeft:"auto",background:"#EF4444",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏹ Detener</button>
      </div>
    </div>
  );

  if(mode==="processing") return (
    <div style={{background:accent,borderRadius:10,padding:"14px",marginBottom:12,textAlign:"center"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#555",marginBottom:4}}>
        <span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>⚙️</span> Procesando audio con IA...
      </div>
      <div style={{fontSize:11,color:"#AAA"}}>Identificando hablantes · Esto toma ~30 segundos</div>
    </div>
  );

  if(mode==="done") return (
    <div style={{background:accent,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1.5px solid ${color}44`}}>
      <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:6}}>🎙️ Transcripción con hablantes — edita si es necesario:</div>
      <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
        style={{width:"100%",minHeight:120,padding:"8px 10px",borderRadius:8,border:`1px solid ${color}33`,fontSize:12,lineHeight:1.8,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <Btn onClick={confirmTranscript} color={color} small disabled={!transcript.trim()}>✅ Usar transcripción</Btn>
        <Btn onClick={()=>{setMode(null);setTranscript("");}} color="#999" outline small>Cancelar</Btn>
      </div>
    </div>
  );

  if(mode==="upload") return (
    <div style={{background:accent,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1.5px solid ${color}44`}}>
      <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:4}}>📝 Escribe o pega la transcripción:</div>
      <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
        placeholder="[Wilmer]: Buenos días, vamos a revisar la propuesta...
[Cliente]: Sí, tenemos dudas sobre el precio..."
        style={{width:"100%",minHeight:100,padding:"8px 10px",borderRadius:8,border:`1px solid ${color}33`,fontSize:12,lineHeight:1.6,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <Btn onClick={confirmTranscript} color={color} small disabled={!transcript.trim()}>✅ Usar transcripción</Btn>
        <Btn onClick={()=>setMode(null)} color="#999" outline small>Cancelar</Btn>
      </div>
    </div>
  );

  return null;
}

/* ─── CLIENT MODAL ───────────────────────────────────── */
function ClientModal({client,company,onClose,onUpdate,onDelete}) {
  const [tab,setTab]=useState("conv");
  const [newConvTitle,setNewConvTitle]=useState("");
  const [newConvNotes,setNewConvNotes]=useState("");
  const [loadingExtract,setLoadingExtract]=useState(false);
  const [newTodo,setNewTodo]=useState("");
  const [stage,setStage]=useState(client.stage||"Prospecto");
  const [confirmDelete,setConfirmDelete]=useState(false);

  const upd=(patch)=>onUpdate({...client,...patch});

  const handleTranscript=(text)=>{
    setNewConvNotes(prev=>(prev?prev+"\n\n":"")+text);
    if(!newConvTitle) setNewConvTitle(`Reunión transcrita — ${today()}`);
  };

  const addConv=async()=>{
    if(!newConvNotes.trim()) return;
    setLoadingExtract(true);
    const title=newConvTitle.trim()||`Conversación ${today()}`;
    const todos=await aiExtractTodos(newConvNotes,client.name,company.name);
    setLoadingExtract(false);
    const conv={id:uid(),title,date:today(),notes:newConvNotes,todos,transcribed:newConvNotes.length>200};
    const updatedConvs=[conv,...(client.conversations||[])];
    const allTodos=[...(client.todos||[]),...todos];
    upd({conversations:updatedConvs,todos:allTodos});
    setNewConvTitle(""); setNewConvNotes(""); setTab("conv");
  };

  const deleteConv=(cid)=>upd({conversations:(client.conversations||[]).filter(c=>c.id!==cid)});
  const toggleTodo=(id)=>upd({todos:(client.todos||[]).map(t=>t.id===id?{...t,done:!t.done}:t)});
  const deleteTodo=(id)=>upd({todos:(client.todos||[]).filter(t=>t.id!==id)});
  const updateOwner=(id,owner)=>upd({todos:(client.todos||[]).map(t=>t.id===id?{...t,owner}:t)});
  const addManualTodo=()=>{
    if(!newTodo.trim()) return;
    upd({todos:[...(client.todos||[]),{id:uid(),text:newTodo.trim(),done:false,owner:"Wilmer"}]});
    setNewTodo("");
  };
  const changeStage=(s)=>{setStage(s);upd({stage:s});};

  const c=company.color;
  const TABS=[
    {id:"conv",label:"💬 Historial",count:(client.conversations||[]).length},
    {id:"todos",label:"✅ To-Do's",count:(client.todos||[]).length},
    {id:"new",label:"➕ Nueva"},
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${c},${company.dark})`,padding:"16px 20px 12px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>{company.emoji} {company.name}</div>
              <div style={{color:"#fff",fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{client.name}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setConfirmDelete(true)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:15}}>🗑</button>
              <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#fff",fontSize:18}}>×</button>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {STAGES.map(s=>(
              <span key={s} onClick={()=>changeStage(s)} style={{background:stage===s?STAGE_COLORS[s]:"rgba(255,255,255,0.15)",color:stage===s?"#fff":"rgba(255,255,255,0.75)",border:`1px solid ${stage===s?"transparent":"rgba(255,255,255,0.25)"}`,borderRadius:20,fontSize:11,fontWeight:700,padding:"3px 10px",cursor:"pointer",transition:"all 0.15s"}}>{s}</span>
            ))}
          </div>
        </div>

        {confirmDelete&&(
          <div style={{background:"#FFF5F5",borderBottom:"1px solid #FFD0D0",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <span style={{fontSize:13,color:"#C0392B",fontWeight:600}}>¿Eliminar a {client.name} y todos sus datos?</span>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={onDelete} color="#EF4444" small>Sí, eliminar</Btn>
              <Btn onClick={()=>setConfirmDelete(false)} color="#999" outline small>Cancelar</Btn>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1.5px solid #F0F0F0",background:"#FAFAFA",flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 6px",border:"none",cursor:"pointer",background:tab===t.id?"#fff":"transparent",color:tab===t.id?c:"#999",fontWeight:tab===t.id?700:500,fontSize:12,borderBottom:tab===t.id?`2.5px solid ${c}`:"2.5px solid transparent",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              {t.label}
              {t.count!==undefined&&t.count>0&&<span style={{background:tab===t.id?c+"22":"#EEE",color:tab===t.id?c:"#AAA",borderRadius:10,padding:"0 5px",fontSize:10,fontWeight:700}}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px 18px"}}>

          {tab==="conv"&&(
            <div>
              {(client.conversations||[]).length===0?(
                <div style={{textAlign:"center",padding:"32px 20px",color:"#BBB"}}>
                  <div style={{fontSize:36,marginBottom:8}}>💬</div>
                  Sin conversaciones aún.<br/><span style={{fontSize:12}}>Usa "Nueva" para registrar o transcribir reuniones</span>
                </div>
              ):(client.conversations||[]).map(conv=>(
                <ConvEntry key={conv.id} conv={conv} color={c} onDelete={()=>deleteConv(conv.id)}/>
              ))}
            </div>
          )}

          {tab==="todos"&&(
            <div>
              {(client.todos||[]).length===0&&(
                <div style={{textAlign:"center",padding:"24px",color:"#BBB",fontSize:13}}>
                  <div style={{fontSize:32,marginBottom:6}}>📋</div>
                  Sin tareas. Se generan automáticamente al guardar conversaciones.
                </div>
              )}
              {(client.todos||[]).filter(t=>!t.done).map(t=>(
                <TodoItem key={t.id} todo={t} color={c} onToggle={()=>toggleTodo(t.id)} onDelete={()=>deleteTodo(t.id)} onOwnerChange={(o)=>updateOwner(t.id,o)}/>
              ))}
              {(client.todos||[]).filter(t=>t.done).length>0&&(
                <>
                  <div style={{fontSize:11,color:"#BBB",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",margin:"12px 0 6px"}}>Completadas</div>
                  {(client.todos||[]).filter(t=>t.done).map(t=>(
                    <TodoItem key={t.id} todo={t} color={c} onToggle={()=>toggleTodo(t.id)} onDelete={()=>deleteTodo(t.id)} onOwnerChange={(o)=>updateOwner(t.id,o)}/>
                  ))}
                </>
              )}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <input value={newTodo} onChange={e=>setNewTodo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addManualTodo()} placeholder="Agregar tarea manualmente..." style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${c}44`,fontSize:13,fontFamily:"inherit",outline:"none",background:"#FAFAFA"}}/>
                <Btn onClick={addManualTodo} color={c} small>+ Add</Btn>
              </div>
            </div>
          )}

          {tab==="new"&&(
            <div>
              {/* Voice recorder */}
              <VoiceRecorder color={c} accent={company.accent} onTranscript={handleTranscript}/>

              <div style={{marginBottom:10}}>
                <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:4}}>Título</label>
                <input value={newConvTitle} onChange={e=>setNewConvTitle(e.target.value)} placeholder={`Reunión con ${client.name} — ${today()}`}
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${c}44`,fontSize:13,fontFamily:"inherit",outline:"none",background:"#FAFAFA",boxSizing:"border-box"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:4}}>
                  Notas o transcripción
                  {newConvNotes&&<span style={{fontWeight:400,color:"#AAA",marginLeft:6}}>({newConvNotes.length} caracteres)</span>}
                </label>
                <textarea value={newConvNotes} onChange={e=>setNewConvNotes(e.target.value)}
                  placeholder={`Escribe notas o pega la transcripción de la reunión con ${client.name}...\n\nEjemplos:\n- Confirmaron interés en la propuesta\n- Necesitan ajuste de precio para julio\n- Hay que enviar contrato la próxima semana`}
                  style={{width:"100%",minHeight:140,padding:"10px 12px",borderRadius:8,border:`1.5px solid ${c}44`,fontSize:13,lineHeight:1.6,fontFamily:"inherit",outline:"none",resize:"vertical",background:company.accent,boxSizing:"border-box"}}/>
              </div>
              <Btn onClick={addConv} color={c} disabled={!newConvNotes.trim()||loadingExtract}>
                {loadingExtract?"⚙️ Extrayendo to-do's con IA...":"💾 Guardar y extraer to-do's automáticamente"}
              </Btn>
              <p style={{fontSize:11,color:"#AAA",marginTop:6}}>
                ✨ La IA extraerá los to-do's automáticamente al guardar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CLIENT CARD ────────────────────────────────────── */
function ClientCard({client,company,onClick}) {
  const pending=(client.todos||[]).filter(t=>!t.done).length;
  const convs=(client.conversations||[]).length;
  const c=company.color;
  return (
    <div onClick={onClick} style={{background:"#fff",borderRadius:12,padding:"12px 14px",border:`1.5px solid ${c}22`,cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:8,transition:"box-shadow 0.15s",boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 20px ${c}22`}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,0.04)"}>
      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${c}22,${c}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:c}}>
        {client.name.charAt(0).toUpperCase()}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:14,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{client.name}</div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginTop:3,flexWrap:"wrap"}}>
          <StagePill stage={client.stage||"Prospecto"}/>
          {convs>0&&<span style={{fontSize:11,color:"#999"}}>💬 {convs}</span>}
        </div>
      </div>
      {pending>0&&<span style={{background:c,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700,flexShrink:0}}>{pending}</span>}
      <span style={{color:"#DDD",fontSize:14,flexShrink:0}}>›</span>
    </div>
  );
}

/* ─── COMPANY PANEL ──────────────────────────────────── */
function CompanyPanel({company,data,onChange}) {
  const [selectedClient,setSelectedClient]=useState(null);
  const [addingClient,setAddingClient]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const totalPending=data.clients.reduce((a,c)=>a+(c.todos||[]).filter(t=>!t.done).length,0);

  const addClient=()=>{
    if(!newClientName.trim()) return;
    const c={id:uid(),name:newClientName.trim(),stage:"Prospecto",conversations:[],todos:[]};
    onChange({...data,clients:[...data.clients,c]});
    setNewClientName(""); setAddingClient(false);
  };
  const updateClient=(updated)=>{onChange({...data,clients:data.clients.map(c=>c.id===updated.id?updated:c)});setSelectedClient(updated);};
  const deleteClient=(id)=>{onChange({...data,clients:data.clients.filter(c=>c.id!==id)});setSelectedClient(null);};

  return (
    <>
      <div style={{background:"#fff",borderRadius:16,boxShadow:`0 2px 24px ${company.color}18`,border:`1.5px solid ${company.color}22`,overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${company.color},${company.dark})`,padding:"16px 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>{company.emoji} Hoja de Ruta</div>
            <div style={{color:"#fff",fontSize:17,fontWeight:800,letterSpacing:"-0.02em"}}>{company.name}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {totalPending>0&&<span style={{background:"rgba(255,255,255,0.2)",color:"#fff",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{totalPending} pendiente{totalPending!==1?"s":""}</span>}
            <span style={{background:"rgba(255,255,255,0.15)",color:"#fff",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>{data.clients.length} cliente{data.clients.length!==1?"s":""}</span>
          </div>
        </div>
        <div style={{padding:"14px 16px 16px"}}>
          {data.clients.length===0?(
            <div style={{textAlign:"center",padding:"24px 16px",color:"#BBB",fontSize:13}}>
              <div style={{fontSize:32,marginBottom:6}}>🏢</div>
              Sin clientes aún.<br/><span style={{fontSize:12}}>Agrega el primero para comenzar</span>
            </div>
          ):(
            <div style={{maxHeight:340,overflowY:"auto",paddingRight:2}}>
              {data.clients.map(client=>(<ClientCard key={client.id} client={client} company={company} onClick={()=>setSelectedClient(client)}/>))}
            </div>
          )}
          {addingClient?(
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input autoFocus value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addClient();if(e.key==="Escape")setAddingClient(false);}} placeholder="Nombre del cliente o empresa..." style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1.5px solid ${company.color}55`,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
              <Btn onClick={addClient} color={company.color} small>Agregar</Btn>
              <Btn onClick={()=>setAddingClient(false)} color="#999" outline small>✕</Btn>
            </div>
          ):(
            <button onClick={()=>setAddingClient(true)} style={{width:"100%",marginTop:8,padding:"9px",borderRadius:10,border:`1.5px dashed ${company.color}55`,background:"transparent",color:company.color,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar cliente</button>
          )}
        </div>
      </div>
      {selectedClient&&(
        <ClientModal key={selectedClient.id} client={selectedClient} company={company} onClose={()=>setSelectedClient(null)} onUpdate={updateClient} onDelete={()=>deleteClient(selectedClient.id)}/>
      )}
    </>
  );
}

/* ─── COMPANY SETTINGS MODAL ─────────────────────────── */
const EMOJI_OPTIONS = ["🔵","🟢","🟡","🟠","🔴","⚫","🟣","🟤","⚪","🏢","🚀","💼","🌐","⚡","🔥"];
const COLOR_PRESETS = [
  "#0057FF","#00B27A","#F5A623","#1A1A1A","#EF4444","#8B5CF6",
  "#EC4899","#14B8A6","#F59E0B","#10B981","#3B82F6","#6366F1",
];

function hexToAccent(hex) {
  // Generate a light accent from hex color
  return hex + "15";
}

function CompanySettingsModal({companies, onClose, onSave}) {
  const [list, setList] = useState(companies.map(c=>({...c})));
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const upd = (id, patch) => setList(list.map(c=>c.id===id?{...c,...patch}:c));

  const addCompany = () => {
    if(!newName.trim()) return;
    const id = "co_"+uid();
    setList([...list, {
      id, name:newName.trim(), short:newName.trim().split(" ")[0],
      color:"#0057FF", accent:"#E8F0FF", dark:"#002B80", emoji:"🏢"
    }]);
    setNewName(""); setAdding(false);
  };

  const removeCompany = (id) => {
    if(list.length<=1) return;
    setList(list.filter(c=>c.id!==id));
  };

  const handleSave = () => {
    const updated = list.map(c=>({...c, accent: c.color+"18", dark: c.color}));
    onSave(updated);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:500,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#1A1A2E,#16213E)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Configuración</div>
            <div style={{color:"#fff",fontSize:18,fontWeight:800}}>Gestión de Empresas</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#fff",fontSize:18}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
          {list.map(c=>(
            <div key={c.id} style={{background:"#FAFAFA",borderRadius:12,padding:"14px",marginBottom:10,border:`1.5px solid ${c.color}33`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                {/* Emoji picker */}
                <div style={{position:"relative"}}>
                  <button onClick={()=>setEditingId(editingId===c.id+"emoji"?null:c.id+"emoji")}
                    style={{width:40,height:40,borderRadius:10,border:`1.5px solid ${c.color}44`,background:c.color+"18",fontSize:20,cursor:"pointer"}}>
                    {c.emoji}
                  </button>
                  {editingId===c.id+"emoji"&&(
                    <div style={{position:"absolute",top:44,left:0,background:"#fff",borderRadius:10,padding:8,boxShadow:"0 8px 32px rgba(0,0,0,0.15)",display:"flex",flexWrap:"wrap",gap:4,width:180,zIndex:10}}>
                      {EMOJI_OPTIONS.map(e=>(
                        <button key={e} onClick={()=>{upd(c.id,{emoji:e});setEditingId(null);}}
                          style={{width:32,height:32,border:"none",background:"transparent",cursor:"pointer",fontSize:18,borderRadius:6}}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Name */}
                <input value={c.name} onChange={e=>upd(c.id,{name:e.target.value,short:e.target.value.split(" ")[0]})}
                  style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${c.color}44`,fontSize:14,fontWeight:700,fontFamily:"inherit",outline:"none",background:"#fff"}}/>
                {list.length>1&&(
                  <button onClick={()=>removeCompany(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DDD",fontSize:18,flexShrink:0}}>🗑</button>
                )}
              </div>
              {/* Color */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Color principal</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {COLOR_PRESETS.map(col=>(
                    <button key={col} onClick={()=>upd(c.id,{color:col})}
                      style={{width:26,height:26,borderRadius:6,background:col,border:c.color===col?"3px solid #333":"2px solid transparent",cursor:"pointer",transition:"all 0.1s"}}/>
                  ))}
                  <input type="color" value={c.color} onChange={e=>upd(c.id,{color:e.target.value})}
                    style={{width:26,height:26,borderRadius:6,border:"none",cursor:"pointer",padding:0,background:"none"}} title="Color personalizado"/>
                </div>
              </div>
            </div>
          ))}

          {adding ? (
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")addCompany();if(e.key==="Escape")setAdding(false);}}
                placeholder="Nombre de la nueva empresa..."
                style={{flex:1,padding:"9px 12px",borderRadius:8,border:"1.5px solid #0057FF55",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
              <Btn onClick={addCompany} color="#0057FF" small>Agregar</Btn>
              <Btn onClick={()=>setAdding(false)} color="#999" outline small>✕</Btn>
            </div>
          ) : (
            <button onClick={()=>setAdding(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #DDD",background:"transparent",color:"#999",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
              + Agregar empresa
            </button>
          )}
        </div>

        <div style={{padding:"12px 18px",borderTop:"1px solid #F0F0F0",display:"flex",gap:8,justifyContent:"flex-end",flexShrink:0}}>
          <Btn onClick={onClose} color="#999" outline>Cancelar</Btn>
          <Btn onClick={handleSave} color="#0057FF">💾 Guardar cambios</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ROOT ───────────────────────────────────────── */
export default function App() {
  const [data,setData]=useState(loadData);
  const [companies,setCompanies]=useState(loadCompanies);
  const [showSettings,setShowSettings]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const syncTimer=useRef(null);

  // Keep COMPANIES in sync with state
  useEffect(()=>{ COMPANIES = companies; saveCompanies(companies); },[companies]);

  // On mount: always load from cloud first
  useEffect(()=>{
    setSyncing(true);
    loadFromCloud().then(cloudData=>{
      if(cloudData && (cloudData.bgh || cloudData._ts)){
        const { _ts, ...cleanData } = cloudData;
        setData(p => {
          // Merge: cloud wins for clients, keep local if cloud is empty
          const merged = {};
          companies.forEach(c => {
            const cloudClients = cleanData[c.id]?.clients || [];
            const localClients = p[c.id]?.clients || [];
            merged[c.id] = { clients: cloudClients.length > 0 ? cloudClients : localClients };
          });
          saveData(merged);
          return merged;
        });
      }
      setSyncing(false); setLastSync(new Date());
    });
  },[]);

  // On every change: save locally + sync to cloud immediately
  useEffect(()=>{
    saveData(data);
    if(syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current=setTimeout(()=>{
      setSyncing(true);
      saveToCloud({...data, _ts: Date.now()}).then(()=>{
        setSyncing(false); setLastSync(new Date());
      });
    },800);
  },[data]);

  // Poll cloud every 30 seconds to catch updates from other devices
  useEffect(()=>{
    const interval = setInterval(()=>{
      loadFromCloud().then(cloudData=>{
        if(!cloudData) return;
        const { _ts, ...cleanData } = cloudData;
        const cloudTs = _ts || 0;
        const localTs = loadData()._ts || 0;
        if(cloudTs > localTs + 2000){ // cloud is newer by >2s
          setData(p => {
            const merged = {};
            companies.forEach(c => {
              merged[c.id] = cleanData[c.id] || { clients: [] };
            });
            saveData({...merged, _ts: cloudTs});
            return merged;
          });
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  },[]);

  const totalPending=companies.reduce((acc,c)=>acc+(data[c.id]?.clients||[]).reduce((a,cl)=>a+(cl.todos||[]).filter(t=>!t.done).length,0),0);

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#F5F7FF 0%,#F0FFF8 50%,#FFF5F0 100%)",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",padding:"0 0 48px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#F5F5F5;border-radius:10px;}
        ::-webkit-scrollbar-thumb{background:#DDD;border-radius:10px;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      {/* Topbar */}
      <div style={{background:"#fff",borderBottom:"1px solid #EFEFEF",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:99,boxShadow:"0 1px 12px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 0"}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#0057FF,#00B27A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🗺️</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#111",letterSpacing:"-0.02em"}}>Roadmap PM</div>
            <div style={{fontSize:11,color:"#999",fontWeight:500}}>Wilmer Rodríguez · Ciclo de negocio por cliente</div>
          </div>
          <button onClick={()=>setShowSettings(true)} title="Gestionar empresas"
            style={{marginLeft:4,background:"#F5F5F5",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ⚙️
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {syncing&&<span style={{fontSize:11,color:"#AAA",display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>⚙️</span> Sync...</span>}
          {!syncing&&lastSync&&<span style={{fontSize:11,color:"#BBB"}}>☁️ Sync</span>}
          {totalPending>0&&<div style={{background:"linear-gradient(135deg,#FF5A1F,#FF8C00)",color:"#fff",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:700}}>{totalPending} pendiente{totalPending!==1?"s":""}</div>}
        </div>
      </div>

      {/* Main */}
      <div style={{maxWidth:1120,margin:"0 auto",padding:"28px 20px 0"}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:26,fontWeight:800,color:"#111",letterSpacing:"-0.03em",margin:"0 0 6px"}}>Hoja de Ruta por Empresa</h1>
          <p style={{color:"#888",fontSize:14,margin:0}}>Ciclo completo por cliente: graba reuniones 🎙️, extrae to-do's automáticamente ✨ y sincroniza en la nube ☁️</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          {companies.map(c=>(<CompanyPanel key={c.id} company={c} data={data[c.id]||{clients:[]}} onChange={nd=>setData(p=>({...p,[c.id]:nd}))}/>))}
        </div>

        {companies.some(c=>(data[c.id]?.clients||[]).length>0)&&(
          <div style={{marginTop:28,background:"#fff",borderRadius:16,border:"1.5px solid #EFEFEF",padding:"18px 22px",boxShadow:"0 2px 16px rgba(0,0,0,0.05)"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#111",marginBottom:14,letterSpacing:"-0.01em"}}>📊 Resumen General</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {companies.map(co=>{
                const clients=data[co.id]?.clients||[];
                if(clients.length===0) return null;
                const pending=clients.reduce((a,c)=>a+(c.todos||[]).filter(t=>!t.done).length,0);
                const done=clients.reduce((a,c)=>a+(c.todos||[]).filter(t=>t.done).length,0);
                const total=pending+done;
                return (
                  <div key={co.id} style={{flex:"1 1 200px",background:co.accent,borderRadius:12,padding:"14px 16px",border:`1px solid ${co.color}22`}}>
                    <div style={{fontSize:12,fontWeight:700,color:co.dark,marginBottom:4}}>{co.emoji} {co.name}</div>
                    <div style={{fontSize:12,color:"#666",marginBottom:8}}>{clients.length} cliente{clients.length!==1?"s":""} · {pending} pendiente{pending!==1?"s":""}</div>
                    {total>0&&(
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                        <div style={{flex:1,height:5,background:"#E5E5E5",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${(done/total)*100}%`,height:"100%",background:co.color,borderRadius:3,transition:"width 0.4s"}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:co.color}}>{done}/{total}</span>
                      </div>
                    )}
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {STAGES.filter(s=>clients.some(c=>(c.stage||"Prospecto")===s)).map(s=>{
                        const n=clients.filter(c=>(c.stage||"Prospecto")===s).length;
                        return <StagePill key={s} stage={`${s} (${n})`}/>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {showSettings&&(
        <CompanySettingsModal
          companies={companies}
          onClose={()=>setShowSettings(false)}
          onSave={(updated)=>setCompanies(updated)}
        />
      )}
    </div>
  );
}
