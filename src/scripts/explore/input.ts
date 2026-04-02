// ─── PC · 모바일 입력 ───

export interface InputState {
  keys: Record<string, boolean>;
  yaw: number;
  pitch: number;
  camDist: number;
  isLocked: boolean;
  moveTid: number | null;
  jIn: { x: number; y: number };
}

export function createInput(
  canvas: HTMLCanvasElement,
  isMobile: boolean,
  isPanelOpen: () => boolean,
): InputState {
  const state: InputState = {
    keys: {},
    yaw: 0, pitch: 0,
    camDist: isMobile ? 6.5 : 5,
    isLocked: false,
    moveTid: null,
    jIn: { x: 0, y: 0 },
  };

  // ── Keyboard ──
  document.addEventListener('keydown', e => { state.keys[e.code] = true; });
  document.addEventListener('keyup', e => { state.keys[e.code] = false; });

  // ── PC Mouse ──
  if (!isMobile) {
    canvas.addEventListener('click', () => { if (!isPanelOpen()) canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === canvas; });
    document.addEventListener('mousemove', e => {
      if (state.isLocked) {
        state.yaw -= e.movementX * 0.003;
        state.pitch = Math.max(-0.6, Math.min(0.8, state.pitch - e.movementY * 0.002));
      }
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); if (state.isLocked) document.exitPointerLock(); }
    });
  }

  // ── Wheel zoom ──
  canvas.addEventListener('wheel', e => { state.camDist = Math.max(2.5, Math.min(12, state.camDist + e.deltaY * 0.004)); }, { passive: true });

  // ── Mobile Touch ──
  const jBase = document.getElementById('joystick-base')!;
  const jThumb = document.getElementById('joystick-thumb')!;
  let moveOrig = { x: 0, y: 0 };
  let camTid: number | null = null;
  let camPrev = { x: 0, y: 0 };
  let pinchOn = false, pinchBase = 0;
  const JR = 55, MZ = 0.65;
  const pDist = (a: Touch, b: Touch) => Math.sqrt((a.clientX - b.clientX) ** 2 + (a.clientY - b.clientY) ** 2);

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (isPanelOpen()) return;
    if (e.touches.length >= 2) { pinchOn = true; pinchBase = pDist(e.touches[0], e.touches[1]); return; }
    const t = e.changedTouches[0];
    const yr = t.clientY / innerHeight;
    if (state.moveTid === null && yr >= MZ) {
      state.moveTid = t.identifier;
      moveOrig = { x: t.clientX, y: t.clientY };
      state.jIn = { x: 0, y: 0 };
      jBase.style.left = t.clientX + 'px'; jBase.style.top = t.clientY + 'px';
      jBase.classList.add('active'); jThumb.classList.add('active');
      jThumb.style.transform = 'translate(-50%,-50%)';
    } else if (camTid === null) {
      camTid = t.identifier; camPrev = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length >= 2) {
      if (!pinchOn) { pinchOn = true; pinchBase = pDist(e.touches[0], e.touches[1]); }
      const nd = pDist(e.touches[0], e.touches[1]);
      state.camDist = Math.max(3, Math.min(12, state.camDist - (nd - pinchBase) * 0.008));
      pinchBase = nd;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === state.moveTid) {
        let dx = t.clientX - moveOrig.x, dy = t.clientY - moveOrig.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; }
        state.jIn.x = dx / JR; state.jIn.y = dy / JR;
        jThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      if (t.identifier === camTid) {
        state.yaw -= (t.clientX - camPrev.x) * 0.005;
        state.pitch = Math.max(-0.6, Math.min(0.8, state.pitch - (t.clientY - camPrev.y) * 0.003));
        camPrev = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) pinchOn = false;
    for (const t of e.changedTouches) {
      if (t.identifier === state.moveTid) {
        state.moveTid = null; state.jIn = { x: 0, y: 0 };
        jBase.classList.remove('active'); jThumb.classList.remove('active');
        jThumb.style.transform = 'translate(-50%,-50%)';
      }
      if (t.identifier === camTid) camTid = null;
    }
  });

  canvas.addEventListener('touchcancel', () => {
    state.moveTid = null; camTid = null; pinchOn = false; state.jIn = { x: 0, y: 0 };
    jBase.classList.remove('active'); jThumb.classList.remove('active');
  });

  return state;
}
