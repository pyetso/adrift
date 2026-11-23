import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSolarPosition,localClockApproximation} from '../lib/solar.mjs';

test('solar direction is repeatable and normalized',()=>{
  const date=new Date('2026-06-21T12:00:00Z');
  const first=calculateSolarPosition(date,40,-74);
  const second=calculateSolarPosition(date,40,-74);
  assert.deepEqual(first,second);
  const magnitude=Math.hypot(first.direction.x,first.direction.y,first.direction.z);
  assert.ok(Math.abs(magnitude-1)<1e-12);
});

test('solar elevation distinguishes daytime and nighttime',()=>{
  assert.ok(calculateSolarPosition(new Date('2026-06-21T17:00:00Z'),40,-74).elevation>0);
  assert.ok(calculateSolarPosition(new Date('2026-06-21T07:00:00Z'),40,-74).elevation<0);
});

test('local-clock approximation needs no browser globals',()=>{
  const day=localClockApproximation(new Date(2026,5,21,12));
  const morning=localClockApproximation(new Date(2026,5,21,6));
  const night=localClockApproximation(new Date(2026,5,21,0));
  assert.ok(day.elevation>0);
  assert.ok(Math.abs(day.direction.x)<1e-12);
  assert.ok(day.direction.z>0);
  assert.ok(morning.direction.x>0);
  assert.ok(night.elevation<0);
  assert.ok(Math.abs(Math.hypot(day.direction.x,day.direction.y,day.direction.z)-1)<1e-12);
});
