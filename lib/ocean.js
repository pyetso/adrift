// Adrift: immersive open-water Three.js scene.
// Water: GPU vertex waves + fragment normal detail, Fresnel sky reflections,
// warm sun glitter and distant atmospheric blending. Inspired by the technical
// approach to reflections / ripples in https://github.com/jeantimex/threejs-water
// This is an original open-ocean shader, not a copy of its pool simulation.
import * as THREE from 'three';

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
const vertexShader = /* glsl */`
  uniform float uTime;
  uniform vec4 uRipples[4];
  varying vec3 vPosition;
  varying vec3 vNormalSea;
  varying float vWave;
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
    float h=seaHeight(p.xz,uTime)+ripples(p.xz);
    float e=.13;
    float hx=seaHeight(p.xz+vec2(e,0.),uTime)+ripples(p.xz+vec2(e,0.));
    float hz=seaHeight(p.xz+vec2(0.,e),uTime)+ripples(p.xz+vec2(0.,e));
    vNormalSea=normalize(vec3(-(hx-h)/e,1.,-(hz-h)/e));
    p.y+=h;
    vWave=h;
    vec4 world=modelMatrix*vec4(p,1.);
    vPosition=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const fragmentShader = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uEye;
  varying vec3 vPosition;
  varying vec3 vNormalSea;
  varying float vWave;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    vec3 V=normalize(uEye-vPosition);
    float n1=noise(vPosition.xz*2.7+vec2(uTime*.31,-uTime*.22));
    float n2=noise(vPosition.xz*7.9+vec2(-uTime*.53,uTime*.37));
    vec3 N=normalize(vNormalSea + vec3((n1-.5)*.14,0.,(n2-.5)*.13));
    float facing=clamp(dot(V,N),0.,1.);
    float fresnel=pow(1.-facing,3.4);
    vec3 R=reflect(-V,N);
    vec3 sunDir=normalize(vec3(.44,.115,-1.));
    float skyFactor=smoothstep(-.11,.87,R.y);
    vec3 reflection=mix(vec3(.92,.57,.42),vec3(.21,.42,.54),skyFactor);
    reflection=mix(reflection,vec3(.08,.29,.44),smoothstep(.42,1.,R.y)*.4);
    vec3 deep=vec3(.025,.185,.235);
    vec3 shallow=vec3(.055,.315,.355);
    vec3 base=mix(deep,shallow,clamp(vWave*.8+.43,0.,1.));
    vec3 color=mix(base,reflection,clamp(.24+fresnel*.72,0.,.88));
    float sunAngle=max(dot(R,sunDir),0.);
    float shimmer=pow(sunAngle,140.);
    float sparkle=step(.63,noise(vPosition.xz*11.+vec2(uTime*.61,-uTime*.33)))*.8+.23;
    color+=vec3(1.,.75,.47)*shimmer*sparkle*2.25;
    float threads=pow(max(0.,sin(vPosition.x*4.7+vPosition.z*7.1+uTime*1.4)),20.)
                 *pow(max(0.,sin(vPosition.z*5.6-uTime*2.2)),14.);
    color+=vec3(.34,.64,.65)*threads*(.035+.10*fresnel);
    float crest=smoothstep(.22,.43,vWave)*(.18+.35*n1);
    color+=vec3(.18,.36,.36)*crest*.15;
    float dist=length(vPosition.xz-uEye.xz);
    float fog=smoothstep(62.,265.,dist);
    color=mix(color,vec3(.56,.57,.53),fog*.70);
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
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.1+vec2(13.,17.);a*=.5;}return v;}
  void main(){
    vec3 dir=normalize(vDir);
    float h=clamp(dir.y,0.,1.);
    vec3 horizon=vec3(.79,.57,.49);
    vec3 middle=vec3(.34,.49,.56);
    vec3 zenith=vec3(.075,.22,.35);
    vec3 col=mix(horizon,middle,smoothstep(.0,.35,h));
    col=mix(col,zenith,smoothstep(.23,.97,h));
    float cloud=fbm(vec2(dir.x*7.+dir.z*2.+uTime*.0018,dir.y*5.+dir.z*1.8));
    float cloudBand=smoothstep(.15,.6,h)*(1.-smoothstep(.60,.9,h));
    float cloudLayer=smoothstep(.54,.78,cloud)*cloudBand;
    col=mix(col,vec3(.89,.69,.63),cloudLayer*.36);
    vec3 sun=normalize(vec3(.44,.115,-1.));
    float sunDot=max(dot(dir,sun),0.);
    float glow=pow(sunDot,28.);
    col+=vec3(1.,.57,.32)*glow*.52;
    float disk=smoothstep(.9993,.99965,sunDot);
    col=mix(col,vec3(1.0,.87,.66),disk);
    float haze=exp(-abs(dir.y)*15.);
    col+=vec3(.22,.125,.105)*haze*.37;
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
  renderer.toneMappingExposure=1.36;
  renderer.setClearColor(0x456572,1);
  renderer.domElement.setAttribute('aria-label','An interactive three-dimensional ocean. Drag to look around and select a bottle to read it.');
  root.appendChild(renderer.domElement);

  const sun=new THREE.DirectionalLight(0xffd4a8,2.7);sun.position.set(40,22,-80);scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xb9d1d5,0x0c4550,2.4));
  const fill=new THREE.DirectionalLight(0xc2e5df,1.25);fill.position.set(-12,18,14);scene.add(fill);

  const skyUniforms={uTime:{value:0}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(370,48,28),new THREE.ShaderMaterial({
    vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:skyUniforms,
    side:THREE.BackSide,depthWrite:false,depthTest:false
  }));
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);

  const waterUniforms={uTime:{value:0},uEye:{value:new THREE.Vector3()},
    uRipples:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,-100,0))}};
  let rippleSlot=0;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(650,650,window.innerWidth < 768 ? 112 : 170,window.innerWidth < 768 ? 112 : 170),new THREE.ShaderMaterial({
    uniforms:waterUniforms,vertexShader,fragmentShader,side:THREE.DoubleSide
  }));
  water.geometry.rotateX(-Math.PI/2);
  water.frustumCulled=false;scene.add(water);

  // Hand-built physical glass bottles with paper rolls inside them.
  const glass=new THREE.MeshPhysicalMaterial({color:0xc5e8df,metalness:0,roughness:.075,
    transparent:true,opacity:.44,transmission:.12,ior:1.44,thickness:.22,
    clearcoat:1,clearcoatRoughness:.09,depthWrite:false,side:THREE.DoubleSide});
  const glassHighlight=new THREE.MeshBasicMaterial({color:0xeaffed,transparent:true,opacity:.37,depthWrite:false,side:THREE.DoubleSide});
  const lip=new THREE.MeshStandardMaterial({color:0xe6f7ee,metalness:.18,roughness:.16,transparent:true,opacity:.75});
  const corkMat=new THREE.MeshStandardMaterial({color:0xa67b4e,roughness:.92});
  const corkTop=new THREE.MeshStandardMaterial({color:0xd0a673,roughness:1});
  const paperMat=new THREE.MeshStandardMaterial({color:0xf2dabb,roughness:.96,side:THREE.DoubleSide});
  const twineMat=new THREE.MeshStandardMaterial({color:0xb58c5c,roughness:1});
  const shadowMat=new THREE.MeshBasicMaterial({color:0x051e2d,transparent:true,opacity:.2,depthWrite:false});
  const waterRingGeom=new THREE.RingGeometry(.5,.53,64);
  const bodyPts=[
    [0,-.65],[.16,-.65],[.25,-.60],[.27,-.52],[.27,.23],[.255,.37],[.21,.48],
    [.135,.58],[.122,.67],[.122,.98],[.143,1.0],[.143,1.06],[.117,1.07]
  ].map(p=>new THREE.Vector2(p[0],p[1]));
  const glassBody=new THREE.LatheGeometry(bodyPts,32);
  const highlightGeom=new THREE.CylinderGeometry(.271,.271,.65,32,1,true,0,.4);
  const neckRingGeom=new THREE.TorusGeometry(.143,.022,8,32);
  const paperGeom=new THREE.CylinderGeometry(.151,.151,.78,18,1,false);
  const corkGeom=new THREE.CylinderGeometry(.145,.119,.25,20);
  const stopperTopGeom=new THREE.CylinderGeometry(.148,.148,.025,20);
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
    const cord=new THREE.Mesh(new THREE.TorusGeometry(.152,.014,6,24),twineMat);
    cord.rotation.x=Math.PI/2;cord.position.y=-.30;object.add(cord);
    // Thin hand-written marks visible through the glass.
    const inkMat=new THREE.MeshBasicMaterial({color:0x8e7b6b,transparent:true,opacity:.38,side:THREE.DoubleSide});
    for(let i=0;i<3;i++){
      const stroke=new THREE.Mesh(new THREE.PlaneGeometry(.15-.03*i,.011),inkMat);
      stroke.position.set(0,.03-i*.085,.158);
      object.add(stroke);
    }
    object.scale.setScalar(1.34);
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

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  let hovered=null,focused=null,mouseX=0,mouseY=0;
  let drag={down:false,x:0,y:0,travel:0},yaw=0,pitch=0,zoom=0;
  const targetPosition=new THREE.Vector3(0,4.1,12.5);
  const targetLook=new THREE.Vector3(0,.06,-12);
  const normalPosition=new THREE.Vector3(),normalLook=new THREE.Vector3();
  const lookPoint=new THREE.Vector3(0,0,-12);
  const clock=new THREE.Clock();
  const introStart=performance.now(),introDuration=reduced?0:5500;
  camera.position.set(0,72,14);
  camera.lookAt(0,0,-11);
  let selectTimer=null;
  let running=true,raf=0,elapsed=0;
  const clamp=THREE.MathUtils.clamp;

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
      return {x:clamp(ndc.x*9,-17,17),z:clamp(-8-ndc.y*7,-30,1)};
    }
    return {x:clamp(point.x,-17,17),z:clamp(point.z,-30,1)};
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
    hovered=null;focused=null;
    const ghost={id:'__held_bottle__',start_x:0,start_z:-5,drift_seed:1};
    const group=createBottle(ghost,true);
    group.scale.setScalar(1.1);
    group.userData.pick.visible=false;
    carrier={group,phase:'following',x:0,z:-5,dropX:0,dropZ:-5,
      y:3.5,started:performance.now(),saved:null,shownImpact:false};
    renderer.domElement.style.cursor='crosshair';
  }
  function pointerDown(event){
    if(event.button!==0 && event.pointerType==='mouse')return;
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
        yaw=clamp(yaw-dx*.0023,-.60,.60);
        pitch=clamp(pitch+dy*.003,-.25,.28);
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
      renderer.domElement.style.cursor='wait';
      try{
        const saved=await onPlace({x:Math.round(loc.x*100)/100,z:Math.round(loc.z*100)/100});
        if(!running||carrier!==current)return;
        if(saved){current.saved=saved;}
        else{current.phase='following';current.saved=null;current.group.visible=true;current.shownImpact=false;}
      }catch(err){
        console.error('Release failed',err);
        if(running&&carrier===current){current.phase='following';current.group.visible=true;}
      }
      return;
    }
    if(!wasTap)return;
    const id=pointerToBottle(event);
    if(id && bottles.has(id) && !focused){
      focused=id;hovered=null;
      clearTimeout(selectTimer);
      const b=bottles.get(id).userData.b;
      selectTimer=setTimeout(()=>{if(running&&focused===id)onSelect(b);},reduced?80:1120);
    }else if(!id && !reduced){
      const point=raycaster.intersectObject(water,false)[0]?.point;
      if(point)makeRipple(point.x,point.z);
    }
  }
  function wheel(event){
    if(event.target!==renderer.domElement||carrier)return;
    event.preventDefault();zoom=clamp(zoom+Math.sign(event.deltaY)*.7,-3,6);
  }
  function keys(event){
    if(document.querySelector('[role="dialog"]')||carrier)return;
    if(event.key==='ArrowLeft')yaw=clamp(yaw+.08,-.6,.6);
    if(event.key==='ArrowRight')yaw=clamp(yaw-.08,-.6,.6);
    if(event.key==='ArrowUp')zoom=clamp(zoom-.8,-3,6);
    if(event.key==='ArrowDown')zoom=clamp(zoom+.8,-3,6);
  }
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',pointerUp);
  renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  window.addEventListener('keydown',keys);

  function animate(){
    if(!running)return;
    raf=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.07);
    if(!reduced)elapsed+=dt;
    const t=elapsed,now=performance.now(),nowSeconds=Date.now()/1000;
    waterUniforms.uTime.value=t;
    skyUniforms.uTime.value=t;
    sky.position.copy(camera.position);

    // Bottles wander across the sea on multiple slow, different currents.
    // Their positions are deterministic from creation time, not tied to one visitor.
    for(const [id,group] of bottles){
      const d=group.userData,seed=d.seed;
      const born=new Date(d.b.created_at).getTime()/1000;
      const age=Math.max(0,Number.isFinite(born)?nowSeconds-born:nowSeconds-1794200000);
      const waveA=.025, waveB=.061;
      const x=(Number(d.b.start_x)||0)+(reduced?0:
        2.6*(Math.sin(age*waveA+seed)-Math.sin(seed))+
        1.15*(Math.sin(age*waveB+seed*.77)-Math.sin(seed*.77)));
      const z=(Number(d.b.start_z)||-6)+(reduced?0:
        2.1*(Math.sin(age*.018+seed*1.3)-Math.sin(seed*1.3))+
        .8*(Math.cos(age*.047+seed*.8)-Math.cos(seed*.8)));
      const h=waveHeight(x,z,t);
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
        const age=(now-d.droppedAt)/1000;
        const alpha=clamp(age/(reduced?.12:1.07),0,1);
        const ease=alpha*alpha*(3-2*alpha);
        group.position.x=THREE.MathUtils.lerp(group.position.x,d.dropX,Math.min(1,dt*13));
        group.position.z=THREE.MathUtils.lerp(group.position.z,d.dropZ,Math.min(1,dt*13));
        const h=waveHeight(d.dropX,d.dropZ,t)+.29;
        group.position.y=THREE.MathUtils.lerp(d.fromY,h,ease);
        if(alpha>=1&&!d.shownImpact){makeRipple(d.dropX,d.dropZ,.2);d.shownImpact=true;}
        if(alpha>=1){group.position.y=h+Math.sin(t*3)*.04;}
        if(d.saved&&alpha>=1){
          const real=bottles.get(d.saved.id);
          if(real){real.visible=true;real.userData.waitingForDrop=false;}
          removeCarrier();
        }
      }
    }
    for(let i=rippleMeshes.length-1;i>=0;i--){
      const a=rippleMeshes[i],age=(now-a.created)/1000;
      if(age>3.2){scene.remove(a.mesh);a.mesh.material.dispose();rippleMeshes.splice(i,1);continue;}
      a.mesh.position.y=waveHeight(a.x,a.z,t)+.05;
      a.mesh.scale.setScalar(.6+age*2.4);
      a.mesh.material.opacity=.5*Math.pow(1-age/3.2,1.5);
    }
    if(focused&&bottles.has(focused)){
      const p=bottles.get(focused).position;
      targetPosition.set(p.x+1.5,p.y+2.7,p.z+4.8);
      targetLook.set(p.x,p.y+.34,p.z);
    }else{
      normalPosition.set(Math.sin(yaw)*4.7,4.1+pitch*3+zoom*.19,12.5+zoom);
      normalLook.set(Math.sin(yaw)*17+mouseX*.15,.05+pitch*4,-12);
      targetPosition.copy(normalPosition);targetLook.copy(normalLook);
    }
    const startAmount=introDuration?clamp((now-introStart)/introDuration,0,1):1;
    if(startAmount<1 && !focused && !carrier){
      const k=startAmount*startAmount*(3-2*startAmount);
      const from=new THREE.Vector3(0,72,14);
      camera.position.copy(from.lerp(targetPosition,k));
      lookPoint.set(0,0,-10).lerp(targetLook,k);
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
    camera.aspect=w/h;camera.fov=w<680?64:55;camera.updateProjectionMatrix();renderer.setSize(w,h);
  }
  window.addEventListener('resize',resize);resize();

  return {
    setBottles,
    focusBottle(id){if(bottles.has(id))focused=id;},
    clearFocus(){focused=null;clearTimeout(selectTimer);},
    setCarrying(yes){if(yes)beginCarry();else if(carrier?.phase==='following')removeCarrier();},
    destroy(){
      running=false;cancelAnimationFrame(raf);clearTimeout(selectTimer);
      window.removeEventListener('resize',resize);window.removeEventListener('keydown',keys);
      renderer.domElement.removeEventListener('pointerdown',pointerDown);
      renderer.domElement.removeEventListener('pointermove',pointerMove);
      renderer.domElement.removeEventListener('pointerup',pointerUp);
      renderer.domElement.removeEventListener('pointercancel',pointerUp);
      renderer.domElement.removeEventListener('wheel',wheel);
      removeCarrier();
      water.geometry.dispose();water.material.dispose();sky.geometry.dispose();sky.material.dispose();
      for(const r of rippleMeshes){scene.remove(r.mesh);r.mesh.material.dispose();}
      for(const g of bottles.values()){g.userData.aura.material.dispose();scene.remove(g);}
      glassBody.dispose();highlightGeom.dispose();neckRingGeom.dispose();paperGeom.dispose();
      corkGeom.dispose();stopperTopGeom.dispose();pickGeometry.dispose();waterRingGeom.dispose();
      [glass,glassHighlight,lip,corkMat,corkTop,paperMat,twineMat,shadowMat,pickMaterial].forEach(m=>m.dispose());
      renderer.dispose();root.replaceChildren();
    }
  };
}
