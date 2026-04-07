// Entry point + game loop
import * as THREE from 'three';
import { getGroundHeight, getSurface } from './core/data';
import { initPerf, perf, startFpsMonitor } from './core/performance';
import { createScene, updateEnvironment } from './world/scene';
import { createCharacter, type SkinPalette } from './entity/character';
import { createZones } from './world/zones';
import { createInput } from './core/input';
import { createWarp, createHUD } from './system/ui';
import { createAudio } from './system/audio';
import { createTimeWeather } from './world/timeweather';
import { createPostFX } from './system/postfx';
import { createAnimals } from './entity/animals';
import { createAnimalInteraction } from './entity/interactions';
import { createSeasonSystem } from './world/seasons';
import { createWindSystem } from './world/wind';
import { createParticleEffects } from './world/particles';
import { createCollectibles } from './system/collectibles';
import { createNPCs } from './entity/npcs';
import { createZoneParticles } from './world/zoneparticles';
import { createEnvironmentEffects } from './world/environment';

const _mv = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const SP = 4.8;
const SPRINT_MULT = 1.7;
const WALK_MULT = 0.45;
const BOUND_X = 50;
const BOUND_Z_MIN = -68;
const BOUND_Z_MAX = 10;
const STEP_H = 0.35;
const GRAVITY = -18.9;
const JUMP_FORCE = 9.6;
const SPAWN = { x: 0, y: 1.5, z: 0 };
const WATER_Y = -3.0;

// --- Skin palette tint helper ---
function applySkinPalette(
    palette: SkinPalette,
    particles: { geo: THREE.BufferGeometry; count: number },
    dustMat: THREE.PointsMaterial,
): void {
  const pMat = (particles.geo.userData?.pointsMaterial as THREE.PointsMaterial | undefined);
  if (pMat) pMat.color.set(palette.particle);
  dustMat.color.set(palette.particle);
}

