'use client';
import {useEffect,useRef,useState} from 'react';

export default function OceanScene({bottles,onSelect,onPlace,carrying,focusedId}){
  const hostRef=useRef(null);
  const instance=useRef(null);
  const onSelectRef=useRef(onSelect);
  const onPlaceRef=useRef(onPlace);
  const bottlesRef=useRef(bottles);
  const [status,setStatus]=useState('loading');
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
    }).catch(err=>{if(!cancelled){console.error('3D ocean unavailable',err);setStatus('unavailable');}});
    return()=>{cancelled=true;instance.current?.destroy();instance.current=null;};
  },[]);
  useEffect(()=>{instance.current?.setBottles(bottles);},[bottles]);
  useEffect(()=>{if(focusedId)instance.current?.focusBottle(focusedId);else instance.current?.clearFocus();},[focusedId]);
  useEffect(()=>{instance.current?.setCarrying(Boolean(carrying));},[carrying]);
  return <>
    <div className="ocean-surface" ref={hostRef} aria-label="Interactive ocean. Click on a floating bottle to read a note." />
    {status!=='ready'&&<div className={`ocean-fallback ${carrying?'fallback-carrying':''}`} role="img" aria-label="An ocean at sunset" onClick={async()=>{if(carrying&&status==='unavailable')await onPlaceRef.current({x:0,z:-8});}}><div className="fallback-haze"/><span className="fallback-sun"/><span className="fallback-water"/>
      {status==='unavailable'&&<div className="fallback-error">3D graphics aren't available in this browser. Try Chrome or Edge with hardware acceleration enabled.</div>}
    </div>}
  </>;
}
