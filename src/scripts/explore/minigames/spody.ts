// ─── SPODY 미니게임: 공 튀기기 ───
// 공을 발사해서 벽에 반사시켜 타겟을 맞추는 게임

// ── Helpers ──
function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const C = { bg: '#0a0a0b', accent: '#6ee7b7', pink: '#ff6b9d', purple: '#a78bfa', yellow: '#fbbf24', blue: '#38bdf8' };
const TARGET_COLORS = [C.pink, C.accent, C.purple, C.yellow, C.blue];

// ── Types ──
interface Ball { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; }
interface Target { x: number; y: number; r: number; color: string; alive: boolean; hitT: number; phase: number; }
interface Particle { x: number; y: number; vx: number; vy: number; a: number; color: string; s: number; }
interface Popup { x: number; y: number; a: number; text: string; }
type Phase = 'aim' | 'fly' | 'result';

const BALL_R = 6, BALL_SPD = 520, TGT_R = 22, MAX_BALLS = 5, TGT_COUNT = 5;

export function createSpodyGame(container: HTMLElement, onExit: () => void) {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animId = 0;
  let running = false;

  // State
  let phase: Phase;
  let ball: Ball | null;
  let targets: Target[];
  let particles: Particle[];
  let popups: Popup[];
  let score: number;
  let ballsLeft: number;
  let mx: number, my: number;
  let lastT: number;
  let isMobile: boolean;
  // 모바일: 터치 중일 때만 에임 표시
  let touching = false;

  function init(): void {
    isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;';
    container.innerHTML = '';
    container.appendChild(canvas);
    container.style.display = 'block';
    ctx = canvas.getContext('2d')!;
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMM);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE, { passive: false });
    document.addEventListener('keydown', onKey);
    resetGame();
    running = true;
    lastT = performance.now();
    loop();
  }

  function resize(): void { canvas.width = innerWidth; canvas.height = innerHeight; }

  function resetGame(): void {
    phase = 'aim'; ball = null; score = 0; ballsLeft = MAX_BALLS;
    particles = []; popups = [];
    mx = canvas.width / 2; my = canvas.height * 0.4;
    targets = [];
    const mg = 70, minY = 100, maxY = canvas.height * 0.52;
    for (let i = 0; i < TGT_COUNT; i++) {
      let x = 0, y = 0, ok = false, att = 0;
      while (!ok && att++ < 80) {
        x = mg + Math.random() * (canvas.width - mg * 2);
        y = minY + Math.random() * (maxY - minY);
        ok = targets.every(t => Math.hypot(x - t.x, y - t.y) > TGT_R * 3.5);
      }
      targets.push({ x, y, r: TGT_R, color: TARGET_COLORS[i % TARGET_COLORS.length], alive: true, hitT: 0, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Launcher ──
  function lp() { return { x: canvas.width / 2, y: canvas.height - 55 }; }
  function aimDir() {
    const l = lp(), dx = mx - l.x, dy = my - l.y;
    const len = Math.hypot(dx, dy) || 1;
    const ny = Math.min(dy / len, -0.08);
    const nx = dx / len;
    const nl = Math.hypot(nx, ny);
    return { x: nx / nl, y: ny / nl };
  }

  function fire(): void {
    if (phase !== 'aim' || ballsLeft <= 0) return;
    const l = lp(), d = aimDir();
    ball = { x: l.x, y: l.y, vx: d.x * BALL_SPD, vy: d.y * BALL_SPD, trail: [] };
    ballsLeft--;
    phase = 'fly';
  }

  // ── Update ──
  function update(dt: number): void {
    const now = performance.now() / 1000;
    if (phase === 'fly' && ball) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 18) ball.trail.shift();
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      const W = canvas.width, H = canvas.height;
      if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
      if (ball.y > H + 30) {
        ball = null;
        const alive = targets.some(t => t.alive);
        phase = (ballsLeft > 0 && alive) ? 'aim' : 'result';
        return;
      }
      for (const tg of targets) {
        if (!tg.alive) continue;
        const fy = tg.y + Math.sin(now * 2 + tg.phase) * 6;
        if (Math.hypot(ball.x - tg.x, ball.y - fy) < BALL_R + tg.r) {
          tg.alive = false; tg.hitT = now; score += 100;
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
            particles.push({ x: tg.x, y: fy, vx: Math.cos(a) * (80 + Math.random() * 140), vy: Math.sin(a) * (80 + Math.random() * 140), a: 1, color: tg.color, s: 2 + Math.random() * 4 });
          }
          popups.push({ x: tg.x, y: fy, a: 1, text: '+100' });
          if (!targets.some(t => t.alive)) {
            score += 200;
            popups.push({ x: canvas.width / 2, y: canvas.height / 2, a: 1.5, text: 'PERFECT +200' });
          }
        }
      }
      if (!targets.some(t => t.alive) && !ball) phase = 'result';
    }
    // fly 끝났는데 공이 아직 남아있고 타겟이 없으면 공이 빠질 때 result
    if (phase === 'aim' && !targets.some(t => t.alive)) phase = 'result';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 2.2;
      if (p.a <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]; p.y -= 35 * dt; p.a -= dt * 0.9;
      if (p.a <= 0) popups.splice(i, 1);
    }
  }

  // ── Render ──
  function render(): void {
    const now = performance.now() / 1000;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = rgba(C.accent, 0.03); ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Walls (top, left, right)
    ctx.strokeStyle = rgba(C.accent, 0.12); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.stroke();

    // Bottom line (kill zone indicator)
    ctx.strokeStyle = rgba(C.pink, 0.08); ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(0, H - 10); ctx.lineTo(W, H - 10); ctx.stroke();
    ctx.setLineDash([]);

    // Targets
    for (const tg of targets) {
      if (!tg.alive) {
        const age = now - tg.hitT;
        if (age < 0.35) {
          ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * (1 + age * 5), 0, Math.PI * 2);
          ctx.strokeStyle = rgba(tg.color, 1 - age / 0.35); ctx.lineWidth = 2; ctx.stroke();
        }
        continue;
      }
      const fy = tg.y + Math.sin(now * 2 + tg.phase) * 6;
      // Outer glow
      ctx.beginPath(); ctx.arc(tg.x, fy, tg.r + 8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(tg.color, 0.06); ctx.fill();
      // Body
      ctx.beginPath(); ctx.arc(tg.x, fy, tg.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(tg.color, 0.12); ctx.fill();
      ctx.strokeStyle = rgba(tg.color, 0.7); ctx.lineWidth = 2; ctx.stroke();
      // Inner
      ctx.beginPath(); ctx.arc(tg.x, fy, 5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(tg.color, 0.9); ctx.fill();
    }

    // Aim line
    const showAim = phase === 'aim' && ballsLeft > 0 && (!isMobile || touching);
    if (showAim) {
      const l = lp(), d = aimDir();
      // 첫 번째 벽 충돌 지점 계산
      let hitT = 1200;
      if (d.x < 0) { const t = (BALL_R - l.x) / d.x; if (t > 0 && t < hitT) hitT = t; }
      if (d.x > 0) { const t = (W - BALL_R - l.x) / d.x; if (t > 0 && t < hitT) hitT = t; }
      if (d.y < 0) { const t = (BALL_R - l.y) / d.y; if (t > 0 && t < hitT) hitT = t; }
      const hx = l.x + d.x * hitT, hy = l.y + d.y * hitT;
      // Main aim line
      ctx.setLineDash([4, 6]); ctx.strokeStyle = rgba(C.accent, 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(hx, hy); ctx.stroke();
      // Bounce prediction
      let rx = d.x, ry = d.y;
      if (hx <= BALL_R + 1 || hx >= W - BALL_R - 1) rx = -rx;
      if (hy <= BALL_R + 1) ry = -ry;
      ctx.strokeStyle = rgba(C.accent, 0.12);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + rx * 140, hy + ry * 140); ctx.stroke();
      ctx.setLineDash([]);
      // Launcher body
      ctx.beginPath(); ctx.arc(l.x, l.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#111115'; ctx.fill();
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
      // Arrow
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + d.x * 22, l.y + d.y * 22);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 3; ctx.stroke();
    } else if (phase === 'aim' && ballsLeft > 0) {
      // 모바일: 터치하지 않을 때 발사대만 표시
      const l = lp();
      ctx.beginPath(); ctx.arc(l.x, l.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#111115'; ctx.fill();
      ctx.strokeStyle = rgba(C.accent, 0.4); ctx.lineWidth = 2; ctx.stroke();
    }

    // Ball
    if (ball) {
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i], a = (i / ball.trail.length) * 0.35, s = BALL_R * (i / ball.trail.length);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.accent, a); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.accent, 0.12); ctx.fill();
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = C.accent; ctx.fill();
    }

    // Particles
    for (const p of particles) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.color, Math.min(p.a, 1)); ctx.fill();
    }
    // Popups
    ctx.font = '600 13px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
    for (const p of popups) { ctx.fillStyle = rgba(C.accent, Math.min(p.a, 1)); ctx.fillText(p.text, p.x, p.y); }

    // ── HUD ──
    ctx.textAlign = 'left';
    ctx.font = '600 11px "JetBrains Mono",monospace'; ctx.fillStyle = C.accent;
    ctx.fillText('◆ SPODY', 20, 28);
    ctx.font = '500 10px "JetBrains Mono",monospace'; ctx.fillStyle = '#7a7a8a';
    ctx.fillText(`SCORE  ${score}`, 20, 46);
    // Balls
    ctx.textAlign = 'right'; ctx.fillStyle = '#5a5a66';
    ctx.font = '500 9px "JetBrains Mono",monospace';
    ctx.fillText('BALLS', W - 20, 28);
    for (let i = 0; i < MAX_BALLS; i++) {
      ctx.beginPath(); ctx.arc(W - 24 - i * 16, 42, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < ballsLeft ? C.accent : '#1a1a1f'; ctx.fill();
    }
    // Close ✕
    ctx.font = '400 16px "JetBrains Mono",monospace'; ctx.fillStyle = '#5a5a66'; ctx.textAlign = 'center';
    ctx.fillText('✕', W - 22, 78);

    // Hint
    if (phase === 'aim' && ballsLeft > 0) {
      const l = lp();
      ctx.font = '400 10px "JetBrains Mono",monospace'; ctx.fillStyle = '#2a2a33'; ctx.textAlign = 'center';
      ctx.fillText(isMobile ? 'TAP TO FIRE' : 'CLICK TO FIRE', l.x, l.y + 28);
    }

    // ── Result ──
    if (phase === 'result') {
      ctx.fillStyle = rgba(C.bg, 0.75); ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      ctx.textAlign = 'center';
      ctx.font = '600 13px "JetBrains Mono",monospace'; ctx.fillStyle = C.accent;
      ctx.fillText('GAME OVER', cx, cy - 44);
      ctx.font = '600 32px "JetBrains Mono",monospace'; ctx.fillStyle = '#e8e8ec';
      ctx.fillText(`${score}`, cx, cy + 4);
      ctx.font = '400 10px "JetBrains Mono",monospace'; ctx.fillStyle = '#5a5a66';
      ctx.fillText('POINTS', cx, cy + 22);
      // Retry button
      drawBtn(cx - 112, cy + 50, 100, 34, '다시', true);
      // Exit button
      drawBtn(cx + 12, cy + 50, 100, 34, '나가기', false);
    }
  }

  function drawBtn(x: number, y: number, w: number, h: number, text: string, primary: boolean): void {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6);
    if (primary) { ctx.fillStyle = rgba(C.accent, 0.1); ctx.fill(); ctx.strokeStyle = rgba(C.accent, 0.4); }
    else { ctx.fillStyle = 'transparent'; ctx.strokeStyle = '#333'; }
    ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '500 12px "JetBrains Mono",monospace';
    ctx.fillStyle = primary ? C.accent : '#8a8a9a';
    ctx.textAlign = 'center'; ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  // ── Game loop ──
  function loop(): void {
    if (!running) return;
    const now = performance.now(), dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    update(dt); render();
    animId = requestAnimationFrame(loop);
  }

  // ── Input ──
  function onMM(e: MouseEvent) { mx = e.clientX; my = e.clientY; }

  function onClick(e: MouseEvent) {
    if (hitClose(e.clientX, e.clientY)) { stop(); return; }
    if (phase === 'result') { hitResult(e.clientX, e.clientY); return; }
    if (phase === 'aim') fire();
  }

  function onTS(e: TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0]; mx = t.clientX; my = t.clientY; touching = true;
    if (hitClose(t.clientX, t.clientY)) { stop(); return; }
    if (phase === 'result') { hitResult(t.clientX, t.clientY); return; }
  }
  function onTM(e: TouchEvent) { e.preventDefault(); const t = e.changedTouches[0]; mx = t.clientX; my = t.clientY; }
  function onTE(e: TouchEvent) {
    e.preventDefault(); touching = false;
    if (phase === 'aim') fire();
  }

  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') stop(); }

  function hitClose(cx: number, cy: number): boolean {
    return cx > canvas.width - 40 && cy > 60 && cy < 90;
  }
  function hitResult(cx: number, cy: number): void {
    const mid = canvas.width / 2, my = canvas.height / 2;
    if (cx > mid - 112 && cx < mid - 12 && cy > my + 50 && cy < my + 84) resetGame();
    if (cx > mid + 12 && cx < mid + 112 && cy > my + 50 && cy < my + 84) stop();
  }

  function stop(): void {
    running = false; cancelAnimationFrame(animId);
    canvas.removeEventListener('mousemove', onMM);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('touchstart', onTS);
    canvas.removeEventListener('touchmove', onTM);
    canvas.removeEventListener('touchend', onTE);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    container.style.display = 'none'; container.innerHTML = '';
    onExit();
  }

  return { start: init, stop };
}
