const el = id => document.getElementById(id);
const bodySel = el('bodySel'), preset = el('preset'), mode = el('mode');
const alt = el('alt_km'), rkm = el('r_km'), hp = el('hp_km'), ha = el('ha_km');
const mass = el('mass'), G = el('G'), useMu = el('useMu'), muInput = el('mu');
const incl = el('incl'), raan = el('raan'), argp = el('argp');
const iTxt = el('iTxt'), oTxt = el('oTxt'), wTxt = el('wTxt');
const out = el('out'), precision = el('precision'); const spd = el('speed'), spdTxt = el('spdTxt');
const lblBody = el('lblBody'), lblV = el('lblV'), lblT = el('lblT'), lblE = el('lblE');
const OmegaDot = el('OmegaDot'), omegaDot = el('omegaDot'), precessionOn = el('precessionOn');

const MODERN = {
  bodies: {
    earth:   { name:'Terra',   Rkm: 6371.0,   mu: 3.986004418e14, color:'#2aa3ff' },
    moon:    { name:'Luna',    Rkm: 1737.4,   mu: 4.9048695e12,  color:'#c9ced6' },
    mars:    { name:'Marte',   Rkm: 3389.5,   mu: 4.282837e13,   color:'#ff6b4a' },
    jupiter: { name:'Giove',   Rkm: 69911.0,  mu: 1.26686534e17, color:'#ffb35a' }
  }
};

// Populate body select
for(const k of Object.keys(MODERN.bodies)){
  const o=document.createElement('option'); o.value=k; o.textContent=MODERN.bodies[k].name; bodySel.appendChild(o);
}
bodySel.value='earth';

function num(v){ return Number(String(v).trim().replace(',', '.')); }
function fmt(x,p){ if(!isFinite(x)) return '—'; if(Math.abs(x)>=1e4 || Math.abs(x)<1e-2) return x.toExponential(p); return x.toLocaleString(undefined,{maximumFractionDigits:p}); }
function hms(seconds){ const s=Math.floor(seconds%60), m=Math.floor((seconds/60)%60), h=Math.floor(seconds/3600); const frac=seconds-Math.floor(seconds); return `${h} h ${m} min ${(s+frac).toFixed(1)} s`; }
function deg2rad(d){ return d*Math.PI/180; }
function rad2deg(r){ return r*180/Math.PI; }

function toggleMode(){
  const circ = document.getElementById('circularBox');
  const ell = document.getElementById('ellipticBox');
  if(mode.value==='circular'){ circ.style.display='grid'; ell.style.display='none'; }
  else { circ.style.display='grid'; ell.style.display='grid'; }
}
mode.addEventListener('change', toggleMode);

function setPreset(name){
  if(name==='earthLEO'){ bodySel.value='earth'; mode.value='elliptic'; hp.value=500; ha.value=500; toggleMode(); }
  if(name==='earthGEO'){ bodySel.value='earth'; mode.value='elliptic'; hp.value=35786; ha.value=35786; toggleMode(); }
}

const canvas = document.getElementById('orbCanvas'); const ctx = canvas.getContext('2d');
let sim = { a:1,e:0,mu:1,R:1,i:0,Omega:0,w:0,n:0,nu:0, running:false, last:0, scale:1, colors:{planet:'#2aa3ff',sat:'#6fd3ff'} };

function setBody(name){
  const b = MODERN.bodies[name]; if(!b) return;
  sim.colors.planet = b.color;
  compute();
}

function fitCanvas(){
  const maxW = canvas.parentElement.clientWidth;
  const w = Math.min(maxW, 800), h = Math.min(440, w);
  const dpr = window.devicePixelRatio||1;
  canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', fitCanvas);

function project3D(x,y,z,w,h){ const fov=600; const s=fov/(fov - z); return {x:w/2+x*s, y:h/2+y*s, s}; }

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

function solveKepler(M,e){
  let E = e<0.8 ? M : Math.PI;
  for(let k=0;k<12;k++){
    const f = E - e*Math.sin(E) - M;
    const fp = 1 - e*Math.cos(E);
    E -= f/fp;
  }
  return E;
}
function orbitalPosition(a,e,nu){
  const p = a*(1-e*e);
  const r = p/(1+e*Math.cos(nu));
  return { r, x:r*Math.cos(nu), y:r*Math.sin(nu), z:0 };
}
function visViva(mu,r,a){ return Math.sqrt(mu*(2/r - 1/a)); }

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
  const n = Math.sqrt(mu/(a*a*a));
  const T = 2*Math.PI/n;

  sim = { ...sim, a, e, mu, R, n,
          i:deg2rad(num(incl.value)),
          Omega:deg2rad(num(raan.value)),
          w:deg2rad(num(argp.value)) };

  out.innerHTML = `a = <span class="mono">${fmt(a/1000,p)} km</span> · e = <span class="mono">${e.toFixed(4)}</span><br>
  μ = <span class="mono">${mu.toExponential(6)} m³/s²</span> · n = <span class="mono">${n.toExponential(4)} rad/s</span><br>
  T = <strong class="mono">${fmt(T,p)} s</strong> — <span class="mono">${hms(T)}</span>`;

  lblBody.textContent = body.name;
  lblT.textContent = hms(T);
  lblE.textContent = e.toFixed(4);

  draw();
}
document.getElementById('calcBtn').addEventListener('click', compute);
preset.addEventListener('change', e=> setPreset(e.target.value));
bodySel.addEventListener('change', e=> setBody(e.target.value));
incl.addEventListener('input', ()=>{ iTxt.textContent = incl.value; sim.i = deg2rad(Number(incl.value)); draw(); });
raan.addEventListener('input', ()=>{ oTxt.textContent = raan.value; sim.Omega = deg2rad(Number(raan.value)); draw(); });
argp.addEventListener('input', ()=>{ wTxt.textContent = argp.value; sim.w = deg2rad(Number(argp.value)); draw(); });

