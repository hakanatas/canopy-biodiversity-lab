import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { POLLINATORS, UI } from './data.js';
import { BUILDERS } from './models.js';

let lang = 'en';
let currentId = 'bees';

// Per-species GLB config. rotY orients the model to a pleasing 3/4 profile.
// Models: "Poly by Google" (CC-BY) via poly.pizza — see models/CREDITS.txt
const POLY = { text: '3D: Poly by Google · CC-BY', url: 'https://poly.pizza' };
const MODELS = {
  bees:         { url: 'models/bee.glb',         rotY: -0.6, credit: { text: '3D: “Animated Bee” by sikoro · CC-BY', url: 'https://skfb.ly/oF6Mx' } },
  wasps:        { url: 'models/wasp.glb',         rotY: -0.6, credit: { text: '3D: “Vespula Vulgaris” by Nobilis the Palaeovespa · CC-BY', url: 'https://skfb.ly/pz6BI' } },
  moths:        { url: 'models/moth.glb',        rotY: -0.5, credit: { text: '3D: “Animated Peacock Moth” by Osian CG · CC-BY', url: 'https://skfb.ly/pwPwG' } },
  butterflies:  { url: 'models/butterfly.glb',   rotY: -0.5, credit: { text: '3D: “BUTTERFLY” by Rukh3D · CC-BY', url: 'https://skfb.ly/oGZZW' } },
  beetles:      { url: 'models/beetle.glb',      rotY: -0.7, credit: { text: '3D: “Rhinoceros Beetle (Golofa Sp)” by RISD Nature Lab · CC-BY', url: 'https://skfb.ly/oxBUC' } },
  hummingbirds: { url: 'models/hummingbird.glb', rotY:  2.5, credit: { text: '3D: “Hummingbird Flying020” by SabininAA · CC-BY', url: 'https://skfb.ly/oFvUO' } },
  bats:         { url: 'models/bat.glb',         rotY: -0.6, credit: { text: '3D: “Bat (Low Poly, Rigged)” by danielvanderkaaden · CC-BY', url: 'https://skfb.ly/6WEYy' } },
};
const gltfLoader = new GLTFLoader();
const modelCache = {};

/* ================= Three.js viewer ================= */
const canvas = document.getElementById('scene');
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 5000);
camera.position.set(0.4, 1.6, 7.4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 12;
controls.target.set(0, 0.1, 0);

// soft studio lighting
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xcabf9f, 1.0));
const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
key.position.set(-4, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -5; key.shadow.camera.right = 5;
key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
key.shadow.radius = 7; key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbfe0ff, 0.9);
rim.position.set(5, 3, -4);
scene.add(rim);
const fill = new THREE.PointLight(0xffe6c0, 0.5, 30);
fill.position.set(3, 1, 6);
scene.add(fill);

// ground shadow catcher
{
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(80,66,44,0.28)');
  grd.addColorStop(1, 'rgba(80,66,44,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = -1.7; scene.add(blob);
  var catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.14 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -1.68; catcher.receiveShadow = true; scene.add(catcher);
  window.__shadowY = (y) => { blob.position.y = y; catcher.position.y = y + 0.01; };
}

let current = null;
let currentWrap = null;
let autoRotate = true;
let userRot = 0;           // radians, driven by slider / drag
let dragging = false;
let fitRadius = 2;         // bounding radius of the loaded model
let mixer = null;
let procWings = null;      // wing list when a procedural fallback is shown
let loadToken = 0;

// Bounding box that accounts for skeletal skinning (Box3.setFromObject ignores it,
// which makes rigged/animated GLB models mis-scale and vanish).
function computeBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let any = false;
  root.traverse(o => {
    if (o.isSkinnedMesh && o.geometry?.attributes?.position) {
      const pos = o.geometry.attributes.position;
      o.skeleton?.update?.();
      const step = Math.max(1, Math.floor(pos.count / 5000)); // sample for speed
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        if (o.applyBoneTransform) o.applyBoneTransform(i, v);
        else if (o.boneTransform) o.boneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        box.expandByPoint(v); any = true;
      }
    } else if (o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) {
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
        any = true;
      }
    }
  });
  if (!any) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
  return box;
}

function prepMeshes(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;   // skinned/animated meshes cull incorrectly otherwise
      if (o.material) {
        o.material.side = THREE.FrontSide;
        if ('roughness' in o.material && o.material.roughness === undefined) o.material.roughness = 0.7;
      }
    }
  });
}

function pickClip(clips) {
  const pref = ['hover', 'fly', 'flap', 'idle', 'loop', 'cycle'];
  return clips.find(c => pref.some(k => c.name.toLowerCase().includes(k))) || clips[0];
}

