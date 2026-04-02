// ─── 씬 · 환경 · 별 ───
import * as THREE from 'three';
import { COMPANIES } from './data';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: { geo: THREE.BufferGeometry; count: number };
  stars: { geo: THREE.BufferGeometry; baseColors: Float32Array; count: number };
}

export function createScene(isMobile: boolean): SceneContext {
  // ── Core ──
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0b, 0.012);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ── Ground + Grid ──
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.95, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(80, 160, 0x1a3a2a, 0x0e0e12);
  (grid.material as THREE.Material).opacity = 0.2;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // ── Zone ground patches ──
  COMPANIES.forEach(co => {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.015, side: THREE.DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2; glow.position.set(co.position.x, 0.002, co.position.z);
    scene.add(glow);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(5, 24),
      new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.025, side: THREE.DoubleSide }),
    );
    inner.rotation.x = -Math.PI / 2; inner.position.set(co.position.x, 0.003, co.position.z);
    scene.add(inner);
  });

  // ── Path dots between zones ──
  const pathColors = [0x6ee7b7, 0xa78bfa, 0xff6b9d, 0xfbbf24];
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      for (let s = 0; s < 12; s++) {
        const t = s / 12;
        if (s % 2 === 0) {
          const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.06, 6),
            new THREE.MeshBasicMaterial({ color: pathColors[(i + j) % 4], transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
          );
          dot.rotation.x = -Math.PI / 2;
          dot.position.set(a.x + (b.x - a.x) * t, 0.005, a.z + (b.z - a.z) * t);
          scene.add(dot);
        }
      }
    }
  }

  // ── Terrain blocks ──
  const terrainColors = [0x141418, 0x16161c, 0x121216, 0x181820];
  for (let i = 0; i < 40; i++) {
    const w = 0.3 + Math.random() * 0.5, h = 0.05 + Math.random() * 0.15, d = 0.3 + Math.random() * 0.5;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: terrainColors[i % 4], roughness: 0.9, metalness: 0.1 }),
    );
    const angle = Math.random() * Math.PI * 2, radius = 8 + Math.random() * 25;
    block.position.set(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
    block.rotation.y = Math.random() * 0.5;
    block.receiveShadow = true;
    let tooClose = false;
    COMPANIES.forEach(co => {
      const dx = block.position.x - co.position.x, dz = block.position.z - co.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 5.5) tooClose = true;
    });
    if (!tooClose) scene.add(block);
  }

  // ── Lights ──
  scene.add(new THREE.AmbientLight(0x151520, 0.5));
  const dL = new THREE.DirectionalLight(0x8888aa, 0.4); dL.position.set(10, 20, 10); dL.castShadow = true;
  dL.shadow.mapSize.set(1024, 1024); dL.shadow.camera.near = 1; dL.shadow.camera.far = 60;
  dL.shadow.camera.left = -30; dL.shadow.camera.right = 30; dL.shadow.camera.top = 30; dL.shadow.camera.bottom = -30;
  scene.add(dL);
  ([[0x6ee7b7, 1.2, 25, 5, 6, 5], [0xff6b9d, 0.8, 18, -10, 5, -8], [0xa78bfa, 0.8, 18, 0, 7, -12], [0xfbbf24, 0.6, 15, -14, 5, 7]] as number[][]).forEach(([c, i, d, x, y, z]) => {
    const l = new THREE.PointLight(c, i, d); l.position.set(x, y, z); scene.add(l);
  });

  // ── Particles ──
  const pCount = 300, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) { pPos[i * 3] = (Math.random() - 0.5) * 60; pPos[i * 3 + 1] = Math.random() * 15; pPos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x6ee7b7, size: 0.03, transparent: true, opacity: 0.35 })));

  // ── Stars ──
  const starCount = 500;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 60 + Math.random() * 20;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.5 + 5;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = Math.random();
    if (tint < 0.3) { starColors[i * 3] = 0.43; starColors[i * 3 + 1] = 0.91; starColors[i * 3 + 2] = 0.72; }
    else if (tint < 0.5) { starColors[i * 3] = 0.65; starColors[i * 3 + 1] = 0.55; starColors[i * 3 + 2] = 0.98; }
    else { starColors[i * 3] = 0.7; starColors[i * 3 + 1] = 0.7; starColors[i * 3 + 2] = 0.75; }
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.15, transparent: true, opacity: 0.5, vertexColors: true, sizeAttenuation: true,
  })));
  const starBaseColors = new Float32Array(starColors);

  // ── Zone connection lines ──
  const ptM = new THREE.LineBasicMaterial({ color: 0x1a3a2a, transparent: true, opacity: 0.15 });
  for (let i = 0; i < COMPANIES.length; i++) for (let j = i + 1; j < COMPANIES.length; j++) {
    const a = COMPANIES[i].position, b = COMPANIES[j].position;
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, 0.01, a.z),
      new THREE.Vector3((a.x + b.x) / 2, 0.01, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, 0.01, b.z),
    ]), ptM));
  }

  // ── Resize ──
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return {
    scene, camera, renderer,
    particles: { geo: pGeo, count: pCount },
    stars: { geo: starGeo, baseColors: starBaseColors, count: starCount },
  };
}

/** 파티클 상승 + 별 트윙클 (매 프레임) */
export function updateEnvironment(
  t: number,
  particles: SceneContext['particles'],
  stars: SceneContext['stars'],
): void {
  // Particles rise
  const pa = particles.geo.attributes.position.array as Float32Array;
  for (let i = 0; i < particles.count; i++) { pa[i * 3 + 1] += 0.003; if (pa[i * 3 + 1] > 15) pa[i * 3 + 1] = 0; }
  particles.geo.attributes.position.needsUpdate = true;

  // Star twinkle — 원본 배열 기준 (곱셈 누적 방지)
  const sOp = stars.geo.getAttribute('color');
  for (let i = 0; i < stars.count; i += 8) {
    const flicker = 0.4 + Math.sin(t * 1.5 + i * 0.3) * 0.3;
    const f = 0.7 + flicker * 0.3;
    sOp.array[i * 3] = stars.baseColors[i * 3] * f;
    sOp.array[i * 3 + 1] = stars.baseColors[i * 3 + 1] * f;
    sOp.array[i * 3 + 2] = stars.baseColors[i * 3 + 2] * f;
  }
  sOp.needsUpdate = true;
}