function draw(){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.width/dpr, h = canvas.height/dpr;
  ctx.clearRect(0,0,w,h);

  const Rpx = Math.min(w,h)*0.35;
  sim.scale = Rpx / (sim.a*(1+sim.e));

  // Orbit ellipse ring front/back
  const steps = 260;
  for(const pass of [0,1]){
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const nu = i/steps*2*Math.PI;
      const {x,y} = orbitalPosition(sim.a, sim.e, nu);
      const ECI = rotateToECI(x, y, 0, sim.Omega, sim.i, sim.w);
      const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
      if( (pass===0 && ECI.z<=0) || (pass===1 && ECI.z>0) ){
        if(i===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
      }
    }
    ctx.strokeStyle = pass===0 ? 'rgba(111,211,255,0.85)' : 'rgba(111,211,255,0.25)';
    ctx.lineWidth = 2; ctx.stroke();
  }

  // Planet with per-body color
  const planetR = Math.max(14, 18);
  const body = MODERN.bodies[bodySel.value];
  ctx.beginPath(); ctx.arc(w/2, h/2, planetR, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(w/2-planetR*0.3,h/2-planetR*0.3,planetR*0.2,w/2,h/2,planetR);
  grd.addColorStop(0, body.color); grd.addColorStop(1, '#0a1826');
  ctx.fillStyle=grd; ctx.fill();

  // Satellite at true anomaly sim.nu
  const st = orbitalPosition(sim.a, sim.e, sim.nu);
  const ECI = rotateToECI(st.x, st.y, 0, sim.Omega, sim.i, sim.w);
  const P = project3D(ECI.x*sim.scale, ECI.y*sim.scale, ECI.z*sim.scale, w,h);
  ctx.beginPath(); ctx.fillStyle=sim.colors.sat; ctx.arc(P.x,P.y,6*(P.s),0,Math.PI*2); ctx.fill();

  // Velocity vector preview
  const dnu = 0.01;
  const st2 = orbitalPosition(sim.a, sim.e, sim.nu + dnu);
  const ECI2 = rotateToECI(st2.x, st2.y, 0, sim.Omega, sim.i, sim.w);
  const P2 = project3D(ECI2.x*sim.scale, ECI2.y*sim.scale, ECI2.z*sim.scale, w,h);
  ctx.strokeStyle='rgba(111,211,255,0.9)'; ctx.beginPath(); ctx.moveTo(P.x,P.y); ctx.lineTo(P2.x,P2.y); ctx.stroke();

  // Live stats: speed
  const r_now = st.r;
  const v_now = Math.sqrt(sim.mu*(2/r_now - 1/sim.a));
  lblV.textContent = (v_now/1000).toFixed(2)+' km/s';
}

function step(ts){
  if(!sim.running) return;
  if(!sim.last) sim.last = ts;
  const dt = (ts - sim.last)/1000; sim.last = ts;

  // Advance satellite by mean motion (Kepler)
  const scale = Number(spd.value);
  const Mdot = sim.n;
  const M = ((ts/1000) * Mdot * scale) % (2*Math.PI);
  const E = solveKepler(M, sim.e);
  const nu = Math.atan2( Math.sqrt(1 - sim.e*sim.e) * Math.sin(E), Math.cos(E) - sim.e );
  sim.nu = nu;

  // Precession: rotate ellipse if enabled
  if(precessionOn.checked){
    const Omd = deg2rad(num(OmegaDot.value));  // rad/s (from deg/s)
    const wdot = deg2rad(num(omegaDot.value));
    sim.Omega += Omd * dt;
    sim.w     += wdot * dt;
  }

  draw();
  spdTxt.textContent = scale.toFixed(1);
  // Update UI text if changing Ω/ω live
  oTxt.textContent = Math.round(rad2deg(sim.Omega)%360);
  wTxt.textContent = Math.round(rad2deg(sim.w)%360);

  requestAnimationFrame(step);
}

document.getElementById('playBtn').addEventListener('click', ()=>{ sim.running=true; sim.last=0; requestAnimationFrame(step); });
document.getElementById('pauseBtn').addEventListener('click', ()=>{ sim.running=false; });

// init
function init(){
  toggleMode();
  fitCanvas();
  setPreset('earthLEO');
  compute();
}
init();