export function init(): void {
  // --- 모바일 UI 판정 ---
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (isMobile) document.body.classList.add('is-mobile');

  // --- 성능 티어 초기화 (createScene보다 먼저! 임시 canvas로 GPU 감지) ---
  const _tmpCanvas = document.createElement('canvas');
  const _tmpGl = _tmpCanvas.getContext('webgl') || _tmpCanvas.getContext('experimental-webgl');
  if (_tmpGl) initPerf(_tmpGl as WebGLRenderingContext);

  // --- Scene + Renderer 생성 (perf 값이 이미 확정된 상태) ---
  const {
    scene, camera, renderer, particles, stars, clouds, water,
    skyUniforms, sunLight, ambientLight, hemiLight, fillLight, starMaterial,
  } = createScene();

  let character = createCharacter(scene);

  const initBtn = document.querySelector(`[data-skin="${character.skinIndex}"]`);
  if (initBtn) initBtn.classList.add('sk-on');

  // --- Audio ---
  const audio = createAudio();
  const initAudio = () => {
    audio.init();
    audio.startAmbient();
    document.removeEventListener('keydown', initAudio);
    document.removeEventListener('click', initAudio);
    document.removeEventListener('touchstart', initAudio);
  };
  document.addEventListener('keydown', initAudio);
  document.addEventListener('click', initAudio);
  document.addEventListener('touchstart', initAudio);

  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.onclick = () => {
      const m = audio.toggleMute();
      soundBtn.textContent = m ? '🔇' : '🔊';
    };
  }

  document.getElementById('guestbook-btn')?.addEventListener('click', () => {
    enterMinigame('guestbook');
  });

  document.getElementById('leaderboard-btn')?.addEventListener('click', () => {
    window.location.href = '/leaderboard/';
  });

  // --- Dust particles ---
  const DUST_MAX = 80;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_MAX * 3);
  const dustAlpha = new Float32Array(DUST_MAX);
  const dustVel = new Float32Array(DUST_MAX * 3);
  let dustCount = 0;
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: character.palette.particle,
    size: 0.08, transparent: true, opacity: 0.5,
    sizeAttenuation: true, depthWrite: false,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));
  let dustSpawnT = 0;

  // --- Skin swap ---
  function swapSkin(index: number): void {
    const pos = character.group.position.clone();
    const rot = character.group.rotation.y;
    scene.remove(character.group);
    character = createCharacter(scene, index);
    character.group.position.copy(pos);
    character.group.rotation.y = rot;
    applySkinPalette(character.palette, particles, dustMat);
  }

  applySkinPalette(character.palette, particles, dustMat);

  const { zones, projectMeshes, update: updateZones } = createZones(scene);
  const animals = createAnimals(scene);
  const animalInteraction = createAnimalInteraction(scene);
  const seasons = createSeasonSystem(scene);
  // --- Season system ---
  document.querySelectorAll('[data-season]').forEach(btn => {
    btn.addEventListener('click', () => {
      seasons.setSeason((btn as HTMLElement).dataset.season as any);
      document.querySelectorAll('[data-season]').forEach(b => b.classList.remove('tw-on'));
      btn.classList.add('tw-on');
    });
  });

  const wind = createWindSystem(scene);
  const particleFx = createParticleEffects(scene);
  const envFx = createEnvironmentEffects(scene);
  const zoneParticles = createZoneParticles(scene);
  const input = createInput(renderer.domElement, isMobile, () => false);
  const hud = createHUD();

  const tw = createTimeWeather({
    scene, renderer,
    skyUniforms, sunLight, ambientLight, hemiLight, fillLight, starMaterial,
    water,
  });

  // --- Skin selection UI ---
  document.querySelectorAll('[data-skin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.skin!);
      swapSkin(idx);
      document.querySelectorAll('[data-skin]').forEach(b => b.classList.remove('sk-on'));
      btn.classList.add('sk-on');
    });
  });

  const postfx = createPostFX(renderer, scene, camera);
  window.addEventListener('resize', () => postfx.resize(innerWidth, innerHeight));

  // --- Time/Weather UI ---
  document.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      tw.setTime((btn as HTMLElement).dataset.time as any);
      document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('tw-on'));
      btn.classList.add('tw-on');
    });
  });
  document.querySelectorAll('[data-weather]').forEach(btn => {
    btn.addEventListener('click', () => {
      tw.setWeather((btn as HTMLElement).dataset.weather as any);
      document.querySelectorAll('[data-weather]').forEach(b => b.classList.remove('tw-on'));
      btn.classList.add('tw-on');
    });
  });

  const collectibles = createCollectibles(scene, audio);
  const npcs = createNPCs(scene, camera);

  // Warp teleport
  const warp = createWarp((x: number, z: number, h: number) => {
    warpOverlay.style.transition = 'opacity 0.12s ease-in';
    warpOverlay.style.opacity = '1';
    setTimeout(() => {
      warpOverlay.style.transition = 'opacity 0.4s ease-out';
      warpOverlay.style.opacity = '0';
    }, 120);

    character.group.position.set(x, h + 0.5, z + 4);
    velocityY = 0;
    isGrounded = false;

    audio.zoneChime(0x6ee7b7);
  });

  // --- Mobile jump button ---
  const mobileJumpBtn = document.getElementById('mobile-jump');
  if (mobileJumpBtn) {
    mobileJumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.keys['Space'] = true;
    }, { passive: false });
    mobileJumpBtn.addEventListener('touchend', () => {
      input.keys['Space'] = false;
    });
  }

  // --- Arcade transition overlay ---
  const arcadeOverlay = document.createElement('div');
  arcadeOverlay.style.cssText =
      'position:fixed;inset:0;background:#0a0a0b;opacity:0;' +
      'pointer-events:none;transition:opacity 0.45s ease;z-index:24;';
  document.body.appendChild(arcadeOverlay);

  // --- warp transition overlay ---
  const warpOverlay = document.createElement('div');
  warpOverlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:22;' +
      'opacity:0;transition:opacity 0.12s ease-in, opacity 0.4s ease-out;' +
      'background:radial-gradient(circle,rgba(110,231,183,0.15) 0%,rgba(110,231,183,0.05) 50%,transparent 70%);';
  document.body.appendChild(warpOverlay);

  // --- Zone atmosphere vignette overlay ---
  const atmoOverlay = document.createElement('div');
  atmoOverlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;';
  document.body.appendChild(atmoOverlay);
  let atmoLastColor = 0, atmoLastAlpha = 0;

  // --- Minigames (with audio) ---
  const mgContainer = document.getElementById('minigame-container')!;
  let inMinigame = false;
  let mgTransitioning = false;

  const exitMg = () => {
    audio.mgExit();
    inMinigame = false;
    arcadeOverlay.style.opacity = '1';
    arcadeOverlay.style.pointerEvents = 'auto';
    setTimeout(() => {
      arcadeOverlay.style.opacity = '0';
      arcadeOverlay.style.pointerEvents = 'none';
      if (!isMobile) renderer.domElement.requestPointerLock?.()?.then?.(() => {});
    }, 100);
  };

  // --- Minigame lazy loading ---
  const mgCache: Record<string, { start(): void; stop(): void }> = {};
  const MG_KEYS = new Set(['spody', 'ruby', 'maze', 'nomads', 'haul', 'ninetosix', 'guestbook']);

  async function loadMinigame(key: string): Promise<{ start(): void; stop(): void }> {
    if (mgCache[key]) return mgCache[key];
    let game: { start(): void; stop(): void };
    switch (key) {
      case 'spody':     game = (await import('./minigames/spody')).createSpodyGame(mgContainer, exitMg, audio); break;
      case 'ruby':      game = (await import('./minigames/ruby')).createRubyGame(mgContainer, exitMg, audio); break;
      case 'maze':      game = (await import('./minigames/maze')).createMazeGame(mgContainer, exitMg, audio); break;
      case 'nomads':    game = (await import('./minigames/nomads')).createNomadsGame(mgContainer, exitMg, audio); break;
      case 'haul':      game = (await import('./minigames/haul')).createHaulGame(mgContainer, exitMg, audio); break;
      case 'ninetosix': game = (await import('./minigames/circles')).createNineToSixGame(mgContainer, exitMg, audio); break;
      case 'guestbook': game = (await import('./minigames/guestbook')).createGuestbookGame(mgContainer, exitMg, audio); break;
      default: throw new Error(`Unknown minigame: ${key}`);
    }
    mgCache[key] = game;
    return game;
  }

  function enterMinigame(key: string): void {
    if (!MG_KEYS.has(key) || mgTransitioning) return;
    mgTransitioning = true;
    if (!isMobile) document.exitPointerLock();
    audio.mgEnter();
    arcadeOverlay.style.opacity = '1';
    arcadeOverlay.style.pointerEvents = 'auto';

    const fadeP = new Promise(r => setTimeout(r, 480));
    Promise.all([fadeP, loadMinigame(key)]).then(([, game]) => {
      inMinigame = true;
      mgTransitioning = false;
      game.start();
    }).catch(() => {
      mgTransitioning = false;
      arcadeOverlay.style.opacity = '0';
      arcadeOverlay.style.pointerEvents = 'none';
    });
  }

  function interact(m: THREE.Mesh): void {
    const proj = m.userData.project;
    warp.visit(m.userData.index);
    if (proj.minigame) {
      enterMinigame(proj.minigame);
    } else if (proj.link && proj.link !== '#') {
      window.open(proj.link, '_blank');
    }
  }

  document.getElementById('mobile-interact')!.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (nearestProject) interact(nearestProject);
  }, { passive: false });

  // --- Game state ---

  let started = false;
  let nearestProject: THREE.Mesh | null = null;
  let prevNearestIdx = -1;
  const activeZoneSet = new Set<number>();
  let velocityY = 0;
  let isGrounded = true;
  let wasGrounded = true;
  let isSprinting = false;
  let isWalking = false;
  let smoothGroundY = 0;
  let lastSafePos = { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z };

  const camLookOffset = new THREE.Vector3(0, 0.8, 0);
  const camPos = character.group.position.clone().add(new THREE.Vector3(0, 3, 5));
  const camLookAt = character.group.position.clone().add(camLookOffset);
  camera.position.copy(camPos);

  const fpsEl = document.getElementById('fps')!;
  let frameCount = 0, fpsLastTime = performance.now();
  let _prevTime = performance.now();

  // --- FPS 모니터: 자동 다운그레이드 ---
  startFpsMonitor((newTier) => {
    console.log(`[perf] Hot downgrade → ${newTier}`);
    // 런타임 토글 가능한 항목 즉시 반영
    renderer.shadowMap.enabled = perf.shadows;
    renderer.setPixelRatio(Math.min(devicePixelRatio, perf.maxPixelRatio));
    renderer.toneMappingExposure = perf.tier === 'low' ? 1.1 : 1.4;
    // PostFX는 매 프레임 perf.bloom 체크하므로 자동 반영
  });

  // --- Main loop ---

  function animate(): void {
    requestAnimationFrame(animate);
    const curTime = performance.now();
    const dt = Math.min((curTime - _prevTime) / 1000, 0.05);
    _prevTime = curTime;
    const t = curTime / 1000;

    if (inMinigame) { renderer.render(scene, camera); return; }

    // Movement input
    _mv.set(0, 0, 0);
    let moving = false;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) _mv.z -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) _mv.z += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) _mv.x -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) _mv.x += 1;
    if (input.moveTid !== null) { _mv.x += input.jIn.x; _mv.z += input.jIn.y; }

    if (input.keys['KeyV']) { isWalking = !isWalking; input.keys['KeyV'] = false; }

    const wantSprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    isSprinting = false;

    if (_mv.length() > 0.12) {
      if (!started) { started = true; hud.heroLabel.classList.add('hidden'); }
      isSprinting = wantSprint && isGrounded && !isWalking;
      const speed = isSprinting ? SP * SPRINT_MULT : isWalking ? SP * WALK_MULT : SP;
      _mv.normalize().applyAxisAngle(Y_AXIS, input.yaw);

      const curY = character.group.position.y;
      const nx = Math.max(-BOUND_X, Math.min(BOUND_X, character.group.position.x + _mv.x * speed * dt));
      const nz = Math.max(BOUND_Z_MIN, Math.min(BOUND_Z_MAX, character.group.position.z + _mv.z * speed * dt));

      const ghBoth = getGroundHeight(nx, nz);
      if (ghBoth <= curY + STEP_H) {
        character.group.position.x = nx;
        character.group.position.z = nz;
      } else {
        const ghX = getGroundHeight(nx, character.group.position.z);
        if (ghX <= curY + STEP_H) character.group.position.x = nx;
        const ghZ = getGroundHeight(character.group.position.x, nz);
        if (ghZ <= curY + STEP_H) character.group.position.z = nz;
      }

      const tr = Math.atan2(_mv.x, _mv.z);
      let df = tr - character.group.rotation.y;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      character.group.rotation.y += df * 8 * dt;
      moving = true;
    }

    // Jump
    if (input.keys['Space'] && isGrounded) {
      velocityY = JUMP_FORCE;
      isGrounded = false;
      input.keys['Space'] = false;
      audio.jump();
    }

    // Gravity + ground
    velocityY += GRAVITY * dt;
    character.group.position.y += velocityY * dt;
    const groundH = getGroundHeight(character.group.position.x, character.group.position.z);

    if (character.group.position.y < WATER_Y) {
      audio.splash();
      character.group.position.set(lastSafePos.x, lastSafePos.y + 0.5, lastSafePos.z);
      velocityY = 0;
      smoothGroundY = lastSafePos.y;
      isGrounded = false;
      wasGrounded = false;
      return;
    }

    if (character.group.position.y <= groundH && groundH > -0.5) {
      if (wasGrounded && velocityY > -3) {
        smoothGroundY += (groundH - smoothGroundY) * Math.min(1, 14 * dt);
        character.group.position.y = smoothGroundY;
      } else {
        character.group.position.y = groundH;
        smoothGroundY = groundH;
        if (velocityY < -2 && !wasGrounded) character.landSquash();
        if (!wasGrounded) audio.land(Math.abs(velocityY) / 5);
      }
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
      smoothGroundY = character.group.position.y;
    }
    wasGrounded = isGrounded;
    if (isGrounded) {
      lastSafePos.x = character.group.position.x;
      lastSafePos.y = character.group.position.y;
      lastSafePos.z = character.group.position.z;
    }

    const groundHForShadow = getGroundHeight(character.group.position.x, character.group.position.z);
    character.animate(t, moving, isSprinting, groundHForShadow);

    if (moving && isGrounded) {
      audio.footstep(getSurface(character.group.position.x, character.group.position.z), isSprinting);
    }

    // Sprint dust
    dustSpawnT -= dt;
    if (isSprinting && moving && dustSpawnT <= 0 && dustCount < DUST_MAX) {
      const backDir = -character.group.rotation.y;
      const idx = dustCount * 3;
      dustPos[idx] = character.group.position.x + Math.sin(backDir) * 0.3 + (Math.random() - 0.5) * 0.3;
      dustPos[idx + 1] = character.group.position.y + 0.05 + Math.random() * 0.15;
      dustPos[idx + 2] = character.group.position.z + Math.cos(backDir) * 0.3 + (Math.random() - 0.5) * 0.3;
      dustVel[idx] = (Math.random() - 0.5) * 0.5;
      dustVel[idx + 1] = 0.3 + Math.random() * 0.4;
      dustVel[idx + 2] = (Math.random() - 0.5) * 0.5;
      dustAlpha[dustCount] = 1.0;
      dustCount++;
      dustSpawnT = 0.03;
    }

    let writeIdx = 0;
    for (let i = 0; i < dustCount; i++) {
      dustAlpha[i] -= dt * 2.5;
      if (dustAlpha[i] <= 0) continue;
      const si = i * 3, wi = writeIdx * 3;
      dustPos[wi] = dustPos[si] + dustVel[si] * dt;
      dustPos[wi + 1] = dustPos[si + 1] + dustVel[si + 1] * dt;
      dustPos[wi + 2] = dustPos[si + 2] + dustVel[si + 2] * dt;
      dustVel[wi] = dustVel[si];
      dustVel[wi + 1] = dustVel[si + 1] * 0.95;
      dustVel[wi + 2] = dustVel[si + 2];
      dustAlpha[writeIdx] = dustAlpha[i];
      writeIdx++;
    }
    dustCount = writeIdx;
    dustGeo.setDrawRange(0, dustCount);
    dustGeo.attributes.position.needsUpdate = true;

    // Nearest project cube
    nearestProject = null;
    let nearestDist = Infinity;
    for (const m of projectMeshes) {
      const dx = character.group.position.x - m.position.x;
      const dy = character.group.position.y - m.position.y;
      const dz = character.group.position.z - m.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 3.0 && d < nearestDist) { nearestDist = d; nearestProject = m; }
    }

    if (nearestProject) hud.showProjectHint(nearestProject.userData.project);
    else hud.hideProjectHint();

    const curNearIdx = nearestProject ? nearestProject.userData.index : -1;
    if (curNearIdx !== prevNearestIdx && curNearIdx >= 0) audio.cubeTick();
    prevNearestIdx = curNearIdx;

    if (input.keys['KeyE'] && nearestProject) {
      interact(nearestProject);
      input.keys['KeyE'] = false;
    }

    updateZones(t, dt, character.group.position, nearestProject);
    animals.update(dt, t, character.group.position);
    animalInteraction.update(dt, t, character.group.position);
    zoneParticles.update(dt, t, character.group.position);

    collectibles.update(dt, t, character.group.position);
    npcs.update(dt, t, character.group.position);

    for (let zi = 0; zi < zones.length; zi++) {
      const dx = character.group.position.x - zones[zi].cx;
      const dz = character.group.position.z - zones[zi].cz;
      const inZone = Math.sqrt(dx * dx + dz * dz) < 5;
      if (inZone && !activeZoneSet.has(zi)) audio.zoneChime(zones[zi].color);
      if (inZone) activeZoneSet.add(zi); else activeZoneSet.delete(zi);
    }

    // Zone atmosphere vignette
    let bestProx = 0, bestColor = 0;
    for (let zi = 0; zi < zones.length; zi++) {
      if (zones[zi].proximity > bestProx) { bestProx = zones[zi].proximity; bestColor = zones[zi].color; }
    }
    const atmoAlpha = bestProx > 0.3 ? Math.min(0.12, (bestProx - 0.3) * 0.17) : 0;
    if (Math.abs(atmoAlpha - atmoLastAlpha) > 0.003 || (atmoAlpha > 0.003 && bestColor !== atmoLastColor)) {
      if (atmoAlpha < 0.003) {
        atmoOverlay.style.background = 'transparent';
      } else {
        const r = (bestColor >> 16) & 0xff, g = (bestColor >> 8) & 0xff, b = bestColor & 0xff;
        atmoOverlay.style.background =
            `radial-gradient(ellipse at center, transparent 35%, rgba(${r},${g},${b},${atmoAlpha}) 100%)`;
      }
      atmoLastAlpha = atmoAlpha;
      atmoLastColor = bestColor;
    }

    // Camera
    const walkCamDist = isWalking ? Math.min(input.camDist, 3.5) : input.camDist;
    const camH = walkCamDist * 0.55 + input.pitch * walkCamDist * 0.8;
    const camZ = walkCamDist * Math.cos(input.pitch * 0.5);

    _camOffset.set(0, Math.max(1.5, camH), camZ).applyAxisAngle(Y_AXIS, input.yaw);
    _camTarget.copy(character.group.position).add(_camOffset);
    camPos.lerp(_camTarget, (isWalking ? 3 : 4) * dt);

    _lookTarget.copy(character.group.position).add(camLookOffset);
    camLookAt.lerp(_lookTarget, 6 * dt);

    camera.position.copy(camPos);
    camera.lookAt(camLookAt);

    const targetFov = isSprinting && moving ? 58 : isWalking ? 42 : 50;
    if (Math.abs(camera.fov - targetFov) > 0.15) {
      camera.fov += (targetFov - camera.fov) * 3.5 * dt;
      camera.updateProjectionMatrix();
    }

    updateEnvironment(t, particles, stars, clouds, water);
    wind.update(t);
    envFx.update(dt, t);
    audio.update(dt);
    tw.update(dt);
    audio.setBGMMood(tw.getTimeLabel());
    seasons.update(dt);
    particleFx.update(dt, t, tw.getTimeLabel(), seasons.getSeason());
    postfx.updateForTime(tw.getTimeLabel(), dt);
    postfx.render();

    frameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      fpsEl.textContent = `${frameCount} fps · ${perf.tier}`;
      frameCount = 0;
      fpsLastTime = now;
    }
  }

  animate();
}