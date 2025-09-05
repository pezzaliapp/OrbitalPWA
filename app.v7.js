const el = id => document.getElementById(id);
const bodySel = el('bodySel'), preset = el('preset'), mode = el('mode'), vizMode = el('vizMode');
const hp = el('hp_km'), ha = el('ha_km'), mass = el('mass'), G = el('G'), useMu = el('useMu'), muInput = el('mu');
const incl = el('incl'), raan = el('raan'), argp = el('argp');
const iTxt = el('iTxt'), oTxt = el('oTxt'), wTxt = el('wTxt');
const OmegaDot = el('OmegaDot'), omegaDot = el('omegaDot'), precessionOn = el('precessionOn');
const calcBtn = el('calcBtn'), playBtn = el('playBtn'), pauseBtn = el('pauseBtn'), spd = el('speed'), spdTxt = el('spdTxt');
const lblBody = el('lblBody'), lblV = el('lblV'), lblT = el('lblT'), lblE = el('lblE');

const video = el('bgVideo'); const canvas = el('orbCanvas'); const ctx = canvas.getContext('2d');

const MODERN = {
  bodies: {
    earth:   { name:'Terra',   Rkm: 6371.0,   mu: 3.986004418e14, color:'#2aa3ff' },
    moon:    { name:'Luna',    Rkm: 1737.4,   mu: 4.9048695e12,  color:'#c9ced6' },
    mars:    { name:'Marte',   Rkm: 3389.5,   mu: 4.282837e13,   color:'#ff6b4a' },
    jupiter: { name:'Giove',   Rkm: 69911.0,  mu: 1.26686534e17, color:'#ffb35a' }
  }
};

for(const k of Object.keys(MODERN.bodies)){
  const o=document.createElement('option'); o.value=k; o.textContent=MODERN.bodies[k].name; bodySel.appendChild(o);
}
bodySel.value='earth';

function num(v){ return Number(String(v).trim().replace(',', '.')); }
function fmt(x,p){ if(!isFinite(x)) return '—'; if(Math.abs(x)>=1e4 || Math.abs(x)<1e-2) return x.toExponential(p); return x.toLocaleString(undefined,{maximumFractionDigits:p}); }
function hms(seconds){ const s=Math.floor(seconds%60), m=Math.floor((seconds/60)%60), h=Math.floor(seconds/3600); const frac=seconds-Math.floor(seconds); return `${h} h ${m} min ${(s+frac).toFixed(1)} s`; }
const deg2rad = d=>d*Math.PI/180, rad2deg = r=>r*180/Math.PI;

let sim = { a:1,e:0,mu:1,R:1,n:0, i:0,Omega:0,w:0, nu:0, running:false, last:0, scale:1, colors:{planet:'#2aa3ff',sat:'#6fd3ff'}, viewYaw:0, viewPitch:0 };

function setPreset(name){
  if(name==='earthLEO'){ bodySel.value='earth'; hp.value=500; ha.value=500; }
  if(name==='earthGEO'){ bodySel.value='earth'; hp.value=35786; ha.value=35786; }
}
preset.addEventListener('change', e=>{ setPreset(e.target.value); compute(); });
bodySel.addEventListener('change', e=>{ sim.colors.planet = MODERN.bodies[e.target.value].color; compute(); });

function solveKepler(M,e){
  let E = e<0.8 ? M : Math.PI;
  for(let k=0;k<12;k++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); E-=f/fp; }
  return E;
}
function orbitalPosition(a,e,nu){
  const p = a*(1-e*e);
  const r = p/(1+e*Math.cos(nu));
  return { r, x:r*Math.cos(nu), y:r*Math.sin(nu), z:0 };
}
function rotateToECI(x,y,z,Omega,i,w){
  let x1 = x*Math.cos(w) - y*Math.sin(w);
  let y1 = x*Math.sin(w) + y*Math.cos(w);
  let z1 = z;
  let x2 = x1;
  let y2 = y1*Math.cos(i) - z1*Math.sin(i);
  let z2 = y1*Math.sin(i) + z1*Math.cos(i);
  let x3 = x2*Math.cos(Omega) - y2*Math.sin(Omega);
  let y3 = x2*Math.sin(Omega) + y2*Math.cos(Omega);
  let z3 = z2;
  return {x:x3,y:y3,z:z3};
}

