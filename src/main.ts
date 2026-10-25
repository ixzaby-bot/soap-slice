import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cutAmount, soapHeight, randomSeed, STROKE_LIMIT } from './mechanics';
import { ShavingAudio } from './audio';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('canvas'), host = $('scene');
const audio = new ShavingAudio();
const palettes = [
  { name: 'ROSE MARBLE', dark: '#b83f60', light: '#f7b5bf', stripe: '#ffe3d8' },
  { name: 'MATCHA CLOUD', dark: '#599485', light: '#b9dfbb', stripe: '#f1eed2' },
  { name: 'LAVENDER DREAM', dark: '#8170b1', light: '#d2bce7', stripe: '#f4dded' },
];
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch { $('error').hidden = false; $('error').textContent = '3D表示を開始できませんでした。WebGL対応ブラウザで開いてください。'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0xf4eee8, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
camera.position.set(5.7, 7.3, 8.8); camera.lookAt(0, .45, 0);
scene.add(new THREE.HemisphereLight(0xfffbf1, 0xb8a2a3, 2.6));
const sun = new THREE.DirectionalLight(0xfff7eb, 3.5); sun.position.set(-3, 8, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5; sun.shadow.normalBias = .035; scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .09 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.06; floor.receiveShadow = true; scene.add(floor);
const tray = new THREE.Mesh(new RoundedBoxGeometry(4.6, .15, 4.4, 4, .18), new THREE.MeshStandardMaterial({ color: '#ede1d8', roughness: .84 })); tray.position.y = -.08; tray.receiveShadow = true; scene.add(tray);
const soapGroup = new THREE.Group(); scene.add(soapGroup);
const soapMaterial = new THREE.MeshStandardMaterial({ roughness: .46, metalness: .02 });
const soap = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1, 2.4, 4, .08), soapMaterial); soap.castShadow = true; soap.receiveShadow = true; soapGroup.add(soap);
const topMaterial = new THREE.MeshStandardMaterial({ roughness: .5 });
const top = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 2.24), topMaterial); top.rotation.x = -Math.PI / 2; soapGroup.add(top);
let marble: THREE.CanvasTexture | undefined;
function texture(level: number) {
  const pal = palettes[(level - 1) % 3], rng = randomSeed(level * 141);
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d')!; ctx.fillStyle = pal.dark; ctx.fillRect(0, 0, 512, 512);
  const phase = rng() * 10;
  for (let y = -180; y < 700; y += 6 + rng() * 13) {
    ctx.beginPath();
    for (let x = -10; x < 530; x += 4) { const yy = y + Math.sin(x * .012 + y * .014 + phase) * 36 + Math.sin(x * .027 + y * .009) * 16; if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.strokeStyle = rng() > .35 ? pal.light : pal.stripe; ctx.lineWidth = 2 + rng() * 9; ctx.globalAlpha = .35 + rng() * .55; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  marble?.dispose(); marble = new THREE.CanvasTexture(c); marble.colorSpace = THREE.SRGBColorSpace; marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
  soapMaterial.map = marble; topMaterial.map = marble; soapMaterial.needsUpdate = topMaterial.needsUpdate = true;
}
const knife = new THREE.Group(); scene.add(knife);
const bladeShape = new THREE.Shape(); bladeShape.moveTo(-1.32, 0); bladeShape.lineTo(1.35, 0); bladeShape.lineTo(1.35, .45); bladeShape.lineTo(-1.15, .45); bladeShape.quadraticCurveTo(-1.38, .35, -1.32, 0);
const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .045, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#d7e3e6', metalness: .75, roughness: .24 }));
blade.rotation.x = -.34; blade.castShadow = true; knife.add(blade);
const edge = new THREE.Mesh(new THREE.BoxGeometry(2.65, .025, .065), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: .8, roughness: .15 })); knife.add(edge);
const handle = new THREE.Mesh(new RoundedBoxGeometry(.95, .27, .27, 3, .07), new THREE.MeshStandardMaterial({ color: '#383038', roughness: .6 })); handle.position.set(1.76, .27, -.045); handle.castShadow = true; knife.add(handle);
for (const x of [1.48, 1.96]) { const rivet = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#b1a7a1', metalness: .7, roughness: .3 })); rivet.position.set(x, .407, -.045); knife.add(rivet); }

const CAPACITY = 400;
let budget = matchMedia('(pointer:coarse)').matches ? 240 : 400;
type Chip = { active: boolean; p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; spin: THREE.Vector3; size: number; life: number; maxLife: number; confetti: boolean };
const chips: Chip[] = Array.from({ length: CAPACITY }, () => ({ active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), spin: new THREE.Vector3(), size: 0, life: 0, maxLife: 1, confetti: false }));
const pieces = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .72 }), CAPACITY); pieces.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pieces.frustumCulled = false; scene.add(pieces);
const dummy = new THREE.Object3D(), color = new THREE.Color();
let cursor = 0, level = 1, progress = 0, free = false, cleared = false, freeTimer = 0;
let pointer: number | null = null, lastY = 0, lastTime = 0, stroke = 0, targetZ = -1.12, spawnRemainder = 0, lastHaptic = 0;
function emit(amount: number, celebration = false) {
  const palette = palettes[(level - 1) % 3];
  for (let n = 0; n < amount; n++) {
    cursor = (cursor + 1) % budget; const p = chips[cursor];
    p.active = true; p.confetti = celebration; p.size = celebration ? .07 + Math.random() * .06 : .045 + Math.random() * .075;
    p.p.set((Math.random() - .5) * 2.28, celebration ? 1 + Math.random() : knife.position.y + .045, celebration ? (Math.random() - .5) * 2 : knife.position.z + .035);
    p.v.set((Math.random() - .5) * 2.1, celebration ? 3 + Math.random() * 3 : .7 + Math.random() * 1.6, celebration ? (Math.random() - .5) * 3 : 1.2 + Math.random() * 1.9);
    p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); p.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    p.maxLife = p.life = celebration ? 3.5 : 3 + Math.random() * 2;
    color.set(celebration ? ['#dbb564', '#f7c9d0', '#b0c8a5', '#b8a3ce'][n % 4] : Math.random() < .3 ? palette.stripe : Math.random() < .5 ? palette.light : palette.dark);
    pieces.setColorAt(cursor, color);
  }
  if (pieces.instanceColor) pieces.instanceColor.needsUpdate = true;
}
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .23 : .48; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) starShape.moveTo(x, y); else starShape.lineTo(x, y); } starShape.closePath();
const reward = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: .15, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 3, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#eabb50', metalness: .65, roughness: .23 })); reward.visible = false; reward.castShadow = true; scene.add(reward);
function updateSoap() { const h = soapHeight(progress); soap.scale.y = h; soap.position.y = h / 2 + .02; top.position.y = h + .022; if (marble) { marble.offset.y = progress * 1.7; marble.rotation = Math.sin(progress * 8) * .15; } }
function updateUI() { const percent = Math.round(progress * 100); $('percent').innerHTML = `${percent}<span>%</span>`; $('progress').style.width = `${percent}%`; document.querySelector('.track')!.setAttribute('aria-valuenow', String(percent)); }
function stop() { if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer); pointer = null; audio.stop(); }
function reset(advance = false) {
  stop(); if (advance) level++; progress = 0; cleared = false; freeTimer = 0; stroke = 0; spawnRemainder = 0; targetZ = -1.12;
  chips.forEach(p => p.active = false); reward.visible = false; knife.visible = true; $('complete').hidden = true; $('hint').hidden = false;
  $('level').textContent = `LEVEL ${String(level).padStart(2, '0')}`; $('soap-name').textContent = `${String((level - 1) % 3 + 1).padStart(2, '0')} — ${palettes[(level - 1) % 3].name}`;
  texture(level); updateSoap(); knife.position.set(0, soapHeight(0) + .035, -1.12); updateUI();
}
function finish() { cleared = true; stop(); if (free) { freeTimer = .5; return; } knife.visible = false; reward.visible = true; emit(100, true); $('complete').hidden = false; $('hint').hidden = true; }
canvas.addEventListener('pointerdown', e => {
  if (pointer !== null || cleared || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); pointer = e.pointerId; canvas.setPointerCapture(e.pointerId); lastY = e.clientY; lastTime = performance.now(); stroke = 0; targetZ = -1.12;
  // A new stroke starts at the back edge; both blade and emission share this position.
  knife.position.z = targetZ; void audio.unlock().catch(() => {});
});
canvas.addEventListener('pointermove', e => {
  if (pointer !== e.pointerId || cleared) return;
  const now = performance.now(), delta = e.clientY - lastY, elapsed = Math.max(8, now - lastTime); lastY = e.clientY; lastTime = now;
  const amount = cutAmount(delta, host.clientHeight, stroke, progress);
  if (amount <= 0) { audio.stop(); return; }
  stroke += amount; progress = Math.min(1, progress + amount); targetZ = -1.12 + Math.min(1, stroke / STROKE_LIMIT) * 2.24;
  updateSoap(); updateUI();
  // Sample the entire travelled contact line so fast pointer events still leave a continuous shower.
  const oldZ = knife.position.z; const count = Math.floor(spawnRemainder + amount * 1350); spawnRemainder = spawnRemainder + amount * 1350 - count;
  knife.position.y = soapHeight(progress) + .035;
  for (let i = 0; i < count; i++) { knife.position.z = THREE.MathUtils.lerp(oldZ, targetZ, (i + 1) / count); emit(1); }
  knife.position.z = targetZ;
  audio.scrape(delta / elapsed * 1000);
  if (now - lastHaptic > 85 && navigator.vibrate) { navigator.vibrate(5); lastHaptic = now; }
  if (progress >= 1 - 1e-8) { progress = 1; updateUI(); finish(); }
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { if ((e as PointerEvent).pointerId === pointer) stop(); });
window.addEventListener('pointerup', stop); window.addEventListener('blur', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('reset').onclick = () => reset(); $('next').onclick = () => reset(true);
$('sound').onclick = () => { audio.enabled = !audio.enabled; $('sound').setAttribute('aria-pressed', String(audio.enabled)); $('sound-label').textContent = `音 ${audio.enabled ? 'ON' : 'OFF'}`; if (audio.enabled) void audio.unlock().catch(() => {}); else audio.stop(); };
$('free').onclick = () => { free = !free; $('free').setAttribute('aria-pressed', String(free)); $('mode-label').textContent = free ? 'おわりのない、ひと休み。' : 'ゆっくり、ひと削り。'; reset(); };
function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < .8 ? 42 : 34; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host); resize(); reset();
let previous = performance.now(), sampleTime = 0, frames = 0;
function frame(now: number) {
  requestAnimationFrame(frame); const raw = (now - previous) / 1000; previous = now; if (document.hidden) return; const dt = Math.min(raw, .035);
  sampleTime += raw; frames++;
  if (sampleTime > 3) { const fps = frames / sampleTime; if (fps < 44) { budget = Math.max(100, budget - 60); renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .25)); resize(); } else if (fps > 57) budget = Math.min(CAPACITY, budget + 20); sampleTime = 0; frames = 0; }
  if (freeTimer > 0) { freeTimer -= dt; if (freeTimer <= 0) reset(true); }
  knife.position.y = THREE.MathUtils.lerp(knife.position.y, soapHeight(progress) + .035, 1 - Math.exp(-22 * dt));
  for (let i = 0; i < CAPACITY; i++) {
    const p = chips[i]; if (p.active) {
      p.life -= dt; if (p.life <= 0) p.active = false;
      p.v.y -= (p.confetti ? 3.4 : 9.8) * dt; p.p.addScaledVector(p.v, dt);
      const inSoap = Math.abs(p.p.x) < 1.2 && Math.abs(p.p.z) < 1.2;
      const floorY = inSoap ? soapHeight(progress) + .025 : Math.abs(p.p.x) < 2.3 && Math.abs(p.p.z) < 2.2 ? 0 : -.055;
      const bottom = floorY + p.size / 2;
      if (p.p.y < bottom && p.v.y < 0) { p.p.y = bottom; p.v.y *= -.25; p.v.x *= .76; p.v.z *= .76; p.spin.multiplyScalar(.85); if (Math.abs(p.v.y) < .12) p.v.y = 0; }
      p.r.x += p.spin.x * dt; p.r.y += p.spin.y * dt; p.r.z += p.spin.z * dt;
      dummy.position.copy(p.p); dummy.rotation.copy(p.r); const size = p.size * Math.min(1, p.life / .65); dummy.scale.set(size, p.confetti ? size * .16 : size, size);
    }
    if (!p.active) dummy.scale.setScalar(0);
    dummy.updateMatrix(); pieces.setMatrixAt(i, dummy.matrix);
  }
  pieces.instanceMatrix.needsUpdate = true;
  if (reward.visible) { reward.position.set(0, .85 + Math.sin(now * .002) * .08, 0); reward.rotation.y = now * .0007; }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); });
