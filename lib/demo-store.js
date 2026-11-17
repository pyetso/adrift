// Browser-only preview. This is NOT a shared database.
import {positionForNewBottle} from './validation.mjs';
const KEY='adrift-demo-letters-v1';
function read() {
  try {return JSON.parse(localStorage.getItem(KEY) || '[]').filter(x=>x && x.id && x.message);} catch {return [];}
}
function write(items) {localStorage.setItem(KEY,JSON.stringify(items));}
export function getDemoLetters(){return read();}
export function createDemoLetter(payload,position={}){
  const bottle={id:crypto.randomUUID(),...payload,...positionForNewBottle(position),created_at:new Date().toISOString(),demo:true};
  write([bottle,...read()].slice(0,60));return bottle;
}
export function editDemoLetter(id,message){
  const bottles=read().map(b=>b.id===id?{...b,message}:b);write(bottles);
  return bottles.find(b=>b.id===id);
}
export function deleteDemoLetter(id){write(read().filter(b=>b.id!==id));}
