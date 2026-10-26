// Oikos (project 01): the wildfire detector, as an interactive model with a parts list, the same way the V8 and
// fin can viewers work. There is no CAD export for this one, so the geometry is rebuilt in code from the team's
// CAD render (the exploded video in our pitch deck): the case, the solar roof, the antenna, the battery and the
// circuit board with its layers and parts. Units are millimetres; +Y is up and the front of the case faces +Z.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ what each part is
// explode: where the part moves to in the exploded view (mm). The circuit board's layers and parts spread further.
const GROUPS = [
  { id: 'cover', cat: 'Outside', name: 'Front cover', count: '×1', color: '#b2c6a1',
    blurb: 'The front of the case, with the Oikos logo moulded in. It comes off for maintenance, and four screws pull it tight against a seal in the housing’s rim.',
    specs: [['Fixings', '4 screws'], ['Sealed by', 'A gasket in the housing rim']] },
  { id: 'port', cat: 'Outside', name: 'Sensor window', count: '×1', color: '#e9ede4',
    blurb: 'A hooded opening low on the front. Outside air reaches the sensors through it, and the hood keeps the rain off.',
    specs: [['Faces', 'Down and out, away from the rain']] },
  { id: 'housing', cat: 'Outside', name: 'Housing', count: '×1', color: '#a3b891',
    blurb: 'The back of the case. It holds the battery and the circuit board, with a groove round the rim for the weather seal and a screw boss in each corner.',
    specs: [['Holds', 'Battery, circuit board'], ['Seal', 'Gasket round the rim']] },
  { id: 'screws', cat: 'Outside', name: 'Screws', count: '×4', color: '#9aa0a6',
    blurb: 'One in each corner, holding the front cover onto the housing.',
    specs: [['Count', '4']] },
  { id: 'roof', cat: 'Power & comms', name: 'Roof', count: '×1', color: '#235a3f',
    blurb: 'A sloped roof that sheds rain, shades the case and holds the solar panel at an angle to the sky.',
    specs: [['Shape', 'Sloped, overhanging the case']] },
  { id: 'solar', cat: 'Power & comms', name: 'Solar panel', count: '×1', color: '#14254a',
    blurb: 'Keeps the battery charged, so a detector can sit out on a hillside for months without anyone coming to charge it.',
    specs: [['Charges', 'The battery inside']] },
  { id: 'antenna', cat: 'Power & comms', name: 'Antenna', count: '×1', color: '#9fb78f',
    blurb: 'Sends readings and alerts over the mobile network, so it works on hills with no Wi-Fi. Our working prototype used an LTE modem with a SIM card.',
    specs: [['Network', 'LTE (mobile data)'], ['In the prototype', 'Pimoroni LTE modem + SIM']] },
  { id: 'battery', cat: 'Inside', name: 'Battery', count: '×1', color: '#1f8a96',
    blurb: 'A rechargeable cell that runs everything between sunny spells, charged by the solar panel.',
    specs: [['Charged by', 'Solar panel'], ['In the prototype', 'The Pico LiPo board charges a LiPo cell']] },
  { id: 'pcb', cat: 'Inside', name: 'Circuit board', count: '×1', color: '#2e7d5b',
    blurb: 'One board carries everything. In the exploded view it splits into its layers: the green solder mask on each face, the copper that carries the signals, and the core in between.',
    specs: [['Layers shown', '4: mask, copper, core, mask']] },
  { id: 'mcu', cat: 'Inside', name: 'Microcontroller', count: '×1', color: '#1a1a1a',
    blurb: 'The brain. It reads the sensors, works out the fire risk with the Fire Weather Index (using Met Éireann’s rain and wind data too) and decides when to raise an alert.',
    specs: [['In the prototype', 'Pimoroni Pico LiPo 2 W'], ['Code', 'MicroPython'], ['Risk model', 'Canadian Fire Weather Index']] },
  { id: 'gas', cat: 'Inside', name: 'Gas & climate sensor', count: '×1', color: '#f2f2f2',
    blurb: 'Measures temperature, humidity, pressure and gases in the air. Heat and smoke from a fire nearby show up here first.',
    specs: [['Measures', 'Temperature, humidity, pressure, gas'], ['In the prototype', 'Bosch BME688']] },
  { id: 'co2', cat: 'Inside', name: 'CO₂ sensor', count: '×1', color: '#e4e6ea',
    blurb: 'Burning vegetation releases CO₂, so a sudden rise is a strong sign of a fire, and harder to fool than temperature alone.',
    specs: [['Measures', 'CO₂ concentration'], ['In the prototype', 'Sensirion SCD-30']] },
  { id: 'gps', cat: 'Inside', name: 'GPS module', count: '×1', color: '#d9dcdf',
    blurb: 'Tags every reading with where the detector is, so an alert says exactly where to send someone.',
    specs: [['Gives', 'Location of each reading']] },
  { id: 'parts', cat: 'Inside', name: 'Connectors & small parts', count: '×11', color: '#e8e2cf',
    blurb: 'The plugs, header pins, button, aerial socket and small components that tie the board together.',
    specs: [['Includes', 'Plugs, header pins, a button, an aerial socket, capacitors']] },
];
const INSIDE = new Set(GROUPS.filter((g) => g.cat === 'Inside').map((g) => g.id));

