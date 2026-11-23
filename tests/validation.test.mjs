import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBottle,validateEdit,positionForNewBottle} from '../lib/validation.mjs';
test('validates a short letter',()=>{
  const result=validateBottle({message:'  Hello, ocean.  ',mood:'wish',author_name:'  Someone  '});
  assert.deepEqual(result.value,{message:'Hello, ocean.',mood:'wish',author_name:'Someone'});
});
test('rejects letters that are too long',()=>{
  assert.match(validateBottle({message:'x'.repeat(401)}).error,/between/);
});
test('rejects HTML in place of a string and unexpected message types',()=>{
  assert.ok(validateBottle({message:{content:'hi'}}).error);
  assert.ok(validateBottle({message:'Hello',mood:'nope'}).error);
});
test('edit changes message only',()=>{
  assert.deepEqual(validateEdit({message:'  New message  ',mood:'secret'}).value,{message:'New message'});
});
test('new bottle positions stay inside ocean range',()=>{
  for(let i=0;i<500;i++){
    const pos=positionForNewBottle();
    assert.ok(pos.start_x>=-30 && pos.start_x<=30);
    assert.ok(pos.start_z<=20 && pos.start_z>=-100);
    assert.ok(pos.drift_seed>0);
  }
});
test('a bottle can be placed where the visitor clicked, with safe coordinates',()=>{
  const p=positionForNewBottle({start_x:24.65,start_z:-82.4});
  assert.equal(p.start_x,24.65);
  assert.equal(p.start_z,-82.4);
  const outside=positionForNewBottle({start_x:999,start_z:-999});
  assert.equal(outside.start_x,30);
  assert.equal(outside.start_z,-100);
});
