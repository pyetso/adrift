import {OCEAN_BOUNDS} from './ocean-bounds.mjs';

function clamp(value,min,max) {
  return Math.max(min,Math.min(max,value));
}

function currentWave(age,frequency,phase) {
  return Math.sin(age*frequency+phase)-Math.sin(phase);
}

export function bottleCurrentPosition(bottle,nowSeconds=Date.now()/1000,{reducedMotion=false}={}) {
  const savedX=Number(bottle?.start_x),savedZ=Number(bottle?.start_z);
  const startX=Number.isFinite(savedX)?savedX:0;
  const startZ=Number.isFinite(savedZ)?savedZ:-6;
  if(reducedMotion)return {x:startX,z:startZ};

  const createdAt=Date.parse(bottle?.created_at||'')/1000;
  const age=Math.max(0,Number.isFinite(createdAt)?nowSeconds-createdAt:0);
  const seed=Number(bottle?.drift_seed)||1;
  const x=startX
    +25*currentWave(age,.0015,seed)
    +12*currentWave(age,.00052,seed*.77)
    +4*currentWave(age,.007,seed*2.2);
  const z=startZ
    +43*currentWave(age,.0011,seed*1.3)
    +22*currentWave(age,.00037,seed*.8+2.1)
    +5*currentWave(age,.005,seed*2.4);
  return {
    x:clamp(x,OCEAN_BOUNDS.minX,OCEAN_BOUNDS.maxX),
    z:clamp(z,OCEAN_BOUNDS.minZ,OCEAN_BOUNDS.maxZ),
  };
}
