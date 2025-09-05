const el = id => document.getElementById(id);
const bodySel = el('bodySel'), preset = el('preset'), mode = el('mode');
const alt = el('alt_km'), rkm = el('r_km'), hp = el('hp_km'), ha = el('ha_km');
const mass = el('mass'), G = el('G'), useMu = el('useMu'), muInput = el('mu');
const incl = el('incl'), raan = el('raan'), argp = el('argp');
const out = el('out'), precision = el('precision'); const spd = el('speed'), spdTxt = el('spdTxt');
const lblBody = el('lblBody'), lblV = el('lblV'), lblT = el('lblT'), lblE = el('lblE');
const circularBox = el('circularBox'), ellipticBox = el('ellipticBox');

const MODERN = {
  G: 6.67430e-11,
  bodies: {
    earth:   { name:'Terra',   Rkm: 6371.0,   mu: 3.986004418e14, color:'#2aa3ff' },
    moon:    { name:'Luna',    Rkm: 1737.4,   mu: 4.9048695e12,  color:'#c9ced6' },
    mars:    { name:'Marte',   Rkm: 3389.5,   mu: 4.282837e13,   color:'#ff6b4a' },
    jupiter: { name:'Giove',   Rkm: 69911.0,  mu: 1.26686534e17, color:'#ffb35a' }
  }
};

// Populate selects
for(const k of Object.keys(MODERN.bodies)){
  const o=document.createElement('option'); o.value=k; o.textContent=MODERN.bodies[k].name; bodySel.appendChild(o);
}
bodySel.value='earth';

function num(v){ return Number(String(v).trim().replace(',', '.')); }
function fmt(x,p){ if(!isFinite(x)) return '—'; if(Math.abs(x)>=1e4 || Math.abs(x)<1e-2) return x.toExponential(p); return x.toLocaleString(undefined,{maximumFractionDigits:p}); }
function hms(seconds){ const s=Math.floor(seconds%60), m=Math.floor((seconds/60)%60), h=Math.floor(seconds/3600); const frac=seconds-Math.floor(seconds); return `${h} h ${m} min ${(s+frac).toFixed(1)} s`; }

function toggleMode(){
  if(mode.value==='circular'){ circularBox.style.display='grid'; ellipticBox.style.display='none'; }
  else { circularBox.style.display='grid'; ellipticBox.style.display='grid'; }
}
mode.addEventListener('change', toggleMode);
toggleMode();

function setPreset(name){
  if(name==='earthLEO'){ bodySel.value='earth'; mode.value='elliptic'; hp.value=500; ha.value=500; toggleMode(); }
  if(name==='earthGEO'){ bodySel.value='earth'; mode.value='elliptic'; hp.value=35786; ha.value=35786; toggleMode(); }
}

function compute(){
  const p = Number(precision.value)||3;
  const body = MODERN.bodies[bodySel.value];
  const R = body.Rkm*1000;
  let mu = useMu.checked ? num(muInput.value) : num(G.value)*num(mass.value);
  if(!mu || !isFinite(mu)) mu = body.mu;

  let a, e, rp, ra;
  if(mode.value==='circular'){
    const r = (num(rkm.value) + num(alt.value))*1000;
    a = r; e = 0; rp = ra = r;
  }else{
    rp = (R + num(hp.value)*1000);
    ra = (R + num(ha.value)*1000);
    a = 0.5*(rp+ra);
    e = (ra-rp)/(ra+rp);
  }

  const n = Math.sqrt(mu/(a*a*a)); // mean motion rad/s
  const T = 2*Math.PI/n;

  // current state at t=0: choose true anomaly ν0 = 0 at perigee
  const nu0 = 0;
  updateSim({ a, e, mu, R, i:deg2rad(num(incl.value)), Omega:deg2rad(num(raan.value)), w:deg2rad(num(argp.value)), n, t0:performance.now()/1000, nu:nu0 });

  out.innerHTML = `Semiasse maggiore a = <span class="mono">${fmt(a/1000,p)} km</span> · e = <span class="mono">${e.toFixed(4)}</span><br>
  μ = <span class="mono">${mu.toExponential(6)} m³/s²</span> · n = <span class="mono">${n.toExponential(4)} rad/s</span><br>
  Periodo T = <strong class="mono">${fmt(T,p)} s</strong> — <span class="mono">${hms(T)}</span>`;

  lblBody.textContent = body.name;
  lblT.textContent = hms(T);
  lblE.textContent = e.toFixed(4);
}
document.getElementById('calcBtn').addEventListener('click', compute);
preset.addEventListener('change', e=> setPreset(e.target.value));

