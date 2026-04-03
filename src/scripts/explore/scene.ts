// ─── 씬 · 복셀 지형 · 환경 ───
// ★ Step 3: 맵 확대 + 플랫폼 높이차 + 레벨 디자인
import * as THREE from 'three';
import { COMPANIES, PLATFORMS } from './data';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: { geo: THREE.BufferGeometry; count: number };
  stars: { geo: THREE.BufferGeometry; baseColors: Float32Array; count: number };
}

const PK = 0xff6b9d;
const GD = 0xfbbf24;
const SK = 0x67e8f9;

function nearZone(x: number, z: number, r: number): boolean {
  for (const co of COMPANIES) {
    const dx = x - co.position.x, dz = z - co.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < r) return true;
  }
  return false;
}

// ══════════════════════════════════════════
// ── Ground ──
// ══════════════════════════════════════════

function buildGround(scene: THREE.Scene): void {
  // ★ 넓은 베이스 평면 (어두운 바닥)
  const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 90),
      new THREE.MeshStandardMaterial({ color: 0x141418, emissive: PK, emissiveIntensity: 0.008, metalness: 0.3, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, -29);
  ground.receiveShadow = true;
  scene.add(ground);

  // 그리드 오버레이
  const grid = new THREE.GridHelper(130, 65, 0x2a2030, 0x1a1824);
  grid.position.set(0, 0.001, -29);
  (grid.material as THREE.Material).opacity = 0.2;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);
}

// ══════════════════════════════════════════
// ★ Platforms from PLATFORMS data
// ══════════════════════════════════════════

function buildPlatforms(scene: THREE.Scene, isMobile: boolean): void {
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x162e1e, emissive: 0x2a5a38, emissiveIntensity: 0.22,
    metalness: 0.2, roughness: 0.85,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e2a, emissive: 0x2a2a3a, emissiveIntensity: 0.12,
    metalness: 0.4, roughness: 0.8,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: PK, transparent: true, opacity: 0.06 });

  // 존별 에지 색상 결정
  function getEdgeColor(px: number, pz: number): number {
    let best = 0, bestD = Infinity;
    COMPANIES.forEach((co, i) => {
      const d = Math.hypot(px - co.position.x, pz - co.position.z);
      if (d < bestD) { bestD = d; best = i; }
    });
    return COMPANIES[best].color;
  }

  for (const p of PLATFORMS) {
    if (p.h <= 0.05) continue; // 스폰(h=0)은 flat ground
    const eCol = getEdgeColor(p.x, p.z);

    // 본체 (stone)
    const bodyH = Math.max(0.15, p.h - 0.15);
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, bodyH, p.d),
        stoneMat,
    );
    body.position.set(p.x, bodyH / 2, p.z);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    // 상단 잔디 캡
    const cap = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, 0.15, p.d),
        grassMat,
    );
    cap.position.set(p.x, p.h - 0.075, p.z);
    cap.receiveShadow = true;
    scene.add(cap);

    // 네온 엣지 (데스크톱만, 모바일은 draw call 절감)
    if (!isMobile) {
      const capEdge = new THREE.LineSegments(
          new THREE.EdgesGeometry(cap.geometry),
          new THREE.LineBasicMaterial({ color: eCol, transparent: true, opacity: 0.08 }),
      );
      cap.add(capEdge);
    }
  }
}

// ══════════════════════════════════════════
// ── Trees (확장 배치) ──
// ══════════════════════════════════════════

