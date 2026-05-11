import { useState, useEffect, useCallback } from "react";

const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function isoDate(y,m,d){ return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function calendarDays(year,month){
  const first=new Date(year,month,1).getDay(), total=new Date(year,month+1,0).getDate(), cells=[];
  for(let i=0;i<first;i++) cells.push(null);
  for(let d=1;d<=total;d++) cells.push(d);
  return cells;
}
function today(){ const n=new Date(); return {y:n.getFullYear(),m:n.getMonth()}; }
function fmtDay(iso){ const d=new Date(iso+"T00:00:00"); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }

// availability shape: { "2026-05-15": ["9:00 AM","2:00 PM"], ... }
const TIMES = Array.from({length:24},(_,i)=>{ const h=i%12||12,p=i<12?"AM":"PM"; return `${h}:00 ${p}`; });
function uid(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function sortedDays(avail){ return Object.keys(avail).sort(); }
function totalSlots(avail){ return Object.values(avail).reduce((s,t)=>s+t.length,0); }

// ── Supabase storage ──────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path, options={}){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers||{}),
    },
  });
  if(!res.ok){ const err=await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function saveEvent(id, data){
  await sbFetch("events", {
    method: "POST",
    body: JSON.stringify({ id, title: data.title, availability: data.availability }),
  });
}

async function loadEvent(id){
  const rows = await sbFetch(`events?id=eq.${id}&limit=1`);
  if(!rows || rows.length===0) return null;
  return { title: rows[0].title, availability: rows[0].availability };
}

async function saveResponse(eventId, guestId, data){
  await sbFetch("responses", {
    method: "POST",
    body: JSON.stringify({ id: guestId, event_id: eventId, name: data.name, availability: data.availability }),
  });
}

async function loadAllResponses(eventId){
  const rows = await sbFetch(`responses?event_id=eq.${eventId}`);
  if(!rows) return [];
  return rows.map(r => ({ name: r.name, availability: r.availability }));
}

// ── Router ────────────────────────────────────────────────────────────────────
function useHash(){
  const [hash,setHash]=useState(window.location.hash.slice(1)||"");
  useEffect(()=>{
    const h=()=>setHash(window.location.hash.slice(1)||"");
    window.addEventListener("hashchange",h);
    return()=>window.removeEventListener("hashchange",h);
  },[]);
  return hash;
}
function navigate(p){ window.location.hash=p; }

// ── Design tokens ─────────────────────────────────────────────────────────────
const C={
  bg:"#141414", surface:"#1c1c1c", surfaceHi:"#242424",
  border:"#2a2a2a", borderHi:"#333",
  accent:"#e8714a", accentBg:"#e8714a18",
  text:"#f0ebe4", textMid:"#8a8480", textDim:"#4a4744",
  green:"#52b788", yellow:"#d4a843",
};
const font="'Plus Jakarta Sans','DM Sans',sans-serif";

// ── Base UI ───────────────────────────────────────────────────────────────────
function Card({ children, style={} }){
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16,...style}}>{children}</div>;
}
function FieldLabel({ children }){
  return <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{children}</div>;
}
function TextInput({ value, onChange, placeholder }){
  const [f,setF]=useState(false);
  return(
    <input value={value} onChange={onChange} placeholder={placeholder}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{display:"block",width:"100%",boxSizing:"border-box",
        background:C.surfaceHi,border:`1.5px solid ${f?C.accent:C.border}`,
        borderRadius:10,padding:"11px 14px",fontSize:14,color:C.text,
        marginBottom:20,outline:"none",fontFamily:font,transition:"border-color .15s"}}/>
  );
}
function Btn({ children, onClick, disabled, variant="primary", fullWidth, style={} }){
  const [hov,setHov]=useState(false);
  const base={fontFamily:font,fontSize:13,fontWeight:600,borderRadius:9,padding:"10px 18px",
    cursor:disabled?"not-allowed":"pointer",transition:"all .15s",outline:"none",border:"none",
    width:fullWidth?"100%":undefined,opacity:disabled?.4:1};
  const v={
    primary:{background:disabled?C.border:hov?"#d4623b":C.accent,color:"#fff"},
    ghost:{background:hov?C.surfaceHi:"transparent",color:hov?C.text:C.textMid,border:`1px solid ${C.border}`},
    danger:{background:hov?"#ff224420":"transparent",color:"#ff4455",border:"1px solid #ff445530"},
  };
  return(
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...base,...v[variant],...style}}>{children}</button>
  );
}
function NavArrow({ children, onClick }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?C.surfaceHi:"transparent",border:`1px solid ${hov?C.borderHi:"transparent"}`,
        cursor:"pointer",width:30,height:30,borderRadius:6,display:"flex",alignItems:"center",
        justifyContent:"center",color:hov?C.text:C.textMid,fontSize:16,transition:"all .12s",fontFamily:font}}>
      {children}
    </button>
  );
}
function Pill({ label, color }){
  return(
    <span style={{background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:99,
      padding:"3px 10px",fontSize:12,color:color||C.textMid,fontWeight:500}}>{label}</span>
  );
}
function SectionTitle({ children }){
  return <div style={{fontSize:11,fontWeight:600,color:C.textMid,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8,marginTop:4}}>{children}</div>;
}
function Centered({ children }){
  return <div style={{padding:80,textAlign:"center",color:C.textMid,fontSize:14}}>{children}</div>;
}
function PageWrap({ children, maxWidth=560, style={} }){
  return <div style={{maxWidth,margin:"0 auto",padding:"36px 20px",...style}}>{children}</div>;
}
function PageHeader({ title, sub, noMargin }){
  return(
    <div style={{marginBottom:noMargin?0:28}}>
      <h2 style={{fontFamily:font,fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>{title}</h2>
      {sub&&<p style={{fontSize:13,color:C.textMid,margin:0}}>{sub}</p>}
    </div>
  );
}
function MonthNav({ cal, onPrev, onNext }){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <NavArrow onClick={onPrev}>‹</NavArrow>
      <span style={{fontSize:13,fontWeight:600,color:C.text}}>{MONTHS[cal.m]} {cal.y}</span>
      <NavArrow onClick={onNext}>›</NavArrow>
    </div>
  );
}
function LinkBox({ label, url }){
  const [copied,setCopied]=useState(false);
  function copy(){ navigator.clipboard.writeText(url).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  return(
    <div style={{marginBottom:14}}>
      {label&&<div style={{fontSize:12,fontWeight:500,color:C.textMid,marginBottom:6}}>{label}</div>}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{flex:1,background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,
          padding:"9px 13px",fontSize:12,color:C.textMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</div>
        <Btn variant={copied?"primary":"ghost"} onClick={copy} style={{padding:"9px 16px",fontSize:12,flexShrink:0}}>
          {copied?"Copied ✓":"Copy link"}
        </Btn>
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function DayCell({ d, state, onToggle }){
  // state: "selected" | "has-times" | "disabled" | "normal"
  const [hov,setHov]=useState(false);
  const bg = state==="has-times" ? C.accent
           : state==="selected"  ? C.accentBg
           : hov&&state!=="disabled" ? C.surfaceHi : "transparent";
  const color = state==="has-times" ? "#fff"
              : state==="selected"  ? C.accent
              : state==="disabled"  ? C.textDim : C.text;
  const border = state==="selected" ? `2px solid ${C.accent}` : "2px solid transparent";
  return(
    <button onClick={onToggle} onMouseEnter={()=>state!=="disabled"&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{aspectRatio:"1",borderRadius:8,border,cursor:state==="disabled"?"default":"pointer",
        background:bg,color,fontWeight:state!=="normal"&&state!=="disabled"?600:400,
        fontSize:13,transition:"all .12s",outline:"none",fontFamily:font}}>{d}</button>
  );
}

function Calendar({ year, month, availability, onToggleDay, isDisabled, selectedDay, onSelectDay }){
  const cells=calendarDays(year,month);
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
      {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:500,color:C.textDim,paddingBottom:6}}>{d}</div>)}
      {cells.map((d,i)=>{
        if(!d) return <div key={`e${i}`}/>;
        const iso=isoDate(year,month,d);
        const dis=isDisabled?isDisabled(iso):false;
        const hasTimes=availability[iso]?.length>0;
        const isSel=selectedDay===iso;
        const state=dis?"disabled":hasTimes?"has-times":isSel?"selected":"normal";
        return(
          <DayCell key={iso} d={d} state={state}
            onToggle={()=>{
              if(dis) return;
              if(onToggleDay) onToggleDay(iso);
              if(onSelectDay) onSelectDay(iso);
            }}/>
        );
      })}
    </div>
  );
}

// ── Time grid (for a single day) ──────────────────────────────────────────────
function TimeCell({ t, sel, avail, onToggle }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onToggle} onMouseEnter={()=>avail&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{border:`1.5px solid ${sel?C.accent:hov?C.borderHi:C.border}`,
        borderRadius:8,padding:"7px 0",background:sel?C.accentBg:"transparent",
        color:sel?C.accent:avail?C.textMid:C.textDim,fontWeight:sel?600:400,fontSize:12,
        cursor:avail?"pointer":"default",transition:"all .12s",outline:"none",fontFamily:font}}>{t}</button>
  );
}
function TimeGrid({ available, selected, onToggle }){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
      {TIMES.map(t=>{
        const avail=!available||available.includes(t), sel=selected.includes(t);
        return <TimeCell key={t} t={t} sel={sel} avail={avail} onToggle={()=>avail&&onToggle(t)}/>;
      })}
    </div>
  );
}

