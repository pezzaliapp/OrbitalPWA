const el = id => document.getElementById(id);
const bodySel = el('bodySel'), preset = el('preset'), alt = el('alt_km'), rkm = el('r_km'), mass = el('mass'), G = el('G');
const out = el('out'), precision = el('precision'); const useMu = el('useMu'), muInput = el('mu');
const incl = el('incl'), az = el('az'), inclTxt = el('inclTxt'), azTxt = el('azTxt');
const lblBody = el('lblBody'), lblSat = el('lblSat'), lblV = el('lblV'), lblG = el('lblG');
const spd = el('speed'), spdTxt = el('spdTxt');

const MODERN = {
  G: 6.67430e-11,
  bodies: {
    earth:   { name:'Terra',   Rkm: 6371.0,   M: 5.972e24, mu: 3.986004418e14, color:'#2aa3ff' },
    moon:    { name:'Luna',    Rkm: 1737.4,   M: 7.34767309e22, mu: 4.9048695e12, color:'#c9ced6' },
    mars:    { name:'Marte',   Rkm: 3389.5,   M: 6.4171e23, mu: 4.282837e13, color:'#ff6b4a' },
    jupiter: { name:'Giove',   Rkm: 69911.0,  M: 1.898e27,  mu: 1.26686534e17, color:'#ffb35a' }
  }
};

// populate body select
for(const k of Object.keys(MODERN.bodies)){
  const o = document.createElement('option'); o.value = k; o.textContent = MODERN.bodies[k].name; bodySel.appendChild(o);
}

function num(v){ return Number(String(v).trim().replace(',', '.')); }
function fmt(x, p){ if(!isFinite(x)) return '—'; if(Math.abs(x)>=1e4 || Math.abs(x)<1e-2) return x.toExponential(p); return x.toLocaleString(undefined,{maximumFractionDigits:p}); }
function hms(seconds){ const s=Math.floor(seconds%60); const m=Math.floor((seconds/60)%60); const h=Math.floor(seconds/3600); const frac=seconds-Math.floor(seconds); return `${h} h ${m} min ${(s+frac).toFixed(1)} s`; }

function setBody(name){
  const b = MODERN.bodies[name]; if(!b) return;
  rkm.value = b.Rkm; mass.value = b.M; muInput.value = b.mu;
  current.colors = { planet: b.color, sat: '#6fd3ff' };
  compute();
}
function setPreset(name){
  if(name==='casio'){ bodySel.value = 'earth'; alt.value='5500'; rkm.value='6400'; mass.value='6e24'; G.value='6.67e-11'; useMu.checked=false; muInput.value=''; }
  else if(name==='earth5500'){ bodySel.value='earth'; alt.value='5500'; setBody('earth'); G.value=String(MODERN.G); useMu.checked=false; }
}

function compute(){
  const p = Number(precision.value)||3;
  const Rkm = num(rkm.value), altkm = num(alt.value), M = num(mass.value), Gc = num(G.value);
  const muField = num(muInput.value); const use_mu = useMu.checked && isFinite(muField) && muField>0;
  const r = (Rkm + (isFinite(altkm)?altkm:0)) * 1000; // m
  const mu = use_mu ? muField : (Gc * M);
  const v = Math.sqrt(mu / r); // m/s
  const T = 2 * Math.PI * r / v; // s
  const g_here = mu / (r*r); // m/s^2
  const vkms = v/1000;

  out.innerHTML = `Raggio orbitale <span class="mono">${fmt(r/1000,p)} km</span><br>
  Parametro μ <span class="mono">${mu.toExponential(6)} m³/s²</span><br>
  Velocità <strong class="mono">${fmt(v,p)} m/s</strong> (<span class="mono">${fmt(vkms,p)} km/s</span>)<br>
  Periodo <strong class="mono">${fmt(T,p)} s</strong> — <span class="mono">${hms(T)}</span>`;

  lblBody.textContent = MODERN.bodies[bodySel.value].name;
  lblSat.textContent = 'Satellite';
  lblV.textContent = `${vkms.toFixed(2)} km/s`;
  lblG.textContent = g_here.toFixed(3);

  updateSim({ r, mu, T, v });
}

// ====== Responsive canvas & Faux-3D ======
const canvas = el('orbCanvas'); const ctx = canvas.getContext('2d');
let current = { r:1, mu:1, T:1, v:1, angle:0, running:false, last:0, colors:{planet:'#2aa3ff',sat:'#6fd3ff'} };

