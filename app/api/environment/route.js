import {DEFAULT_ENVIRONMENT,normalizeEnvironment} from '../../../lib/environment.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const cacheHeaders={'Cache-Control':'public, max-age=0, s-maxage=900, stale-while-revalidate=300'};
const fallback={...DEFAULT_ENVIRONMENT};
async function getJson(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(5000),next:{revalidate:1200}});
  if(!response.ok)throw new Error(`Forecast HTTP ${response.status}`);
  return response.json();
}
export async function GET(request){
  const query=new URL(request.url).searchParams;
  const latInput=query.get('latitude'),lonInput=query.get('longitude');
  const lat=latInput===null?40:Number(latInput);
  const lon=lonInput===null?-50:Number(lonInput);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)
    return Response.json({error:'Invalid coordinates.'},{status:400});
  // Round before sending to the upstream service; never store visitor coordinates.
  const weatherLat=Math.round(lat*100)/100,weatherLon=Math.round(lon*100)/100;
  const weatherUrl=new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.search=new URLSearchParams({latitude:String(weatherLat),longitude:String(weatherLon),current:'cloud_cover,wind_speed_10m,wind_direction_10m',wind_speed_unit:'kmh'}).toString();
  const marineUrl='https://marine-api.open-meteo.com/v1/marine?latitude=40&longitude=-50&current=wave_height,wave_direction,wave_period';
  const [weather,marine]=await Promise.allSettled([getJson(weatherUrl),getJson(marineUrl)]);
  const values=normalizeEnvironment(weather.status==='fulfilled'?weather.value:{},marine.status==='fulfilled'?marine.value:{});
  const sources={weather:weather.status==='fulfilled'?'live':'fallback',marine:marine.status==='fulfilled'?'live':'fallback'};
  return Response.json({...fallback,...values,sources,updatedAt:new Date().toISOString()},{headers:cacheHeaders});
}
