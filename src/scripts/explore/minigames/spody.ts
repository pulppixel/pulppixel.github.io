// ─── SPODY v2: 돌아다니는 타겟을 공으로 터뜨리기 ───
// 웨이브 3단계 · 콤보 시스템 · 스플래시 범위 판정

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const C = { bg: '#0a0a0b', accent: '#6ee7b7', pink: '#ff6b9d', purple: '#a78bfa', yellow: '#fbbf24', blue: '#38bdf8' };
const TCOL = [C.pink, C.accent, C.purple, C.yellow, C.blue];
const SYMS = [['★', '+', '♥', '◆'], ['▲', '●', '×', '÷', '='], ['π', '∑', '√', '∞', '±', '≡', '∫']];
const WAVES = [
  { n: 4, r: 24, sMin: 70, sMax: 130, splash: 54 },
  { n: 5, r: 19, sMin: 120, sMax: 200, splash: 44 },
  { n: 7, r: 15, sMin: 160, sMax: 280, splash: 36 },
];
const MAX_AMMO = 3, AMMO_CD = 0.85, COMBO_WIN = 1.8;

interface Tgt { x: number; y: number; vx: number; vy: number; r: number; color: string; sym: string; alive: boolean; hitT: number; sq: number; sqA: 'x' | 'y'; }
interface Fly { sx: number; sy: number; ex: number; ey: number; t: number; dur: number; }
interface Spl { x: number; y: number; t: number; r: number; }
interface Ptc { x: number; y: number; vx: number; vy: number; a: number; color: string; s: number; }
interface Pop { x: number; y: number; a: number; text: string; big: boolean; }
type Phase = 'intro' | 'play' | 'clear' | 'result';

