const el = id => document.getElementById(id);
const preset = el('preset'), bodySel = el('bodySel'), alt = el('alt_km'), rkm = el('r_km'), mass = el('mass'), G = el('G');
const out = el('out'), work = el('work'), precision = el('precision');
const useMu = el('useMu'), muInput = el('mu');

const MODERN = {
  G: 6.67430e-11,
  bodies: {
    earth:   { name:'Terra',   Rkm: 6371.0,   M: 5.972e24, mu: 3.986004418e14 },
    moon:    { name:'Luna',    Rkm: 1737.4,   M: 7.34767309e22, mu: 4.9048695e12 },
    mars:    { name:'Marte',   Rkm: 3389.5,   M: 6.4171e23, mu: 4.282837e13 },
    jupiter: { name:'Giove',   Rkm: 69911.0,  M: 1.898e27,  mu: 1.26686534e17 }
  }
};

function setBody(name){
  const b = MODERN.bodies[name];
  if(!b) return;
  rkm.value = String(b.Rkm);
  mass.value = String(b.M);
  muInput.value = String(b.mu);
}

function setPreset(name){
  if(name==='casio'){
    bodySel.value = 'earth';
    alt.value = '5500';
    rkm.value = '6400';
    mass.value = '6e24';
    G.value = '6.67e-11';
    useMu.checked = false;
    muInput.value = '';
  }else if(name==='earth5500'){
    bodySel.value = 'earth';
    setBody('earth');
    alt.value = '5500';
    G.value   = String(MODERN.G);
    useMu.checked = false;
  }
}

function fmt(x, p){
  if(!isFinite(x)) return '—';
  if(Math.abs(x)>=1e4 || Math.abs(x)<1e-2) return x.toExponential(p);
  return x.toLocaleString(undefined,{maximumFractionDigits:p});
}
function hms(seconds){
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const frac = seconds - Math.floor(seconds);
  const sPrec = (s + frac).toFixed(1);
  return `${h} h ${m} min ${sPrec} s`;
}
function num(v){
  return Number(String(v).trim().replace(',', '.'));
}

function compute(){
  const p = Number(precision.value)||3;
  const Rkm = num(rkm.value);
  const altkm = num(alt.value);
  const M = num(mass.value);
  const Gc = num(G.value);
  const muField = num(muInput.value);
  const use_mu = useMu.checked && isFinite(muField) && muField>0;

  const r = (Rkm + (isFinite(altkm)?altkm:0)) * 1000; // m
  const mu = use_mu ? muField : (Gc * M); // m^3/s^2

  const v = Math.sqrt(mu / r); // m/s
  const T = 2 * Math.PI * r / v; // s

  const vkms = v/1000;
  const rkm_out = r/1000;

  out.innerHTML = `
    <div>Raggio orbitale <span class="mono">${fmt(rkm_out,p)} km</span></div>
    <div>Parametro gravitazionale μ <span class="mono">${mu.toExponential(6)} m³/s²</span></div>
    <div>Velocità orbitale <strong class="mono">${fmt(v,p)} m/s</strong> (<span class="mono">${fmt(vkms,p)} km/s</span>)</div>
    <div>Periodo <strong class="mono">${fmt(T,p)} s</strong> — <span class="mono">${hms(T)}</span></div>
  `;

  work.textContent =
`v = √(μ / r),  T = 2πr / v
Dati: ${use_mu?`μ (dato) = ${mu}`:`G = ${Gc},  M = ${M},  μ = G·M = ${(Gc*M).toExponential()}`} 
r = (${Rkm} + ${isFinite(altkm)?altkm:0})·10³ = ${r.toExponential()} m
⇒ v = √(μ / r) = √(${(mu).toExponential()} / ${(r).toExponential()}) = ${v.toExponential()} m/s
⇒ T = 2πr / v = ${T.toExponential()} s  ≈  ${hms(T)}`;

  updateSim({ r, mu, T, v });
}

// === Simulazione orbitale ===
const canvas = el('orbCanvas');
const ctx = canvas.getContext('2d');
const simInfo = el('simInfo');
const speed = el('speed');
const playBtn = el('playBtn');
const pauseBtn = el('pauseBtn');

