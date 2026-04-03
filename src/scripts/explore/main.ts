// ─── 진입점 · 게임 루프 ───
import * as THREE from 'three';
import { getGroundHeight } from './data';
import { createScene, updateEnvironment } from './scene';
import { createCharacter } from './character';
import { createZones } from './zones';
import { createInput } from './input';
import { createPanel, createQuest, createHUD } from './ui';
import { createSpodyGame } from './minigames/spody';
import { createRubyGame } from './minigames/ruby';
import { createMazeGame } from './minigames/maze';
import { createNomadsGame } from './minigames/nomads';

export function init(): void {
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (isMobile) document.body.classList.add('is-mobile');

  const { scene, camera, renderer, particles, stars } = createScene(isMobile);
  const character = createCharacter(scene);
  const { zones, projectMeshes, update: updateZones } = createZones(scene);
  const quest = createQuest();
  const panel = createPanel(isMobile, quest.visit);
  const input = createInput(renderer.domElement, isMobile, panel.isOpen);
  const hud = createHUD();

  // ── 미니게임 ──
  const mgContainer = document.getElementById('minigame-container')!;
  let inMinigame = false;
  const exitMg = () => { inMinigame = false; if (!isMobile) renderer.domElement.requestPointerLock(); };
  const minigames: Record<string, { start(): void; stop(): void }> = {
    spody: createSpodyGame(mgContainer, exitMg),
    ruby: createRubyGame(mgContainer, exitMg),
    maze: createMazeGame(mgContainer, exitMg),
    nomads: createNomadsGame(mgContainer, exitMg),
  };

  function enterMinigame(key: string, projectIndex: number): void {
    if (!minigames[key]) return;
    inMinigame = true;
    if (!isMobile) document.exitPointerLock();
    quest.visit(projectIndex);
    minigames[key].start();
  }

  document.getElementById('mobile-interact')!.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (!nearestProject) return;
    const proj = nearestProject.userData.project;
    if (proj.minigame) enterMinigame(proj.minigame, nearestProject.userData.index);
    else panel.open(proj, nearestProject.userData.index);
  }, { passive: false });

  // ── 게임 상태 ──
  const mv = new THREE.Vector3();
  const SP = 4.8;
  // ★ 맵 경계 확장
  const BOUND_X = 50;
  const BOUND_Z_MIN = -68;
  const BOUND_Z_MAX = 10;

  let started = false;
  let nearestProject: THREE.Mesh | null = null;

  // 점프
  let velocityY = 0;
  let isGrounded = true;
  let wasGrounded = true;
  const GRAVITY = -22;
  const JUMP_FORCE = 8.2;

  // 스프린트
  let isSprinting = false;
  const SPRINT_MULT = 1.7;

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
      // ★ 확장된 맵 경계
      character.group.position.x = Math.max(-BOUND_X, Math.min(BOUND_X, character.group.position.x + mv.x * speed * dt));
      character.group.position.z = Math.max(BOUND_Z_MIN, Math.min(BOUND_Z_MAX, character.group.position.z + mv.z * speed * dt));
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

    // ★ 중력 + 높이맵 기반 지면 충돌
    velocityY += GRAVITY * dt;
    character.group.position.y += velocityY * dt;
    const groundH = getGroundHeight(character.group.position.x, character.group.position.z);
    if (character.group.position.y <= groundH) {
      character.group.position.y = groundH;
      if (velocityY < -2 && !wasGrounded) {
        character.landSquash();
      }
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }
    wasGrounded = isGrounded;

    // ── 캐릭터 애니메이션 ──
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

    // ── 가장 가까운 프로젝트 (★ 3D 거리 + 높이 고려) ──
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

    if (input.keys['KeyE'] && nearestProject && !panel.isOpen()) {
      const proj = nearestProject.userData.project;
      if (proj.minigame) enterMinigame(proj.minigame, nearestProject.userData.index);
      else panel.open(proj, nearestProject.userData.index);
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

    updateEnvironment(t, particles, stars);
    renderer.render(scene, camera);

    frameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) { fpsEl.textContent = frameCount + ' fps'; frameCount = 0; fpsLastTime = now; }
  }

  animate();
}