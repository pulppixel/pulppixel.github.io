// Scene setup + per-frame environment update
import * as THREE from 'three';
import { COMPANIES } from '../core/data';
import { buildPlatforms, buildTrees, buildFlowers, buildMushrooms, buildRocks, buildFences, buildLanterns, buildZonePatches, buildPathDots, flushInstances } from './terrain';
import { buildOcean } from './ocean';
import { buildSkyDome, buildClouds } from './sky';
import { buildWaterEdge, buildBushes, buildZoneDecor, buildZoneBoundaries } from './zonedetails';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: { geo: THREE.BufferGeometry; count: number };
  stars: { geo: THREE.BufferGeometry; baseColors: Float32Array; count: number };
  clouds: THREE.Group[];
  water: THREE.Mesh;
  skyUniforms: Record<string, { value: any }>;
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  starMaterial: THREE.PointsMaterial;
}

export function createScene(isMobile: boolean): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8e8fa);
  scene.fog = new THREE.FogExp2(0xb8daf0, 0.008);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = !isMobile;
  if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Build world
  buildPlatforms(scene, isMobile);
  buildTrees(scene);
  buildFlowers(scene);
  buildMushrooms(scene);
  buildRocks(scene);
  buildFences(scene);
  buildLanterns(scene);
  buildZonePatches(scene);
  buildPathDots(scene);
  flushInstances(scene);

  buildWaterEdge(scene);
  buildBushes(scene);
  buildZoneDecor(scene);
  buildZoneBoundaries(scene);
  const skyUniforms = buildSkyDome(scene);
  const water = buildOcean(scene, isMobile);
  const clouds = buildClouds(scene);

  // --- Lighting ---

  const ambientLight = new THREE.AmbientLight(0x8899bb, 1.2);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x88bbff, 0x446633, 0.7);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
  sun.position.set(15, 25, 10);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    const c = sun.shadow.camera;
    c.left = -50; c.right = 50; c.top = 50; c.bottom = -50;
  }
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x99aacc, 0.4);
  fill.position.set(-10, 15, -8);
  scene.add(fill);

  // Zone area lights
  const zoneLights: [number, number, number, number, number, number][] = [
    [0xa78bfa, 0.5, 18, 0, 6, -18],
    [0x6ee7b7, 0.4, 16, 28, 5, -40],
    [0xfbbf24, 0.4, 16, -28, 5, -40],
    [0xff6b9d, 0.4, 16, 0, 6, -58],
  ];
  for (const [c, intensity, dist, x, y, z] of zoneLights) {
    const l = new THREE.PointLight(c, intensity, dist);
    l.position.set(x, y, z);
    scene.add(l);
  }

  // --- Pollen particles ---

  const pCount = isMobile ? 80 : 180;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 100;
    pPos[i * 3 + 1] = 0.5 + Math.random() * 8;
    pPos[i * 3 + 2] = -29 + (Math.random() - 0.5) * 80;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: 0xf5e8a0, size: 0.06, transparent: true, opacity: 0.4,
  })));

  // --- Sky sparkles ---

  const starCount = isMobile ? 60 : 120;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random());
    const r = 60 + Math.random() * 20;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.4 + 12;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starColors[i * 3] = 1;
    starColors[i * 3 + 1] = 0.95 + Math.random() * 0.05;
    starColors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.08, transparent: true, opacity: 0.15, vertexColors: true, sizeAttenuation: true,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // --- Zone connection lines ---

  const lineMat = new THREE.LineBasicMaterial({ color: 0x90b090, transparent: true, opacity: 0.06 });
  for (let i = 0; i < COMPANIES.length; i++) {
    for (let j = i + 1; j < COMPANIES.length; j++) {
      const a = COMPANIES[i].position, b = COMPANIES[j].position;
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.02, a.z),
        new THREE.Vector3((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2),
        new THREE.Vector3(b.x, 0.02, b.z),
      ]), lineMat));
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
    stars: { geo: starGeo, baseColors: new Float32Array(starColors), count: starCount },
    clouds, water,
    skyUniforms, sunLight: sun, ambientLight, hemiLight, fillLight: fill, starMaterial: starMat,
  };
}

// --- Per-frame environment animation ---

export function updateEnvironment(
    t: number,
    particles: SceneContext['particles'],
    stars: SceneContext['stars'],
    clouds?: THREE.Group[],
    water?: THREE.Mesh,
): void {
  // Pollen drift
  const pa = particles.geo.attributes.position.array as Float32Array;
  for (let i = 0; i < particles.count; i++) {
    pa[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.002;
    pa[i * 3] += Math.cos(t * 0.25 + i * 0.7) * 0.001;
    if (pa[i * 3 + 1] > 10) pa[i * 3 + 1] = 0.5;
  }
  particles.geo.attributes.position.needsUpdate = true;

  // Sparkle twinkle (every 6th for perf)
  const sCol = stars.geo.getAttribute('color');
  for (let i = 0; i < stars.count; i += 6) {
    const f = 0.6 + Math.sin(t * 1.2 + i * 0.3) * 0.4;
    sCol.array[i * 3] = stars.baseColors[i * 3] * f;
    sCol.array[i * 3 + 1] = stars.baseColors[i * 3 + 1] * f;
    sCol.array[i * 3 + 2] = stars.baseColors[i * 3 + 2] * f;
  }
  sCol.needsUpdate = true;

  // Cloud drift
  if (clouds) {
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += 0.15 * (0.5 + (i % 3) * 0.2) * (1 / 60);
      if (clouds[i].position.x > 55) clouds[i].position.x = -55;
    }
  }

  // Water time uniform
  if (water) {
    (water.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  }
}