function buildTrees(scene: THREE.Scene): void {
  const trees: [number, number, number, number][] = [
    // 스폰 근처
    [-8, -4, 4, PK],   [9, -2, 3, SK],
    // Zone0 주변
    [-12, -14, 5, GD],  [12, -14, 4, PK],
    // Zone0→Zone1 경로
    [20, -20, 4, SK],   [30, -30, 3, GD],
    // Zone0→Zone2 경로
    [-20, -20, 4, PK],  [-32, -30, 5, SK],
    // Zone3 언덕 주변 (숲 테마)
    [-8, -52, 6, PK],   [8, -52, 5, GD],
    [-5, -63, 4, SK],   [6, -64, 5, PK],
    // 외곽
    [-38, -48, 4, GD],  [38, -48, 4, SK],
    [25, -55, 3, PK],   [-25, -55, 5, GD],
  ];

  trees.forEach(([tx, tz, h, lc]) => {
    if (nearZone(tx, tz, 6)) return;

    const trunkGeo = new THREE.BoxGeometry(0.6, h * 0.8, 0.6);
    const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({
      color: 0x2a2018, emissive: 0x3a2a18, emissiveIntensity: 0.15,
      metalness: 0.2, roughness: 0.9,
    }));
    // ★ 트리 Y를 주변 지면 높이에 맞춤
    const baseH = getApproxHeight(tx, tz);
    trunk.position.set(tx, baseH + h * 0.4, tz);
    trunk.castShadow = true;
    scene.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x121a14, emissive: lc, emissiveIntensity: 0.5,
      metalness: 0.1, roughness: 0.7, transparent: true, opacity: 0.9,
    });
    const leafEdge = new THREE.LineBasicMaterial({ color: lc, transparent: true, opacity: 0.35 });
    const leafGeo = new THREE.BoxGeometry(1.2, 1.0, 1.2);
    const leafEdgeGeo = new THREE.EdgesGeometry(leafGeo);

    [[0,0,0],[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0],[-1,0,1],[1,0,-1]].forEach(([lx, ly, lz]) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(tx + lx * 1.1, baseH + h * 0.8 + ly * 1.0 + 0.5, tz + lz * 1.1);
      leaf.castShadow = true;
      leaf.add(new THREE.LineSegments(leafEdgeGeo, leafEdge));
      scene.add(leaf);
    });
  });
}

/** 데코 배치용 대략적 지면 높이 (PLATFORMS 체크) */
function getApproxHeight(x: number, z: number): number {
  let maxH = 0;
  for (const p of PLATFORMS) {
    const hw = p.w / 2 + 1, hd = p.d / 2 + 1; // 살짝 여유
    if (x >= p.x - hw && x <= p.x + hw && z >= p.z - hd && z <= p.z + hd) {
      if (p.h > maxH) maxH = p.h;
    }
  }
  return maxH;
}

// ══════════════════════════════════════════
// ── Mushrooms (확장 배치) ──
// ══════════════════════════════════════════

function buildMushrooms(scene: THREE.Scene): void {
  const shrooms: [number, number, number][] = [
    [-5, -3, PK],   [7, -8, GD],    [-14, -12, SK],
    [10, -20, PK],  [-9, -25, GD],  [19, -23, SK],
    [-23, -32, PK], [26, -28, GD],  [-16, -44, SK],
    [8, -36, PK],   [-30, -50, GD], [22, -53, SK],
    [3, -50, PK],   [-6, -62, GD],  [12, -58, SK],
    [-40, -38, PK], [40, -42, GD],
  ];

  const stemGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
  const capGeo = new THREE.BoxGeometry(0.5, 0.2, 0.5);
  const capEdgeGeo = new THREE.EdgesGeometry(capGeo);

  shrooms.forEach(([sx, sz, color]) => {
    if (nearZone(sx, sz, 5)) return;
    const baseH = getApproxHeight(sx, sz);

    const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.15,
      metalness: 0.2, roughness: 0.8,
    }));
    stem.position.set(sx, baseH + 0.175, sz);
    scene.add(stem);

    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
      color: 0x121218, emissive: color, emissiveIntensity: 1.0,
      metalness: 0.3, roughness: 0.5,
    }));
    cap.position.set(sx, baseH + 0.45, sz);
    cap.add(new THREE.LineSegments(capEdgeGeo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.55,
    })));
    scene.add(cap);
  });
}

