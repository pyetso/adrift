import test from 'node:test';
import assert from 'node:assert/strict';
import {stepDropMotion} from '../lib/drop-motion.mjs';

test('airborne bottle descends under gravity',()=>{
  const next=stepDropMotion({phase:'airborne',y:3,velocity:0,startY:3},.1,0);
  assert.ok(next.y<3);
  assert.ok(next.velocity<0);
  assert.equal(next.impacted,false);
});

test('first surface crossing clamps and reports one impact',()=>{
  const landed=stepDropMotion({phase:'airborne',y:.1,velocity:-2,startY:.1},.1,0);
  assert.equal(landed.y,0);
  assert.equal(landed.phase,'settling');
  assert.equal(landed.impacted,true);
  const following=stepDropMotion(landed,.016,0);
  assert.equal(following.impacted,false);
});

test('damped bounce settles within 1.1 seconds without sinking',()=>{
  let state={phase:'airborne',y:1,velocity:0,startY:1};
  let impactTime=null;
  const dt=1/120;
  for(let elapsed=0;elapsed<2;elapsed+=dt){
    state=stepDropMotion(state,dt,0);
    if(state.impacted)impactTime=elapsed;
    assert.ok(state.y>=0);
  }
  assert.ok(impactTime!==null);
  assert.equal(state.phase,'settled');
  assert.equal(state.y,0);
});
