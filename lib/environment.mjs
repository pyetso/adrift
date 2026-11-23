// Normalized, bounded artistic inputs. Not a physical ocean simulation.
const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const DEFAULT_ENVIRONMENT=Object.freeze({cloudCover:35,windSpeed:12,windDirection:270,waveHeight:1.2,waveDirection:250,wavePeriod:8});
export function normalizeEnvironment(weather={},marine={}){
  const w=weather?.current||{},m=marine?.current||{};
  return {
    cloudCover:clamp(finite(w.cloud_cover,DEFAULT_ENVIRONMENT.cloudCover),0,100),
    windSpeed:clamp(finite(w.wind_speed_10m,DEFAULT_ENVIRONMENT.windSpeed),0,150),
    windDirection:((finite(w.wind_direction_10m,DEFAULT_ENVIRONMENT.windDirection)%360)+360)%360,
    waveHeight:clamp(finite(m.wave_height,DEFAULT_ENVIRONMENT.waveHeight),0,15),
    waveDirection:((finite(m.wave_direction,DEFAULT_ENVIRONMENT.waveDirection)%360)+360)%360,
    wavePeriod:clamp(finite(m.wave_period,DEFAULT_ENVIRONMENT.wavePeriod),1,30),
  };
}
export function environmentVisuals(e=DEFAULT_ENVIRONMENT){
  const v={...DEFAULT_ENVIRONMENT,...e};
  return {
    waveScale:clamp(.72+v.waveHeight*.21,.72,1.85),
    cloudOpacity:clamp(.35+v.cloudCover*.006,.35,.95),
    cloudSpeed:clamp(.0001+v.windSpeed*.000024,.0001,.002),
    driftSpeed:clamp(.85+v.waveHeight*.13+v.windSpeed*.004,.85,1.8),
  };
}
