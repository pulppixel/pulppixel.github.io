// ─── 진입점 · 게임 루프 ───
import * as THREE from 'three';
import { createScene, updateEnvironment } from './scene';
import { createCharacter } from './character';
import { createZones } from './zones';
import { createInput } from './input';
import { createPanel, createQuest, createHUD } from './ui';

export function init(): void {
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (isMobile) document.body.classList.add('is-mobile');

  // ── 모듈 초기화 ──
  const { scene, camera, renderer, particles, stars } = createScene(isMobile);
  const character = createCharacter(scene);
  const { zones, projectMeshes, update: updateZones } = createZones(scene);
  const quest = createQuest();
  const panel = createPanel(isMobile, quest.visit);
  const input = createInput(renderer.domElement, isMobile, panel.isOpen);
  const hud = createHUD();

  // Mobile interact button
  document.getElementById('mobile-interact')!.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (nearestProject) panel.open(nearestProject.userData.project, nearestProject.userData.index);
  }, { passive: false });

  // ── 게임 상태 ──
  const mv = new THREE.Vector3();
  const SP = 4.8;
  let started = false;
  let nearestProject: THREE.Mesh | null = null;
  const camLookOffset = new THREE.Vector3(0, 0.8, 0);
  const camPos = character.group.position.clone().add(new THREE.Vector3(0, 3, 5));
  const camLookAt = character.group.position.clone().add(camLookOffset);
  camera.position.copy(camPos);

  // ── FPS 카운터 ──
  const fpsEl = document.getElementById('fps')!;
  let frameCount = 0, fpsLastTime = performance.now();

  // ── 게임 루프 ──
  const clock = new THREE.Clock();

  function animate(): void {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    // ── 이동 ──
    mv.set(0, 0, 0);
    let moving = false;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) mv.z -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) mv.z += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) mv.x -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) mv.x += 1;
    if (input.moveTid !== null) { mv.x += input.jIn.x; mv.z += input.jIn.y; }

    if (mv.length() > 0.12) {
      if (!started) { started = true; hud.heroLabel.classList.add('hidden'); }
      mv.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);
      character.group.position.x = Math.max(-30, Math.min(30, character.group.position.x + mv.x * SP * dt));
      character.group.position.z = Math.max(-30, Math.min(30, character.group.position.z + mv.z * SP * dt));
      const tr = Math.atan2(mv.x, mv.z);
      let df = tr - character.group.rotation.y;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      character.group.rotation.y += df * 8 * dt;
      moving = true;
    }

    // ── 캐릭터 애니메이션 ──
    character.animate(t, moving);

    // ── 가장 가까운 프로젝트 ──
    nearestProject = null;
    let nearestDist = Infinity;
    projectMeshes.forEach(m => {
      const dx = character.group.position.x - m.position.x, dz = character.group.position.z - m.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2.4 && d < nearestDist) { nearestDist = d; nearestProject = m; }
    });

    // ── HUD 업데이트 ──
    if (nearestProject) hud.showProjectHint(nearestProject.userData.project);
    else hud.hideProjectHint();

    // ── E키 인터랙트 ──
    if (input.keys['KeyE'] && nearestProject && !panel.isOpen()) {
      panel.open(nearestProject.userData.project, nearestProject.userData.index);
      input.keys['KeyE'] = false;
    }

    // ── 존 · 큐브 · 데코레이션 업데이트 ──
    updateZones(t, dt, character.group.position, nearestProject);

    // ── 카메라 ──
    const camH = input.camDist * 0.55 + input.pitch * input.camDist * 0.8;
    const camZ = input.camDist * Math.cos(input.pitch * 0.5);
    const dO = new THREE.Vector3(0, Math.max(1.5, camH), camZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);
    camPos.lerp(character.group.position.clone().add(dO), 4 * dt);
    camLookAt.lerp(character.group.position.clone().add(camLookOffset), 6 * dt);
    camera.position.copy(camPos);
    camera.lookAt(camLookAt);

    // ── 파티클 · 별 ──
    updateEnvironment(t, particles, stars);

    // ── 렌더 ──
    renderer.render(scene, camera);

    // FPS
    frameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) { fpsEl.textContent = frameCount + ' fps'; frameCount = 0; fpsLastTime = now; }
  }

  animate();
}