// Camera/view rotation (for AR or mouse)
let drag=false, lx=0, ly=0;
canvas.addEventListener('pointerdown', e=>{ drag=true; lx=e.clientX; ly=e.clientY; });
window.addEventListener('pointerup', ()=> drag=false);
window.addEventListener('pointermove', e=>{
  if(!drag || vizMode.value==='ar') return;
  const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
  sim.viewYaw += dx*0.005; sim.viewPitch += dy*0.005;
  draw();
});

function applyView(x,y,z){
  // Yaw around Z, Pitch around X (camera-like)
  const yaw = sim.viewYaw, pitch = sim.viewPitch;
  // yaw (around Z): rotate x,y
  let x1 = x*Math.cos(yaw) - y*Math.sin(yaw);
  let y1 = x*Math.sin(yaw) + y*Math.cos(yaw);
  let z1 = z;
  // pitch (around X): rotate y,z
  let x2 = x1;
  let y2 = y1*Math.cos(pitch) - z1*Math.sin(pitch);
  let z2 = y1*Math.sin(pitch) + z1*Math.cos(pitch);
  return {x:x2,y:y2,z:z2};
}

function project3D(x,y,z,w,h){
  // Apply view rotation first
  const v = applyView(x,y,z);
  const fov=600; const s=fov/(fov - v.z);
  return {x:w/2+v.x*s, y:h/2+v.y*s, s};
}