// ======= 3D Kepler simulation =======
const canvas = document.getElementById('orbCanvas'); const ctx = canvas.getContext('2d');
let sim = { a:1,e:0,mu:1,R:1,i:0,Omega:0,w:0,n:0,t0:0,nu:0,r:1, running:false, last:0, scale:1 };

function deg2rad(d){ return d*Math.PI/180; }
function project3D(x,y,z,w,h){ const fov=600; const s=fov/(fov - z); return {x:w/2+x*s, y:h/2+y*s, s}; }

function fitCanvas(){
  const maxW = canvas.parentElement.clientWidth;
  const w = Math.min(maxW, 800), h = Math.min(440, w);
  const dpr = window.devicePixelRatio||1;
  canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', fitCanvas);

function updateSim(o){ Object.assign(sim, o); sim.last=0; draw(); }

function solveKepler(M,e){
  // Newton-Raphson for eccentric anomaly E
  let E = e<0.8 ? M : Math.PI;
  for(let k=0;k<10;k++){
    const f = E - e*Math.sin(E) - M;
    const fp = 1 - e*Math.cos(E);
    E -= f/fp;
  }
  return E;
}

function orbitalPosition(a,e,nu){
  const p = a*(1-e*e);
  const r = p/(1+e*Math.cos(nu));
  const x_orb = r*Math.cos(nu), y_orb = r*Math.sin(nu), z_orb = 0;
  return {r, x_orb, y_orb, z_orb};
}

function rotateToECI(x,y,z,Omega,i,w){
  // Rz(Omega) * Rx(i) * Rz(w) * [x y z]^T
  // First rotate by w about z
  let x1 = x*Math.cos(w) - y*Math.sin(w);
  let y1 = x*Math.sin(w) + y*Math.cos(w);
  let z1 = z;
  // Inclination i about x
  let x2 = x1;
  let y2 = y1*Math.cos(i) - z1*Math.sin(i);
  let z2 = y1*Math.sin(i) + z1*Math.cos(i);
  // RAAN Omega about z
  let x3 = x2*Math.cos(Omega) - y2*Math.sin(Omega);
  let y3 = x2*Math.sin(Omega) + y2*Math.cos(Omega);
  let z3 = z2;
  return {x:x3,y:y3,z:z3};
}

function visViva(mu,r,a){ return Math.sqrt(mu*(2/r - 1/a)); }

function draw(){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.width/dpr, h = canvas.height/dpr;
  ctx.clearRect(0,0,w,h);

  // scale scene
  const Rpx = Math.min(w,h)*0.35;
  sim.scale = Rpx / (sim.a*(1+sim.e)); // apogee fits in view

  // draw ellipse ring (front/back)
  const steps = 240;
  for(const pass of [0,1]){
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const nu = i/steps*2*Math.PI;
      const {r,x_orb,y_orb} = orbitalPosition(sim.a, sim.e, nu);
      const ECI = rotateToECI(x_orb, y_orb, 0, sim.Omega, sim.i, sim.w);
      const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
      if( (pass===0 && ECI.z<=0) || (pass===1 && ECI.z>0) ){
        if(i===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
      }
    }
    ctx.strokeStyle = pass===0 ? 'rgba(111,211,255,0.8)' : 'rgba(111,211,255,0.25)';
    ctx.lineWidth = 2; ctx.stroke();
  }

  // Draw planet
  const planetR = Math.max(10, 18);
  ctx.beginPath(); ctx.arc(w/2, h/2, planetR, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(w/2-planetR*0.3,h/2-planetR*0.3,planetR*0.2,w/2,h/2,planetR);
  grd.addColorStop(0, '#2aa3ff'); grd.addColorStop(1, '#0a1826');
  ctx.fillStyle=grd; ctx.fill();

  // Satellite at current true anomaly sim.nu
  const st = orbitalPosition(sim.a, sim.e, sim.nu);
  const ECI = rotateToECI(st.x_orb, st.y_orb, 0, sim.Omega, sim.i, sim.w);
  const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
  ctx.beginPath(); ctx.fillStyle='#6fd3ff'; ctx.arc(P.x,P.y,6*(P.s),0,Math.PI*2); ctx.fill();

  // Velocity vector magnitude
  const v = visViva(sim.mu, st.r, sim.a);
  lblV.textContent = (v/1000).toFixed(2)+' km/s';

  // Small velocity direction arrow (tangent)
  const dnu = 0.01;
  const st2 = orbitalPosition(sim.a, sim.e, sim.nu + dnu);
  const ECI2 = rotateToECI(st2.x_orb, st2.y_orb, 0, sim.Omega, sim.i, sim.w);
  const P2 = project3D(ECI2.x*sim.scale, ECI2.y*sim.scale, ECI2.z*sim.scale, w,h);
  ctx.strokeStyle='rgba(111,211,255,0.9)'; ctx.beginPath(); ctx.moveTo(P.x,P.y); ctx.lineTo(P2.x,P2.y); ctx.stroke();
}

function step(ts){
  if(!sim.running){ return; }
  if(!sim.last){ sim.last = ts; }
  const dt = (ts - sim.last)/1000; sim.last = ts;

  // advance mean anomaly and solve Kepler for E, then ν
  const scale = Number(spd.value);
  const Mdot = sim.n; // rad/s
  const M = ( ( (ts/1000 - sim.t0) * Mdot * scale ) ) % (2*Math.PI);
  const E = solveKepler(M, sim.e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const nu = Math.atan2( Math.sqrt(1 - sim.e*sim.e) * sinE, cosE - sim.e );
  sim.nu = nu;

  draw(); spdTxt.textContent = scale.toFixed(1);
  requestAnimationFrame(step);
}

document.getElementById('playBtn').addEventListener('click', ()=>{ sim.running=true; sim.last=0; sim.t0=performance.now()/1000; requestAnimationFrame(step); });
document.getElementById('pauseBtn').addEventListener('click', ()=>{ sim.running=false; });

// init
fitCanvas();
setPreset('earthLEO');
compute();

// PWA installabile
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));}

// ===== A2HS (Add to Home) =====
let deferredPrompt=null;
const a2hsBar=document.getElementById('a2hsBar');
const a2hsBtn=document.getElementById('a2hsBtn');
const iosHint=document.getElementById('iosHint');

function isStandalone(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
         (window.navigator.standalone === true);
}

window.addEventListener('beforeinstallprompt', (e)=>{
  // Chrome/Edge/Android: intercept prompt
  e.preventDefault();
  deferredPrompt = e;
  if(!isStandalone()){ a2hsBar.style.display='block'; }
});

window.addEventListener('appinstalled', ()=>{
  a2hsBar.style.display='none'; deferredPrompt=null;
});

a2hsBtn?.addEventListener('click', async ()=>{
  if(deferredPrompt){
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt=null;
    if(choice.outcome!=='dismissed'){ a2hsBar.style.display='none'; }
  }
});

// iOS: non supporta beforeinstallprompt → mostra istruzione
(function(){
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isIOS && !isStandalone()){
    iosHint.style.display='inline';
    a2hsBar.style.display='block';
  }
})();