let sim = {
  r: 1, mu: 1, T: 1, v: 1,
  angle: 0, running: false,
  lastTime: 0
};

// Retina scale
function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.width * dpr); // square
  ctx.setTransform(dpr,0,0,dpr,0,0); // use CSS pixels for drawing
}
window.addEventListener('resize', fitCanvas);

function updateSim(params){
  Object.assign(sim, params);
  sim.angle = 0;
  draw();
  updateInfo(0);
}

function updateInfo(speedFactor){
  simInfo.textContent = `T ≈ ${hms(sim.T)}  •  v ≈ ${(sim.v/1000).toFixed(2)} km/s  •  scala ×${Number(speed.value).toFixed(1)}`;
}

function draw(){
  const width = canvas.clientWidth;
  const height = canvas.clientWidth; // square
  const cx = width/2, cy = height/2;

  const ctx2 = canvas.getContext('2d');
  ctx2.clearRect(0,0,width,height);

  // scale orbit to fit
  const margin = Math.min(cx,cy)*0.15;
  const maxRadiusPx = Math.min(cx,cy) - margin;
  const r_px = maxRadiusPx; // orbit circle radius

  // Draw orbit circle
  ctx2.strokeStyle = '#2f5f84';
  ctx2.lineWidth = 2;
  ctx2.beginPath();
  ctx2.arc(cx, cy, r_px, 0, Math.PI*2);
  ctx2.stroke();

  // Central body
  ctx2.fillStyle = '#2274a5';
  const bodyRadius = Math.max(8, Math.min(30, r_px*0.08));
  ctx2.beginPath();
  ctx2.arc(cx, cy, bodyRadius, 0, Math.PI*2);
  ctx2.fill();

  // Satellite position
  const x = cx + r_px * Math.cos(sim.angle);
  const y = cy + r_px * Math.sin(sim.angle);
  ctx2.fillStyle = '#6fd3ff';
  ctx2.beginPath();
  ctx2.arc(x, y, 6, 0, Math.PI*2);
  ctx2.fill();

  // Velocity vector (tangent)
  const vx = -Math.sin(sim.angle);
  const vy =  Math.cos(sim.angle);
  ctx2.strokeStyle = '#6fd3ff';
  ctx2.beginPath();
  ctx2.moveTo(x, y);
  ctx2.lineTo(x + vx*30, y + vy*30);
  ctx2.stroke();
}

function step(ts){
  if(!sim.running){ return; }
  if(!sim.lastTime){ sim.lastTime = ts; }
  const dt = (ts - sim.lastTime)/1000; // seconds real
  sim.lastTime = ts;
  const scale = Number(speed.value); // realtime factor

  // Angular speed ω = sqrt(μ / r^3)
  const omega = Math.sqrt(sim.mu / (sim.r*sim.r*sim.r)); // rad/s
  sim.angle += omega * dt * scale;
  if(sim.angle > Math.PI*2) sim.angle -= Math.PI*2;

  draw();
  updateInfo(scale);
  requestAnimationFrame(step);
}

playBtn.addEventListener('click', ()=>{
  if(!sim.running){
    sim.running = true;
    sim.lastTime = 0;
    requestAnimationFrame(step);
  }
});
pauseBtn.addEventListener('click', ()=>{
  sim.running = false;
});
speed.addEventListener('input', ()=> updateInfo(Number(speed.value)));

// === Wiring ===
preset.addEventListener('change', e => { setPreset(e.target.value); compute(); });
bodySel.addEventListener('change', e => { setBody(e.target.value); compute(); });

document.getElementById('calcBtn').addEventListener('click', compute);
document.getElementById('casioBtn').addEventListener('click', ()=>{ setPreset('casio'); compute(); });

useMu.addEventListener('change', ()=>{
  muInput.disabled = !useMu.checked ? false : false; // keep enabled for editing
});

// initial
fitCanvas();
setBody('earth');
setPreset('earth5500');
compute();

// PWA
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js');
  });
}
