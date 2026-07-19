import * as THREE from 'three';

/* Stylized specimen models. Each builder returns a THREE.Group centred at the
   origin, sized to roughly fit a 3-unit sphere, oriented so +X is "forward". */

// ---- materials ----
function iridescent(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.55, roughness: 0.28,
    iridescence: 1.0, iridescenceIOR: 2.0,
    iridescenceThicknessRange: [120, 520],
    clearcoat: 0.6, clearcoatRoughness: 0.35,
  });
}
const matFuzz = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0.0 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.55, metalness: 0.2 });
const matLeg = new THREE.MeshStandardMaterial({ color: 0x1f1c17, roughness: 0.6, metalness: 0.15 });
const matWing = new THREE.MeshPhysicalMaterial({
  color: 0xdfeef2, transparent: true, opacity: 0.32, roughness: 0.15,
  transmission: 0.6, side: THREE.DoubleSide, metalness: 0, iridescence: 0.7,
  iridescenceThicknessRange: [100, 400],
});

function limb(points, r, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 20, r, 8, false);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}
function wingShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.15, wid * 0.6, len * 0.7, wid * 0.62, len, wid * 0.14);
  s.bezierCurveTo(len * 1.02, 0, len * 0.98, -wid * 0.05, len * 0.85, -wid * 0.16);
  s.bezierCurveTo(len * 0.5, -wid * 0.32, len * 0.2, -wid * 0.18, 0, 0);
  return s;
}
function veinedWing(len, wid, tint) {
  const g = new THREE.Group();
  const geo = new THREE.ShapeGeometry(wingShape(len, wid), 24);
  const mat = matWing.clone(); if (tint !== undefined) mat.color = new THREE.Color(tint);
  const w = new THREE.Mesh(geo, mat);
  w.castShadow = false;
  g.add(w);
  // rim
  const pts = wingShape(len, wid).getPoints(50).map(p => new THREE.Vector3(p.x, p.y, 0));
  const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x9fb0a6, transparent: true, opacity: 0.5 }));
  g.add(rim);
  return g;
}

/* ======================= BEE (hero) ======================= */
export function buildBee() {
  const g = new THREE.Group();
  const green = 0x1f7a4d, blue = 0x2b5fb0;

  // abdomen — striped iridescent
  const abdo = new THREE.Group();
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    const r = 0.62 - t * 0.34;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24),
      iridescent(i % 2 ? blue : green));
    s.position.x = -0.55 - i * 0.52 * (0.9 - t * 0.2);
    s.scale.x = 1.15;
    s.castShadow = true;
    abdo.add(s);
  }
  g.add(abdo);

  // thorax — fuzzy
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), matFuzz(0x6b5a3a));
  thorax.scale.set(1.05, 0.95, 1.0);
  thorax.position.x = 0.15;
  thorax.castShadow = true;
  g.add(thorax);
  // fuzz collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 12, 28), matFuzz(0x8a7446));
  collar.rotation.y = Math.PI / 2;
  collar.position.x = 0.5;
  g.add(collar);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), iridescent(green));
  head.position.x = 1.05; head.scale.set(0.85, 1, 1); head.castShadow = true;
  g.add(head);
  // eyes
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), matDark);
    eye.position.set(1.12, 0.08, 0.32 * s); eye.scale.set(0.7, 1.15, 0.8);
    g.add(eye);
  }
  // antennae
  for (const s of [1, -1]) {
    g.add(limb([[1.35, 0.28, 0.16 * s], [1.7, 0.55, 0.28 * s], [1.95, 0.5, 0.34 * s], [2.15, 0.32, 0.38 * s]], 0.04, matLeg));
  }
  // mandible / tongue hint
  const tongue = limb([[1.4, -0.2, 0], [1.6, -0.55, 0], [1.7, -0.85, 0]], 0.05, matLeg);
  g.add(tongue);

  // wings (2 per side)
  const wingDefs = [[0.28, 1, 2.6, 1.15], [0.05, 1, 2.0, 0.8], [0.28, -1, 2.6, 1.15], [0.05, -1, 2.0, 0.8]];
  g.userData.wings = [];
  for (const [xoff, side, len, wid] of wingDefs) {
    const w = veinedWing(len, wid);
    w.position.set(0.15 + xoff, 0.55, 0.28 * side);
    w.rotation.x = -Math.PI / 2 + side * 0.12;
    w.rotation.z = side * 0.08;
    w.scale.z = side;
    g.add(w);
    g.userData.wings.push({ mesh: w, side });
  }

  // legs (3 per side)
  const legX = [0.55, 0.1, -0.35];
  for (const s of [1, -1]) {
    legX.forEach((lx, i) => {
      const spread = 0.55 + i * 0.12;
      g.add(limb([
        [lx, -0.35, 0.35 * s],
        [lx - 0.05, -0.7, (spread) * s],
        [lx - 0.15, -1.0, (spread + 0.15) * s],
        [lx - 0.1, -1.25, (spread + 0.05) * s],
      ], 0.07, matLeg));
      // pollen basket on hind legs
      if (i === 2) {
        const pb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), matFuzz(0xd8a83a));
        pb.position.set(lx - 0.12, -1.05, (spread + 0.1) * s);
        g.add(pb);
      }
    });
  }

  g.scale.setScalar(1.05);
  return g;
}

