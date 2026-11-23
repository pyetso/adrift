'use client';
import {useEffect,useRef,useState} from 'react';

export default function OceanScene({bottles,onSelect,onPlace,carrying,focusedId,onLoadComplete}){
  const hostRef=useRef(null);
  const instance=useRef(null);
  const onSelectRef=useRef(onSelect);
  const onPlaceRef=useRef(onPlace);
  const bottlesRef=useRef(bottles);
  const [status,setStatus]=useState('loading');
  function setDirection(direction,active){
    instance.current?.setMovement(direction,active);
  }
  function movementButton(direction,label){
    return <button
      key={direction}
      className={`flight-direction flight-${direction}`}
      type="button"
      aria-label={label}
      onPointerDown={event=>{event.preventDefault();setDirection(direction,true);}}
      onPointerUp={()=>setDirection(direction,false)}
      onPointerCancel={()=>setDirection(direction,false)}
      onPointerLeave={()=>setDirection(direction,false)}
      onBlur={()=>setDirection(direction,false)}
      onClick={event=>{
        if(event.detail!==0)return;
        setDirection(direction,true);
        window.setTimeout(()=>setDirection(direction,false),180);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 11h-5v10h-4V11H5z"/></svg>
    </button>;
  }
  onSelectRef.current=onSelect;
  onPlaceRef.current=onPlace;
  bottlesRef.current=bottles;
  useEffect(()=>{
    let cancelled=false;
    import('../lib/ocean').then(({initOcean})=>{
      if(cancelled)return;
      const ocean=initOcean(hostRef.current,
        b=>onSelectRef.current(b),
        location=>onPlaceRef.current(location));
      if(cancelled){ocean.destroy();return;}
      instance.current=ocean;
      ocean.setBottles(bottlesRef.current);
      setStatus('ready');
      onLoadComplete();
    }).catch(err=>{if(!cancelled){console.error('3D ocean unavailable',err);setStatus('unavailable');onLoadComplete();}});
    return()=>{cancelled=true;instance.current?.destroy();instance.current=null;};
  },[]);
  useEffect(()=>{instance.current?.setBottles(bottles);},[bottles]);
  useEffect(()=>{if(focusedId)instance.current?.focusBottle(focusedId);else instance.current?.clearFocus();},[focusedId]);
  useEffect(()=>{instance.current?.setCarrying(Boolean(carrying));},[carrying]);
  return <>
    <div className="ocean-surface" ref={hostRef} aria-label="Interactive ocean. Drag to look, use WASD to move and arrow keys to adjust your view. On touch screens, swipe and use the movement pad. Select a bottle to read a note." />
    {status==='ready'&&!carrying&&<>
      <p className="exploration-hint"><span className="desktop-hint">Drag to look. WASD to move; arrow keys turn.</span><span className="touch-hint">Swipe to look. Move with the pad.</span></p>
      <div className="flight-pad" role="group" aria-label="Move through the ocean">
        {movementButton('forward','Move forward')}
        {movementButton('left','Move left')}
        {movementButton('right','Move right')}
        {movementButton('backward','Move backward')}
      </div>
    </>}
    <div className={`ocean-fallback ${status==='loading'?'fallback-loading':''} ${status==='ready'?'fallback-finished':''} ${carrying?'fallback-carrying':''}`} role={status==='loading'?'status':undefined} aria-label={status==='loading'?'Loading ocean':undefined} aria-hidden={status==='ready'} onClick={async()=>{if(carrying&&status==='unavailable')await onPlaceRef.current({x:0,z:-8});}}>
      {status==='unavailable'&&<div className="fallback-error">3D graphics aren't available in this browser. Try Chrome or Edge with hardware acceleration enabled.</div>}
    </div>
  </>;
}
