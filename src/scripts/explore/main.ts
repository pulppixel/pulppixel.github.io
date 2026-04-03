// ─── 진입점 · 게임 루프 ───
import * as THREE from 'three';
import { getGroundHeight } from './data';
import { createScene, updateEnvironment } from './scene';
import { createCharacter } from './character';
import { createZones } from './zones';
import { createInput } from './input';
import { createWarp, createHUD } from './ui';
import { createSpodyGame } from './minigames/spody';
import { createRubyGame } from './minigames/ruby';
import { createMazeGame } from './minigames/maze';
import { createNomadsGame } from './minigames/nomads';

export function init(): void {
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (isMobile) document.body.classList.add('is-mobile');

  const { scene, camera, renderer, particles, stars, clouds } = createScene(isMobile);
  const character = createCharacter(scene);
  const { zones, projectMeshes, update: updateZones } = createZones(scene);
  const input = createInput(renderer.domElement, isMobile, () => false);
  const hud = createHUD();

  // 워프 — 캐릭터 텔레포트 콜백
  const warp = createWarp((x: number, z: number, h: number) => {
    character.group.position.set(x, h + 0.5, z + 4);
    velocityY = 0;
    isGrounded = false;
  });

  // ── 아케이드 트랜지션 오버레이 ──
  const arcadeOverlay = document.createElement('div');
  arcadeOverlay.style.cssText = `
    position:fixed; inset:0; background:#0a0a0b; opacity:0;
    pointer-events:none; transition:opacity 0.45s ease;
    z-index:24; /* above 3D (z:0~20), below minigame (z:25) */
  `;
  document.body.appendChild(arcadeOverlay);

  // ── 미니게임 ──
  const mgContainer = document.getElementById('minigame-container')!;
  let inMinigame = false;
  let mgTransitioning = false;

  const exitMg = () => {
    // Minigame just closed → screen is dark (overlay still opacity:1 from enter)
    // Fade out to reveal 3D world
    inMinigame = false;
    arcadeOverlay.style.opacity = '1';
    arcadeOverlay.style.pointerEvents = 'auto';
    setTimeout(() => {
      arcadeOverlay.style.opacity = '0';
      arcadeOverlay.style.pointerEvents = 'none';
      if (!isMobile) renderer.domElement.requestPointerLock();
    }, 100);
  };

  const minigames: Record<string, { start(): void; stop(): void }> = {
    spody: createSpodyGame(mgContainer, exitMg),
    ruby: createRubyGame(mgContainer, exitMg),
    maze: createMazeGame(mgContainer, exitMg),
    nomads: createNomadsGame(mgContainer, exitMg),
  };

  function enterMinigame(key: string): void {
    if (!minigames[key] || mgTransitioning) return;
    mgTransitioning = true;

    if (!isMobile) document.exitPointerLock();

    // Phase 1: Fade to black (0.45s)
    arcadeOverlay.style.opacity = '1';
    arcadeOverlay.style.pointerEvents = 'auto';

    // Phase 2: After fade complete, start minigame
    setTimeout(() => {
      inMinigame = true;
      mgTransitioning = false;
      minigames[key].start();
    }, 480);
  }

  // 인터랙트 — 미니게임은 바로 시작, 나머지는 링크 열기
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

  // ── 게임 상태 ──
  const mv = new THREE.Vector3();
  const SP = 4.8;
  const BOUND_X = 50, BOUND_Z_MIN = -68, BOUND_Z_MAX = 10;
  // 벽 충돌용 step height
  const STEP_H = 0.35;
  let smoothGroundY = 0;       // 부드러운 지면 추적용
  let started = false;
  let nearestProject: THREE.Mesh | null = null;
  let velocityY = 0;
  let isGrounded = true;
  let wasGrounded = true;
  const GRAVITY = -15;
  const JUMP_FORCE = 10.6;
  let isSprinting = false;
  const SPRINT_MULT = 1.7;

  const WATER_Y = -1.5;           // 이 아래로 떨어지면 리스폰
  const SPAWN = { x: 0, y: 1.0, z: 0 };  // 리스폰 위치

  // 더스트 파티클
  const DUST_MAX = 80;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_MAX * 3);
  const dustAlpha = new Float32Array(DUST_MAX);
  const dustVel = new Float32Array(DUST_MAX * 3);
  let dustCount = 0;
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x9B8EC4, size: 0.08, transparent: true, opacity: 0.5,
    sizeAttenuation: true, depthWrite: false,
  }));
  scene.add(dustPts);
  let dustSpawnT = 0;

  const camLookOffset = new THREE.Vector3(0, 0.8, 0);
  const camPos = character.group.position.clone().add(new THREE.Vector3(0, 3, 5));
  const camLookAt = character.group.position.clone().add(camLookOffset);
  camera.position.copy(camPos);

  const fpsEl = document.getElementById('fps')!;
  let frameCount = 0, fpsLastTime = performance.now();
  const clock = new THREE.Clock();

  function animate(): void {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    if (inMinigame) { renderer.render(scene, camera); return; }

    // ── 이동 ──
    mv.set(0, 0, 0);
    let moving = false;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) mv.z -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) mv.z += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) mv.x -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) mv.x += 1;
    if (input.moveTid !== null) { mv.x += input.jIn.x; mv.z += input.jIn.y; }

    const wantSprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    isSprinting = false;

    if (mv.length() > 0.12) {
      if (!started) { started = true; hud.heroLabel.classList.add('hidden'); }
      isSprinting = wantSprint && isGrounded;
      const speed = isSprinting ? SP * SPRINT_MULT : SP;
      mv.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);

      // 벽 충돌 — stepHeight 이상 높은 플랫폼은 벽 처리, 축 분리 슬라이딩
      const curY = character.group.position.y;
      const footY = character.group.position.y;
      const nx = Math.max(-BOUND_X, Math.min(BOUND_X, character.group.position.x + mv.x * speed * dt));
      const nz = Math.max(BOUND_Z_MIN, Math.min(BOUND_Z_MAX, character.group.position.z + mv.z * speed * dt));

      const ghBoth = getGroundHeight(nx, nz);
      if (ghBoth <= footY + STEP_H) {
        // 양 축 모두 이동 가능
        character.group.position.x = nx;
        character.group.position.z = nz;
      } else {
        // 축 분리 — X만 시도
        const ghX = getGroundHeight(nx, character.group.position.z);
        if (ghX <= curY + STEP_H) {
          character.group.position.x = nx;
        }
        // Z만 시도
        const ghZ = getGroundHeight(character.group.position.x, nz);
        if (ghZ <= curY + STEP_H) {
          character.group.position.z = nz;
        }
      }

      const tr = Math.atan2(mv.x, mv.z);
      let df = tr - character.group.rotation.y;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      character.group.rotation.y += df * 8 * dt;
      moving = true;
    }

    // ── 점프 ──
    if (input.keys['Space'] && isGrounded) {
      velocityY = JUMP_FORCE;
      isGrounded = false;
      input.keys['Space'] = false;
    }

    // ── 중력 + 지면 충돌 ──
    velocityY += GRAVITY * dt;
    character.group.position.y += velocityY * dt;
    const groundH = getGroundHeight(character.group.position.x, character.group.position.z);

    // 물에 빠짐 → 리스폰
    if (character.group.position.y < WATER_Y) {
      character.group.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
      velocityY = 0;
      smoothGroundY = SPAWN.y;
      isGrounded = false;
      wasGrounded = false;
      return;
    }

    if (character.group.position.y <= groundH && groundH > -0.5) {
      if (wasGrounded && velocityY > -3) {
        // 걸어서 높이 변화 → lerp
        smoothGroundY += (groundH - smoothGroundY) * Math.min(1, 14 * dt);
        character.group.position.y = smoothGroundY;
      } else {
        // 낙하 착지
        character.group.position.y = groundH;
        smoothGroundY = groundH;
        if (velocityY < -2 && !wasGrounded) character.landSquash();
      }
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
      smoothGroundY = character.group.position.y;
    }
    wasGrounded = isGrounded;

    character.animate(t, moving, isSprinting);

    // ── 더스트 파티클 ──
    dustSpawnT -= dt;
    if (isSprinting && moving && dustSpawnT <= 0 && dustCount < DUST_MAX) {
      const backDir = -character.group.rotation.y;
      const bx = character.group.position.x + Math.sin(backDir) * 0.3 + (Math.random() - 0.5) * 0.3;
      const bz = character.group.position.z + Math.cos(backDir) * 0.3 + (Math.random() - 0.5) * 0.3;
      const idx = dustCount * 3;
      dustPos[idx] = bx;
      dustPos[idx + 1] = character.group.position.y + 0.05 + Math.random() * 0.15;
      dustPos[idx + 2] = bz;
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
      dustVel[wi] = dustVel[si]; dustVel[wi + 1] = dustVel[si + 1] * 0.95; dustVel[wi + 2] = dustVel[si];
      dustAlpha[writeIdx] = dustAlpha[i];
      writeIdx++;
    }
    dustCount = writeIdx;
    dustGeo.setDrawRange(0, dustCount);
    dustGeo.attributes.position.needsUpdate = true;

    // ── 가장 가까운 프로젝트 ──
    nearestProject = null;
    let nearestDist = Infinity;
    projectMeshes.forEach(m => {
      const dx = character.group.position.x - m.position.x;
      const dy = character.group.position.y - m.position.y;
      const dz = character.group.position.z - m.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 3.0 && d < nearestDist) { nearestDist = d; nearestProject = m; }
    });

    if (nearestProject) hud.showProjectHint(nearestProject.userData.project);
    else hud.hideProjectHint();

    // E키 → interact()
    if (input.keys['KeyE'] && nearestProject) {
      interact(nearestProject);
      input.keys['KeyE'] = false;
    }

    updateZones(t, dt, character.group.position, nearestProject);

    // ── 카메라 ──
    const camH = input.camDist * 0.55 + input.pitch * input.camDist * 0.8;
    const camZ = input.camDist * Math.cos(input.pitch * 0.5);
    const dO = new THREE.Vector3(0, Math.max(1.5, camH), camZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);
    camPos.lerp(character.group.position.clone().add(dO), 4 * dt);
    camLookAt.lerp(character.group.position.clone().add(camLookOffset), 6 * dt);
    camera.position.copy(camPos);
    camera.lookAt(camLookAt);

    const targetFov = isSprinting && moving ? 58 : 50;
    if (Math.abs(camera.fov - targetFov) > 0.15) {
      camera.fov += (targetFov - camera.fov) * 3.5 * dt;
      camera.updateProjectionMatrix();
    }

    updateEnvironment(t, particles, stars, clouds);
    renderer.render(scene, camera);

    frameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) { fpsEl.textContent = frameCount + ' fps'; frameCount = 0; fpsLastTime = now; }
  }

  animate();
}