function fitCanvas(){
  const maxW = canvas.parentElement.clientWidth;
  const maxH = 420;
  const w = Math.min(maxW, 800);
  const h = Math.min(w, maxH);
  const dpr = window.devicePixelRatio||1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', fitCanvas);

function project3D(x,y,z, w,h){
  const fov = 600;
  const s = fov/(fov - z);
  return { x: w/2 + x*s, y: h/2 + y*s, s };
}

function draw(){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.width/dpr, h = canvas.height/dpr;
  ctx.clearRect(0,0,w,h);

  const Rpx = Math.min(w,h)*0.38;
  const inc = Number(incl.value) * Math.PI/180;
  const azi = Number(az.value) * Math.PI/180;

  // Orbit ring: back half
  ctx.lineWidth = 2;
  for(const pass of [0,1]){
    ctx.beginPath();
    for(let i=0;i<=180;i++){
      const t = i/180*2*Math.PI;
      let x=Rpx*Math.cos(t), y=0, z=Rpx*Math.sin(t);
      let y1 = y*Math.cos(inc) - z*Math.sin(inc);
      let z1 = y*Math.sin(inc) + z*Math.cos(inc);
      let x2 = x*Math.cos(azi) + z1*Math.sin(azi);
      let z2 = -x*Math.sin(azi) + z1*Math.cos(azi);
      if((pass===0 && z2<=0) || (pass===1 && z2>0)){
        const P = project3D(x2,y1,z2,w,h);
        if(i===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
      }
    }
    ctx.strokeStyle = pass===0 ? 'rgba(111,211,255,0.8)' : 'rgba(111,211,255,0.25)';
    ctx.stroke();
  }

  // Planet
  const planetR = Math.max(10, Math.min(40, Rpx*0.12));
  ctx.beginPath(); ctx.arc(w/2, h/2, planetR, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(w/2-planetR*0.3,h/2-planetR*0.3,planetR*0.2,w/2,h/2,planetR);
  grd.addColorStop(0, current.colors.planet); grd.addColorStop(1, '#0a1826');
  ctx.fillStyle = grd; ctx.fill();

  // Satellite position
  const angle = current.angle;
  let x=Rpx*Math.cos(angle), y=0, z=Rpx*Math.sin(angle);
  let y1 = y*Math.cos(inc) - z*Math.sin(inc);
  let z1 = y*Math.sin(inc) + z*Math.cos(inc);
  let x2 = x*Math.cos(azi) + z1*Math.sin(azi);
  let z2 = -x*Math.sin(azi) + z1*Math.cos(azi);
  const P = project3D(x2,y1,z2,w,h);
  ctx.beginPath(); ctx.fillStyle = current.colors.sat; ctx.arc(P.x,P.y,6*(P.s),0,Math.PI*2); ctx.fill();

  // Velocity vector
  const vx3=-Math.sin(angle), vy3=0, vz3=Math.cos(angle);
  let vy1 = vy3*Math.cos(inc) - vz3*Math.sin(inc);
  let vz1 = vy3*Math.sin(inc) + vz3*Math.cos(inc);
  let vx2 = vx3*Math.cos(azi) + vz1*Math.sin(azi);
  let vz2 = -vx3*Math.sin(azi) + vz1*Math.cos(azi);
  const P2 = project3D(x2+vx2*35, y1+vy1*35, z2+vz2*35, w,h);
  ctx.strokeStyle='rgba(111,211,255,0.9)'; ctx.beginPath(); ctx.moveTo(P.x,P.y); ctx.lineTo(P2.x,P2.y); ctx.stroke();

  // labels
  ctx.fillStyle='#cfe6ff'; ctx.font='12px system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText(MODERN.bodies[bodySel.value].name, w/2+planetR+6, h/2-planetR-6);
  ctx.fillText('Satellite', P.x+8, P.y-8);
}

function step(ts){
  if(!current.running) return;
  if(!current.last) current.last = ts;
  const dt = (ts-current.last)/1000; current.last = ts;
  const omega = Math.sqrt(current.mu / (current.r**3));
  current.angle += omega * dt * Number(spd.value);
  if(current.angle > Math.PI*2) current.angle -= Math.PI*2;
  draw(); spdTxt.textContent = Number(spd.value).toFixed(1);
  requestAnimationFrame(step);
}

function updateSim(params){ Object.assign(current, params); current.angle=0; draw(); }
function play(){ if(!current.running){ current.running=true; current.last=0; requestAnimationFrame(step);} }
function pause(){ current.running=false; }

// events
bodySel.addEventListener('change', e=> setBody(e.target.value));
preset.addEventListener('change', e=> { setPreset(e.target.value); compute(); });
document.getElementById('calcBtn').addEventListener('click', compute);
document.getElementById('casioBtn').addEventListener('click', ()=>{ setPreset('casio'); compute(); });
document.getElementById('playBtn').addEventListener('click', play);
document.getElementById('pauseBtn').addEventListener('click', pause);
spd.addEventListener('input', ()=> spdTxt.textContent = Number(spd.value).toFixed(1));
incl.addEventListener('input', ()=> { inclTxt.textContent = incl.value; draw(); });
az.addEventListener('input', ()=> { azTxt.textContent = az.value; draw(); });

// init
bodySel.value='earth'; setBody('earth'); preset.value='earth5500';
el('inclTxt').textContent=incl.value; el('azTxt').textContent=az.value; spdTxt.textContent=spd.value;
compute(); fitCanvas();
