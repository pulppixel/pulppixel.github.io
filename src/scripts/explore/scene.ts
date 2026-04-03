// ─── 씬 · 복셀 지형 · 환경 ───
// Night Minecraft + Kawaii Neon — ★ 라이팅 대폭 강화
import * as THREE from 'three';
import { COMPANIES } from './data';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: { geo: THREE.BufferGeometry; count: number };
  stars: { geo: THREE.BufferGeometry; baseColors: Float32Array; count: number };
}

// ── Palette ──
const PK = 0xff6b9d;
const GD = 0xfbbf24;
const SK = 0x67e8f9;

// ── Noise helper ──
function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function nearZone(x: number, z: number, r: number): boolean {
  for (const co of COMPANIES) {
    const dx = x - co.position.x, dz = z - co.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < r) return true;
  }
  return false;
}

// ══════════════════════════════════════════
// ── Terrain builders ──
// ══════════════════════════════════════════

function buildGroundBlocks(scene: THREE.Scene): void {
  const S = 2; // block size
  const geo = new THREE.BoxGeometry(S - 0.06, 0.15, S - 0.06);
  // ★ 지면 밝기 향상
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1c1c24, emissive: PK, emissiveIntensity: 0.015,
    metalness: 0.3, roughness: 0.88,
  });

  const count = 31 * 31; // -30 to 30, step 2
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.receiveShadow = true;
  const d = new THREE.Object3D();
  let i = 0;
  for (let x = -30; x <= 30; x += S) {
    for (let z = -30; z <= 30; z += S) {
      d.position.set(x, -0.075, z);
      d.updateMatrix();
      mesh.setMatrixAt(i++, d.matrix);
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // Subtle edge grid — ★ 약간 더 밝게
  const grid = new THREE.GridHelper(62, 31, 0x2a2030, 0x1a1824);
  (grid.material as THREE.Material).opacity = 0.3;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);
}

function buildRaisedTerrain(scene: THREE.Scene): void {
  const geo = new THREE.BoxGeometry(1.9, 1, 1.9);

  // ★ 머티리얼 밝기 향상
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x162e1e, emissive: 0x2a5a38, emissiveIntensity: 0.22,
    metalness: 0.2, roughness: 0.85,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e2a, emissive: 0x2a2a3a, emissiveIntensity: 0.12,
    metalness: 0.4, roughness: 0.8,
  });

  const clusters: [number, number, number, number, number][] = [
    // [cx, cz, countX, countZ, maxH]
    [-25, -2, 3, 2, 3],  [-22, -20, 2, 3, 2],
    [22, -5, 2, 2, 3],   [25, -22, 3, 2, 2],
    [-8, 2, 2, 2, 2],    [10, 2, 3, 1, 2],
    [-26, -12, 2, 2, 4],  [26, -12, 2, 3, 3],
    [5, -28, 3, 2, 2],   [-6, -28, 2, 2, 3],
    [18, -26, 2, 2, 2],  [-20, -26, 3, 2, 3],
    // Small accent blocks
    [-15, -4, 1, 1, 2],  [16, -8, 1, 1, 1],
    [-12, -22, 1, 1, 2], [14, -20, 1, 1, 1],
  ];

  const edgeMat = new THREE.LineBasicMaterial({ color: PK, transparent: true, opacity: 0.08 });
  const edgeGeo = new THREE.EdgesGeometry(geo);

  clusters.forEach(([cx, cz, w, dp, maxH]) => {
    for (let bx = 0; bx < w; bx++) {
      for (let bz = 0; bz < dp; bz++) {
        const h = 1 + Math.floor(hash(cx + bx, cz + bz) * maxH);
        for (let y = 0; y < h; y++) {
          const px = cx + bx * 2, pz = cz + bz * 2;
          if (nearZone(px, pz, 5.5)) continue;
          const isTop = y === h - 1;
          const block = new THREE.Mesh(geo, isTop ? grassMat : stoneMat);
          block.position.set(px, y * 1 + 0.5, pz);
          block.castShadow = true;
          block.receiveShadow = true;
          scene.add(block);

          if (isTop) {
            block.add(new THREE.LineSegments(edgeGeo, edgeMat));
          }
        }
      }
    }
  });
}