/* ======================= MOTH ======================= */
export function buildMoth() {
  const g = new THREE.Group();
  // body
  const body = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const r = 0.4 - i * 0.05;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), matFuzz(i < 2 ? 0x8a6b45 : 0x6f5334));
    s.position.x = 0.5 - i * 0.42; s.scale.x = 1.2; s.castShadow = true;
    body.add(s);
  }
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), matFuzz(0x9a7a4e));
  head.position.x = 0.85; g.add(head);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), matDark);
    eye.position.set(0.95, 0.05, 0.2 * s); g.add(eye);
    // feathery antenna
    g.add(limb([[1.0, 0.2, 0.14 * s], [1.35, 0.5, 0.3 * s], [1.55, 0.45, 0.42 * s]], 0.03, matLeg));
  }
  // proboscis coil
  g.add(limb([[0.95, -0.15, 0], [1.15, -0.45, 0], [1.0, -0.6, 0], [0.85, -0.5, 0.05]], 0.035, matLeg));

  // wings — large, tan with eyespots
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xcbb083, roughness: 0.85, side: THREE.DoubleSide });
  const hindMat = new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.85, side: THREE.DoubleSide });
  g.userData.wings = [];
  for (const s of [1, -1]) {
    for (const [len, wid, mat, xo, yo] of [[2.7, 1.7, wingMat, 0.35, 0.15], [2.1, 1.5, hindMat, -0.35, -0.1]]) {
      const geo = new THREE.ShapeGeometry(wingShape(len, wid), 24);
      const w = new THREE.Mesh(geo, mat);
      const wrap = new THREE.Group();
      wrap.add(w);
      // eyespot
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: 0x5a3f2a }));
      spot.position.set(len * 0.55, wid * 0.18, 0.01); wrap.add(spot);
      wrap.position.set(xo, 0.15 + yo, 0.15 * s);
      wrap.rotation.x = -Math.PI / 2;
      wrap.rotation.z = s > 0 ? 0 : Math.PI;
      wrap.scale.z = s;
      g.add(wrap);
      g.userData.wings.push({ mesh: wrap, side: s });
    }
  }
  g.scale.setScalar(0.92);
  return g;
}

/* ======================= BEETLE ======================= */
export function buildBeetle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 40, 28),
    new THREE.MeshPhysicalMaterial({ color: 0x243a1e, roughness: 0.25, metalness: 0.4, clearcoat: 0.9 }));
  shell.scale.set(1.5, 0.85, 1.05); shell.position.x = -0.15; shell.castShadow = true;
  g.add(shell);
  // elytra split line + bands
  const line = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.03), matDark);
  line.position.set(-0.15, 0.83, 0); g.add(line);
  for (const bx of [-0.7, 0.0, 0.55]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 10, 24, Math.PI), matFuzz(0xd8b24a));
    band.rotation.x = Math.PI / 2; band.position.set(bx, 0.45, 0); band.scale.set(1, 1, 0.5);
    g.add(band);
  }
  // pronotum (fuzzy thorax)
  const pron = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), matFuzz(0x5a4326));
  pron.position.set(0.95, 0.15, 0); pron.scale.set(0.8, 0.7, 1.1); g.add(pron);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), matDark);
  head.position.set(1.4, 0.0, 0); g.add(head);
  for (const s of [1, -1]) {
    g.add(limb([[1.5, 0.1, 0.1 * s], [1.8, 0.28, 0.22 * s], [2.0, 0.22, 0.3 * s]], 0.04, matLeg)); // antenna
    // legs
    [0.7, 0.1, -0.5].forEach((lx) => {
      g.add(limb([[lx, -0.2, 0.5 * s], [lx - 0.1, -0.5, 0.85 * s], [lx - 0.2, -0.8, 0.95 * s]], 0.07, matLeg));
    });
  }
  g.scale.setScalar(1.0);
  return g;
}