// ── DayTimeEditor — shared by host + guest ────────────────────────────────────
// availability: { iso: [times] }   (what this user has picked so far)
// offered:      { iso: [times] }   (host's offered slots; null = no restriction)
// onToggleDay:  (iso) => void       (add/remove day from availability)
// onToggleTime: (iso, time) => void
function DayTimeEditor({ availability, offered, cal, onPrevMonth, onNextMonth }){
  const days = offered ? Object.keys(offered).sort() : sortedDays(availability);
  const [activeDay, setActiveDay] = useState(null);

  // auto-select first selected day on mount or when availability changes
  useEffect(()=>{
    const selected = sortedDays(availability);
    if(selected.length && (!activeDay || !availability[activeDay])){
      setActiveDay(selected[0]);
    }
  },[]);

  function handleDayClick(iso){
    // If offered is set, only allow days in offered
    if(offered && !offered[iso]) return;
    // Toggle: if day already in availability, selecting it again just activates it in the panel
    setActiveDay(iso);
  }

  const activeTimes = activeDay ? (availability[activeDay]||[]) : [];
  const offeredTimes = activeDay && offered ? (offered[activeDay]||[]) : null;

  return(
    <div>
      <Card>
        <MonthNav cal={cal} onPrev={onPrevMonth} onNext={onNextMonth}/>
        <Calendar year={cal.y} month={cal.m}
          availability={availability}
          selectedDay={activeDay}
          onSelectDay={handleDayClick}
          isDisabled={offered ? iso=>!offered[iso] : undefined}/>
        <div style={{fontSize:11,color:C.textDim,marginTop:10}}>
          {offered ? "Only dates the host offered are selectable" : "Click a date to set times for it"}
        </div>
      </Card>

      {/* Time picker panel */}
      {activeDay ? (
        <Card style={{borderColor:C.borderHi}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{fmtDay(activeDay)}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {activeTimes.length>0&&(
                <Pill label={`${activeTimes.length} selected`} color={C.accent}/>
              )}
              {/* Remove day button — only show if this day has been activated */}
              {availability[activeDay]!==undefined&&(
                <Btn variant="danger" style={{padding:"4px 10px",fontSize:11}}
                  onClick={()=>{ /* handled by parent via onToggleTime clearing all */ }}>
                </Btn>
              )}
            </div>
          </div>
          <TimeGrid available={offeredTimes} selected={activeTimes}
            onToggle={(t)=>{
              // bubble up as a synthetic event — parent handles via onToggleTime
              const evt=new CustomEvent("toggletime",{detail:{iso:activeDay,time:t},bubbles:true});
              document.dispatchEvent(evt);
            }}/>
          {offeredTimes&&offeredTimes.length===0&&(
            <div style={{fontSize:12,color:C.textMid,marginTop:10}}>No times offered for this day.</div>
          )}
        </Card>
      ) : (
        <Card style={{textAlign:"center",padding:28,borderStyle:"dashed"}}>
          <div style={{fontSize:13,color:C.textMid}}>
            {Object.keys(availability).length===0
              ? "Click a date above to select times for it"
              : "Click a date to view or edit its times"}
          </div>
        </Card>
      )}

      {/* Summary of all selected day+times */}
      {sortedDays(availability).length>0&&(
        <div style={{marginTop:4}}>
          <SectionTitle>Your selections</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedDays(availability).map(iso=>(
              <div key={iso} style={{display:"flex",alignItems:"center",gap:10,
                background:activeDay===iso?C.surfaceHi:C.surface,
                border:`1px solid ${activeDay===iso?C.borderHi:C.border}`,
                borderRadius:8,padding:"8px 12px",cursor:"pointer"}}
                onClick={()=>setActiveDay(iso)}>
                <div style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{fmtDay(iso)}</div>
                <div style={{fontSize:12,color:availability[iso]?.length?C.accent:C.textDim}}>
                  {availability[iso]?.length
                    ? `${availability[iso].length} time${availability[iso].length!==1?"s":""}`
                    : "no times yet"}
                </div>
                <div style={{fontSize:11,color:C.textDim}}>›</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Host Create ───────────────────────────────────────────────────────────────
function HostCreate(){
  const [cal,setCal]=useState(today());
  // availability: { iso: [times] }
  const [availability,setAvailability]=useState({});
  const [title,setTitle]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(null);

  // Listen for time toggle events from DayTimeEditor
  useEffect(()=>{
    function onToggle(e){
      const {iso,time}=e.detail;
      setAvailability(prev=>{
        const times=prev[iso]||[];
        const next=times.includes(time)?times.filter(t=>t!==time):[...times,time];
        // If no times remain for this day, keep the key but empty (so day stays visible)
        return {...prev,[iso]:next};
      });
    }
    document.addEventListener("toggletime",onToggle);
    return()=>document.removeEventListener("toggletime",onToggle);
  },[]);

  function handleDayClick(iso){
    setAvailability(prev=>{
      if(iso in prev){
        // day already exists — clicking just selects it in the panel, don't remove
        return prev;
      }
      // Add day with empty times
      return {...prev,[iso]:[]};
    });
  }

  function removeDay(iso){
    setAvailability(prev=>{ const n={...prev}; delete n[iso]; return n; });
  }

  const days=sortedDays(availability);
  const slots=totalSlots(availability);
  const ready=title.trim()&&days.length>0&&slots>0;

  async function create(){
    if(!ready) return;
    setSaving(true);
    const id=uid();
    await saveEvent(id,{title:title.trim(),availability,created:Date.now()});
    setDone(id); setSaving(false);
  }

  if(done){
    const guestUrl=`${location.origin}${location.pathname}#guest/${done}`;
    const hostUrl=`${location.origin}${location.pathname}#results/${done}`;
    return(
      <PageWrap>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:13,fontWeight:500,color:C.green,marginBottom:6}}>✓ Poll created</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>You're all set!</div>
          <div style={{fontSize:14,color:C.textMid}}>Share the guest link and check back for results.</div>
        </div>
        <Card><LinkBox label="Share with guests" url={guestUrl}/></Card>
        <Card><LinkBox label="Your results page — save this link" url={hostUrl}/></Card>
        <Btn variant="ghost" onClick={()=>navigate("")}>← Create another</Btn>
      </PageWrap>
    );
  }

  return(
    <PageWrap>
      <PageHeader title="New availability poll" sub="Pick your available days and the times for each one."/>

      <FieldLabel>Event name</FieldLabel>
      <TextInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Coffee catch-up, team sync…"/>

      <FieldLabel>Your availability</FieldLabel>
      <DayTimeEditor
        availability={availability}
        offered={null}
        cal={cal}
        onPrevMonth={()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1})}
        onNextMonth={()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1})}
      />

      {/* Remove-day buttons */}
      {days.length>0&&(
        <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>
          {days.map(iso=>(
            <button key={iso} onClick={()=>removeDay(iso)}
              style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,
                padding:"4px 10px",fontSize:11,color:C.textMid,cursor:"pointer",fontFamily:font,
                display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:C.textDim}}>✕</span> {fmtDay(iso)}
            </button>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:8,margin:"20px 0",flexWrap:"wrap"}}>
        <Pill label={`${days.length} day${days.length!==1?"s":""}`}/>
        <Pill label={`${slots} time slot${slots!==1?"s":""}`}/>
      </div>

      <Btn onClick={create} disabled={saving||!ready} fullWidth style={{padding:"13px"}}>
        {saving?"Creating…":"Create poll & get link"}
      </Btn>
    </PageWrap>
  );
}

// ── Guest View ────────────────────────────────────────────────────────────────
function GuestView({ eventId }){
  const [event,setEvent]=useState(null);
  const [loading,setLoading]=useState(true);
  const [name,setName]=useState("");
  // availability: { iso: [times] } — guest's selections
  const [availability,setAvailability]=useState({});
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const [cal,setCal]=useState(today());

  useEffect(()=>{
    loadEvent(eventId).then(e=>{
      setEvent(e); setLoading(false);
      if(e?.availability){
        const firstDay=Object.keys(e.availability).sort()[0];
        if(firstDay){ const d=new Date(firstDay+"T00:00:00"); setCal({y:d.getFullYear(),m:d.getMonth()}); }
        // Pre-populate availability keys (empty) for all host days so calendar shows them
        const init={};
        Object.keys(e.availability).forEach(iso=>{ init[iso]=[]; });
        setAvailability(init);
      }
    });
  },[eventId]);

  // Listen for time toggle events
  useEffect(()=>{
    function onToggle(e){
      const {iso,time}=e.detail;
      setAvailability(prev=>{
        const times=prev[iso]||[];
        const next=times.includes(time)?times.filter(t=>t!==time):[...times,time];
        return {...prev,[iso]:next};
      });
    }
    document.addEventListener("toggletime",onToggle);
    return()=>document.removeEventListener("toggletime",onToggle);
  },[]);

  const slots=totalSlots(availability);

  async function submit(){
    if(!name.trim()) return;
    setSaving(true);
    await saveResponse(eventId,uid(),{name:name.trim(),availability,submitted:Date.now()});
    setDone(true); setSaving(false);
  }

  if(loading) return <Centered>Loading…</Centered>;
  if(!event)  return <Centered>Event not found.</Centered>;
  if(done) return(
    <PageWrap style={{textAlign:"center",paddingTop:80}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.green+"22",border:`1px solid ${C.green}44`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 20px"}}>✓</div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Response saved!</div>
      <div style={{fontSize:14,color:C.textMid}}>Thanks for filling out <span style={{color:C.text,fontWeight:500}}>{event.title}</span>.</div>
    </PageWrap>
  );

  const offeredDays=Object.keys(event.availability).sort();

  return(
    <PageWrap>
      <PageHeader title={event.title} sub="Select the times that work for you on each day."/>

      <FieldLabel>Your name</FieldLabel>
      <TextInput value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <FieldLabel>Your availability</FieldLabel>
        <span style={{fontSize:12,color:C.textMid,marginBottom:8}}>{offeredDays.length} day{offeredDays.length!==1?"s":""} offered</span>
      </div>

      <DayTimeEditor
        availability={availability}
        offered={event.availability}
        cal={cal}
        onPrevMonth={()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1})}
        onNextMonth={()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1})}/>

      <div style={{display:"flex",gap:8,margin:"20px 0",flexWrap:"wrap"}}>
        <Pill label={`${slots} time slot${slots!==1?"s":""} selected`} color={slots>0?C.accent:C.textMid}/>
      </div>

      <Btn onClick={submit} disabled={saving||!name.trim()||slots===0} fullWidth style={{padding:"13px"}}>
        {saving?"Submitting…":"Submit availability"}
      </Btn>
    </PageWrap>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsView({ eventId }){
  const [event,setEvent]=useState(null);
  const [responses,setResponses]=useState([]);
  const [loading,setLoading]=useState(true);

  const reload=useCallback(async()=>{
    setLoading(true);
    const [e,r]=await Promise.all([loadEvent(eventId),loadAllResponses(eventId)]);
    setEvent(e); setResponses(r); setLoading(false);
  },[eventId]);

  useEffect(()=>{ reload(); },[reload]);

  if(loading) return <Centered>Loading…</Centered>;
  if(!event)  return <Centered>Event not found.</Centered>;

  const n=responses.length||1;

  // Build slot counts: { "2026-05-15|9:00 AM": count }
  const slotCount={};
  for(const r of responses){
    for(const [iso,times] of Object.entries(r.availability||{})){
      for(const t of times){
        const key=`${iso}|${t}`;
        slotCount[key]=(slotCount[key]||0)+1;
      }
    }
  }

  function barColor(count){
    if(!responses.length) return C.border;
    const p=count/responses.length;
    return p===1?C.green:p>=.5?C.yellow:C.accent;
  }

  const offeredDays=Object.keys(event.availability).sort();

  return(
    <PageWrap maxWidth={680}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:28}}>
        <PageHeader title={event.title} sub={`${responses.length} response${responses.length!==1?"s":""} so far`} noMargin/>
        <Btn variant="ghost" onClick={reload}>Refresh</Btn>
      </div>

      {responses.length===0?(
        <Card style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:13,color:C.textMid}}>No responses yet — share the guest link below.</div>
        </Card>
      ):(
        <>
          <SectionTitle>Availability by day</SectionTitle>
          {offeredDays.map(iso=>{
            const offeredTimes=event.availability[iso]||[];
            return(
              <Card key={iso} style={{marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>{fmtDay(iso)}</div>
                {offeredTimes.length===0?(
                  <div style={{fontSize:12,color:C.textDim}}>No times were offered for this day.</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    {offeredTimes.map(t=>{
                      const key=`${iso}|${t}`;
                      const count=slotCount[key]||0;
                      const pct=count/responses.length*100;
                      return(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:72,fontSize:12,color:C.textMid,flexShrink:0}}>{t}</div>
                          <div style={{flex:1,background:C.surfaceHi,borderRadius:99,height:7,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:99,background:barColor(count),width:`${pct}%`,transition:"width .35s"}}/>
                          </div>
                          <div style={{fontSize:12,color:barColor(count),fontWeight:600,width:36,textAlign:"right"}}>{count}/{responses.length}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          <SectionTitle style={{marginTop:20}}>Who responded</SectionTitle>
          <Card>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {responses.map((r,i)=>{
                const total=totalSlots(r.availability||{});
                const days=Object.keys(r.availability||{}).length;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                    background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:C.accent,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>
                      {r.name?.[0]?.toUpperCase()||"?"}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:C.text}}>{r.name}</div>
                      <div style={{fontSize:11,color:C.textMid}}>{days}d · {total} slot{total!==1?"s":""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20,marginTop:4}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:10}}>Guest link to share</div>
        <LinkBox url={`${location.origin}${location.pathname}#guest/${eventId}`}/>
      </div>
    </PageWrap>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
function Landing(){
  return(
    <div style={{maxWidth:440,margin:"0 auto",padding:"90px 20px 60px",textAlign:"center"}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.accent,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:24,margin:"0 auto 24px",boxShadow:`0 8px 24px ${C.accent}44`}}>📅</div>
      <h1 style={{fontFamily:font,fontSize:36,fontWeight:800,color:C.text,margin:"0 0 12px",letterSpacing:"-.02em"}}>
        Gettogether
      </h1>
      <p style={{fontSize:15,color:C.textMid,lineHeight:1.75,margin:"0 0 40px"}}>
        The simplest way to find a time that works.<br/>
        Set your availability, share a link, done.
      </p>
      <Btn onClick={()=>navigate("create")} style={{padding:"13px 32px",fontSize:14}}>Create a poll</Btn>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const hash=useHash();
  const [,route,param]=hash.match(/^([^/]*)\/?(.*)$/)||[];
  let view;
  if(!route||route==="")    view=<Landing/>;
  else if(route==="create") view=<HostCreate/>;
  else if(route==="guest")  view=<GuestView eventId={param}/>;
  else if(route==="results")view=<ResultsView eventId={param}/>;
  else                       view=<Centered>Page not found.</Centered>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:font}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input::placeholder { color: #4a4744; }
        ::-webkit-scrollbar { width:6px; background:#141414; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
        ::selection { background:#e8714a33; }
      `}</style>
      <header style={{position:"sticky",top:0,zIndex:10,background:"#141414e8",backdropFilter:"blur(12px)",
        borderBottom:`1px solid #2a2a2a`,padding:"0 24px",height:52,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>navigate("")} style={{background:"none",border:"none",cursor:"pointer",
          display:"flex",alignItems:"center",gap:10,padding:0}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.accent,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📅</div>
          <span style={{fontFamily:font,fontWeight:700,fontSize:15,color:C.text}}>Gettogether</span>
        </button>
        <Btn variant="ghost" onClick={()=>navigate("create")} style={{padding:"6px 14px",fontSize:12}}>+ New poll</Btn>
      </header>
      {view}
    </div>
  );
}