function buildTrees(scene: THREE.Scene): void {
  const trees: [number, number, number, number][] = [
    // [x, z, height, leafColor]
    [-18, -6, 5, PK], [20, -3, 4, SK], [-14, -18, 6, GD],
    [18, -18, 4, PK], [-24, -14, 5, SK], [8, -26, 4, GD],
    [-5, -14, 5, PK], [24, -8, 3, SK],
  ];

  trees.forEach(([tx, tz, h, lc]) => {
    if (nearZone(tx, tz, 5.5)) return;

    // Trunk — ★ 밝기 향상
    const trunkGeo = new THREE.BoxGeometry(0.6, h * 0.8, 0.6);
    const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({
      color: 0x2a2018, emissive: 0x3a2a18, emissiveIntensity: 0.15,
      metalness: 0.2, roughness: 0.9,
    }));
    trunk.position.set(tx, h * 0.4, tz);
    trunk.castShadow = true;
    scene.add(trunk);

    // Leaves — ★ 발광 강화
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x121a14, emissive: lc, emissiveIntensity: 0.35,
      metalness: 0.1, roughness: 0.7, transparent: true, opacity: 0.9,
    });
    const leafEdge = new THREE.LineBasicMaterial({ color: lc, transparent: true, opacity: 0.3 });

    const leafPositions = [
      [0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1],
      [0, 1, 0], [-1, 0, 1], [1, 0, -1],
    ];

    const leafGeo = new THREE.BoxGeometry(1.2, 1.0, 1.2);
    const leafEdgeGeo = new THREE.EdgesGeometry(leafGeo);

    leafPositions.forEach(([lx, ly, lz]) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(tx + lx * 1.1, h * 0.8 + ly * 1.0 + 0.5, tz + lz * 1.1);
      leaf.castShadow = true;
      leaf.add(new THREE.LineSegments(leafEdgeGeo, leafEdge));
      scene.add(leaf);
    });

    // ★ 트리 라이트 강화
    const treeLight = new THREE.PointLight(lc, 0.35, 6);
    treeLight.position.set(tx, h * 0.8 + 1, tz);
    scene.add(treeLight);
  });
}

function buildMushrooms(scene: THREE.Scene): void {
  const shrooms: [number, number, number][] = [
    [-10, -3, PK], [12, -6, GD], [-16, -10, SK],
    [6, -12, PK], [-3, -20, GD], [16, -14, SK],
    [-20, -8, PK], [22, -16, GD], [-8, -26, SK],
    [4, -4, PK], [-12, -14, GD], [10, -22, SK],
    [20, -24, PK], [-22, -22, GD], [0, -16, SK],
  ];

  const stemGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
  const capGeo = new THREE.BoxGeometry(0.5, 0.2, 0.5);
  const capEdgeGeo = new THREE.EdgesGeometry(capGeo);

  shrooms.forEach(([sx, sz, color]) => {
    if (nearZone(sx, sz, 4.5)) return;

    const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.15,
      metalness: 0.2, roughness: 0.8,
    }));
    stem.position.set(sx, 0.175, sz);
    scene.add(stem);

    // ★ 버섯 발광 강화
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
      color: 0x121218, emissive: color, emissiveIntensity: 0.8,
      metalness: 0.3, roughness: 0.5,
    }));
    cap.position.set(sx, 0.45, sz);
    cap.add(new THREE.LineSegments(capEdgeGeo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.5,
    })));
    scene.add(cap);

    // ★ 버섯 라이트 강화
    const light = new THREE.PointLight(color, 0.2, 3.5);
    light.position.set(sx, 0.6, sz);
    scene.add(light);
  });
}