const ACCENT = new THREE.Color('#ffffff');

// ------------------------------------------------------------------ geometry helpers
function rrPath(w, h, r, path = new THREE.Shape()) {
  const x = w / 2, y = h / 2;
  path.moveTo(-x + r, -y);
  path.lineTo(x - r, -y); path.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x, y - r); path.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  path.lineTo(-x + r, y); path.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-x, -y + r); path.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
// a rounded slab w x h x d, centred, its face towards +Z
function slab(w, h, d, r, b = 0) {
  const g = new THREE.ExtrudeGeometry(rrPath(w - 2 * b, h - 2 * b, Math.max(0.2, r - b)), {
    depth: d - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
// a rounded ring (an open box's walls)
function ring(w, h, r, wall, d) {
  const s = rrPath(w, h, r);
  s.holes.push(rrPath(w - 2 * wall, h - 2 * wall, Math.max(0.5, r - wall), new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -d / 2);
  return g;
}
const cylZ = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// canvas textures for the circuit board's layers and the moulded logo
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function traces(ctx, w, h, color, n, seed) {
  const r = rng(seed);
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    let x = r() * w, y = r() * h;
    ctx.lineWidth = 2 + r() * 3;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() < 0.5) x += (r() - 0.5) * w * 0.5; else y += (r() - 0.5) * h * 0.4;
      const d = (r() - 0.5) * 30;
      ctx.lineTo(x + d, y + d);
    }
    ctx.stroke();
  }
}

// the team's CAD render: a short silent loop that plays while it's on screen (and never on its own under
// reduced motion, where it keeps its controls instead)
export function initOikosVideo(video) {
  if (!video || video.dataset.ready) return;
  video.dataset.ready = '1';
  if (document.documentElement.classList.contains('reduce-motion') || !('IntersectionObserver' in window)) { video.controls = true; return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) video.play().catch(() => { video.controls = true; });
    else video.pause();
  }, { threshold: 0.35 }).observe(video);
}