// Union of the posed bounds sampled across the animation, so framing fits the
// whole motion (not just the bind pose, which can sit off-centre for rigged models).
function computeMotionBounds(root, mx, clip) {
  if (!mx || !clip || !clip.duration) return computeBounds(root);
  const box = new THREE.Box3();
  const N = 12;
  for (let i = 0; i <= N; i++) {
    mx.setTime(clip.duration * (i / N));
    box.union(computeBounds(root));
  }
  mx.setTime(0);
  return box;
}

// Build a ready-to-display wrapper (recentred, normalised, animated). Built once
// per model and reused — cloning skinned meshes breaks their skeleton binding.
function buildDisplay(root, cfg, gltf) {
  prepMeshes(root);
  const wrap = new THREE.Group();
  wrap.add(root);

  let mx = null, clip = null;
  const clips = gltf?.animations || [];
  if (clips.length) {
    mx = new THREE.AnimationMixer(root);
    clip = pickClip(clips);
    const act = mx.clipAction(clip);
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.play();
    mx.update(0);
  }

  const box = computeMotionBounds(root, mx, clip);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);
  const rawRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
  const TARGET = 2.4;
  const s = TARGET / rawRadius;

  wrap.scale.setScalar(s);
  wrap.rotation.y = cfg?.rotY || 0;
  wrap._baseRotY = cfg?.rotY || 0;
  wrap._fitRadius = TARGET;
  wrap._shadowY = ((box.min.y - centre.y) * s) - TARGET * 0.04;
  wrap._mixer = mx;
  wrap._wings = root.userData.wings || null;
  wrap._model = root;
  return wrap;
}

function mountWrap(wrap) {
  if (currentWrap && currentWrap !== wrap) scene.remove(currentWrap);
  currentWrap = wrap;
  current = wrap._model;
  mixer = wrap._mixer || null;
  procWings = wrap._wings || null;
  fitRadius = wrap._fitRadius || 2.4;
  scene.add(wrap);
  window.__shadowY?.(wrap._shadowY ?? -2);
  userRot = 0;
  rotInput.value = 0; degVal.textContent = '0°';
  fitCamera();
  loading.classList.add('hide');
}

const creditEl = document.querySelector('.credit');
function loadSpecimen(id) {
  const token = ++loadToken;
  const cfg = MODELS[id];
  if (creditEl) {
    const c = cfg?.credit || POLY;
    creditEl.textContent = c.text;
    creditEl.href = c.url;
  }
  const fallback = () => { if (token === loadToken) mountWrap(buildDisplay(BUILDERS[id](), cfg, null)); };

  if (!cfg) return fallback();
  if (modelCache[id]) {
    if (!modelCache[id].__wrap) modelCache[id].__wrap = buildDisplay(modelCache[id].scene, cfg, modelCache[id]);
    mountWrap(modelCache[id].__wrap);
    return;
  }
  gltfLoader.load(cfg.url, async (gltf) => {
    if (token !== loadToken) return;
    modelCache[id] = gltf;
    await recoverSpecGloss(gltf);
    if (token !== loadToken) return;
    gltf.__wrap = buildDisplay(gltf.scene, cfg, gltf);
    mountWrap(gltf.__wrap);
  }, undefined, (err) => { console.warn('GLB load failed for', id, err); fallback(); });
}

// three r160 dropped KHR_materials_pbrSpecularGlossiness support, so such models
// load as plain white. Recover their diffuse colour/texture from the raw glTF.
async function recoverSpecGloss(gltf) {
  if (gltf.__sgDone) return;
  gltf.__sgDone = true;
  const parser = gltf.parser, json = parser.json;
  if (!json.materials) return;
  const byName = new Map();
  const all = [];
  gltf.scene.traverse(o => {
    if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m) { byName.set(m.name, m); all.push(m); }
    });
  });
  for (let i = 0; i < json.materials.length; i++) {
    const sg = json.materials[i].extensions?.KHR_materials_pbrSpecularGlossiness;
    if (!sg) continue;
    const three = byName.get(json.materials[i].name) || all[i] || all[0];
    if (!three) continue;
    if (sg.diffuseFactor) three.color.setRGB(sg.diffuseFactor[0], sg.diffuseFactor[1], sg.diffuseFactor[2]);
    if (sg.diffuseTexture) {
      try {
        const tex = await parser.getDependency('texture', sg.diffuseTexture.index);
        tex.colorSpace = THREE.SRGBColorSpace;
        three.map = tex;
        three.color.setScalar(1);
      } catch (e) { /* keep base colour */ }
    }
    three.roughness = 0.6; three.metalness = 0.0;
    three.needsUpdate = true;
  }
}


