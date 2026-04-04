// NPC animals: Rabbit (4-state FSM), Bird (perch/fly/glide), Butterfly (figure-8)
import * as THREE from 'three';
import { stdBox, facePlane, setPos, stdMat } from './helpers';
import { getGroundHeight } from './data';

export interface Animals {
  update(dt: number, t: number, playerPos: THREE.Vector3): void;
}

// --- Rabbit ---

interface Rabbit {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  earL: THREE.Mesh; earR: THREE.Mesh;
  legFL: THREE.Mesh; legFR: THREE.Mesh;
  legBL: THREE.Mesh; legBR: THREE.Mesh;
  tail: THREE.Mesh;
  homeX: number; homeZ: number; range: number;
  state: 'idle' | 'hop' | 'alert' | 'flee';
  timer: number; dir: number; hopT: number;
  tx: number; tz: number;
}

const CREAM = 0xf5efe0, RPINK = 0xf0a0b0, RWHITE = 0xffffff, RDARK = 0x1a1520;

function createRabbit(scene: THREE.Scene, x: number, z: number): Rabbit {
  const h = getGroundHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, h, z);
  g.scale.setScalar(0.4);

  const body = setPos(stdBox(0.35, 0.28, 0.45, CREAM), 0, 0.28, 0);
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.18);
  head.add(stdBox(0.28, 0.24, 0.26, CREAM));

  const earL = setPos(stdBox(0.07, 0.22, 0.04, CREAM), -0.08, 0.20, -0.02);
  head.add(earL);
  head.add(setPos(stdBox(0.04, 0.14, 0.01, RPINK), -0.08, 0.21, 0.005));
  const earR = setPos(stdBox(0.07, 0.22, 0.04, CREAM), 0.08, 0.20, -0.02);
  head.add(earR);
  head.add(setPos(stdBox(0.04, 0.14, 0.01, RPINK), 0.08, 0.21, 0.005));

  head.add(setPos(facePlane(0.04, 0.05, RDARK), -0.08, 0.02, 0.131));
  head.add(setPos(facePlane(0.04, 0.05, RDARK), 0.08, 0.02, 0.131));
  head.add(setPos(facePlane(0.015, 0.015, RWHITE), -0.065, 0.035, 0.133));
  head.add(setPos(facePlane(0.015, 0.015, RWHITE), 0.065, 0.035, 0.133));
  head.add(setPos(facePlane(0.03, 0.02, RPINK), 0, -0.04, 0.131));
  g.add(head);

  const legFL = setPos(stdBox(0.08, 0.14, 0.08, CREAM), -0.10, 0.07, 0.14);
  const legFR = setPos(stdBox(0.08, 0.14, 0.08, CREAM), 0.10, 0.07, 0.14);
  const legBL = setPos(stdBox(0.09, 0.12, 0.12, CREAM), -0.10, 0.06, -0.14);
  const legBR = setPos(stdBox(0.09, 0.12, 0.12, CREAM), 0.10, 0.06, -0.14);
  g.add(legFL, legFR, legBL, legBR);

  const tail = setPos(stdBox(0.09, 0.09, 0.06, RWHITE), 0, 0.28, -0.26);
  g.add(tail);

  // Shadow circle
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 12),
    new THREE.MeshBasicMaterial({ color: 0x080810, transparent: true, opacity: 0.15 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  g.add(shadow);

  scene.add(g);

  return {
    group: g, body, head, earL, earR,
    legFL, legFR, legBL, legBR, tail,
    homeX: x, homeZ: z, range: 4,
    state: 'idle', timer: 1 + Math.random() * 3,
    dir: Math.random() * Math.PI * 2, hopT: 0,
    tx: x, tz: z,
  };
}

function updateRabbit(r: Rabbit, dt: number, t: number, px: number, pz: number): void {
  const dx = px - r.group.position.x;
  const dz = pz - r.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // State transitions
  if (r.state !== 'flee' && dist < 2.5) {
    r.state = 'flee';
    r.timer = 1.5 + Math.random();
    r.dir = Math.atan2(-dz, -dx);
  } else if (r.state === 'idle' && dist < 5) {
    r.state = 'alert';
    r.timer = 0.5 + Math.random() * 0.5;
  }

  r.timer -= dt;
  if (r.timer <= 0) {
    switch (r.state) {
      case 'idle':
        r.state = 'hop'; r.timer = 0.6 + Math.random() * 0.6;
        r.dir = Math.random() * Math.PI * 2; r.hopT = 0;
        r.tx = Math.max(r.homeX - r.range, Math.min(r.homeX + r.range,
          r.group.position.x + Math.cos(r.dir) * (1.5 + Math.random() * 2)));
        r.tz = Math.max(r.homeZ - r.range, Math.min(r.homeZ + r.range,
          r.group.position.z + Math.sin(r.dir) * (1.5 + Math.random() * 2)));
        break;
      case 'hop': r.state = 'idle'; r.timer = 2 + Math.random() * 4; break;
      case 'alert':
        r.state = dist < 5 ? 'alert' : 'idle';
        r.timer = dist < 5 ? 0.3 : 2 + Math.random() * 3;
        break;
      case 'flee': r.state = 'idle'; r.timer = 3 + Math.random() * 3; break;
    }
  }

  // Movement
  const gndH = getGroundHeight(r.group.position.x, r.group.position.z);

  if (r.state === 'hop' || r.state === 'flee') {
    const spd = r.state === 'flee' ? 4.5 : 2;
    r.hopT += dt;
    const hpPhase = r.hopT * (r.state === 'flee' ? 9 : 5);

    if (r.state === 'flee') {
      r.tx = Math.max(r.homeX - r.range * 1.5, Math.min(r.homeX + r.range * 1.5,
        r.group.position.x + Math.cos(r.dir) * spd * dt));
      r.tz = Math.max(r.homeZ - r.range * 1.5, Math.min(r.homeZ + r.range * 1.5,
        r.group.position.z + Math.sin(r.dir) * spd * dt));
    }

    const tdx = r.tx - r.group.position.x;
    const tdz = r.tz - r.group.position.z;
    const tD = Math.sqrt(tdx * tdx + tdz * tdz);
    if (tD > 0.1) {
      r.group.position.x += (tdx / tD) * spd * dt;
      r.group.position.z += (tdz / tD) * spd * dt;
      r.dir = Math.atan2(tdz, tdx);
    }

    r.group.position.y = gndH + Math.abs(Math.sin(hpPhase)) * 0.25;
    const ls = Math.sin(hpPhase) * 0.4;
    r.legFL.rotation.x = -ls; r.legFR.rotation.x = -ls;
    r.legBL.rotation.x = ls * 1.3; r.legBR.rotation.x = ls * 1.3;

    const sq = Math.sin(hpPhase);
    r.body.scale.set(1 + Math.abs(sq) * 0.08, 1 - Math.abs(sq) * 0.15, 1);
    const ea = r.state === 'flee' ? -0.5 : -0.2;
    r.earL.rotation.x = ea; r.earR.rotation.x = ea;
  } else {
    r.group.position.y = gndH;
    r.body.scale.set(1, 1, 1);
    r.legFL.rotation.x = 0; r.legFR.rotation.x = 0;
    r.legBL.rotation.x = 0; r.legBR.rotation.x = 0;

    r.earL.rotation.x = Math.sin(t * 2.5 + r.homeX) * 0.08;
    r.earR.rotation.x = Math.sin(t * 2.5 + r.homeZ + 1) * 0.08;
    r.earL.rotation.z = Math.sin(t * 1.5) * 0.05;
    r.earR.rotation.z = -Math.sin(t * 1.5 + 0.5) * 0.05;

    if (r.state === 'alert') {
      r.earL.rotation.x = 0.15; r.earR.rotation.x = 0.15;
      r.earL.rotation.z = 0; r.earR.rotation.z = 0;
      r.dir = Math.atan2(dz, dx);
    }
  }

  // Smooth rotation
  const targetRot = -r.dir + Math.PI / 2;
  let dRot = targetRot - r.group.rotation.y;
  while (dRot > Math.PI) dRot -= Math.PI * 2;
  while (dRot < -Math.PI) dRot += Math.PI * 2;
  r.group.rotation.y += dRot * 6 * dt;

  r.tail.rotation.x = Math.sin(t * 4 + r.homeX) * 0.15;
  r.tail.position.x = Math.sin(t * 3) * 0.015;
}

// --- Bird ---

interface Bird {
  group: THREE.Group;
  wingL: THREE.Mesh; wingR: THREE.Mesh;
  head: THREE.Group;
  perchPos: THREE.Vector3;
  state: 'perch' | 'fly' | 'glide';
  timer: number;
  flyAngle: number; flyRadius: number; flyY: number;
  flyCenter: THREE.Vector3;
}

function createBird(scene: THREE.Scene, x: number, y: number, z: number, color: number): Bird {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(0.3);

  const BELLY = 0xf0e8d8, BEAK = 0xf0a040, DARK = 0x1a1520;

  g.add(setPos(stdBox(0.18, 0.16, 0.32, color), 0, 0, 0));
  g.add(setPos(stdBox(0.14, 0.10, 0.22, BELLY), 0, -0.04, 0.02));

  const head = new THREE.Group();
  head.position.set(0, 0.10, 0.16);
  head.add(stdBox(0.15, 0.14, 0.15, color));
  head.add(setPos(stdBox(0.05, 0.04, 0.08, BEAK), 0, -0.02, 0.10));
  const eL = facePlane(0.03, 0.04, DARK); eL.rotation.y = -0.3;
  head.add(setPos(eL, -0.065, 0.02, 0.055));
  const eR = facePlane(0.03, 0.04, DARK); eR.rotation.y = 0.3;
  head.add(setPos(eR, 0.065, 0.02, 0.055));
  g.add(head);

  const wingL = setPos(stdBox(0.26, 0.03, 0.16, color), -0.18, 0.02, -0.02);
  const wingR = setPos(stdBox(0.26, 0.03, 0.16, color), 0.18, 0.02, -0.02);
  g.add(wingL, wingR);

  const tail = setPos(stdBox(0.10, 0.03, 0.12, color), 0, 0.02, -0.22);
  tail.rotation.x = 0.2;
  g.add(tail);

  scene.add(g);

  return {
    group: g, wingL, wingR, head,
    perchPos: new THREE.Vector3(x, y, z),
    state: 'perch', timer: 5 + Math.random() * 10,
    flyAngle: Math.random() * Math.PI * 2,
    flyRadius: 4 + Math.random() * 3,
    flyY: y + 3 + Math.random() * 2,
    flyCenter: new THREE.Vector3(x, y, z),
  };
}

function updateBird(b: Bird, dt: number, t: number): void {
  b.timer -= dt;
  if (b.timer <= 0) {
    switch (b.state) {
      case 'perch':
        b.state = 'fly'; b.timer = 4 + Math.random() * 6;
        b.flyAngle = Math.random() * Math.PI * 2;
        b.flyCenter.copy(b.perchPos);
        break;
      case 'fly': b.state = 'glide'; b.timer = 1.5 + Math.random(); break;
      case 'glide':
        b.state = 'perch'; b.timer = 6 + Math.random() * 12;
        b.group.position.copy(b.perchPos);
        break;
    }
  }

  if (b.state === 'perch') {
    b.head.rotation.x = Math.sin(t * 2.5 + b.perchPos.x) * 0.12;
    b.head.rotation.y = Math.sin(t * 0.8) * 0.3;
    b.wingL.rotation.z = 0.5; b.wingR.rotation.z = -0.5;
    b.group.position.y = b.perchPos.y + Math.sin(t * 1.5) * 0.02;
    b.group.rotation.z = 0;
  } else if (b.state === 'fly') {
    b.flyAngle += dt * 1.5;
    const tx = b.flyCenter.x + Math.cos(b.flyAngle) * b.flyRadius;
    const tz = b.flyCenter.z + Math.sin(b.flyAngle) * b.flyRadius;
    b.group.position.x += (tx - b.group.position.x) * 3 * dt;
    b.group.position.z += (tz - b.group.position.z) * 3 * dt;
    b.group.position.y += (b.flyY - b.group.position.y) * 2 * dt;
    const flap = Math.sin(t * 12) * 0.7;
    b.wingL.rotation.z = flap; b.wingR.rotation.z = -flap;
    b.group.rotation.y = -b.flyAngle + Math.PI / 2;
    b.group.rotation.z = Math.sin(b.flyAngle) * 0.15;
    b.head.rotation.x = 0; b.head.rotation.y = 0;
  } else {
    b.group.position.lerp(b.perchPos, 2 * dt);
    b.wingL.rotation.z = 0.3 + Math.sin(t * 3) * 0.2;
    b.wingR.rotation.z = -0.3 - Math.sin(t * 3) * 0.2;
    b.group.rotation.z *= 0.9;
  }
}

// --- Butterfly ---

interface Butterfly {
  group: THREE.Group;
  wingL: THREE.Mesh; wingR: THREE.Mesh;
  homeX: number; homeZ: number; homeH: number;
  phase: number; speed: number; radius: number;
}

const BF_COLS: [number, number][] = [
  [0xf5a8c0, 0xf0d060], [0x88c8e8, 0xf5a8c0],
  [0xf0d060, 0x88c8e8], [0xf5a8c0, 0xf5c8e0], [0x88c8e8, 0xf0d060],
];

function createButterfly(scene: THREE.Scene, x: number, z: number, cols: [number, number]): Butterfly {
  const h = getGroundHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, h + 0.8 + Math.random() * 0.4, z);
  g.scale.setScalar(0.22);

  g.add(setPos(stdBox(0.03, 0.03, 0.12, 0x333333), 0, 0, 0));

  const wingL = setPos(stdBox(0.14, 0.01, 0.11, cols[0]), -0.08, 0, 0);
  const wingR = setPos(stdBox(0.14, 0.01, 0.11, cols[1]), 0.08, 0, 0);
  g.add(wingL, wingR);

  // Wing dots
  const sMat = stdMat(0xffffff);
  const sGeo = new THREE.BoxGeometry(0.035, 0.015, 0.035);
  g.add(setPos(new THREE.Mesh(sGeo, sMat), -0.09, 0.01, 0));
  g.add(setPos(new THREE.Mesh(sGeo, sMat), 0.09, 0.01, 0));

  // Antennae
  const ant = stdBox(0.01, 0.01, 0.05, 0x333333);
  const antL = ant.clone(); antL.position.set(-0.02, 0.02, 0.08); antL.rotation.set(-0.4, 0, -0.3);
  const antR = ant.clone(); antR.position.set(0.02, 0.02, 0.08); antR.rotation.set(-0.4, 0, 0.3);
  g.add(antL, antR);

  scene.add(g);

  return {
    group: g, wingL, wingR,
    homeX: x, homeZ: z, homeH: h,
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.4,
    radius: 1.5 + Math.random() * 2,
  };
}