// ══════════════════════════════════════════
// ── Lanterns (경로 표시) ──
// ══════════════════════════════════════════

function buildLanterns(scene: THREE.Scene): void {
  const lanterns: [number, number, number][] = [
    // 스폰 → Zone 0
    [0, -4, GD],    [0, -14, GD],
    // Zone 0 → Zone 1
    [10, -24, PK],  [17, -28, PK],  [22, -33, PK],
    // Zone 0 → Zone 2
    [-10, -24, SK], [-17, -28, SK], [-22, -33, SK],
    // Zone 0 → Zone 3 (중앙)
    [1, -30, GD],   [-1, -42, GD],  [0, -48, GD],
  ];

  lanterns.forEach(([lx, lz, color]) => {
    if (nearZone(lx, lz, 4.5)) return;
    const baseH = getApproxHeight(lx, lz);

    const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.6, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x2a2018, emissive: 0x3a2a18, emissiveIntensity: 0.12,
          metalness: 0.3, roughness: 0.8,
        }),
    );
    post.position.set(lx, baseH + 0.8, lz);
    scene.add(post);

    const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({
          color: 0x121214, emissive: color, emissiveIntensity: 2.0,
          metalness: 0.4, roughness: 0.4,
        }),
    );
    lamp.position.set(lx, baseH + 1.75, lz);
    lamp.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(lamp.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    ));
    scene.add(lamp);
  });
}

// ══════════════════════════════════════════
// ── Zone patches + Paths ──
// ══════════════════════════════════════════

function buildZonePatches(scene: THREE.Scene): void {
  COMPANIES.forEach(co => {
    const h = 0;
    for (const p of PLATFORMS) {
      if (Math.abs(p.x - co.position.x) < 1 && Math.abs(p.z - co.position.z) < 1) {
        // 존 플랫폼 높이 사용
        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(8, 32),
            new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.02, side: THREE.DoubleSide }),
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(co.position.x, p.h + 0.01, co.position.z);
        scene.add(glow);

        const inner = new THREE.Mesh(
            new THREE.CircleGeometry(5, 24),
            new THREE.MeshBasicMaterial({ color: co.color, transparent: true, opacity: 0.035, side: THREE.DoubleSide }),
        );
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(co.position.x, p.h + 0.015, co.position.z);
        scene.add(inner);
        break;
      }
    }
  });
}

function buildPathDots(scene: THREE.Scene): void {
  const pathColors = [PK, SK, GD, PK];
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      const steps = Math.max(12, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 4));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        if (s % 2 === 0) {
          const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
          const ph = getApproxHeight(px, pz);
          const dot = new THREE.Mesh(
              new THREE.BoxGeometry(0.15, 0.04, 0.15),
              new THREE.MeshStandardMaterial({
                color: 0x0e0e14, emissive: pathColors[(i + j) % 4],
                emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.5,
              }),
          );
          dot.position.set(px, ph + 0.02, pz);
          scene.add(dot);
        }
      }
    }
  }
}

// ══════════════════════════════════════════
// ── Sky ──
// ══════════════════════════════════════════

