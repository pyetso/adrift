import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleCurrentPosition} from '../lib/bottle-drift.mjs';
import {OCEAN_BOUNDS} from '../lib/ocean-bounds.mjs';

const bottle={start_x:0,start_z:-12,drift_seed:4.6,created_at:'2026-01-01T00:00:00Z'};
const createdAt=Date.parse(bottle.created_at)/1000;

test('bottles begin at their release point and follow a repeatable current',()=>{
  assert.deepEqual(bottleCurrentPosition(bottle,createdAt),{x:0,z:-12});
  const first=bottleCurrentPosition(bottle,createdAt+1200);
  const repeated=bottleCurrentPosition(bottle,createdAt+1200);
  assert.deepEqual(first,repeated);
  assert.notDeepEqual(first,{x:0,z:-12});
});

test('current drift remains inside the navigable ocean',()=>{
  for(let hours=0;hours<=72;hours++){
    const position=bottleCurrentPosition(bottle,createdAt+hours*3600);
    assert.ok(position.x>=OCEAN_BOUNDS.minX&&position.x<=OCEAN_BOUNDS.maxX);
    assert.ok(position.z>=OCEAN_BOUNDS.minZ&&position.z<=OCEAN_BOUNDS.maxZ);
  }
});

test('reduced motion holds each bottle at its release point',()=>{
  assert.deepEqual(bottleCurrentPosition(bottle,createdAt+3600,{reducedMotion:true}),{x:0,z:-12});
});