function buildLanterns(scene: THREE.Scene): void {
  const lanterns: [number, number, number][] = [
    [0, -4, GD], [0, -12, GD], [0, -20, GD],
    [-6, -8, PK], [6, -8, PK],
    [-6, -16, SK], [6, -16, SK],
    [6, -24, GD], [-6, -24, GD],
  ];

  lanterns.forEach(([lx, lz, color]) => {
    if (nearZone(lx, lz, 4)) return;

    // Post — ★ 약간 밝게
    const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.6, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x2a2018, emissive: 0x3a2a18, emissiveIntensity: 0.12,
          metalness: 0.3, roughness: 0.8,
        }),
    );
    post.position.set(lx, 0.8, lz);
    scene.add(post);

    // ★ 랜턴 헤드 발광 강화
    const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({
          color: 0x121214, emissive: color, emissiveIntensity: 1.5,
          metalness: 0.4, roughness: 0.4,
        }),
    );
    lamp.position.set(lx, 1.75, lz);
    lamp.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(lamp.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    ));
    scene.add(lamp);

    // ★ 랜턴 라이트 대폭 강화
    const light = new THREE.PointLight(color, 0.8, 7);
    light.position.set(lx, 1.9, lz);
    scene.add(light);
  });
}

// ══════════════════════════════════════════
// ── Zone ground patches ──
// ══════════════════════════════════════════