function buildSkyDome(scene: THREE.Scene): void {
  const skyGeo = new THREE.SphereGeometry(90, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x0a0a1a) },
      midColor: { value: new THREE.Color(0x141428) },
      bottomColor: { value: new THREE.Color(0x1a1020) },
    },
    vertexShader: `varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor; varying float vY; void main() { float t = clamp(vY, 0.0, 1.0); vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t)); col = mix(col, topColor, smoothstep(0.3, 1.0, t)); gl_FragColor = vec4(col, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
}

// ══════════════════════════════════════════
// ── Main ──
// ══════════════════════════════════════════

export function createScene(isMobile: boolean): SceneContext {
  const scene = new THREE.Scene();
  // ★ 넓은 맵에 맞춰 안개 줄임
  scene.fog = new THREE.FogExp2(0x0e0e18, 0.006);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.shadowMap.enabled = !isMobile;
  if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ── Build world ──
  buildGround(scene);
  buildPlatforms(scene, isMobile);
  buildTrees(scene);
  buildMushrooms(scene);
  buildLanterns(scene);
  buildZonePatches(scene);
  buildPathDots(scene);
  buildSkyDome(scene);

  // ── Lights ──
  scene.add(new THREE.AmbientLight(0x2a2040, 0.9));
  scene.add(new THREE.HemisphereLight(0x4466aa, 0x221122, 0.5));

  const dL = new THREE.DirectionalLight(0x9999cc, 1.2);
  dL.position.set(10, 20, 10);
  if (!isMobile) {
    dL.castShadow = true;
    dL.shadow.mapSize.set(1024, 1024);
    dL.shadow.camera.near = 1; dL.shadow.camera.far = 80;
    dL.shadow.camera.left = -50; dL.shadow.camera.right = 50;
    dL.shadow.camera.top = 50; dL.shadow.camera.bottom = -50;
  }
  scene.add(dL);

  const fillL = new THREE.DirectionalLight(0x553366, 0.35);
  fillL.position.set(-8, 12, -8);
  scene.add(fillL);

  // ★ 존별 에어리어 라이트 (새 좌표)
  const areaLights: [number, number, number, number, number, number][] = [
    [0xa78bfa, 1.2, 22, 0, 8, -18],
    [0x6ee7b7, 0.8, 20, 28, 7, -40],
    [0xfbbf24, 0.8, 20, -28, 7, -40],
    [0xff6b9d, 0.8, 20, 0, 8, -58],
  ];
  areaLights.forEach(([c, i, d, x, y, z]) => {
    const l = new THREE.PointLight(c, i, d);
    l.position.set(x, y, z);
    scene.add(l);
  });

  // ── Particles ──
  const pCount = isMobile ? 120 : 250;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 100;
    pPos[i * 3 + 1] = 0.3 + Math.random() * 10;
    pPos[i * 3 + 2] = -29 + (Math.random() - 0.5) * 80;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: GD, size: 0.08, transparent: true, opacity: 0.55,
  })));

  // ── Stars ──
  const starCount = isMobile ? 250 : 500;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 70 + Math.random() * 20;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.5 + 5;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = Math.random();
    if (tint < 0.3) { starColors[i*3]=1.0; starColors[i*3+1]=0.42; starColors[i*3+2]=0.62; }
    else if (tint < 0.5) { starColors[i*3]=0.98; starColors[i*3+1]=0.74; starColors[i*3+2]=0.14; }
    else { starColors[i*3]=0.8; starColors[i*3+1]=0.8; starColors[i*3+2]=0.88; }
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.18, transparent: true, opacity: 0.6, vertexColors: true, sizeAttenuation: true,
  })));
  const starBaseColors = new Float32Array(starColors);

  // ── Connection lines ──
  const ptM = new THREE.LineBasicMaterial({ color: 0x1a1420, transparent: true, opacity: 0.12 });
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.01, a.z),
        new THREE.Vector3((a.x + b.x) / 2, 0.01, (a.z + b.z) / 2),
        new THREE.Vector3(b.x, 0.01, b.z),
      ]), ptM));
    }
  }

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

export function updateEnvironment(
    t: number,
    particles: SceneContext['particles'],
    stars: SceneContext['stars'],
): void {
  const pa = particles.geo.attributes.position.array as Float32Array;
  for (let i = 0; i < particles.count; i++) {
    pa[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.002;
    pa[i * 3] += Math.cos(t * 0.3 + i * 0.7) * 0.001;
    if (pa[i * 3 + 1] > 12) pa[i * 3 + 1] = 0.3;
  }
  particles.geo.attributes.position.needsUpdate = true;

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