export function createSpodyGame(container: HTMLElement, onExit: () => void) {
  let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, aId = 0, on = false, mob = false;
  let phase: Phase, wave: number, tgts: Tgt[], fly: Fly | null, spls: Spl[], pts: Ptc[], pops: Pop[];
  let score: number, hits: number, totalTgt: number;
  let ammo: number, ammoT: number, combo: number, maxCombo: number, lastHit: number, phaseT: number, prevT: number;
  let mX = 0, mY = 0;

  function init(): void {
    mob = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;';
    container.innerHTML = ''; container.appendChild(cv); container.style.display = 'block';
    cx = cv.getContext('2d')!;
    rsz();
    window.addEventListener('resize', rsz);
    cv.addEventListener('mousemove', onMM);
    cv.addEventListener('click', onCl);
    cv.addEventListener('touchstart', onTS, { passive: false });
    document.addEventListener('keydown', onKy);
    resetAll(); on = true; prevT = performance.now(); loop();
  }

  function rsz() { cv.width = innerWidth; cv.height = innerHeight; }

  function resetAll() {
    score = 0; hits = 0; totalTgt = 0; combo = 0; maxCombo = 0; lastHit = -10; wave = 0;
    startWave();
  }

  function startWave() {
    const w = WAVES[wave]; tgts = []; spls = []; pts = []; pops = []; fly = null;
    ammo = MAX_AMMO; ammoT = 0;
    const mg = 65, syms = SYMS[wave];
    for (let i = 0; i < w.n; i++) {
      const x = mg + Math.random() * (cv.width - mg * 2);
      const y = mg + Math.random() * (cv.height * 0.55 - mg);
      const a = Math.random() * Math.PI * 2;
      const sp = w.sMin + Math.random() * (w.sMax - w.sMin);
      tgts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: w.r + (Math.random() - 0.5) * 4, color: TCOL[i % TCOL.length], sym: syms[i % syms.length], alive: true, hitT: 0, sq: 0, sqA: 'x' });
    }
    totalTgt += w.n; phase = 'intro'; phaseT = 1.3;
  }

  function throwBall(tx: number, ty: number) {
    if (phase !== 'play' || ammo <= 0 || fly) return;
    ammo--;
    const sx = cv.width / 2, sy = cv.height - 38;
    fly = { sx, sy, ex: tx, ey: ty, t: 0, dur: Math.max(0.07, Math.min(0.18, Math.hypot(tx - sx, ty - sy) / 3200)) };
  }

  function doSplash(x: number, y: number) {
    const sr = WAVES[wave].splash;
    spls.push({ x, y, t: 0, r: sr });
    let h = 0;
    const now = performance.now() / 1000;
    for (const tg of tgts) {
      if (!tg.alive) continue;
      if (Math.hypot(tg.x - x, tg.y - y) < sr + tg.r * 0.3) {
        tg.alive = false; tg.hitT = now; h++;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
          pts.push({ x: tg.x, y: tg.y, vx: Math.cos(a) * (80 + Math.random() * 140), vy: Math.sin(a) * (80 + Math.random() * 140), a: 1, color: tg.color, s: 2 + Math.random() * 4 });
        }
      }
    }
    if (h === 0) return;
    hits += h;
    combo = (now - lastHit < COMBO_WIN) ? combo + 1 : 1;
    if (combo > maxCombo) maxCombo = combo;
    lastHit = now;
    const cm = Math.min(combo, 8);
    let p = h * 100 * cm; if (h >= 2) p += (h - 1) * 150;
    score += p;
    pops.push({ x, y: y - 12, a: 1.2, text: `+${p}`, big: false });
    if (combo >= 2) pops.push({ x, y: y - 38, a: 1.4, text: `COMBO ×${cm}`, big: true });
    if (h >= 2) pops.push({ x, y: y + 14, a: 1.3, text: h === 2 ? 'DOUBLE!' : h === 3 ? 'TRIPLE!' : `×${h} HIT!`, big: true });
    if (!tgts.some(t => t.alive)) {
      score += 300;
      pops.push({ x: cv.width / 2, y: cv.height / 2, a: 1.8, text: `WAVE ${wave + 1} CLEAR +300`, big: true });
      phase = 'clear'; phaseT = 1.4;
    }
  }

  // ── Update ──
  function update(dt: number) {
    const now = performance.now() / 1000;
    if (phase === 'intro' || phase === 'clear') {
      phaseT -= dt;
      if (phaseT <= 0) {
        if (phase === 'intro') phase = 'play';
        else { wave++; if (wave >= WAVES.length) phase = 'result'; else startWave(); }
      }
    }
    if (phase === 'play' && now - lastHit > COMBO_WIN) combo = 0;
    if (phase === 'play' && ammo < MAX_AMMO) { ammoT += dt; if (ammoT >= AMMO_CD) { ammo++; ammoT = 0; } }

    if (phase === 'play' || phase === 'intro') {
      const W = cv.width, bnd = cv.height * 0.85;
      for (const tg of tgts) {
        if (!tg.alive) continue;
        tg.x += tg.vx * dt; tg.y += tg.vy * dt;
        tg.sq = Math.max(0, tg.sq - dt * 5);
        if (tg.x - tg.r < 0) { tg.x = tg.r; tg.vx = Math.abs(tg.vx); tg.sq = 1; tg.sqA = 'x'; }
        if (tg.x + tg.r > W) { tg.x = W - tg.r; tg.vx = -Math.abs(tg.vx); tg.sq = 1; tg.sqA = 'x'; }
        if (tg.y - tg.r < 0) { tg.y = tg.r; tg.vy = Math.abs(tg.vy); tg.sq = 1; tg.sqA = 'y'; }
        if (tg.y + tg.r > bnd) { tg.y = bnd - tg.r; tg.vy = -Math.abs(tg.vy); tg.sq = 1; tg.sqA = 'y'; }
      }
    }

    if (fly) { fly.t += dt; if (fly.t >= fly.dur) { doSplash(fly.ex, fly.ey); fly = null; } }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.a -= dt * 2.5; if (p.a <= 0) pts.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= (p.big ? 42 : 28) * dt; p.a -= dt * 0.65; if (p.a <= 0) pops.splice(i, 1); }
    for (let i = spls.length - 1; i >= 0; i--) { spls[i].t += dt; if (spls[i].t > 0.4) spls.splice(i, 1); }
  }

  // ── Render ──
  function render() {
    const now = performance.now() / 1000;
    const W = cv.width, H = cv.height;
    cx.fillStyle = C.bg; cx.fillRect(0, 0, W, H);

    // Grid
    cx.strokeStyle = rgba(C.accent, 0.025); cx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
    for (let y = 0; y < H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    cx.strokeStyle = rgba(C.accent, 0.08); cx.lineWidth = 1.5; cx.strokeRect(1, 1, W - 2, H * 0.85);
    cx.setLineDash([5, 7]); cx.strokeStyle = rgba(C.pink, 0.06);
    cx.beginPath(); cx.moveTo(0, H * 0.85); cx.lineTo(W, H * 0.85); cx.stroke(); cx.setLineDash([]);

    // Targets
    for (const tg of tgts) {
      if (!tg.alive) {
        const age = now - tg.hitT;
        if (age < 0.35) {
          cx.beginPath(); cx.arc(tg.x, tg.y, tg.r * (1 + age * 7), 0, Math.PI * 2);
          cx.strokeStyle = rgba(tg.color, 1 - age / 0.35); cx.lineWidth = 2; cx.stroke();
        }
        continue;
      }
      cx.save(); cx.translate(tg.x, tg.y);
      if (tg.sq > 0) { const s = tg.sq * 0.3; if (tg.sqA === 'x') cx.scale(1 - s, 1 + s * 0.5); else cx.scale(1 + s * 0.5, 1 - s); }
      cx.beginPath(); cx.arc(0, 0, tg.r + 9, 0, Math.PI * 2); cx.fillStyle = rgba(tg.color, 0.05); cx.fill();
      cx.beginPath(); cx.arc(0, 0, tg.r, 0, Math.PI * 2); cx.fillStyle = rgba(tg.color, 0.14); cx.fill();
      cx.strokeStyle = rgba(tg.color, 0.55); cx.lineWidth = 2; cx.stroke();
      cx.font = `600 ${Math.round(tg.r * 0.85)}px "JetBrains Mono",monospace`;
      cx.fillStyle = rgba(tg.color, 0.8); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(tg.sym, 0, 1);
      cx.restore();
    }

    // Splashes
    for (const sp of spls) {
      const p = sp.t / 0.4, cr = sp.r * p;
      cx.beginPath(); cx.arc(sp.x, sp.y, cr, 0, Math.PI * 2);
      cx.strokeStyle = rgba(C.accent, 0.45 * (1 - p)); cx.lineWidth = 2.5; cx.stroke();
      cx.beginPath(); cx.arc(sp.x, sp.y, cr, 0, Math.PI * 2);
      cx.fillStyle = rgba(C.accent, 0.07 * (1 - p)); cx.fill();
    }

    // Flying ball
    if (fly) {
      const p = fly.t / fly.dur;
      const bx = fly.sx + (fly.ex - fly.sx) * p, by = fly.sy + (fly.ey - fly.sy) * p;
      for (let i = 1; i <= 5; i++) {
        const tp = Math.max(0, p - i * 0.05);
        const tx = fly.sx + (fly.ex - fly.sx) * tp, ty = fly.sy + (fly.ey - fly.sy) * tp;
        cx.beginPath(); cx.arc(tx, ty, 4 - i * 0.5, 0, Math.PI * 2); cx.fillStyle = rgba(C.accent, 0.25 - i * 0.04); cx.fill();
      }
      cx.beginPath(); cx.arc(bx, by, 6, 0, Math.PI * 2); cx.fillStyle = C.accent; cx.fill();
      cx.beginPath(); cx.arc(bx, by, 11, 0, Math.PI * 2); cx.fillStyle = rgba(C.accent, 0.1); cx.fill();
    }

    // Launcher
    if (phase === 'play') {
      const lx = W / 2, ly = H - 38;
      cx.beginPath(); cx.arc(lx, ly, 7, 0, Math.PI * 2); cx.fillStyle = '#111115'; cx.fill();
      cx.strokeStyle = rgba(C.accent, ammo > 0 ? 0.45 : 0.12); cx.lineWidth = 1.5; cx.stroke();
    }

    // Cursor (desktop)
    if (!mob && phase === 'play') {
      cx.beginPath(); cx.arc(mX, mY, 18, 0, Math.PI * 2);
      cx.strokeStyle = rgba(C.accent, ammo > 0 ? 0.15 : 0.05); cx.lineWidth = 1; cx.stroke();
      cx.beginPath(); cx.moveTo(mX - 6, mY); cx.lineTo(mX + 6, mY);
      cx.moveTo(mX, mY - 6); cx.lineTo(mX, mY + 6);
      cx.strokeStyle = rgba(C.accent, ammo > 0 ? 0.25 : 0.08); cx.lineWidth = 1; cx.stroke();
    }

    // Particles & popups
    for (const p of pts) { cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, Math.min(p.a, 1)); cx.fill(); }
    for (const p of pops) {
      cx.font = p.big ? '700 16px "JetBrains Mono",monospace' : '600 13px "JetBrains Mono",monospace';
      cx.fillStyle = rgba(p.big ? C.yellow : C.accent, Math.min(p.a, 1)); cx.textAlign = 'center'; cx.fillText(p.text, p.x, p.y);
    }

    // HUD
    cx.textAlign = 'left';
    cx.font = '600 11px "JetBrains Mono",monospace'; cx.fillStyle = C.accent; cx.fillText('◆ SPODY', 20, 28);
    cx.font = '500 10px "JetBrains Mono",monospace'; cx.fillStyle = '#7a7a8a'; cx.fillText(`SCORE  ${score}`, 20, 46);
    cx.fillStyle = '#3a3a44'; cx.fillText(`WAVE ${wave + 1}/${WAVES.length}`, 20, 62);
    cx.textAlign = 'right'; cx.fillStyle = '#5a5a66';
    cx.font = '500 9px "JetBrains Mono",monospace'; cx.fillText('AMMO', W - 20, 28);
    for (let i = 0; i < MAX_AMMO; i++) {
      cx.beginPath(); cx.arc(W - 24 - i * 16, 42, 5, 0, Math.PI * 2);
      cx.fillStyle = i < ammo ? C.accent : (i === ammo ? rgba(C.accent, 0.12 + (ammoT / AMMO_CD) * 0.35) : '#1a1a1f'); cx.fill();
    }
    if (combo >= 2 && phase === 'play') {
      cx.textAlign = 'center'; cx.font = `700 ${16 + Math.min(combo, 6) * 2}px "JetBrains Mono",monospace`;
      cx.fillStyle = rgba(C.yellow, 0.6 + Math.sin(now * 6) * 0.15); cx.fillText(`×${Math.min(combo, 8)}`, W / 2, H - 60);
    }
    cx.font = '400 16px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.textAlign = 'center'; cx.fillText('✕', W - 22, 78);
    if (phase === 'play' && ammo > 0 && !fly && tgts.every(t => t.alive) && now - lastHit > 3) {
      cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#2a2a33'; cx.textAlign = 'center';
      cx.fillText(mob ? 'TAP TO THROW' : 'CLICK TO THROW', W / 2, H - 10);
    }

    // Wave intro
    if (phase === 'intro') {
      const p = Math.min(1, (1.3 - phaseT) / 0.4);
      cx.fillStyle = rgba(C.bg, 0.55 * (1 - Math.max(0, (phaseT - 0.3) / 1.0))); cx.fillRect(0, 0, W, H);
      cx.textAlign = 'center'; cx.globalAlpha = p;
      cx.font = '700 26px "JetBrains Mono",monospace'; cx.fillStyle = C.accent; cx.fillText(`WAVE ${wave + 1}`, W / 2, H / 2 - 12);
      cx.font = '400 11px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText(`${WAVES[wave].n} TARGETS`, W / 2, H / 2 + 16);
      cx.globalAlpha = 1;
    }

    // Result
    if (phase === 'result') {
      cx.fillStyle = rgba(C.bg, 0.8); cx.fillRect(0, 0, W, H);
      const mx = W / 2, my = H / 2; cx.textAlign = 'center';
      cx.font = '600 12px "JetBrains Mono",monospace'; cx.fillStyle = C.accent; cx.fillText('COMPLETE', mx, my - 62);
      cx.font = '700 36px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${score}`, mx, my - 16);
      cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', mx, my + 4);
      cx.fillText(`${hits}/${totalTgt} HITS · BEST COMBO ×${maxCombo}`, mx, my + 24);
      drawBtn(mx - 112, my + 48, 100, 34, '다시', true);
      drawBtn(mx + 12, my + 48, 100, 34, '나가기', false);
    }
  }

  function drawBtn(x: number, y: number, w: number, h: number, text: string, pri: boolean) {
    cx.beginPath(); cx.roundRect(x, y, w, h, 6);
    if (pri) { cx.fillStyle = rgba(C.accent, 0.1); cx.fill(); cx.strokeStyle = rgba(C.accent, 0.4); }
    else { cx.fillStyle = 'transparent'; cx.strokeStyle = '#333'; }
    cx.lineWidth = 1; cx.stroke(); cx.font = '500 12px "JetBrains Mono",monospace';
    cx.fillStyle = pri ? C.accent : '#8a8a9a'; cx.textAlign = 'center'; cx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  function loop() { if (!on) return; const n = performance.now(), dt = Math.min((n - prevT) / 1000, 0.05); prevT = n; update(dt); render(); aId = requestAnimationFrame(loop); }

  function onMM(e: MouseEvent) { mX = e.clientX; mY = e.clientY; }
  function onCl(e: MouseEvent) { if (hitX(e.clientX, e.clientY)) { stop(); return; } if (phase === 'result') { hitR(e.clientX, e.clientY); return; } if (phase === 'play') throwBall(e.clientX, e.clientY); }
  function onTS(e: TouchEvent) { e.preventDefault(); const t = e.changedTouches[0]; if (hitX(t.clientX, t.clientY)) { stop(); return; } if (phase === 'result') { hitR(t.clientX, t.clientY); return; } if (phase === 'play') throwBall(t.clientX, t.clientY); }
  function onKy(e: KeyboardEvent) { if (e.key === 'Escape') stop(); }
  function hitX(x: number, y: number) { return x > cv.width - 40 && y > 60 && y < 90; }
  function hitR(x: number, y: number) {
    const mx = cv.width / 2, my = cv.height / 2;
    if (x > mx - 112 && x < mx - 12 && y > my + 48 && y < my + 82) resetAll();
    if (x > mx + 12 && x < mx + 112 && y > my + 48 && y < my + 82) stop();
  }
  function stop() {
    on = false; cancelAnimationFrame(aId);
    cv.removeEventListener('mousemove', onMM); cv.removeEventListener('click', onCl);
    cv.removeEventListener('touchstart', onTS); document.removeEventListener('keydown', onKy);
    window.removeEventListener('resize', rsz);
    container.style.display = 'none'; container.innerHTML = ''; onExit();
  }

  return { start: init, stop };
}
