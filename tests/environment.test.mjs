import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ENVIRONMENT,normalizeEnvironment,environmentVisuals} from '../lib/environment.mjs';
test('forecast normalization supports partial and missing feeds',()=>{
  const output=normalizeEnvironment({current:{cloud_cover:80,wind_speed_10m:23}},{});
  assert.equal(output.cloudCover,80);
  assert.equal(output.waveHeight,DEFAULT_ENVIRONMENT.waveHeight);
});
test('forecast values are bounded to safe animation ranges',()=>{
  const e=normalizeEnvironment({current:{cloud_cover:999,wind_speed_10m:-3,wind_direction_10m:-90}},{current:{wave_height:90,wave_period:0}});
  assert.equal(e.cloudCover,100);assert.equal(e.windSpeed,0);assert.equal(e.windDirection,270);
  assert.equal(e.waveHeight,15);assert.equal(e.wavePeriod,1);
  assert.ok(environmentVisuals(e).waveScale<=1.85);
});
test('stronger weather changes visual parameters',()=>{
  const calm=environmentVisuals({waveHeight:0.2,windSpeed:2,cloudCover:10});
  const rough=environmentVisuals({waveHeight:4,windSpeed:45,cloudCover:90});
  assert.ok(rough.waveScale>calm.waveScale);
  assert.ok(rough.cloudOpacity>calm.cloudOpacity);
  assert.ok(rough.cloudSpeed>calm.cloudSpeed);
});