function fitCamera() {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const pad = 1.12;
  const distV = fitRadius / Math.sin(vFov / 2);
  const distH = fitRadius / Math.sin(hFov / 2);
  const dist = Math.max(distV, distH) * pad;
  camera.position.set(dist * 0.06, dist * 0.16, dist * 0.985);
  controls.target.set(0, 0, 0);
  controls.minDistance = dist * 0.55;
  controls.maxDistance = dist * 2.2;
  controls.update();
}

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // On narrow/stacked layouts, free the canvas so the page can scroll:
  // disable orbit drag/zoom and let the slider + auto-rotate drive the model.
  controls.enabled = innerWidth > 760;
  fitCamera();
}
addEventListener('resize', resize);

// track manual orbit → reflect azimuth on the slider
controls.addEventListener('start', () => { dragging = true; });
controls.addEventListener('end', () => { dragging = false; });

const clock = new THREE.Clock();
let wingPhase = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (mixer) mixer.update(dt);

  if (currentWrap) {
    if (autoRotate && !dragging) {
      userRot += dt * 0.5;
      rotInput.value = ((THREE.MathUtils.radToDeg(userRot) % 360) + 360) % 360;
      degVal.textContent = Math.round(rotInput.value) + '°';
    }
    currentWrap.rotation.y = currentWrap._baseRotY + userRot;
    currentWrap.position.y = Math.sin(clock.elapsedTime * 1.1) * fitRadius * 0.03;   // gentle hover

    // wing flutter (procedural fallback models only)
    if (procWings) {
      const fast = current.userData.fastWings;
      wingPhase += dt * (fast ? 45 : 9);
      const amp = fast ? 0.9 : 0.4;
      for (const { mesh, side } of procWings) {
        mesh.rotation.y = Math.sin(wingPhase) * amp * side;
      }
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

/* ================= UI wiring ================= */
const pollList = document.getElementById('pollList');
const rotInput = document.getElementById('rot');
const degVal = document.getElementById('degVal');
const autoBtn = document.getElementById('autoRotate');
const resetBtn = document.getElementById('resetView');
const fsBtn = document.getElementById('fs');
const loading = document.getElementById('loading');

const $ = id => document.getElementById(id);

// build sidebar list (structure once; text filled by renderList)
POLLINATORS.forEach((p, i) => {
  const b = document.createElement('button');
  b.className = 'poll-item' + (i === 0 ? ' active' : '');
  b.dataset.id = p.id;
  b.innerHTML = `
    <div class="pi-thumb">${p.emoji}</div>
    <div class="pi-body"><div class="pi-name"></div><div class="pi-sub"></div></div>
    <div class="pi-chev">›</div>`;
  b.addEventListener('click', () => select(p.id));
  pollList.appendChild(b);
});

function renderList() {
  document.querySelectorAll('.poll-item').forEach(el => {
    const p = POLLINATORS.find(x => x.id === el.dataset.id);
    el.querySelector('.pi-name').textContent = p[lang].cat;
    el.querySelector('.pi-sub').textContent = p[lang].count;
  });
}

function applyStaticUI() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  $('brandName').textContent = t.brandName;
  $('brandSub').textContent = t.brandSub;
  $('seasonTag').textContent = t.seasonTag;
  $('strataHead').textContent = t.strataTitle;
  $('pollenNote').textContent = t.pollenNote;
  $('disclaimer').textContent = t.disclaimer;
  $('pollHead').textContent = t.pollinators;
  $('pollCount').textContent = POLLINATORS.length + ' ' + t.groups;
  $('discTitle').textContent = t.todaysDiscovery;
  $('backBtn').textContent = t.back;
  $('tNotebook').textContent = '▤ ' + t.notebook;
  $('tCompare').textContent = '⇄ ' + t.compare;
  $('tShare').textContent = '↗ ' + t.share;
  $('guideLbl').textContent = t.fieldGuide;
  $('ffHead').textContent = t.flowerFit;
  $('quote').textContent = t.quote;
  $('loading').textContent = t.loading;
  $('resetView').title = t.reset;
  $('autoRotate').title = t.auto;
  $('fs').title = t.fullscreen;
  document.querySelectorAll('#rail .rail-btn').forEach(b => {
    b.querySelector('em').textContent = t.rail[b.dataset.r];
  });
  renderList();
  renderPanel();   // refresh the currently shown species in the new language
  if (overlayMode) renderOverlay();
}

function renderPanel() {
  const p = POLLINATORS.find(x => x.id === currentId);
  const d = p[lang], t = UI[lang];
  $('topName').textContent = d.name;
  $('topLatin').textContent = p.latin;
  $('stamp').innerHTML = d.cat.replace(/[sr]$/i, '') + '<br>' + t.spotlight;
  $('famTag').textContent = d.family;
  $('spName').textContent = d.name;
  $('spLatin').textContent = p.latin;
  $('guideNo').textContent = p.guideNo;
  document.querySelector('.guide-ico').textContent = p.emoji;
  $('chips').innerHTML = d.chips.map((c, i) => `<span class="chip c${i % 4}">${c}</span>`).join('');
  $('facts').innerHTML = d.facts.map((body, i) =>
    `<div class="fact"><div class="fact-ico">${p.factIcons[i]}</div>` +
    `<div class="fact-body"><h3>${t.factTitles[i]}</h3><p>${body}</p></div></div>`
  ).join('');
  $('ffArt').textContent = p.flowerArt;
  $('ffName').textContent = d.flower;
  $('discText').textContent = d.discovery;

  // forest-layer indicator (0 = emergent/top … 3 = forest floor)
  $('strataRows').innerHTML = t.strata.map((name, i) =>
    `<div class="strata-row${i === p.layer ? ' on' : ''}"><span class="bar"></span>${name}` +
    `${i === p.layer ? '<span class="depth">●</span>' : ''}</div>`
  ).join('');
}

function select(id) {
  currentId = id;
  document.querySelectorAll('.poll-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  renderPanel();
  loading.classList.remove('hide');
  requestAnimationFrame(() => requestAnimationFrame(() => loadSpecimen(id)));
}

// ---- bottom rail: Home/Explore return to the browser; Notes/Garden/Learn open a panel ----
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayBody = document.getElementById('overlayBody');
let overlayMode = null;

function setRailActive(mode) {
  document.querySelectorAll('#rail .rail-btn').forEach(b => b.classList.toggle('active', b.dataset.r === mode));
}
function closeOverlay() {
  overlayMode = null;
  overlay.classList.remove('on');
  setRailActive('explore');
}
function openOverlay(mode) {
  overlayMode = mode;
  renderOverlay();
  overlay.classList.add('on');
  setRailActive(mode);
}
function renderOverlay() {
  if (!overlayMode) return;
  const o = UI[lang].overlay;
  if (overlayMode === 'garden') {
    overlayTitle.textContent = o.garden.title;
    overlayBody.innerHTML = `<p class="ov-intro">${o.garden.intro}</p><div class="ov-grid">` +
      POLLINATORS.map(p => {
        const d = p[lang];
        return `<div class="ov-card"><div class="ov-flower">${p.flowerArt}</div>` +
          `<div class="ov-fname">${d.flower}</div>` +
          `<div class="ov-vby">${o.garden.visitedBy} ${p.emoji} ${d.name}</div></div>`;
      }).join('') + `</div>`;
  } else if (overlayMode === 'notes') {
    overlayTitle.textContent = o.notes.title;
    overlayBody.innerHTML = `<p class="ov-intro">${o.notes.intro}</p>` +
      POLLINATORS.map(p => {
        const d = p[lang];
        return `<div class="ov-note"><div class="ov-note-h">${p.emoji} <b>${d.name}</b> <em>${p.latin}</em></div><p>${d.discovery}</p></div>`;
      }).join('');
  } else if (overlayMode === 'learn') {
    overlayTitle.textContent = o.learn.title;
    overlayBody.innerHTML = o.learn.body.map(par => `<p class="ov-p">${par}</p>`).join('');
  }
}
document.querySelectorAll('#rail .rail-btn').forEach(b => {
  b.addEventListener('click', () => {
    const m = b.dataset.r;
    if (m === 'home' || m === 'explore') { closeOverlay(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (overlayMode === m) closeOverlay(); else openOverlay(m);
  });
});
overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
document.getElementById('overlayClose').addEventListener('click', closeOverlay);
addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

// language toggle
document.getElementById('langToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-lang]');
  if (!btn || btn.dataset.lang === lang) return;
  lang = btn.dataset.lang;
  document.querySelectorAll('#langToggle button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  applyStaticUI();
});

// viewer controls
rotInput.addEventListener('input', () => {
  autoRotate = false; autoBtn.classList.remove('active');
  userRot = THREE.MathUtils.degToRad(parseFloat(rotInput.value));
  degVal.textContent = Math.round(rotInput.value) + '°';
});
autoBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  autoBtn.classList.toggle('active', autoRotate);
});

// zoom buttons — work on every layout (wheel zoom is off on narrow screens)
function dolly(factor) {
  const dir = camera.position.clone().sub(controls.target);
  const dist = THREE.MathUtils.clamp(dir.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(dir.setLength(dist));
  controls.update();
}
document.getElementById('zoomIn').addEventListener('click', () => dolly(0.68));
document.getElementById('zoomOut').addEventListener('click', () => dolly(1.47));
resetBtn.addEventListener('click', () => {
  userRot = 0; rotInput.value = 0; degVal.textContent = '0°';
  fitCamera();
});
fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) viewport.requestFullscreen?.();
  else document.exitFullscreen?.();
});
document.addEventListener('fullscreenchange', resize);

// boot
resize();
applyStaticUI();
select('bees');
animate();