let started = false;
export function initOikos() {
  if (started) return;
  started = true;
  const stage = document.getElementById('ok-stage');
  const canvas = document.getElementById('ok-canvas');
  const loading = document.getElementById('ok-loading');
  const tip = document.getElementById('ok-tip');
  const reduced = document.documentElement.classList.contains('reduce-motion');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.classList.add('failed');
    document.getElementById('ok-loading-text').textContent = 'Your browser can’t show 3D (WebGL is off). The CAD render further down shows the detector.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(160, 320, 260); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 0.9); rim.position.set(-260, 120, -220); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', '#111111', 0.3));

  const root = new THREE.Group();
  scene.add(root);

  const camera = new THREE.PerspectiveCamera(30, 1, 5, 6000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 60;
  controls.maxDistance = 1600;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.6;
  let cameraMoved = false, camAnim = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; cameraMoved = true; camAnim = null; });
  // don't trap page scrolling: wheel zoom switches on once you click into the model
  controls.enableZoom = false;
  canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
  stage.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive 3D model of the Oikos wildfire detector. Use the arrow keys to turn it, and + or − to zoom.');
  canvas.addEventListener('keydown', (e) => {
    const step = (e.shiftKey ? 30 : 10) * Math.PI / 180;
    const turn = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    const zoom = { '+': 0.85, '=': 0.85, '-': 1 / 0.85, '_': 1 / 0.85 }[e.key];
    if (!turn && !zoom) return;
    e.preventDefault();
    controls.autoRotate = false; cameraMoved = true; camAnim = null;
    const off = camera.position.clone().sub(controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    if (turn) { s.theta += turn[0]; s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi - turn[1])); }
    if (zoom) s.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, s.radius * zoom));
    camera.position.copy(controls.target).add(off.setFromSpherical(s));
    controls.update();
  });
  if (window.matchMedia('(pointer: coarse)').matches) {
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    canvas.style.touchAction = 'pan-y';
    const hint = document.querySelector('#ok-viewer .v-title p');
    if (hint) hint.textContent = 'Two fingers to rotate & zoom · tap a part';
  }

  // ---------------------------------------------------------------- materials + parts
  const groupState = {};
  GROUPS.forEach((g) => { groupState[g.id] = { g, mats: [], edgeMats: [], meshes: [], objs: [] }; });
  function mat(gid, color, o = {}) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.05, emissive: ACCENT.clone(), emissiveIntensity: 0 }, o));
    m.userData.opacity = o.opacity ?? 1;
    groupState[gid].mats.push(m);
    return m;
  }
  // add a mesh to a part object, with faint CAD-style edges
  function add(gid, obj, geo, material, at, edges = true) {
    const mesh = new THREE.Mesh(geo, material);
    if (at) mesh.position.copy(at);
    mesh.userData.gid = gid;
    obj.add(mesh);
    groupState[gid].meshes.push(mesh);
    if (edges) {
      const em = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.1, depthWrite: false });
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), em);
      lines.raycast = () => {};
      mesh.add(lines);
      groupState[gid].edgeMats.push(em);
    }
    return mesh;
  }
  // a part object: placed at `pos`, moving by `ex` when exploded
  function part(gid, pos, ex, rot) {
    const obj = new THREE.Group();
    obj.position.copy(pos);
    if (rot) obj.rotation.copy(rot);
    obj.userData = { base: pos.clone(), ex: ex.clone() };
    root.add(obj);
    groupState[gid].objs.push(obj);
    return obj;
  }

  // case: 80 x 100 x 44 mm. The housing runs from z = -22 to 16, the cover from 16 to 22.
  const W = 80, H = 100, R = 11;
  {
    const o = part('housing', v3(0, 0, 0), v3(0, -6, -18));
    const m = mat('housing', GROUPS[2].color, { roughness: 0.7 });
    add('housing', o, ring(W, H, R, 3, 34), m, v3(0, 0, -1));
    add('housing', o, slab(W, H, 4, R, 1.2), m, v3(0, 0, -20));
    add('housing', o, ring(W - 6, H - 6, R - 3, 1.6, 1.6), mat('housing', '#161616', { roughness: 0.9 }), v3(0, 0, 16.2), false);
    // screw bosses and the black bay beside the battery
    for (const [x, y] of [[-32, -42], [32, -42], [-32, 42], [32, 42]]) add('housing', o, cylZ(4, 30, 20), m, v3(x, y, -3), false);
    add('housing', o, slab(11, 70, 26, 2, 0.6), mat('housing', '#151515', { roughness: 0.6 }), v3(29, -2, -5));
  }
  {
    const o = part('cover', v3(0, 0, 19), v3(-96, 4, 46));
    add('cover', o, slab(W, H, 6, R, 2), mat('cover', GROUPS[0].color, { roughness: 0.75 }));
    // the moulded logo: a decal a hair in front of the face, in a slightly darker sage
    const logo = canvasTex(512, 160, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(60, 82, 58, 0.55)'; c.fillStyle = 'rgba(60, 82, 58, 0.55)';
      c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(18, 92); c.lineTo(78, 32); c.lineTo(138, 92); c.stroke();                       // the roof
      c.beginPath(); c.ellipse(78, 104, 18, 30, 0, 0, Math.PI * 2); c.lineWidth = 6; c.stroke();             // the leaf
      c.beginPath(); c.moveTo(78, 80); c.lineTo(78, 134); c.stroke();
      c.font = '600 92px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
      c.fillText('oikos', 168, 96);
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(46, 14.4), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.position.set(4, 24, 3.05);
    decal.raycast = () => {};
    groupState.cover.mats.push(decal.material);
    decal.material.userData.opacity = 1;
    decal.material.userData.decal = true;   // always blended: only the logo's pixels show
    o.add(decal);
  }
  {
    // the hooded window, low on the front-left of the cover
    const o = part('port', v3(-20, -24, 22), v3(-96, 4, 70));
    const m = mat('port', GROUPS[1].color, { roughness: 0.6, side: THREE.DoubleSide });
    add('port', o, new THREE.CylinderGeometry(8.5, 8.5, 7, 40, 1, true).rotateX(Math.PI / 2), m, v3(0, 0, 2.5));
    add('port', o, new THREE.CylinderGeometry(10.5, 10.5, 11, 40, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), m, v3(0, 0, 4.5));
    add('port', o, new THREE.CircleGeometry(7, 40), mat('port', '#fafafa', { roughness: 0.25, metalness: 0.1 }), v3(0, 0, 0.6), false);
  }
  {
    const m = mat('screws', GROUPS[3].color, { metalness: 0.85, roughness: 0.3 });
    for (const [x, y] of [[-32, -42], [32, -42], [-32, 42], [32, 42]]) {
      const o = part('screws', v3(x, y, 22.6), v3(x * 0.35 - 96, y * 0.25 + 4, 92));
      add('screws', o, cylZ(1.5, 16, 14), m, v3(0, 0, -8), false);
      add('screws', o, cylZ(3, 2, 20), m, v3(0, 0, 0.6));
    }
  }
  // roof: a wedge on the case top and a plate tilted down to the front (the panel faces forward and up)
  const SLOPE = 24 * Math.PI / 180, TAN = Math.tan(SLOPE);
  {
    const o = part('roof', v3(0, 50, 0), v3(0, 58, -6));
    const m = mat('roof', GROUPS[4].color, { roughness: 0.6 });
    const zf = 22, zb = -22, yUnder = (z) => 1 + (30 - z) * TAN;
    const sh = new THREE.Shape();
    sh.moveTo(zb, 0); sh.lineTo(zf, 0); sh.lineTo(zf, yUnder(zf)); sh.lineTo(zb, yUnder(zb)); sh.closePath();
    const wedge = new THREE.ExtrudeGeometry(sh, { depth: 76, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(38, 0, 0);
    add('roof', o, wedge, m);
    const span = 58, L = span / Math.cos(SLOPE);
    const plate = new THREE.Mesh(slab(98, L, 4, 3, 1), m);
    plate.rotation.x = -Math.PI / 2 + SLOPE;
    plate.position.set(0, 1 + (span / 2) * TAN + 2, 30 - span / 2);
    plate.userData.gid = 'roof';
    o.add(plate);
    groupState.roof.meshes.push(plate);
    const em = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.1, depthWrite: false });
    const pl = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry, 28), em); pl.raycast = () => {}; plate.add(pl);
    groupState.roof.edgeMats.push(em);
    // the panel sits in a shallow round recess on the plate
    const panelPos = plate.position.clone().add(v3(0, Math.cos(SLOPE), Math.sin(SLOPE)).multiplyScalar(2.6));
    const sp = part('solar', v3(0, 50, 0).add(panelPos), v3(0, 96, 4), new THREE.Euler(SLOPE, 0, 0));
    add('solar', sp, new THREE.CylinderGeometry(30, 30, 1.6, 72), mat('solar', GROUPS[5].color, { metalness: 0.55, roughness: 0.18 }));
    add('solar', sp, new THREE.CylinderGeometry(31.5, 31.5, 0.8, 72), mat('solar', '#244e3c', { roughness: 0.7 }), v3(0, -0.6, 0), false);
  }
  {
    // antenna: a swivel knuckle on the back wall and a rubber rod, standing up behind the roof
    const o = part('antenna', v3(-28, 34, -32), v3(-62, 26, 12));
    const m = mat('antenna', GROUPS[6].color, { roughness: 0.75 });
    add('antenna', o, box(6, 6, 7), m, v3(0, 0, 5), false);
    add('antenna', o, new THREE.CylinderGeometry(4, 4, 8, 24).rotateZ(Math.PI / 2), m);
    add('antenna', o, new THREE.CylinderGeometry(3.2, 3.6, 64, 24), m, v3(0, 34, 0));
    add('antenna', o, new THREE.SphereGeometry(3.2, 20, 12), m, v3(0, 66, 0), false);
  }
  {
    const o = part('battery', v3(12, -4, -5), v3(64, -14, -4));
    add('battery', o, new THREE.CylinderGeometry(9, 9, 62, 40), mat('battery', GROUPS[7].color, { roughness: 0.35, metalness: 0.2 }));
    add('battery', o, new THREE.CylinderGeometry(3.6, 3.6, 1.6, 24), mat('battery', '#c9ced3', { metalness: 0.9, roughness: 0.25 }), v3(0, 31.6, 0), false);
  }

  // ---------------------------------------------------------------- circuit board: 34 x 56 mm, facing the front
  const PCB = v3(-17, 2, -14);            // the board's centre inside the case
  const PCB_EX = v3(168, 6, 0);          // where the board goes in the exploded view
  const LAYER_GAP = 11;
  const maskTop = canvasTex(340, 560, (c, w, h) => {
    c.fillStyle = '#2e7d5b'; c.fillRect(0, 0, w, h);
    traces(c, w, h, '#3e9a73', 60, 7);
    c.fillStyle = '#d6bd72';
    const r = rng(3);
    for (let i = 0; i < 70; i++) c.fillRect(r() * w, r() * h, 6 + r() * 8, 4 + r() * 4);
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2;
    c.strokeRect(20, 20, w - 40, h - 40);
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = '600 30px Inter, system-ui, sans-serif';
    c.fillText('oikos', w - 120, h - 40);
  });
  const copper = canvasTex(340, 560, (c, w, h) => {
    c.fillStyle = '#7d6420'; c.fillRect(0, 0, w, h);
    traces(c, w, h, '#e0bb4c', 90, 11);
    c.fillStyle = '#3a2c08';
    for (let y = 16; y < h; y += 22) for (let x = 14; x < w; x += 22) if ((x * 7 + y * 3) % 5 === 0) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); }
  });
  const core = canvasTex(340, 560, (c, w, h) => {
    c.fillStyle = '#e6e0c8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,110,80,0.18)'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  });
  const layers = [
    { z: -0.65, t: 0.3, m: mat('pcb', '#2e7d5b', { transparent: true, opacity: 0.85, roughness: 0.4 }), k: 0 },
    { z: -0.35, t: 0.3, m: mat('pcb', '#ffffff', { map: copper, metalness: 0.7, roughness: 0.35 }), k: 1 },
    { z: 0.15, t: 0.7, m: mat('pcb', '#ffffff', { map: core, roughness: 0.8 }), k: 2 },
    { z: 0.65, t: 0.3, m: mat('pcb', '#ffffff', { map: maskTop, roughness: 0.4 }), k: 3 },
  ];
  for (const L of layers) {
    const o = part('pcb', PCB.clone().add(v3(0, 0, L.z)), PCB_EX.clone().add(v3(0, 0, L.k * LAYER_GAP)));
    add('pcb', o, box(34, 56, L.t), L.m, null, L.k === 3);
  }
  // parts on the board's front face, at board coordinates (x, y), height d. Exploded, they lift off the top layer
  // and spread a little outwards, so each one can be picked out.
  const FACE = 0.8 + 3 * LAYER_GAP;
  function onBoard(gid, x, y, d, ex = 1) {
    const pos = PCB.clone().add(v3(x, y, 0.8 + d / 2));
    const lift = v3(x * 0.9, y * 0.55, FACE + 16 * ex + d / 2);
    return part(gid, pos, PCB_EX.clone().add(lift));
  }
  {
    const o = onBoard('mcu', -4, 2, 1.2);
    add('mcu', o, box(10, 10, 1.2), mat('mcu', GROUPS[9].color, { roughness: 0.45 }));
    const pin = mat('mcu', '#c9ced3', { metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      add('mcu', o, box(0.6, 1.2, 0.4), pin, v3(-3.75 + i * 1.5, s * 5.4, -0.3), false);
      add('mcu', o, box(1.2, 0.6, 0.4), pin, v3(s * 5.4, -3.75 + i * 1.5, -0.3), false);
    }
  }
  {
    const o = onBoard('gas', -9, 20, 1.4, 1.2);
    add('gas', o, box(4.5, 4.5, 1.4), mat('gas', GROUPS[10].color, { roughness: 0.35 }));
    add('gas', o, new THREE.CircleGeometry(0.8, 16), mat('gas', '#111111'), v3(-1, 1, 0.71), false);
  }
  {
    const o = onBoard('co2', 6, 17, 10, 1.6);
    add('co2', o, slab(12, 12, 10, 1.2, 0.5), mat('co2', GROUPS[11].color, { roughness: 0.5 }));
    add('co2', o, box(4.4, 4.4, 0.3), mat('co2', '#101010'), v3(0, 0, 5.05), false);
  }
  {
    const o = onBoard('gps', 8, -6, 3.6, 1.3);
    add('gps', o, box(12, 15, 1), mat('gps', '#1f6b4c', { roughness: 0.4 }), v3(0, 0, -1.3));
    add('gps', o, slab(10, 12, 2.6, 0.8, 0.3), mat('gps', GROUPS[12].color, { metalness: 0.6, roughness: 0.35 }), v3(0, 0, 0.5));
  }
  {
    const white = mat('parts', '#ece6d4', { roughness: 0.55 }), black = mat('parts', '#141414', { roughness: 0.5 });
    const gold = mat('parts', '#d4b04a', { metalness: 0.9, roughness: 0.3 }), tan = mat('parts', '#b98d5a', { roughness: 0.5 });
    for (const x of [-10, 1]) { const o = onBoard('parts', x, -22, 6); add('parts', o, slab(8, 5.5, 6, 0.6, 0.2), white); add('parts', o, box(6, 3, 1), black, v3(0, 0, 3), false); }
    {
      const o = onBoard('parts', -13.5, -6, 2.5);
      add('parts', o, box(2.5, 15, 2.5), black);
      for (let i = 0; i < 6; i++) add('parts', o, box(0.64, 0.64, 9), gold, v3(0, -6.25 + i * 2.5, 2.5), false);
    }
    { const o = onBoard('parts', 12, -22, 2); add('parts', o, box(5, 5, 2), black); add('parts', o, cylZ(1.4, 1.4, 16), mat('parts', '#3b3b3b'), v3(0, 0, 1.6), false); }
    { const o = onBoard('parts', 13, 8, 1.2); add('parts', o, cylZ(1.3, 1.2, 18), gold); }
    for (const [x, y] of [[-12, 10], [-2, 11], [3, -14], [-6, -12], [12, 0], [-14, 18]]) { const o = onBoard('parts', x, y, 0.8, 0.6); add('parts', o, box(1.6, 0.8, 0.8), tan, null, false); }
  }

  const allObjs = GROUPS.flatMap((g) => groupState[g.id].objs);
  const pickables = GROUPS.flatMap((g) => groupState[g.id].meshes);

  // ---------------------------------------------------------------- framing
  function pose(e) {
    for (const o of allObjs) o.position.copy(o.userData.base).addScaledVector(o.userData.ex, e);
  }
  const boxAt = (e) => { pose(e); root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); };
  const explodeBox = boxAt(1), homeBox = boxAt(0);
  const HOME_TARGET = homeBox.getCenter(new THREE.Vector3());
  const EXPLODE_TARGET = explodeBox.getCenter(new THREE.Vector3());
  const explodeSize = explodeBox.getSize(new THREE.Vector3()).length();
  const homeSize = homeBox.getSize(new THREE.Vector3()).length();
  const HOME_DIR = v3(0.62, 0.42, 1).normalize();
  const fitDist = (size) => (size * 0.5) / Math.tan((camera.fov * Math.PI) / 360) * Math.max(1, 1.2 / camera.aspect);
  const homePos = () => HOME_TARGET.clone().add(HOME_DIR.clone().multiplyScalar(fitDist(homeSize)));
  camera.position.copy(homePos());
  controls.target.copy(HOME_TARGET);

  const grid = new THREE.GridHelper(1600, 40, 0x2e2e2e, 0x181818);
  grid.position.y = homeBox.min.y - 4;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  function flyTo(target, dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: target.clone().add(dir.multiplyScalar(dist)), t1: target.clone(), k: 0 };
  }

  // ---------------------------------------------------------------- parts list (same markup as the V8 / fin can)
  const list = document.getElementById('ok-parts');
  const items = {};
  let lastCat = '';
  for (const g of GROUPS) {
    if (g.cat !== lastCat) {
      const h = document.createElement('li'); h.className = 'parts-cat'; h.textContent = g.cat; list.appendChild(h); lastCat = g.cat;
    }
    const li = document.createElement('li');
    li.className = 'part-item';
    li.innerHTML = `
      <button class="part-btn" type="button" aria-expanded="false">
        <span class="part-swatch" style="background:${g.color}"></span>
        <span class="part-name">${g.name}</span><span class="part-count">${g.count}</span>
        <svg class="part-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <div class="part-body"><div><div class="part-body-in">
        <p>${g.blurb}</p>
        <dl class="spec-dl">${g.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      </div></div></div>`;
    const btn = li.querySelector('.part-btn');
    btn.addEventListener('click', () => select(selected === g.id ? null : g.id, true));
    btn.addEventListener('mouseenter', () => setHover(g.id, 'list'));
    btn.addEventListener('mouseleave', () => setHover(null, 'list'));
    btn.addEventListener('focus', () => setHover(g.id, 'list'));
    btn.addEventListener('blur', () => setHover(null, 'list'));
    list.appendChild(li);
    items[g.id] = { li, btn };
  }

  // ---------------------------------------------------------------- state + tools
  let explode = 0, explodeGoal = 0, xray = false;
  let hovered = null, listHover = null, canvasHover = null, selected = null;
  const targetGoal = HOME_TARGET.clone();
  const toolBtn = (act) => document.querySelector(`#ok-viewer .v-tools [data-act="${act}"]`);
  function setExplode(on) {
    explodeGoal = on ? 1 : 0;
    toolBtn('explode').setAttribute('aria-pressed', on);
  }
  document.querySelectorAll('#ok-viewer .v-tools button').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'explode') {
      setExplode(!explodeGoal);
      select(null);
      flyTo(explodeGoal ? EXPLODE_TARGET : HOME_TARGET, fitDist(explodeGoal ? explodeSize : homeSize));
      targetGoal.copy(explodeGoal ? EXPLODE_TARGET : HOME_TARGET);
    }
    if (act === 'xray') { xray = !xray; b.setAttribute('aria-pressed', xray); applyLook(); }
    if (act === 'reset') {
      select(null); setExplode(false);
      xray = false; toolBtn('xray').setAttribute('aria-pressed', false);
      camAnim = null; camera.position.copy(homePos()); targetGoal.copy(HOME_TARGET); controls.target.copy(HOME_TARGET);
      cameraMoved = false;
      applyLook();
    }
  }));

  const SHELL = new Set(['cover', 'port', 'housing', 'screws', 'roof', 'solar']);
  function applyLook() {
    for (const g of GROUPS) {
      const st = groupState[g.id];
      const isSel = selected === g.id, isHov = hovered === g.id;
      const ghost = selected && !isSel;
      const glass = xray && SHELL.has(g.id) && !isSel;
      for (const m of st.mats) {
        let opacity = m.userData.opacity;
        if (glass) opacity = Math.min(opacity, 0.16);
        if (ghost) opacity = Math.min(opacity, 0.08);
        const transparent = opacity < 1 || !!m.userData.decal;
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = !transparent;
        if (m.emissive) m.emissiveIntensity = isSel ? 0.08 : isHov ? 0.18 : 0;
      }
      for (const em of st.edgeMats) em.opacity = isSel || isHov ? 0.9 : ghost ? 0.03 : glass ? 0.2 : 0.1;
    }
  }

  function setHover(id, src) {
    if (src === 'list') listHover = id; else canvasHover = id;
    const next = listHover || canvasHover;
    canvas.classList.toggle('hovering', !!canvasHover);
    if (next === hovered) return;
    hovered = next;
    for (const k in items) items[k].li.classList.toggle('hot', k === hovered);
    applyLook();
  }

  // the part's box once the explode has settled, so the camera can frame it while things are still moving
  function partBox(id, e) {
    const keep = explode; pose(e); root.updateMatrixWorld(true);
    const b = new THREE.Box3();
    groupState[id].objs.forEach((o) => b.expandByObject(o));
    pose(keep); root.updateMatrixWorld(true);
    return b;
  }
  function select(id, fromList = false) {
    selected = id;
    for (const k in items) {
      const open = k === id;
      items[k].li.classList.toggle('open', open);
      items[k].btn.setAttribute('aria-expanded', open);
    }
    if (id && !fromList) list.scrollBy({ top: items[id].li.getBoundingClientRect().top - list.getBoundingClientRect().top - 8, behavior: 'smooth' });
    if (id) {
      // parts inside the case can't be seen when it's closed, so open it up first
      if (INSIDE.has(id) && !explodeGoal) setExplode(true);
      const b = partBox(id, explodeGoal);
      const c = b.getCenter(new THREE.Vector3());
      targetGoal.copy(c);
      flyTo(c, THREE.MathUtils.clamp(fitDist(b.getSize(new THREE.Vector3()).length()) * 1.6, 130, 900));
      controls.autoRotate = false;
    } else targetGoal.copy(explodeGoal ? EXPLODE_TARGET : HOME_TARGET);
    applyLook();
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pointer = null, downAt = null;
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, false);
    if (!hits.length) return null;
    const solid = hits.find((h) => { const id = h.object.userData.gid; return !(selected && selected !== id) && !(xray && SHELL.has(id)); });
    return (solid || hits[0]).object.userData.gid;
  }
  canvas.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { pointer = null; tip.hidden = true; setHover(null, 'canvas'); });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const id = pick(e.clientX, e.clientY);
    select(id && id !== selected ? id : null);
  });
  function updateHover() {
    if (!pointer) return;
    const id = pick(pointer.x, pointer.y);
    if (id !== canvasHover) setHover(id, 'canvas');
    if (id) {
      const r = stage.getBoundingClientRect(), g = groupState[id].g;
      tip.hidden = false;
      tip.innerHTML = `${g.name}<small>${selected === id ? 'Click again to put it back' : 'Click to inspect'}</small>`;
      const x = pointer.x - r.left, y = pointer.y - r.top;
      tip.style.left = Math.min(x, r.width - 220) + 'px';
      tip.style.top = Math.min(y, r.height - 60) + 'px';
    } else tip.hidden = true;
  }

  // ---------------------------------------------------------------- render loop
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!cameraMoved && !camAnim && !selected) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(fitDist(explodeGoal ? explodeSize : homeSize)));
    }
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  applyLook();

  let last = 0, visible = true, raf = 0;
  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    explode = reduced ? explodeGoal : explode + (explodeGoal - explode) * (1 - Math.exp(-dt * 4.5));
    if (camAnim) {
      camAnim.k = reduced ? 1 : Math.min(1, camAnim.k + dt / 0.9);
      const e = 1 - Math.pow(1 - camAnim.k, 3);
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
      controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
      if (camAnim.k >= 1) camAnim = null;
    } else controls.target.lerp(targetGoal, 1 - Math.exp(-dt * 3));
    pose(explode);
    updateHover();
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  renderer.render(scene, camera);
  loading.classList.add('done');
  document.getElementById('ok-viewer').classList.add('ready');
  wake();
}
