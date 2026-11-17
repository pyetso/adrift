'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import OceanScene from './OceanScene';
import {getAccessToken,isCloudConfigured} from '../lib/supabase-browser';
import {getDemoLetters,createDemoLetter,editDemoLetter,deleteDemoLetter} from '../lib/demo-store';
import {MAX_MESSAGE_LENGTH,validateBottle,validateEdit} from '../lib/validation.mjs';
import {samples} from '../lib/samples';

const cloud=isCloudConfigured();
const SEAL_DURATION=1850;
const CLOSE_DURATION=620;
const dateLabel=value=>{
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'Some time ago':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};
async function request(path,options={}){
  const headers={...(options.body?{'Content-Type':'application/json'}:{}),...options.headers};
  const response=await fetch(path,{...options,headers,cache:'no-store'});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||`Request failed (${response.status}).`);
  return body;
}
function PenAndPaper(){
  return <svg viewBox="0 0 108 105" fill="none" aria-hidden="true" className="pen-illustration">
    <path d="M19 19 70 12 81 74 29 84Z" fill="#E9D4AA" stroke="#87694C" strokeWidth="2.5"/>
    <path d="M14 15 65 9 76 71 24 81Z" fill="#FFF7E4" stroke="#AC9777" strokeWidth="2"/>
    <path d="m25 34 34-4M27 44l34-4M29 54l26-3" stroke="#BEA889" strokeWidth="2" strokeLinecap="round"/>
    <path d="m50 83 38-53 7 5-37 54-12 7Z" fill="#4C3F32" stroke="#271F1B" strokeWidth="2"/>
    <path d="m88 30 5-8c2-3 7 0 5 3l-5 10" fill="#C6A56D"/>
    <path d="m50 83-4 13 12-7" fill="#D8B47B" stroke="#271F1B" strokeWidth="1.7"/>
    <path d="m46 96 3-9 5 4" fill="#201B16"/>
  </svg>;
}
function AnimatedBottle(){
  return <svg viewBox="0 0 170 210" className="seal-bottle-svg" aria-hidden="true">
    <defs><linearGradient id="glass" x1="0" x2="1"><stop stopColor="#99D5D0" stopOpacity=".18"/><stop offset=".28" stopColor="#DDF5E9" stopOpacity=".57"/><stop offset=".72" stopColor="#B4DAD7" stopOpacity=".22"/><stop offset="1" stopColor="#E4F4E5" stopOpacity=".5"/></linearGradient></defs>
    <path d="M69 16h32v49c0 9 8 13 15 19 11 10 18 18 18 34v63c0 12-8 20-20 20H56c-12 0-20-8-20-20v-63c0-16 7-24 18-34 7-6 15-10 15-19Z" fill="url(#glass)" stroke="#8CB7B6" strokeWidth="3"/>
    <path d="M49 116v64q0 9 9 9" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".6"/>
    <g className="bottle-scroll"><rect x="67" y="102" width="36" height="71" rx="8" fill="#EBDCBF" stroke="#BBA17E" strokeWidth="2"/><path d="M74 119h22M74 128h17M74 137h19" stroke="#B9A58D" strokeWidth="1.7" strokeLinecap="round"/></g>
    <g className="bottle-cork"><rect x="65" y="1" width="40" height="26" rx="4" fill="#AF8355"/><path d="M70 6v14M79 4v18M94 6v13" stroke="#D4AE79" strokeWidth="2" opacity=".75"/></g>
  </svg>;
}