function updateButterfly(b: Butterfly, dt: number, t: number): void {
  b.phase += dt * b.speed;
  b.group.position.x = b.homeX + Math.sin(b.phase) * b.radius;
  b.group.position.z = b.homeZ + Math.sin(b.phase * 2) * b.radius * 0.5;
  b.group.position.y = b.homeH + 0.8 + Math.sin(b.phase * 1.3) * 0.3;

  const flutter = Math.sin(t * 15 + b.phase) * 0.8;
  b.wingL.rotation.z = flutter;
  b.wingR.rotation.z = -flutter;
  b.group.rotation.y = b.phase + Math.PI / 2;
  b.group.rotation.z = Math.sin(b.phase * 2) * 0.1;
}

// --- Factory ---

export function createAnimals(scene: THREE.Scene): Animals {
  const rabbits: Rabbit[] = [
    createRabbit(scene, 4, 3), createRabbit(scene, -5, 2),
    createRabbit(scene, 6, -16), createRabbit(scene, -31, -43),
    createRabbit(scene, 3, -61),
  ];

  const birds: Bird[] = [
    createBird(scene, -8, getGroundHeight(-8, -4) + 4.2, -4, 0x5588cc),
    createBird(scene, 12, getGroundHeight(12, -14) + 3.8, -14, 0xe87040),
    createBird(scene, -8, getGroundHeight(-8, -52) + 6.2, -52, 0x5588cc),
  ];

  const bfSpawns: [number, number][] = [[-5, -3], [7, -8], [10, -20], [-9, -25], [3, -50]];
  const butterflies = bfSpawns.map((s, i) =>
    createButterfly(scene, s[0], s[1], BF_COLS[i % BF_COLS.length]),
  );

  return {
    update(dt, t, playerPos) {
      for (const r of rabbits) updateRabbit(r, dt, t, playerPos.x, playerPos.z);
      for (const b of birds) updateBird(b, dt, t);
      for (const bf of butterflies) updateButterfly(bf, dt, t);
    },
  };
}
