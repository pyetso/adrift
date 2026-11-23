// Adrift: immersive open-water Three.js scene.
// Water: GPU vertex waves + fragment normal detail, Fresnel sky reflections,
// warm sun glitter and distant atmospheric blending. Inspired by the technical
// approach to reflections / ripples in https://github.com/jeantimex/threejs-water
// This is an original open-ocean shader, not a copy of its pool simulation.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {calculateSolarPosition,localClockApproximation} from './solar.mjs';
import {stepDropMotion} from './drop-motion.mjs';
import {bottleCurrentPosition} from './bottle-drift.mjs';
import {OCEAN_BOUNDS} from './ocean-bounds.mjs';
import {DEFAULT_ENVIRONMENT,environmentVisuals} from './environment.mjs';

let locationRequested=false;

const waveSource = /* glsl */`
  float seaHeight(vec2 p, float t) {
    float a = 0.19 * sin(p.y * .48 + t * .68 + sin(p.x * .14 + t * .13) * .5);
    float b = 0.125 * sin(p.x * .73 - p.y * .34 - t * .64);
    float c = 0.094 * sin(p.x * .39 + p.y * .78 + t * .92);
    float d = 0.054 * sin(p.x * 1.46 + p.y * .93 - t * 1.21);
    return a + b + c + d;
  }
`;
function waveHeight(x, z, t) {
  return .19*Math.sin(z*.48+t*.68+Math.sin(x*.14+t*.13)*.5)
    +.125*Math.sin(x*.73-z*.34-t*.64)
    +.094*Math.sin(x*.39+z*.78+t*.92)
    +.054*Math.sin(x*1.46+z*.93-t*1.21);
}
function seededRandom(seed) {
  let state=seed>>>0;
  return ()=>{
    state=(state*1664525+1013904223)>>>0;
    return state/4294967296;
  };
}
function createLowPolyCloudGeometry(seed) {
  const random=seededRandom(seed);
  const lobeCount=4+Math.floor(random()*3);
  const lobes=[];
  for(let i=0;i<lobeCount;i++){
    const center=(lobeCount-1)/2;
    const radius=i===Math.floor(center)?1.15:.66+random()*.32;
    const geometry=new THREE.SphereGeometry(radius,7,5);
    geometry.translate(
      (i-center)*.72+(random()-.5)*.18,
      .08+random()*.28,
      (random()-.5)*.42
    );
    lobes.push(geometry);
  }
  const merged=mergeGeometries(lobes,false);
  lobes.forEach(geometry=>geometry.dispose());
  if(!merged)throw new Error('Could not combine low-poly cloud geometry.');
  const geometry=merged.toNonIndexed();
  merged.dispose();
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const jitter=(offset)=>Math.sin(x*127.1+y*311.7+z*74.7+seed*offset)*.055;
    positions.setXYZ(i,
      x+jitter(19.1),
      Math.max(y+jitter(83.7),-.58),
      z+jitter(41.3));
  }
  positions.needsUpdate=true;
  geometry.computeVertexNormals();
  const normals=geometry.attributes.normal;
  const facetColors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i+=3){
    const facing=(normals.getY(i)+normals.getY(i+1)+normals.getY(i+2))/3;
    const variation=Math.sin(i*12.9898+seed*78.233)*.055;
    const tone=THREE.MathUtils.clamp(.82+Math.max(0,facing)*.17+variation,.72,1.04);
    for(let vertex=0;vertex<3;vertex++){
      const offset=(i+vertex)*3;
      facetColors[offset]=tone;
      facetColors[offset+1]=tone;
      facetColors[offset+2]=tone;
    }
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(facetColors,3));
  geometry.computeBoundingSphere();
  return geometry;
}
const vertexShader = /* glsl */`
  uniform float uTime;
  uniform vec4 uRipples[4];
  uniform float uWaveScale;
  attribute float aFacet;
  varying vec3 vPosition;
  varying float vWave;
  varying float vFacet;
  ${waveSource}
  float ripples(vec2 pos) {
    float sum=0.;
    for(int i=0;i<4;i++){
      vec4 r=uRipples[i];
      float age=uTime-r.z;
      if(age>0. && age<5.5){
        float distanceFromTouch=distance(pos,r.xy);
        float envelope=exp(-distanceFromTouch*.72-age*.92);
        sum+=sin(distanceFromTouch*5.6-age*7.8)*envelope*r.w;
      }
    }
    return sum;
  }
  void main() {
    vec3 p=position;
    float h=seaHeight(p.xz,uTime)*uWaveScale+ripples(p.xz);
    p.y+=h;
    vWave=h;
    vFacet=aFacet;
    vec4 world=modelMatrix*vec4(p,1.);
    vPosition=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const fragmentShader = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uSunElevation;
  uniform vec3 uSunDir;
  uniform vec3 uEye;
  varying vec3 vPosition;
  varying float vWave;
  varying float vFacet;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    vec3 V=normalize(uEye-vPosition);
    float n1=noise(vPosition.xz*2.7+vec2(uTime*.31,-uTime*.22));
    vec3 N=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
    if(!gl_FrontFacing)N=-N;
    float facing=clamp(dot(V,N),0.,1.);
    float fresnel=pow(1.-facing,3.4);
    vec3 R=reflect(-V,N);
    float skyFactor=smoothstep(-.11,.87,R.y);
    float daylight=smoothstep(-.10,.42,uSunElevation);
    float twilight=1.-smoothstep(.015,.25,abs(uSunElevation));
    vec3 horizon=mix(vec3(.08,.14,.19),vec3(.92,.57,.42),twilight);
    horizon=mix(horizon,vec3(.31,.52,.62),daylight);
    vec3 reflection=mix(horizon,vec3(.21,.42,.54),skyFactor);
    reflection=mix(reflection,vec3(.08,.29,.44),smoothstep(.42,1.,R.y)*.4);
    vec3 deep=vec3(.012,.10,.135);
    vec3 shallow=vec3(.035,.23,.265);
    vec3 base=mix(deep,shallow,clamp(vWave*.8+.43,0.,1.));
    vec3 color=mix(base,reflection,clamp(.10+fresnel*.42,0.,.56));
    float facetTone=.93+vFacet*.11;
    color*=vec3(facetTone*.97,facetTone,facetTone*1.025);
    float sunAngle=max(dot(R,normalize(uSunDir)),0.);
    float broadGlint=pow(sunAngle,42.);
    float shimmer=pow(sunAngle,118.);
    float sunVisibility=smoothstep(0.,.14,uSunElevation);
    vec2 glintUv=vPosition.xz*vec2(1.2,5.5)+vec2(uTime*.09,-uTime*.23);
    float sparkle=smoothstep(.55,.82,noise(glintUv))*.72+.16;
    color+=vec3(1.,.75,.47)*(broadGlint*.065+shimmer*sparkle*2.15)*sunVisibility;
    float crest=smoothstep(.22,.43,vWave)*(.18+.35*n1);
    color+=vec3(.18,.36,.36)*crest*.15;
    vec3 fogHorizon=mix(vec3(.055,.105,.15),vec3(.42,.19,.12),twilight);
    fogHorizon=mix(fogHorizon,vec3(.38,.57,.65),daylight);
    vec3 fogHorizonTint=mix(vec3(.12,.19,.24),vec3(.42,.22,.17),twilight);
    fogHorizonTint=mix(fogHorizonTint,vec3(.18,.28,.33),daylight);
    vec3 fogGlow=mix(vec3(.045,.075,.11),vec3(.22,.125,.105),twilight);
    fogGlow=mix(fogGlow,vec3(.18,.28,.33),daylight);
    vec3 fogHorizonColor=mix(fogHorizon,fogHorizonTint,.14)+fogGlow*.22;
    float dist=length(vPosition.xz-uEye.xz);
    float fog=smoothstep(48.,240.,dist);
    color=mix(color,fogHorizonColor,fog*.98);
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const skyVertex = /* glsl */`
  varying vec3 vDir;
  void main(){
    vDir=normalize(position);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`;
const skyFragment = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform float uTime;
  uniform float uSunElevation;
  uniform vec3 uSunDir;
  void main(){
    vec3 dir=normalize(vDir);
    float h=clamp(dir.y,0.,1.);
    float daylight=smoothstep(-.10,.42,uSunElevation);
    float twilight=1.-smoothstep(.015,.25,abs(uSunElevation));
    vec3 horizon=mix(vec3(.055,.105,.15),vec3(.42,.19,.12),twilight);
    horizon=mix(horizon,vec3(.38,.57,.65),daylight);
    vec3 middle=mix(vec3(.045,.09,.16),vec3(.12,.24,.31),daylight);
    vec3 zenith=mix(vec3(.008,.025,.065),vec3(.027,.08,.14),daylight);
    vec3 col=mix(horizon,middle,smoothstep(.0,.35,h));
    col=mix(col,zenith,smoothstep(.23,.97,h));
    float sunDot=max(dot(dir,normalize(uSunDir)),0.);
    float glow=pow(sunDot,28.);
    float aboveHorizon=step(0.,uSunElevation);
    col+=vec3(1.,.57,.32)*glow*.38*aboveHorizon;
    float horizonHaze=exp(-abs(dir.y-.035)*10.);
    col=mix(col,mix(vec3(.12,.19,.24),vec3(.42,.22,.17),twilight),horizonHaze*.2);
    vec3 sunAxis=normalize(uSunDir);
    vec3 sunReference=abs(sunAxis.y)<.98?vec3(0.,1.,0.):vec3(1.,0.,0.);
    vec3 sunTangent=normalize(cross(sunAxis,sunReference));
    vec3 sunBitangent=cross(sunAxis,sunTangent);
    vec2 sunPlane=vec2(dot(dir,sunTangent),dot(dir,sunBitangent));
    float sectorAngle=6.2831853/12.;
    float sector=mod(atan(sunPlane.y,sunPlane.x)+sectorAngle*.5,sectorAngle)-sectorAngle*.5;
    float sunRadius=.027*cos(sectorAngle*.5)/cos(sector);
    float disk=(1.-smoothstep(sunRadius-.0015,sunRadius+.0015,length(sunPlane)))*aboveHorizon;
    col=mix(col,vec3(1.0,.72,.5),disk);
    float haze=exp(-abs(dir.y)*15.);
    vec3 hazeColor=mix(vec3(.045,.075,.11),vec3(.22,.125,.105),twilight);
    hazeColor=mix(hazeColor,vec3(.18,.28,.33),daylight);
    col+=hazeColor*haze*.22;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function initOcean(root,onSelect,onPlace){
  const scene=new THREE.Scene();
  const width=Math.max(root.clientWidth,1),height=Math.max(root.clientHeight,1);
  const camera=new THREE.PerspectiveCamera(55,width/height,.08,660);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth < 768 ? 1.3 : 1.6));
  renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.setClearColor(0x456572,1);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','An interactive three-dimensional ocean. Drag to look, use WASD to move and arrow keys to adjust your view, or use the mobile movement pad. Select a bottle to read it.');
  renderer.domElement.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown W A S D');
  root.appendChild(renderer.domElement);

  const initialSolar=localClockApproximation(new Date());
  const sunDirection=new THREE.Vector3(initialSolar.direction.x,initialSolar.direction.y,initialSolar.direction.z);
  const targetSunDirection=sunDirection.clone();
  let sunElevation=initialSolar.elevation,targetSunElevation=initialSolar.elevation;
  const sun=new THREE.DirectionalLight(0xffd4a8,.18+THREE.MathUtils.smoothstep(sunElevation,-.1,.45)*2.52);
  sun.position.copy(sunDirection).multiplyScalar(80);scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xb9d1d5,0x0c4550,2.4));
  const fill=new THREE.DirectionalLight(0xc2e5df,1.25);fill.position.set(-12,18,14);scene.add(fill);

  const skyUniforms={uSunDir:{value:sunDirection},uSunElevation:{value:sunElevation}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(370,48,28),new THREE.ShaderMaterial({
    vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:skyUniforms,
    side:THREE.BackSide,depthWrite:false,depthTest:false
  }));
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);

  const cloudMaterial=new THREE.MeshBasicMaterial({
    color:0xbaccc8,vertexColors:true,transparent:true,opacity:.65
  });
  const cloudBank=new THREE.Group();
  let environment={...DEFAULT_ENVIRONMENT};
  let visual=environmentVisuals(environment);
  let environmentStopped=false;
  async function refreshEnvironment(){
    try {
      // The default offshore sample is used until location permission is granted.
      const coord=solarCoordinates;
      const qs=coord?`?latitude=${encodeURIComponent(coord.latitude)}&longitude=${encodeURIComponent(coord.longitude)}`:'';
      const response=await fetch(`/api/environment${qs}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Forecast unavailable');
      const value=await response.json();
      if(!environmentStopped){environment=value;visual=environmentVisuals(value);}
    }catch(err){console.warn('Using default ocean conditions',err);}
  }
  const cloudGeometries=[];
  const cloudRandom=seededRandom(2417);
  const cloudCount=window.innerWidth<768?9:15;
  for(let i=0;i<cloudCount;i++){
    const geometry=createLowPolyCloudGeometry(300+i);
    cloudGeometries.push(geometry);
    const cloud=new THREE.Mesh(geometry,cloudMaterial);
    const angle=(i/cloudCount)*Math.PI*2+(cloudRandom()-.5)*.24;
    const elevation=.14+cloudRandom()*.22;
    const distance=255+cloudRandom()*30;
    const horizontal=Math.cos(elevation)*distance;
    cloud.position.set(
      Math.sin(angle)*horizontal,
      Math.sin(elevation)*distance,
      -Math.cos(angle)*horizontal
    );
    cloud.rotation.y=angle+.3;
    cloud.scale.set(4+cloudRandom()*1.7,3+cloudRandom()*1.4,1.5+cloudRandom()*.9);
    cloudBank.add(cloud);
  }
  scene.add(cloudBank);
  const environmentInterval=setInterval(refreshEnvironment,20*60*1000);
  scene.fog=new THREE.Fog(0x748e91,258,375);

  const waterUniforms={uTime:{value:0},uEye:{value:new THREE.Vector3()},
    uSunDir:{value:sunDirection},uSunElevation:{value:sunElevation},
    uWaveScale:{value:1},
    uRipples:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,-100,0))}};
  let rippleSlot=0;
  const waterSegments=window.innerWidth<768?104:120;
  const indexedWaterGeometry=new THREE.PlaneGeometry(650,650,waterSegments,waterSegments);
  const waterPositions=indexedWaterGeometry.attributes.position;
  const cellSize=650/waterSegments;
  const vertexHash=(x,y,offset)=>{
    const value=Math.sin(x*127.1+y*311.7+offset)*43758.5453;
    return value-Math.floor(value);
  };
  for(let row=1;row<waterSegments;row++){
    for(let column=1;column<waterSegments;column++){
      const vertex=row*(waterSegments+1)+column;
      const jitter=cellSize*.24;
      waterPositions.setX(vertex,waterPositions.getX(vertex)+(vertexHash(column,row,19.1)-.5)*2*jitter);
      waterPositions.setY(vertex,waterPositions.getY(vertex)+(vertexHash(column,row,83.7)-.5)*2*jitter);
    }
  }
  waterPositions.needsUpdate=true;
  indexedWaterGeometry.rotateX(-Math.PI/2);
  const waterGeometry=indexedWaterGeometry.toNonIndexed();
  indexedWaterGeometry.dispose();
  const waterUv=waterGeometry.attributes.uv;
  const facetTones=new Float32Array(waterGeometry.attributes.position.count);
  for(let vertex=0;vertex<facetTones.length;vertex+=3){
    const u=(waterUv.getX(vertex)+waterUv.getX(vertex+1)+waterUv.getX(vertex+2))/3;
    const v=(waterUv.getY(vertex)+waterUv.getY(vertex+1)+waterUv.getY(vertex+2))/3;
    const cellX=Math.floor(u*waterSegments),cellY=Math.floor(v*waterSegments);
    const triangle=(vertex/3)%2;
    const random=Math.sin(cellX*127.1+cellY*311.7+triangle*74.7)*43758.5453;
    const tone=(random-Math.floor(random))*2-1;
    facetTones[vertex]=tone;
    facetTones[vertex+1]=tone;
    facetTones[vertex+2]=tone;
  }
  waterGeometry.setAttribute('aFacet',new THREE.BufferAttribute(facetTones,1));
  const water=new THREE.Mesh(waterGeometry,new THREE.ShaderMaterial({
    uniforms:waterUniforms,vertexShader,fragmentShader,side:THREE.DoubleSide
  }));
  water.frustumCulled=false;scene.add(water);

  // Hand-built physical glass bottles with paper rolls inside them.
  const glass=new THREE.MeshPhysicalMaterial({color:0xc5e8df,metalness:0,roughness:.075,flatShading:true,
    transparent:true,opacity:.44,transmission:.12,ior:1.44,thickness:.22,
    clearcoat:1,clearcoatRoughness:.09,depthWrite:false,side:THREE.DoubleSide});
  const glassHighlight=new THREE.MeshBasicMaterial({color:0xeaffed,transparent:true,opacity:.37,depthWrite:false,side:THREE.DoubleSide});
  const lip=new THREE.MeshStandardMaterial({color:0xe6f7ee,metalness:.18,roughness:.16,transparent:true,opacity:.75});
  const corkMat=new THREE.MeshStandardMaterial({color:0xa67b4e,roughness:.92});
  const corkTop=new THREE.MeshStandardMaterial({color:0xd0a673,roughness:1});
  const paperMat=new THREE.MeshStandardMaterial({color:0xf2dabb,roughness:.96,side:THREE.DoubleSide});
  const twineMat=new THREE.MeshStandardMaterial({color:0xb58c5c,roughness:1});
  const shadowMat=new THREE.MeshBasicMaterial({color:0x051e2d,transparent:true,opacity:.2,depthWrite:false});
  const waterRingGeom=new THREE.RingGeometry(.5,.53,12);
  const bodyPts=[
    [0,-.65],[.16,-.65],[.25,-.60],[.27,-.52],[.27,.23],[.255,.37],[.21,.48],
    [.135,.58],[.122,.67],[.122,.98],[.143,1.0],[.143,1.06],[.117,1.07]
  ].map(p=>new THREE.Vector2(p[0],p[1]));
  const glassBody=new THREE.LatheGeometry(bodyPts,7).toNonIndexed();
  glassBody.computeVertexNormals();
  const highlightGeom=new THREE.CylinderGeometry(.271,.271,.65,8,1,true,0,.4);
  const neckRingGeom=new THREE.TorusGeometry(.143,.022,5,12);
  const paperGeom=new THREE.CylinderGeometry(.151,.151,.78,8,1,false);
  const corkGeom=new THREE.CylinderGeometry(.145,.119,.25,6);
  const stopperTopGeom=new THREE.CylinderGeometry(.148,.148,.025,6);
  const pickGeometry=new THREE.SphereGeometry(.79,12,10);
  const pickMaterial=new THREE.MeshBasicMaterial({color:0xffaa66,transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  const bottles=new Map();
  const selectable=[];
  let carrier=null;
  const rippleMeshes=[];

  function createBottle(b,isGhost=false){
    const group=new THREE.Group();
    const object=new THREE.Group();
    object.rotation.z=-Math.PI/2.13;
    object.rotation.y=(Number(b.drift_seed)||1)*.18;
    const bottleMesh=new THREE.Mesh(glassBody,glass);object.add(bottleMesh);
    const shine=new THREE.Mesh(highlightGeom,glassHighlight);shine.position.y=-.11;shine.rotation.y=-.22;object.add(shine);
    const neckRing=new THREE.Mesh(neckRingGeom,lip);neckRing.rotation.x=Math.PI/2;neckRing.position.y=1.018;object.add(neckRing);
    const cork=new THREE.Mesh(corkGeom,corkMat);cork.position.y=1.17;object.add(cork);
    const stopper=new THREE.Mesh(stopperTopGeom,corkTop);stopper.position.y=1.30;object.add(stopper);
    const paper=new THREE.Mesh(paperGeom,paperMat);paper.position.y=-.14;object.add(paper);
    const cord=new THREE.Mesh(new THREE.TorusGeometry(.152,.014,4,12),twineMat);
    cord.rotation.x=Math.PI/2;cord.position.y=-.30;object.add(cord);
    // Thin hand-written marks visible through the glass.
    const inkMat=new THREE.MeshBasicMaterial({color:0x8e7b6b,transparent:true,opacity:.38,side:THREE.DoubleSide});
    for(let i=0;i<3;i++){
      const stroke=new THREE.Mesh(new THREE.PlaneGeometry(.15-.03*i,.011),inkMat);
      stroke.position.set(0,.03-i*.085,.158);
      object.add(stroke);
    }
    object.scale.setScalar(1.15);
    group.add(object);
    const aura=new THREE.Mesh(new THREE.RingGeometry(.81,.85,72),new THREE.MeshBasicMaterial({
      color:0xe0d9b3,transparent:true,opacity:.0,side:THREE.DoubleSide,depthWrite:false
    }));
    aura.rotation.x=-Math.PI/2;aura.position.y=-.06;group.add(aura);
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.76,32),shadowMat);
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-.04;shadow.scale.set(1,.38,1);group.add(shadow);
    const pick=new THREE.Mesh(pickGeometry,pickMaterial);
    pick.scale.set(1.5,.75,.85);pick.userData.id=b.id;
    group.add(pick);
    if(!isGhost)selectable.push(pick);
    group.userData={b,object,aura,shadow,pick,cork,stopper,paper,seed:Number(b.drift_seed)||1,
      releaseAt:null,readAmount:0,waitingForDrop:false};
    scene.add(group);
    if(!isGhost)bottles.set(b.id,group);
    return group;
  }
  function setBottles(data){
    const available=new Set(data.slice(0,38).map(b=>b.id));
    for(const [id,group] of bottles){
      if(!available.has(id)){
        scene.remove(group);
        const index=selectable.indexOf(group.userData.pick);
        if(index>=0)selectable.splice(index,1);
        // Only local per-object material is aura; geometry/material are shared otherwise.
        group.userData.aura.material.dispose();
        bottles.delete(id);
      }
    }
    data.slice(0,38).forEach(b=>{
      if(!bottles.has(b.id)){
        const group=createBottle(b);
        // Keep a newly-saved bottle out of sight until the carried bottle splashes down.
        if(carrier?.phase==='dropping' &&
          Math.hypot(Number(b.start_x)-carrier.dropX,Number(b.start_z)-carrier.dropZ)<1.7){
          group.userData.waitingForDrop=true;
          group.visible=false;
        }
      }
      else bottles.get(b.id).userData.b=b;
    });
  }

  function makeRipple(x,z,radius=0){
    waterUniforms.uRipples.value[rippleSlot].set(x,z,elapsed,.34);
    rippleSlot=(rippleSlot+1)%4;
    const mesh=new THREE.Mesh(waterRingGeom,new THREE.MeshBasicMaterial({
      color:0xcde8d8,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide
    }));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.06,z);mesh.scale.setScalar(.3+radius);
    scene.add(mesh);rippleMeshes.push({mesh,created:performance.now(),x,z});
  }

  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motionQuery.matches;
  let reducedSince=reduced?performance.now():null;
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  let hovered=null,focused=null,mouseX=0,mouseY=0;
  let drag={down:false,x:0,y:0,travel:0},yaw=0,pitch=0,zoom=0;
  const flightPosition=new THREE.Vector3(0,4.1,12.5);
  const flightVelocity=new THREE.Vector3();
  const desiredVelocity=new THREE.Vector3();
  const keyboardMovement=new Set(),padMovement=new Set();
  const movementBindings={w:'forward',s:'backward',a:'left',d:'right'};
  const targetPosition=flightPosition.clone();
  const targetLook=new THREE.Vector3(0,.06,-12);
  const normalPosition=new THREE.Vector3(),normalLook=new THREE.Vector3();
  const lookPoint=new THREE.Vector3(0,0,-12);
  const clock=new THREE.Clock();
  let introStart=performance.now();
  const introDuration=reduced?0:6200;
  camera.position.set(0,72,14);
  camera.lookAt(0,0,-11);
  let selectTimer=null;
  let running=true,raf=0,elapsed=0;
  const clamp=THREE.MathUtils.clamp;
  let solarCoordinates=null;
  refreshEnvironment();
  function handleMotionChange(event){
    const now=performance.now();
    if(event.matches){
      reduced=true;reducedSince=now;
    }else{
      if(reducedSince!==null){introStart+=now-reducedSince;reducedSince=null;}
      reduced=false;
    }
  }
  motionQuery.addEventListener('change',handleMotionChange);
  function refreshSolarTarget(){
    const solar=solarCoordinates
      ?calculateSolarPosition(new Date(),solarCoordinates.latitude,solarCoordinates.longitude)
      :localClockApproximation(new Date());
    targetSunDirection.set(solar.direction.x,solar.direction.y,solar.direction.z);
    targetSunElevation=solar.elevation;
  }
  refreshSolarTarget();
  const solarInterval=setInterval(refreshSolarTarget,60000);
  const nightHorizon=new THREE.Color(.055,.105,.15);
  const twilightHorizon=new THREE.Color(.42,.19,.12);
  const dayHorizon=new THREE.Color(.38,.57,.65);
  const nightHaze=new THREE.Color(.12,.19,.24);
  const twilightHaze=new THREE.Color(.42,.22,.17);
  const dayHaze=new THREE.Color(.18,.28,.33);
  const nightGlow=new THREE.Color(.045,.075,.11);
  const twilightGlow=new THREE.Color(.22,.125,.105);
  const dayGlow=new THREE.Color(.18,.28,.33);
  const nightCloud=new THREE.Color(0x7d929a);
  const twilightCloud=new THREE.Color(0xc08c77);
  const dayCloud=new THREE.Color(0xdfe9e5);
  const atmosphereColor=new THREE.Color();
  const atmosphereHaze=new THREE.Color();
  const atmosphereGlow=new THREE.Color();
  const horizonColor=new THREE.Color();
  const cloudColor=new THREE.Color();
  function updateAtmosphere(){
    const daylight=THREE.MathUtils.smoothstep(sunElevation,-.10,.42);
    const twilight=1-THREE.MathUtils.smoothstep(Math.abs(sunElevation),.015,.25);
    atmosphereColor.copy(nightHorizon).lerp(twilightHorizon,twilight).lerp(dayHorizon,daylight);
    atmosphereHaze.copy(nightHaze).lerp(twilightHaze,twilight).lerp(dayHaze,daylight);
    atmosphereGlow.copy(nightGlow).lerp(twilightGlow,twilight).lerp(dayGlow,daylight).multiplyScalar(.22);
    horizonColor.copy(atmosphereColor).lerp(atmosphereHaze,.14).add(atmosphereGlow);
    scene.fog.color.copy(horizonColor);
    cloudColor.copy(nightCloud).lerp(twilightCloud,twilight).lerp(dayCloud,daylight);
    cloudMaterial.color.copy(cloudColor);
  }
  updateAtmosphere();
  if(!locationRequested&&typeof navigator!=='undefined'&&navigator.geolocation){
    locationRequested=true;
    try{
      navigator.geolocation.getCurrentPosition(position=>{
        solarCoordinates={latitude:position.coords.latitude,longitude:position.coords.longitude};
        refreshSolarTarget();
        refreshEnvironment();
      },()=>{}, {enableHighAccuracy:false,maximumAge:600000,timeout:2500});
    }catch{}
  }

  function pointerRay(event){
    const rect=renderer.domElement.getBoundingClientRect();
    ndc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(ndc,camera);
  }
  function pointerToBottle(event){
    pointerRay(event);
    const hit=raycaster.intersectObjects(selectable,false)[0];
    return hit?hit.object.userData.id:null;
  }
  function positionAtCursor(x,y,height=0){
    const event={clientX:x,clientY:y};
    pointerRay(event);
    const target=new THREE.Vector3();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-height);
    const point=raycaster.ray.intersectPlane(plane,target);
    if(!point){
      return {
        x:clamp(ndc.x*9,OCEAN_BOUNDS.minX,OCEAN_BOUNDS.maxX),
        z:clamp(-8-ndc.y*7,OCEAN_BOUNDS.minZ,OCEAN_BOUNDS.maxZ)
      };
    }
    return {
      x:clamp(point.x,OCEAN_BOUNDS.minX,OCEAN_BOUNDS.maxX),
      z:clamp(point.z,OCEAN_BOUNDS.minZ,OCEAN_BOUNDS.maxZ)
    };
  }
  function clearMovement(){
    keyboardMovement.clear();
    padMovement.clear();
    flightVelocity.set(0,0,0);
  }
  function removeCarrier(){
    if(!carrier)return;
    scene.remove(carrier.group);
    carrier.group.userData.aura.material.dispose();
    carrier=null;
    renderer.domElement.style.cursor='grab';
  }
  function beginCarry(){
    if(carrier)return;
    clearMovement();
    hovered=null;focused=null;
    const ghost={id:'__held_bottle__',start_x:0,start_z:-5,drift_seed:1};
    const group=createBottle(ghost,true);
    group.userData.pick.visible=false;
    carrier={group,phase:'following',x:0,z:-5,dropX:0,dropZ:-5,
      y:3.5,started:performance.now(),saved:null,shownImpact:false};
    renderer.domElement.style.cursor='crosshair';
  }
  function pointerDown(event){
    if(event.button!==0 && event.pointerType==='mouse')return;
    renderer.domElement.focus({preventScroll:true});
    drag={down:true,x:event.clientX,y:event.clientY,travel:0};
    try{renderer.domElement.setPointerCapture(event.pointerId);}catch{}
  }
  function pointerMove(event){
    const rect=renderer.domElement.getBoundingClientRect();
    mouseX=(event.clientX-rect.left)/rect.width*2-1;
    mouseY=(event.clientY-rect.top)/rect.height*2-1;
    if(carrier?.phase==='following'){
      const coords=positionAtCursor(event.clientX,event.clientY,3.2);
      carrier.x=coords.x;carrier.z=coords.z;
      renderer.domElement.style.cursor='crosshair';
      return;
    }
    if(drag.down){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      drag.travel+=Math.abs(dx)+Math.abs(dy);
      drag.x=event.clientX;drag.y=event.clientY;
      if(!focused){
        yaw-=dx*.0023;
        pitch=clamp(pitch+dy*.003,-.50,.40);
      }
      renderer.domElement.style.cursor='grabbing';
    }else{
      hovered=pointerToBottle(event);
      renderer.domElement.style.cursor=hovered?'pointer':'grab';
    }
  }
  async function pointerUp(event){
    if(!drag.down)return;
    const wasTap=drag.travel<9;
    drag.down=false;
    if(carrier){
      if(carrier.phase!=='following'||!wasTap)return;
      const loc=positionAtCursor(event.clientX,event.clientY,0);
      const current=carrier;
      current.phase='dropping';current.droppedAt=performance.now();
      current.dropX=loc.x;current.dropZ=loc.z;
      current.fromY=current.group.position.y;
      current.dropMotion={phase:'airborne',y:current.fromY,startY:current.fromY,velocity:0,elapsed:0};
      renderer.domElement.style.cursor='wait';
      try{
        const saved=await onPlace({x:Math.round(loc.x*100)/100,z:Math.round(loc.z*100)/100});
        if(!running||carrier!==current)return;
        if(saved){current.saved=saved;}
        else{
          current.phase='following';current.saved=null;current.group.visible=true;
          current.shownImpact=false;current.dropMotion=null;current.droppedAt=null;
        }
      }catch(err){
        console.error('Release failed',err);
        if(running&&carrier===current){
          current.phase='following';current.group.visible=true;current.shownImpact=false;
          current.dropMotion=null;current.droppedAt=null;
        }
      }
      return;
    }
    if(!wasTap)return;
    const id=pointerToBottle(event);
    if(id && bottles.has(id) && !focused){
      clearMovement();
      focused=id;hovered=null;
      clearTimeout(selectTimer);
      const b=bottles.get(id).userData.b;
      selectTimer=setTimeout(()=>{if(running&&focused===id)onSelect(b);},reduced?80:760);
    }else if(!id && !reduced){
      const point=raycaster.intersectObject(water,false)[0]?.point;
      if(point)makeRipple(point.x,point.z);
    }
  }
  function wheel(event){
    if(event.target!==renderer.domElement||carrier)return;
    event.preventDefault();
    zoom=clamp(zoom+Math.sign(event.deltaY)*.7,-3,6);
    camera.fov=clamp((root.clientWidth<680?64:55)+zoom,46,68);
    camera.updateProjectionMatrix();
  }
  function keys(event){
    if(document.querySelector('[role="dialog"]')||carrier||focused)return;
    let handled=true;
    if(event.key==='ArrowLeft')yaw+=.08;
    else if(event.key==='ArrowRight')yaw-=.08;
    else if(event.key==='ArrowUp')pitch=clamp(pitch-.08,-.50,.40);
    else if(event.key==='ArrowDown')pitch=clamp(pitch+.08,-.50,.40);
    else{
      const direction=movementBindings[event.key.toLowerCase()];
      if(direction)keyboardMovement.add(direction);
      else handled=false;
    }
    if(handled)event.preventDefault();
  }
  function keysUp(event){
    const direction=movementBindings[event.key.toLowerCase()];
    if(direction)keyboardMovement.delete(direction);
  }
  function setMovement(direction,active){
    if(!['forward','backward','left','right'].includes(direction))return;
    if(active&&!focused&&!carrier)padMovement.add(direction);
    else padMovement.delete(direction);
  }
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',pointerUp);
  renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  renderer.domElement.addEventListener('keydown',keys);
  window.addEventListener('keyup',keysUp);
  window.addEventListener('blur',clearMovement);

  function animate(){
    if(!running)return;
    raf=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.07);
    if(!reduced)elapsed+=dt;
    const t=elapsed,now=performance.now(),nowSeconds=Date.now()/1000;
    waterUniforms.uTime.value=t;
    waterUniforms.uWaveScale.value=THREE.MathUtils.damp(waterUniforms.uWaveScale.value,visual.waveScale,1.2,dt);
    cloudMaterial.opacity=THREE.MathUtils.damp(cloudMaterial.opacity,visual.cloudOpacity,1.2,dt);
    const solarBlend=1-Math.exp(-dt*1.6);
    sunDirection.lerp(targetSunDirection,solarBlend).normalize();
    sunElevation=THREE.MathUtils.lerp(sunElevation,targetSunElevation,solarBlend);
    skyUniforms.uSunElevation.value=sunElevation;
    waterUniforms.uSunElevation.value=sunElevation;
    sun.position.copy(sunDirection).multiplyScalar(80);
    sun.intensity=.18+THREE.MathUtils.smoothstep(sunElevation,-.1,.45)*2.52;
    sky.position.copy(camera.position);
    cloudBank.position.copy(camera.position);
    cloudBank.rotation.y=reduced?0:t*visual.cloudSpeed;
    updateAtmosphere();

    // Bottles wander across the sea on multiple slow, different currents.
    // Their positions are deterministic from creation time, not tied to one visitor.
    for(const [id,group] of bottles){
      const d=group.userData,seed=d.seed;
      const {x,z}=bottleCurrentPosition(d.b,nowSeconds,{reducedMotion:reduced});
      const h=waveHeight(x,z,t)*waterUniforms.uWaveScale.value;
      const readTarget=focused===id?1:0;
      d.readAmount=THREE.MathUtils.damp(d.readAmount,readTarget,reduced?40:2.15,dt);
      group.position.set(x,h+.29+Math.sin(t*.8+seed)*.045+d.readAmount*1.35,z);
      group.rotation.y=seed*.18+Math.sin(t*.21+seed)*.22;
      d.object.rotation.z=THREE.MathUtils.lerp(-Math.PI/2.13+Math.sin(t*.73+seed)*.09,-.10,d.readAmount);
      d.object.rotation.x=Math.sin(t*.57+seed)*.10*(1-d.readAmount);
      d.cork.position.y=1.17+d.readAmount*.5;
      d.stopper.position.y=1.30+d.readAmount*.5;
      d.paper.position.y=-.14+d.readAmount*.67;
      d.aura.material.opacity=THREE.MathUtils.damp(d.aura.material.opacity,
        (hovered===id||focused===id)? .5:.035,6,dt);
      d.aura.scale.setScalar(1+Math.sin(t*2+seed)*.09);
    }
    if(carrier){
      const d=carrier,group=d.group;
      if(d.phase==='following'){
        const target=new THREE.Vector3(d.x,3.25+Math.sin(t*1.3)*.11,d.z);
        group.position.lerp(target,reduced?1:Math.min(1,dt*11));
        group.rotation.y=Math.sin(t*.42)*.24;
        group.userData.object.rotation.z=-Math.PI/2.13+Math.sin(t*2)*.13;
      } else if(d.phase==='dropping'){
        if(d.dropMotion.phase==='airborne'){
          group.position.x=THREE.MathUtils.lerp(group.position.x,d.dropX,Math.min(1,dt*13));
          group.position.z=THREE.MathUtils.lerp(group.position.z,d.dropZ,Math.min(1,dt*13));
        }
        const h=waveHeight(d.dropX,d.dropZ,t)*waterUniforms.uWaveScale.value+.29;
        d.dropMotion=stepDropMotion(d.dropMotion,dt,h,{reducedMotion:reduced});
        group.position.y=d.dropMotion.y;
        if(d.dropMotion.impacted){makeRipple(d.dropX,d.dropZ,.2);d.shownImpact=true;}
        if(d.saved&&d.dropMotion.phase==='settled'){
          const real=bottles.get(d.saved.id);
          if(real){real.visible=true;real.userData.waitingForDrop=false;}
          removeCarrier();
        }
      }
    }
    if(!focused&&!carrier){
      const forward=Number(keyboardMovement.has('forward')||padMovement.has('forward'))
        -Number(keyboardMovement.has('backward')||padMovement.has('backward'));
      const strafe=Number(keyboardMovement.has('right')||padMovement.has('right'))
        -Number(keyboardMovement.has('left')||padMovement.has('left'));
      const length=Math.hypot(forward,strafe)||1;
      desiredVelocity.set(
        (Math.sin(yaw)*forward+Math.cos(yaw)*strafe)/length*5.2,
        0,
        (-Math.cos(yaw)*forward+Math.sin(yaw)*strafe)/length*5.2
      );
      const response=1-Math.exp(-dt*(forward||strafe?4.8:1.9));
      flightVelocity.lerp(desiredVelocity,response);
      flightPosition.addScaledVector(flightVelocity,dt);
      const boundedX=clamp(flightPosition.x,OCEAN_BOUNDS.minX,OCEAN_BOUNDS.maxX);
      const boundedZ=clamp(flightPosition.z,OCEAN_BOUNDS.minZ,OCEAN_BOUNDS.maxZ);
      if(boundedX!==flightPosition.x)flightVelocity.x=0;
      if(boundedZ!==flightPosition.z)flightVelocity.z=0;
      flightPosition.set(boundedX,4.1,boundedZ);
    }
    for(let i=rippleMeshes.length-1;i>=0;i--){
      const a=rippleMeshes[i],age=(now-a.created)/1000;
      if(age>3.2){scene.remove(a.mesh);a.mesh.material.dispose();rippleMeshes.splice(i,1);continue;}
      a.mesh.position.y=waveHeight(a.x,a.z,t)*waterUniforms.uWaveScale.value+.05;
      a.mesh.scale.setScalar(.6+age*2.4);
      a.mesh.material.opacity=.5*Math.pow(1-age/3.2,1.5);
    }
    if(focused&&bottles.has(focused)){
      const p=bottles.get(focused).position;
      targetPosition.set(p.x+1.5,p.y+2.7,p.z+4.8);
      targetLook.set(p.x,p.y+.34,p.z);
    }else{
      const viewPitch=pitch-.16;
      const viewCos=Math.cos(viewPitch);
      normalPosition.copy(flightPosition);
      normalLook.set(
        flightPosition.x+Math.sin(yaw)*viewCos*24+mouseX*.15,
        flightPosition.y+Math.sin(viewPitch)*24,
        flightPosition.z-Math.cos(yaw)*viewCos*24
      );
      targetPosition.copy(normalPosition);targetLook.copy(normalLook);
    }
    const introNow=reduced&&reducedSince!==null?reducedSince:now;
    const startAmount=introDuration?clamp((introNow-introStart)/introDuration,0,1):1;
    if(startAmount<1 && !focused && !carrier){
      const progress=startAmount*startAmount*(3-2*startAmount);
      const arc=Math.sin(progress*Math.PI);
      const from=new THREE.Vector3(0,72,14);
      camera.position.copy(from.lerp(targetPosition,progress));
      camera.position.x+=arc*1.25;
      camera.position.y+=arc*1.8;
      camera.position.z-=arc*1.4;
      lookPoint.set(0,0,-10).lerp(targetLook,progress);
      lookPoint.x+=arc*.55;
      camera.lookAt(lookPoint);
    }else{
      const blend=1-Math.pow(.0006,dt);
      camera.position.lerp(targetPosition,reduced?1:blend*.45);
      lookPoint.lerp(targetLook,reduced?1:blend*.52);
      camera.lookAt(lookPoint);
    }
    waterUniforms.uEye.value.copy(camera.position);
    renderer.render(scene,camera);
  }
  animate();

  function resize(){
    const w=Math.max(root.clientWidth,1),h=Math.max(root.clientHeight,1);
    camera.aspect=w/h;camera.fov=clamp((w<680?64:55)+zoom,46,68);camera.updateProjectionMatrix();renderer.setSize(w,h);
  }
  window.addEventListener('resize',resize);resize();

  return {
    setBottles,
    setMovement,
    focusBottle(id){if(bottles.has(id))focused=id;},
    clearFocus(){focused=null;clearTimeout(selectTimer);},
    setCarrying(yes){if(yes)beginCarry();else if(carrier?.phase==='following')removeCarrier();},
    destroy(){
      running=false;cancelAnimationFrame(raf);clearTimeout(selectTimer);
      clearMovement();
      window.removeEventListener('resize',resize);
      window.removeEventListener('keyup',keysUp);
      window.removeEventListener('blur',clearMovement);
      renderer.domElement.removeEventListener('keydown',keys);
      motionQuery.removeEventListener('change',handleMotionChange);
      clearInterval(solarInterval);
      environmentStopped=true;clearInterval(environmentInterval);
      renderer.domElement.removeEventListener('pointerdown',pointerDown);
      renderer.domElement.removeEventListener('pointermove',pointerMove);
      renderer.domElement.removeEventListener('pointerup',pointerUp);
      renderer.domElement.removeEventListener('pointercancel',pointerUp);
      renderer.domElement.removeEventListener('wheel',wheel);
      removeCarrier();
      water.geometry.dispose();water.material.dispose();sky.geometry.dispose();sky.material.dispose();
      cloudGeometries.forEach(geometry=>geometry.dispose());cloudMaterial.dispose();
      for(const r of rippleMeshes){scene.remove(r.mesh);r.mesh.material.dispose();}
      for(const g of bottles.values()){g.userData.aura.material.dispose();scene.remove(g);}
      glassBody.dispose();highlightGeom.dispose();neckRingGeom.dispose();paperGeom.dispose();
      corkGeom.dispose();stopperTopGeom.dispose();pickGeometry.dispose();waterRingGeom.dispose();
      [glass,glassHighlight,lip,corkMat,corkTop,paperMat,twineMat,shadowMat,pickMaterial].forEach(m=>m.dispose());
      renderer.dispose();root.replaceChildren();
    }
  };
}