/* ======================= HUMMINGBIRD ======================= */
export function buildHummingbird() {
  const g = new THREE.Group();
  const bodyMat = iridescent(0x1f7a4d);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), bodyMat);
  body.scale.set(1.5, 1.05, 1.05); body.castShadow = true; g.add(body);
  // gorget (ruby throat)
  const gorget = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18),
    new THREE.MeshPhysicalMaterial({ color: 0xa01524, roughness: 0.3, metalness: 0.5, iridescence: 0.8 }));
  gorget.position.set(0.75, -0.15, 0); gorget.scale.set(0.7, 0.7, 0.9); g.add(gorget);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), bodyMat);
  head.position.set(0.95, 0.28, 0); g.add(head);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), matDark);
    eye.position.set(1.1, 0.35, 0.2 * s); g.add(eye);
  }
  // long straight bill
  const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.5, 12), matDark);
  bill.rotation.z = -Math.PI / 2 - 0.15; bill.position.set(1.75, 0.28, 0); g.add(bill);
  // tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 4), iridescent(0x2f6a44));
  tail.rotation.z = Math.PI / 2; tail.position.set(-1.15, -0.05, 0); tail.scale.set(1, 1, 0.25); g.add(tail);
  // blurred wings
  g.userData.wings = []; g.userData.fastWings = true;
  for (const s of [1, -1]) {
    const w = veinedWing(2.2, 0.9, 0x8fae9a);
    w.position.set(0.1, 0.35, 0.35 * s);
    w.rotation.x = -Math.PI / 2;
    w.scale.z = s;
    g.add(w);
    g.userData.wings.push({ mesh: w, side: s });
  }
  g.scale.setScalar(1.0);
  return g;
}

/* ======================= BAT ======================= */
export function buildBat() {
  const g = new THREE.Group();
  const fur = matFuzz(0x5b4636);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 20), fur);
  body.scale.set(1.3, 1.0, 0.9); body.castShadow = true; g.add(body);
  // head with long muzzle
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), fur);
  head.position.set(0.8, 0.15, 0); g.add(head);
  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 16), fur);
  muzzle.rotation.z = -Math.PI / 2; muzzle.position.set(1.35, 0.05, 0); g.add(muzzle);
  // ears
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 12), fur);
    ear.position.set(0.7, 0.55, 0.2 * s); ear.rotation.x = -0.2 * s; g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), matDark);
    eye.position.set(0.95, 0.2, 0.18 * s); g.add(eye);
  }
  // long tongue
  g.add(limb([[1.65, 0.02, 0], [1.95, -0.1, 0], [2.15, -0.05, 0]], 0.04, new THREE.MeshStandardMaterial({ color: 0xc06a6a, roughness: .7 })));

  // membrane wings (fingered)
  const memMat = new THREE.MeshStandardMaterial({ color: 0x3f322a, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  g.userData.wings = [];
  for (const s of [1, -1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.2);
    shape.lineTo(2.4, 0.9);
    shape.lineTo(2.7, 0.2);
    shape.lineTo(2.5, -0.2);
    shape.lineTo(2.7, -0.7);
    shape.lineTo(2.2, -0.6);
    shape.lineTo(2.3, -1.15);
    shape.lineTo(1.7, -0.8);
    shape.lineTo(0.2, -0.5);
    shape.closePath();
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), memMat);
    const wrap = new THREE.Group(); wrap.add(w);
    // finger bones
    for (const [ex, ey] of [[2.4, 0.9], [2.7, 0.2], [2.7, -0.7], [2.3, -1.15]]) {
      wrap.add(limb([[0.1, 0, 0], [ex, ey, 0]], 0.03, matLeg));
    }
    wrap.position.set(0.0, 0.1, 0.28 * s);
    wrap.rotation.x = -Math.PI / 2;
    wrap.scale.z = s;
    g.add(wrap);
    g.userData.wings.push({ mesh: wrap, side: s });
  }
  g.scale.setScalar(0.95);
  return g;
}

export const BUILDERS = {
  bees: buildBee,
  moths: buildMoth,
  beetles: buildBeetle,
  hummingbirds: buildHummingbird,
  bats: buildBat,
};