export default function AdriftApp(){
  const [letters,setLetters]=useState([]);
  const [modal,setModal]=useState(null); // write | read | mine
  const [selected,setSelected]=useState(null);
  const [readPhase,setReadPhase]=useState('open'); // open | closing
  const [sealing,setSealing]=useState(false);
  const [carrying,setCarrying]=useState(null);
  const [draft,setDraft]=useState(null);
  const [editing,setEditing]=useState(null);
  const [message,setMessage]=useState('');
  const [author,setAuthor]=useState('');
  const [own,setOwn]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const dialogRef=useRef(null);
  const timers=useRef([]);
  const isPlacing=useRef(false);
  const shown=useMemo(()=>[...letters,...samples.slice(0,Math.max(0,8-letters.length))].slice(0,38),[letters]);
  function after(callback,delay){const id=setTimeout(callback,delay);timers.current.push(id);return id;}
  function notify(value){setToast(value);after(()=>setToast(''),3600);}
  async function refresh(){
    try{
      if(!cloud){setLetters(getDemoLetters());return;}
      const result=await request('/api/bottles');setLetters(result.bottles||[]);
    }catch(err){console.warn('Could not load the shared ocean:',err);}
  }
  useEffect(()=>{
    refresh();const interval=setInterval(refresh,30000);
    return()=>{clearInterval(interval);timers.current.forEach(clearTimeout);};
  },[]);
  useEffect(()=>{
    if(!modal)return;
    const handleKey=e=>{
      if(e.key==='Escape'){
        if(modal==='read')closeRead();else if(!sealing)closePanel();
        return;
      }
      if(e.key==='Tab'&&dialogRef.current){
        const els=[...dialogRef.current.querySelectorAll('button:not([disabled]),textarea:not([disabled]),input:not([disabled])')];
        if(!els.length)return;
        if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els[els.length-1].focus();}
        else if(!e.shiftKey&&document.activeElement===els[els.length-1]){e.preventDefault();els[0].focus();}
      }
    };
    document.addEventListener('keydown',handleKey);
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const id=setTimeout(()=>dialogRef.current?.querySelector(modal==='write'?'textarea':'.paper-close')?.focus(),120);
    return()=>{document.removeEventListener('keydown',handleKey);document.body.style.overflow=previous;clearTimeout(id);};
  },[modal,sealing]);
  useEffect(()=>{
    if(!carrying)return;
    const key=e=>{if(e.key==='Escape'&&!isPlacing.current){setCarrying(null);setDraft(null);notify('The letter was not released.');}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[carrying]);

  function closePanel(){setModal(null);setError('');setEditing(null);}
  function compose(){
    if(carrying)return;
    setEditing(null);setMessage('');setAuthor('');setError('');setSealing(false);setModal('write');
  }
  function beginRead(b){
    if(carrying)return;
    setSelected(b);setError('');setReadPhase('open');setModal('read');
  }
  function closeRead(){
    if(readPhase==='closing')return;
    setReadPhase('closing');
    after(()=>{setModal(null);setSelected(null);setReadPhase('open');setError('');},CLOSE_DURATION);
  }
  function editLetter(b){setEditing(b);setMessage(b.message);setAuthor(b.author_name||'');setError('');setModal('write');}
  async function openMine(){
    setModal('mine');setError('');
    if(!cloud){setOwn(getDemoLetters());return;}
    setBusy(true);
    try{
      const token=await getAccessToken();
      const result=await request('/api/bottles/mine',{headers:{Authorization:`Bearer ${token}`}});
      setOwn(result.bottles||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function submitLetter(event){
    event.preventDefault();
    const parsed=editing?validateEdit({message}):validateBottle({message,author_name:author,mood:'hope'});
    if(parsed.error){setError(parsed.error);return;}
    setError('');
    if(editing){
      setBusy(true);
      try{
        if(!cloud){editDemoLetter(editing.id,parsed.value.message);setLetters(getDemoLetters());}
        else{
          const token=await getAccessToken();
          await request(`/api/bottles/${editing.id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(parsed.value)});
          await refresh();
        }
        closePanel();notify('Changes saved.');
      }catch(e){setError(e.message);}finally{setBusy(false);}
      return;
    }
    // The letter remains an unsent draft until the visitor actually drops it.
    setDraft(parsed.value);setSealing(true);
    after(()=>{
      setModal(null);setSealing(false);setCarrying({token:Date.now()});
    },SEAL_DURATION);
  }
  async function placeBottle(location){
    if(!draft||isPlacing.current)return null;
    isPlacing.current=true;setBusy(true);
    try{
      const payload={...draft,start_x:location.x,start_z:location.z};
      let bottle;
      if(!cloud){bottle=createDemoLetter(payload,location);setLetters(getDemoLetters());}
      else{
        const token=await getAccessToken();
        const result=await request('/api/bottles',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});
        bottle=result.bottle;
        setLetters(previous=>[bottle,...previous].slice(0,80));
      }
      setCarrying(null);setDraft(null);
      notify('Your letter is now adrift.');
      return bottle;
    }catch(e){notify(`The bottle could not be released: ${e.message}`);return null;}
    finally{isPlacing.current=false;setBusy(false);}
  }
  async function removeLetter(b){
    if(!window.confirm('Remove this letter from the ocean?'))return;
    setBusy(true);
    try{
      if(!cloud){deleteDemoLetter(b.id);setOwn(getDemoLetters());setLetters(getDemoLetters());}
      else{
        const token=await getAccessToken();
        await request(`/api/bottles/${b.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
        setOwn(previous=>previous.filter(x=>x.id!==b.id));
        setLetters(previous=>previous.filter(x=>x.id!==b.id));
      }
      notify('Letter removed.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function reportLetter(){
    if(!selected||selected.id.startsWith('sample-')||!cloud)return;
    if(!window.confirm('Report this letter for review?'))return;
    setBusy(true);
    try{
      const token=await getAccessToken();
      await request(`/api/bottles/${selected.id}/report`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      closeRead();notify('Report received.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }

  return <main className={`site-shell ${carrying?'is-carrying':''}`}>
    <OceanScene bottles={shown} onSelect={beginRead} onPlace={placeBottle}
      carrying={carrying} focusedId={modal==='read'&&readPhase!=='closing'?selected?.id:null} />
    <div className="screen-vignette" aria-hidden="true" />

    {!carrying&&<button className="write-trigger" onClick={compose} type="button" aria-label="Write a letter" title="Write a letter">
      <PenAndPaper />
    </button>}
    {carrying&&<div className="release-hint" role="status">Drag the bottle to the water, then release to let it go.<button disabled={busy} onClick={()=>{setCarrying(null);setDraft(null);}}>Cancel</button></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}

    {modal&&<div className={`modal-layer ${modal==='read'?'reader-layer':''} ${sealing?'sealing-layer':''}`} role="presentation" onMouseDown={e=>{
      if(e.currentTarget===e.target&&!sealing){if(modal==='read')closeRead();else closePanel();}
    }}>
      <div className={`paper-dialog ${modal==='read'?'reader-dialog':''} ${modal==='mine'?'mine-dialog':''} ${sealing?'sealing-dialog':''} ${readPhase==='closing'?'reader-closing':''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-label={modal==='write'?'Write a letter':modal==='read'?'Read a letter':'My letters'}>
        {!sealing&&<button className="paper-close" type="button" onClick={modal==='read'?closeRead:closePanel} aria-label="Close">×</button>}
        {modal==='write'&&<form className="writing-paper" onSubmit={submitLetter}>
          <div className="paper-topline">A note to the sea</div>
          <p className="handwritten greeting">Dear stranger,</p>
          <textarea autoFocus className="handwritten letter-writing" placeholder="I've been meaning to say..." aria-label="Write your message" maxLength={MAX_MESSAGE_LENGTH} value={message} onChange={e=>setMessage(e.target.value)} disabled={sealing||busy} />
          <div className="paper-signature"><span className="handwritten">Yours,</span><input className="handwritten" placeholder="a stranger" aria-label="Your name (optional)" value={author} onChange={e=>setAuthor(e.target.value)} maxLength={32} disabled={sealing||busy||Boolean(editing)}/></div>
          {error&&<p className="form-error" role="alert">{error}</p>}
          <div className="paper-bottomline"><button className="quiet-link" type="button" onClick={openMine} disabled={sealing}>My letters</button><span>{message.length}/{MAX_MESSAGE_LENGTH}</span></div>
          <button className="cast-button" type="submit" disabled={busy||sealing}>{editing?'Save this letter':'Seal the letter'}</button>
        </form>}
        {modal==='read'&&selected&&<article className="reading-paper">
          <div className="paper-topline">A letter from somewhere</div>
          <p className="handwritten greeting">To whoever finds this,</p>
          <blockquote className="handwritten found-message">{selected.message}</blockquote>
          <p className="handwritten found-signature">Yours,<br/>{selected.author_name||'A stranger'}</p>
          <div className="paper-bottomline"><span>{dateLabel(selected.created_at)}</span><div className="paper-links">{cloud&&!selected.id.startsWith('sample-')&&<button className="quiet-link" onClick={reportLetter} disabled={busy}>Report</button>}<button className="quiet-link" onClick={closeRead}>Return to the sea</button></div></div>
          {error&&<p className="form-error" role="alert">{error}</p>}
        </article>}
        {modal==='mine'&&<section className="mine-content">
          <div className="paper-topline">Your letters</div>
          <h2 className="handwritten greeting">Letters you've released</h2>
          {busy&&<p>Looking for your letters...</p>}
          {error&&<p className="form-error" role="alert">{error}</p>}
          {!busy&&own.length===0&&<p className="empty-note">The sea is waiting for your first letter.</p>}
          <div className="mine-list">{own.map(b=><article className="mine-letter" key={b.id}>
            <p className="handwritten">{b.message}</p>
            <div><span>{dateLabel(b.created_at)}</span><button onClick={()=>editLetter(b)}>Edit</button><button onClick={()=>removeLetter(b)} disabled={busy}>Remove</button></div>
          </article>)}</div>
          <button className="cast-button" onClick={compose} type="button">Write another</button>
        </section>}
      </div>
      {sealing&&<div className="sealing-visual" aria-live="polite" aria-label="Rolling the paper and sealing it inside a bottle"><span className="rolling-sheet"/><AnimatedBottle/><span className="sealing-caption">Sealing your words…</span></div>}
    </div>}
  </main>;
}