function fitCanvas(){
  const maxW = canvas.parentElement.clientWidth;
  const w = Math.min(maxW, 900), h = Math.min(520, w*0.65);
  const dpr = window.devicePixelRatio||1;
  canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', fitCanvas);

function compute(){
  const p = Number(el('precision').value)||3;
  const body = MODERN.bodies[bodySel.value];
  const R = body.Rkm*1000;
  let mu = useMu.checked ? num(muInput.value) : num(G.value)*num(mass.value);
  if(!mu || !isFinite(mu)) mu = body.mu;

  const rp = (R + num(hp.value)*1000), ra = (R + num(ha.value)*1000);
  const a = 0.5*(rp+ra);
  const e = (ra-rp)/(ra+rp);
  const n = Math.sqrt(mu/(a*a*a));
  const T = 2*Math.PI/n;

  sim.a=a; sim.e=e; sim.mu=mu; sim.R=R; sim.n=n;
  sim.i=deg2rad(num(incl.value)); sim.Omega=deg2rad(num(raan.value)); sim.w=deg2rad(num(argp.value));

  lblBody.textContent = body.name; lblT.textContent = hms(T); lblE.textContent = e.toFixed(4);
  draw();
}
calcBtn.addEventListener('click', compute);

function drawAxes(w,h,scale){
  // Draw reference XY axes and node line/pericenter
  // Unit vectors after view rotation
  function seg(ax,ay,az,bx,by,bz,stroke){
    const A=project3D(ax,ay,az,w,h), B=project3D(bx,by,bz,w,h);
    ctx.strokeStyle=stroke; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
  }
  ctx.lineWidth=1.5;
  // ECI axes (scaled)
  seg(0,0,0, 100,0,0, 'rgba(180,220,255,0.5)'); // X
  seg(0,0,0, 0,100,0, 'rgba(180,220,255,0.3)'); // Y
  seg(0,0,0, 0,0,100, 'rgba(180,220,255,0.3)'); // Z
  // Node line (Ω) on XY plane
  const L=140;
  const xN = Math.cos(sim.Omega)*L, yN = Math.sin(sim.Omega)*L;
  seg(-xN,-yN,0, xN,yN,0, 'var(--node)');
  // Pericenter direction (ω) within orbital plane
  // Take unit vector at nu=0 in orbital plane, rotate to ECI, then draw small arrow
  const base = rotateToECI(1,0,0, sim.Omega, sim.i, sim.w); // direction of pericenter
  seg(0,0,0, base.x*100, base.y*100, base.z*100, 'var(--peric)');
  // Arc arrows for Ω and ω (schematic)
  ctx.strokeStyle='var(--node)'; ctx.beginPath();
  for(let t=0;t<=1;t+=0.05){
    const ang = t*sim.Omega; const P=project3D(Math.cos(ang)*60, Math.sin(ang)*60, 0, w,h);
    if(t===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
  } ctx.stroke();
  ctx.strokeStyle='var(--peric)'; ctx.beginPath();
  for(let t=0;t<=1;t+=0.05){
    const ang = t*sim.w; const dir=rotateToECI(Math.cos(ang),Math.sin(ang),0, sim.Omega, sim.i, 0);
    const P=project3D(dir.x*60, dir.y*60, dir.z*60, w,h);
    if(t===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
  } ctx.stroke();
  // Labels
  ctx.fillStyle='var(--node)'; ctx.font='12px system-ui'; const PN=project3D(xN,yN,0,w,h); ctx.fillText('Ω', PN.x+6, PN.y-6);
  const PP=project3D(base.x*100, base.y*100, base.z*100, w,h); ctx.fillStyle='var(--peric)'; ctx.fillText('ω', PP.x+6, PP.y-6);
}

function projectEllipse(w,h){
  const Rpx = Math.min(w,h)*0.35;
  sim.scale = Rpx / (sim.a*(1+sim.e));
  const steps = 260;
  const front=[]; const back=[];
  for(let i=0;i<=steps;i++){
    const nu = i/steps*2*Math.PI;
    const {x,y} = orbitalPosition(sim.a, sim.e, nu);
    const ECI = rotateToECI(x, y, 0, sim.Omega, sim.i, sim.w);
    const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
    (ECI.z>0?front:back).push(P);
  }
  return {front, back};
}

function draw(){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.width/dpr, h = canvas.height/dpr;
  // Background for AR
  if(vizMode.value==='ar' && video.readyState>=2){
    ctx.drawImage(video, 0, 0, w, h);
  } else {
    ctx.fillStyle='#081522'; ctx.fillRect(0,0,w,h);
  }
  // Axes & guides
  drawAxes(w,h,1);

  // Orbit ellipse (front/back)
  const {front, back} = projectEllipse(w,h);
  ctx.lineWidth=2;
  ctx.strokeStyle='rgba(111,211,255,0.25)'; ctx.beginPath();
  back.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.stroke();
  ctx.strokeStyle='rgba(111,211,255,0.9)'; ctx.beginPath();
  front.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.stroke();

  // Planet
  const planetR = 18;
  const body = MODERN.bodies[bodySel.value];
  const grd = ctx.createRadialGradient(w/2-planetR*0.3,h/2-planetR*0.3,planetR*0.2,w/2,h/2,planetR);
  grd.addColorStop(0, body.color); grd.addColorStop(1, '#0a1826');
  ctx.beginPath(); ctx.arc(w/2, h/2, planetR, 0, Math.PI*2); ctx.fillStyle=grd; ctx.fill();

  // Satellite point
  const {x,y,r} = orbitalPosition(sim.a, sim.e, sim.nu);
  const ECI = rotateToECI(x, y, 0, sim.Omega, sim.i, sim.w);
  const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
  ctx.beginPath(); ctx.fillStyle=sim.colors.sat; ctx.arc(P.x,P.y,6*(P.s),0,Math.PI*2); ctx.fill();

  // Velocity live
  const v_now = Math.sqrt(sim.mu*(2/r - 1/sim.a));
  lblV.textContent = (v_now/1000).toFixed(2)+' km/s';
}

function step(ts){
  if(!sim.running) return;
  if(!sim.last) sim.last = ts;
  const dt = (ts - sim.last)/1000; sim.last = ts;

  // Satellite motion
  const scale = Number(spd.value);
  const M = (ts/1000) * sim.n * scale;
  const E = solveKepler(M % (2*Math.PI), sim.e);
  sim.nu = Math.atan2( Math.sqrt(1 - sim.e*sim.e) * Math.sin(E), Math.cos(E) - sim.e );

  // Ellipse precession (Ω·, ω·) in real mode
  if(vizMode.value==='real' && precessionOn.checked){
    sim.Omega += deg2rad(num(OmegaDot.value)) * dt;
    sim.w     += deg2rad(num(omegaDot.value)) * dt;
    oTxt.textContent = Math.round(rad2deg(sim.Omega)%360);
    wTxt.textContent = Math.round(rad2deg(sim.w)%360);
  }

  draw();
  spdTxt.textContent = scale.toFixed(1);
  requestAnimationFrame(step);
}

// AR: camera + device orientation
async function startAR(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
    video.srcObject = stream; video.style.display='block';
  }catch(e){ console.warn('Camera non disponibile', e); }
  // iOS requires permission for deviceorientation
  if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
    try{ const p = await DeviceOrientationEvent.requestPermission(); if(p!=='granted') return; }catch(e){}
  }
  window.addEventListener('deviceorientation', (ev)=>{
    if(vizMode.value!=='ar') return;
    const beta = (ev.beta||0);   // tilt front-back (-180..180)
    const gamma = (ev.gamma||0); // left-right (-90..90)
    sim.viewPitch = beta * Math.PI/180 * 0.5; // soften
    sim.viewYaw   = gamma * Math.PI/180 * 0.8;
    draw();
  });
}
function stopAR(){
  video.style.display='none';
  const s = video.srcObject;
  if(s){ s.getTracks().forEach(t=>t.stop()); video.srcObject=null; }
}

vizMode.addEventListener('change', ()=>{
  if(vizMode.value==='ar'){ startAR(); }
  else { stopAR(); }
});

calcBtn.addEventListener('click', compute);
playBtn.addEventListener('click', ()=>{ sim.running=true; sim.last=0; requestAnimationFrame(step); });
pauseBtn.addEventListener('click', ()=>{ sim.running=false; });

incl.addEventListener('input', ()=>{ iTxt.textContent=incl.value; sim.i=deg2rad(num(incl.value)); draw(); });
raan.addEventListener('input', ()=>{ oTxt.textContent=raan.value; sim.Omega=deg2rad(num(raan.value)); draw(); });
argp.addEventListener('input', ()=>{ wTxt.textContent=argp.value; sim.w=deg2rad(num(argp.value)); draw(); });

function fit(){
  const maxW = canvas.parentElement.clientWidth;
  const w = Math.min(maxW, 900), h = Math.min(520, w*0.65);
  const dpr = window.devicePixelRatio||1;
  canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function init(){
  fit(); compute(); draw();
}
window.addEventListener('resize', ()=>{ fit(); draw(); });
init();


// ===== PWA Service Worker & A2HS =====
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js'));
}
let deferredPrompt=null;
const a2hsBar=document.getElementById('a2hsBar');
const a2hsBtn=document.getElementById('a2hsBtn');
const iosHint=document.getElementById('iosHint');
function isStandalone(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone===true);
}
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt=e;
  if(!isStandalone()){ a2hsBar.style.display='block'; }
});
window.addEventListener('appinstalled', ()=>{ a2hsBar.style.display='none'; deferredPrompt=null; });
a2hsBtn?.addEventListener('click', async()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); const choice=await deferredPrompt.userChoice; deferredPrompt=null; if(choice.outcome!=='dismissed'){ a2hsBar.style.display='none'; } }
});
(function(){ const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent); if(isIOS && !isStandalone()){ iosHint.style.display='inline'; a2hsBar.style.display='block'; } })();