function buildZonePatches(scene: THREE.Scene): void {
  COMPANIES.forEach(co => {
    // ★ 존 글로우 강화
    const glow = new THREE.Mesh(
        new THREE.CircleGeometry(8, 32),
        new THREE.MeshBasicMaterial({
          color: co.color, transparent: true, opacity: 0.02, side: THREE.DoubleSide,
        }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(co.position.x, 0.002, co.position.z);
    scene.add(glow);

    const inner = new THREE.Mesh(
        new THREE.CircleGeometry(5, 24),
        new THREE.MeshBasicMaterial({
          color: co.color, transparent: true, opacity: 0.035, side: THREE.DoubleSide,
        }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(co.position.x, 0.003, co.position.z);
    scene.add(inner);
  });
}

function buildPathDots(scene: THREE.Scene): void {
  const pathColors = [PK, SK, GD, PK];
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      for (let s = 0; s < 12; s++) {
        const t = s / 12;
        if (s % 2 === 0) {
          const dot = new THREE.Mesh(
              new THREE.BoxGeometry(0.15, 0.04, 0.15),
              new THREE.MeshStandardMaterial({
                color: 0x0e0e14, emissive: pathColors[(i + j) % 4],
                emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.5,
              }),
          );
          dot.position.set(
              a.x + (b.x - a.x) * t,
              0.02,
              a.z + (b.z - a.z) * t,
          );
          scene.add(dot);
        }
      }
    }
  }
}

// ══════════════════════════════════════════
// ★ Sky Gradient (반구형 하늘)
// ══════════════════════════════════════════

function buildSkyDome(scene: THREE.Scene): void {
  const skyGeo = new THREE.SphereGeometry(80, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x0a0a1a) },
      midColor: { value: new THREE.Color(0x141428) },
      bottomColor: { value: new THREE.Color(0x1a1020) },
    },
    vertexShader: `
      varying float vY;
      void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying float vY;
      void main() {
        float t = clamp(vY, 0.0, 1.0);
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t));
        col = mix(col, topColor, smoothstep(0.3, 1.0, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
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
  // ★ 안개 — 밀도 낮추고 색상 조정 (더 멀리 보이게)
  scene.fog = new THREE.FogExp2(0x0e0e18, 0.008);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // ★ 톤매핑 노출 올리기
  renderer.toneMappingExposure = 1.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ── Terrain ──
  buildGroundBlocks(scene);
  buildRaisedTerrain(scene);
  buildTrees(scene);
  buildMushrooms(scene);
  buildLanterns(scene);
  buildZonePatches(scene);
  buildPathDots(scene);
  // ★ 하늘 그라디언트
  buildSkyDome(scene);

  // ── Lights ── ★ 대폭 강화
  // Ambient: 전체적 기본 밝기
  scene.add(new THREE.AmbientLight(0x2a2040, 0.9));

  // ★ HemisphereLight: 하늘/땅 색 차이로 자연스러운 입체감
  scene.add(new THREE.HemisphereLight(0x4466aa, 0x221122, 0.5));

  // ★ DirectionalLight: 달빛 느낌, 강도 대폭 상향
  const dL = new THREE.DirectionalLight(0x9999cc, 1.2);
  dL.position.set(10, 20, 10);
  dL.castShadow = true;
  dL.shadow.mapSize.set(1024, 1024);
  dL.shadow.camera.near = 1; dL.shadow.camera.far = 60;
  dL.shadow.camera.left = -30; dL.shadow.camera.right = 30;
  dL.shadow.camera.top = 30; dL.shadow.camera.bottom = -30;
  scene.add(dL);

  // ★ 보조 Directional (반대쪽 Fill Light)
  const fillL = new THREE.DirectionalLight(0x553366, 0.35);
  fillL.position.set(-8, 12, -8);
  scene.add(fillL);

  // ★ 컬러 에어리어 라이트 강화
  const lights: [number, number, number, number, number, number][] = [
    [PK, 1.5, 28, 0, 8, -4],
    [SK, 1.0, 22, -10, 7, -10],
    [GD, 1.0, 22, 8, 7, -18],
    [PK, 0.8, 18, -14, 7, 7],
    // ★ 추가 라이트 — 존 중심부 밝히기
    [0xa78bfa, 0.6, 12, 0, 3, -8],
    [0x6ee7b7, 0.5, 12, 13, 3, -16],
    [0xfbbf24, 0.5, 12, -13, 3, -16],
    [0xff6b9d, 0.5, 12, 0, 3, -24],
  ];
  lights.forEach(([c, i, d, x, y, z]) => {
    const l = new THREE.PointLight(c, i, d);
    l.position.set(x, y, z);
    scene.add(l);
  });

  // ── Firefly particles ── ★ 약간 크고 밝게
  const pCount = 250;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 60;
    pPos[i * 3 + 1] = 0.3 + Math.random() * 8;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: GD, size: 0.08, transparent: true, opacity: 0.55,
  })));

  // ── Stars ── ★ 밝기 향상
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
    if (tint < 0.3) {
      // Pink stars
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.42; starColors[i * 3 + 2] = 0.62;
    } else if (tint < 0.5) {
      // Gold stars
      starColors[i * 3] = 0.98; starColors[i * 3 + 1] = 0.74; starColors[i * 3 + 2] = 0.14;
    } else {
      // White-ish
      starColors[i * 3] = 0.8; starColors[i * 3 + 1] = 0.8; starColors[i * 3 + 2] = 0.88;
    }
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.18, transparent: true, opacity: 0.6,
    vertexColors: true, sizeAttenuation: true,
  })));
  const starBaseColors = new Float32Array(starColors);

  // ── Connection lines between zones ──
  const ptM = new THREE.LineBasicMaterial({ color: 0x1a1420, transparent: true, opacity: 0.15 });
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

/** 파티클 부유 + 별 트윙클 */
export function updateEnvironment(
    t: number,
    particles: SceneContext['particles'],
    stars: SceneContext['stars'],
): void {
  // Firefly drift
  const pa = particles.geo.attributes.position.array as Float32Array;
  for (let i = 0; i < particles.count; i++) {
    pa[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.002;
    pa[i * 3] += Math.cos(t * 0.3 + i * 0.7) * 0.001;
    if (pa[i * 3 + 1] > 10) pa[i * 3 + 1] = 0.3;
  }
  particles.geo.attributes.position.needsUpdate = true;

  // Star twinkle
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