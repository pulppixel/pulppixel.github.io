// ─── 루비의 모험: 콤보 슬래시 ───
// 사이드뷰 전투. 양쪽에서 접근하는 몬스터를 콤보 타이밍 맞춰 베기

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const C = { bg: '#0a0a0b', accent: '#6ee7b7', pink: '#ff6b9d', purple: '#a78bfa', yellow: '#fbbf24', blue: '#38bdf8', red: '#ef4444' };
const MAX_HP = 5, ATK_DUR = 0.22, WIN_DUR = 0.30, MAX_COMBO = 4;

const MDATA: Record<string, { hp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; shoots?: boolean }> = {
  normal: { hp: 1, spd: 52, r: 15, color: C.pink, sym: '●', pts: 50, rng: 42 },
  orc: { hp: 2, spd: 85, r: 19, color: C.yellow, sym: '◆', pts: 100, rng: 48 },
  mage: { hp: 1, spd: 22, r: 15, color: C.purple, sym: '★', pts: 80, rng: 210, shoots: true },
};

const WAVES = [
  [{ t: 'normal', s: 1, d: 0.6 }, { t: 'normal', s: -1, d: 1.4 }, { t: 'normal', s: 1, d: 1.3 }, { t: 'normal', s: -1, d: 1.4 }, { t: 'normal', s: 1, d: 1.3 }],
  [{ t: 'normal', s: -1, d: 0.5 }, { t: 'orc', s: 1, d: 1.1 }, { t: 'normal', s: -1, d: 1.0 }, { t: 'normal', s: 1, d: 0.9 }, { t: 'orc', s: -1, d: 1.1 }, { t: 'normal', s: 1, d: 0.8 }, { t: 'orc', s: -1, d: 1.0 }],
  [{ t: 'normal', s: -1, d: 0.4 }, { t: 'mage', s: 1, d: 1.0 }, { t: 'orc', s: -1, d: 0.9 }, { t: 'normal', s: 1, d: 0.8 }, { t: 'orc', s: -1, d: 0.8 }, { t: 'mage', s: -1, d: 0.9 }, { t: 'normal', s: 1, d: 0.7 }, { t: 'orc', s: 1, d: 0.8 }, { t: 'normal', s: -1, d: 0.7 }],
];

interface Mon { type: string; x: number; hp: number; maxHp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; alive: boolean; hitT: number; flashT: number; atkCd: number; shootCd: number; side: number; shoots: boolean; }
interface Proj { x: number; y: number; vx: number; color: string; }
interface Slash { x: number; dir: number; combo: number; t: number; }
interface Ptc { x: number; y: number; vx: number; vy: number; a: number; color: string; s: number; }
interface Pop { x: number; y: number; a: number; text: string; big: boolean; }
type Combat = 'idle' | 'atk' | 'win';
type Phase = 'intro' | 'play' | 'clear' | 'result' | 'dead';

export function createRubyGame(container: HTMLElement, onExit: () => void) {
  let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, aId = 0, on = false, mob = false;
  let phase: Phase, wave: number, score: number, kills: number, playerHp: number;
  let playerDir: number, iFrames: number;
  let combat: Combat, combo: number, maxCombo: number, atkT: number, winT: number;
  let mons: Mon[], projs: Proj[], slashes: Slash[], pts: Ptc[], pops: Pop[];
  let spawnQ: typeof WAVES[0], spawnT: number, spawnI: number;
  let shX: number, shY: number, prevT: number;
  let gY: number, pX: number; // ground Y, player X

  function init() {
    mob = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;';
    container.innerHTML = ''; container.appendChild(cv); container.style.display = 'block';
    cx = cv.getContext('2d')!;
    rsz(); window.addEventListener('resize', rsz);
    cv.addEventListener('click', onCl); cv.addEventListener('touchstart', onTS, { passive: false });
    document.addEventListener('keydown', onKy);
    resetAll(); on = true; prevT = performance.now(); loop();
  }

  function rsz() { cv.width = innerWidth; cv.height = innerHeight; gY = cv.height * 0.72; pX = cv.width / 2; }

  function resetAll() {
    score = 0; kills = 0; playerHp = MAX_HP; playerDir = 1; iFrames = 0;
    combat = 'idle'; combo = 0; maxCombo = 0; atkT = 0; winT = 0;
    shX = 0; shY = 0; wave = 0; startWave();
  }

  function startWave() {
    mons = []; projs = []; slashes = []; pts = []; pops = [];
    spawnQ = [...WAVES[wave]]; spawnI = 0; spawnT = spawnQ[0]?.d ?? 0;
    phase = 'intro'; phaseT = 1.3;
  }
  let phaseT = 0;

  function spawnMon(type: string, side: number) {
    const d = MDATA[type];
    mons.push({ type, x: side < 0 ? -30 : cv.width + 30, hp: d.hp, maxHp: d.hp, spd: d.spd, r: d.r, color: d.color, sym: d.sym, pts: d.pts, rng: d.rng, alive: true, hitT: 0, flashT: 0, atkCd: 1.2, shootCd: 1.8, side, shoots: !!d.shoots });
  }

  // ── Attack ──
  function doAttack(clickX: number) {
    if (phase !== 'play') return;
    if (combat === 'atk') return; // too early

    const side = clickX < cv.width / 2 ? -1 : 1;
    playerDir = side;

    if (combat === 'win') { combo = Math.min(combo + 1, MAX_COMBO); }
    else { combo = 0; }

    const mult = 1 + combo * 0.5;
    const dmg = Math.ceil(mult);

    // Find nearest on that side
    let tgt: Mon | null = null, minD = Infinity;
    for (const m of mons) {
      if (!m.alive) continue;
      const ms = m.x < pX ? -1 : 1;
      if (ms !== side) continue;
      const d = Math.abs(m.x - pX);
      if (d < minD && d < 160) { minD = d; tgt = m; }
    }

    const now = performance.now() / 1000;
    if (tgt) {
      tgt.hp -= dmg; tgt.flashT = 0.12;
      tgt.x += side * (8 + combo * 4);
      if (tgt.hp <= 0) {
        tgt.alive = false; tgt.hitT = now; kills++;
        const p = Math.round(tgt.pts * mult); score += p;
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4; pts.push({ x: tgt.x, y: gY - 30, vx: Math.cos(a) * (70 + Math.random() * 100), vy: Math.sin(a) * (70 + Math.random() * 100) - 50, a: 1, color: tgt.color, s: 2 + Math.random() * 3 }); }
        pops.push({ x: tgt.x, y: gY - 55, a: 1.2, text: `+${p}`, big: false });
      }
    }

    slashes.push({ x: pX, dir: side, combo, t: 0 });
    shX = (2 + combo * 1.5) * (Math.random() > 0.5 ? 1 : -1); shY = (1 + combo) * (Math.random() - 0.5);
    if (combo >= 2) pops.push({ x: pX, y: gY - 90, a: 1.3, text: combo >= MAX_COMBO ? 'MAX COMBO!' : `COMBO ×${combo + 1}`, big: true });
    if (combo > maxCombo) maxCombo = combo;

    atkT = ATK_DUR; combat = 'atk';
  }

  // ── Update ──
  function update(dt: number) {
    const now = performance.now() / 1000;

    // Phase
    if (phase === 'intro' || phase === 'clear') {
      phaseT -= dt;
      if (phaseT <= 0) {
        if (phase === 'intro') phase = 'play';
        else { wave++; if (wave >= WAVES.length) phase = 'result'; else startWave(); }
      }
    }
    if (phase !== 'play') return;

    // Spawn
    if (spawnI < spawnQ.length) {
      spawnT -= dt;
      if (spawnT <= 0) { const s = spawnQ[spawnI]; spawnMon(s.t, s.s); spawnI++; if (spawnI < spawnQ.length) spawnT = spawnQ[spawnI].d; }
    }

    // Combat state machine
    if (combat === 'atk') { atkT -= dt; if (atkT <= 0) { combat = 'win'; winT = WIN_DUR; } }
    else if (combat === 'win') { winT -= dt; if (winT <= 0) { combat = 'idle'; combo = 0; } }

    // iFrames
    iFrames = Math.max(0, iFrames - dt);

    // Monsters
    for (const m of mons) {
      if (!m.alive) continue;
      m.flashT = Math.max(0, m.flashT - dt);
      const dx = pX - m.x, dist = Math.abs(dx), dir = Math.sign(dx);
      if (dist > m.rng) { m.x += dir * m.spd * dt; }
      else {
        // Melee attack
        if (!m.shoots) { m.atkCd -= dt; if (m.atkCd <= 0 && iFrames <= 0) { hurtPlayer(); m.atkCd = 1.4; } }
        // Mage shoot
        if (m.shoots) { m.shootCd -= dt; if (m.shootCd <= 0) { projs.push({ x: m.x, y: gY - 28, vx: dir * 220, color: m.color }); m.shootCd = 2.0; } }
      }
    }

    // Projectiles
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]; p.x += p.vx * dt;
      if (Math.abs(p.x - pX) < 18 && iFrames <= 0) { hurtPlayer(); projs.splice(i, 1); }
      else if (p.x < -30 || p.x > cv.width + 30) projs.splice(i, 1);
    }

    // Wave clear check
    if (spawnI >= spawnQ.length && !mons.some(m => m.alive) && phase === 'play') {
      score += 300;
      pops.push({ x: pX, y: cv.height / 2, a: 1.8, text: `WAVE ${wave + 1} CLEAR +300`, big: true });
      phase = 'clear'; phaseT = 1.5;
    }

    // Shake decay
    shX *= 0.85; shY *= 0.85;

    // Slashes
    for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t > 0.25) slashes.splice(i, 1); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.a -= dt * 2.5; if (p.a <= 0) pts.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= (p.big ? 40 : 28) * dt; p.a -= dt * 0.6; if (p.a <= 0) pops.splice(i, 1); }
  }

  function hurtPlayer() {
    playerHp--; iFrames = 0.8; combat = 'idle'; combo = 0;
    shX = 8 * (Math.random() > 0.5 ? 1 : -1); shY = 5 * (Math.random() - 0.5);
    if (playerHp <= 0) { phase = 'dead'; }
  }

  // ── Render ──
  function render() {
    const now = performance.now() / 1000;
    const W = cv.width, H = cv.height;
    cx.save(); cx.translate(shX, shY);
    cx.fillStyle = C.bg; cx.fillRect(-10, -10, W + 20, H + 20);

    // Grid
    cx.strokeStyle = rgba(C.accent, 0.02); cx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
    for (let y = 0; y < H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    // Ground
    cx.strokeStyle = rgba(C.accent, 0.1); cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, gY + 5); cx.lineTo(W, gY + 5); cx.stroke();
    cx.fillStyle = rgba(C.accent, 0.015); cx.fillRect(0, gY + 5, W, H - gY);

    // ── Monsters ──
    for (const m of mons) {
      if (!m.alive) {
        const age = now - m.hitT;
        if (age < 0.3) { cx.beginPath(); cx.arc(m.x, gY - 25, m.r * (1 + age * 6), 0, Math.PI * 2); cx.strokeStyle = rgba(m.color, 1 - age / 0.3); cx.lineWidth = 2; cx.stroke(); }
        continue;
      }
      const my = gY - 25 + Math.sin(now * 4 + m.x * 0.1) * 3;
      const flash = m.flashT > 0;
      cx.beginPath(); cx.arc(m.x, my, m.r + 7, 0, Math.PI * 2); cx.fillStyle = rgba(m.color, 0.05); cx.fill();
      cx.beginPath(); cx.arc(m.x, my, m.r, 0, Math.PI * 2);
      cx.fillStyle = flash ? rgba('#ffffff', 0.5) : rgba(m.color, 0.15); cx.fill();
      cx.strokeStyle = rgba(m.color, 0.6); cx.lineWidth = 2; cx.stroke();
      cx.font = `600 ${Math.round(m.r * 0.8)}px "JetBrains Mono",monospace`;
      cx.fillStyle = rgba(m.color, 0.85); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(m.sym, m.x, my + 1);
      // HP pips for multi-hp
      if (m.maxHp > 1) {
        for (let i = 0; i < m.maxHp; i++) {
          cx.beginPath(); cx.arc(m.x - (m.maxHp - 1) * 4 + i * 8, my - m.r - 8, 3, 0, Math.PI * 2);
          cx.fillStyle = i < m.hp ? m.color : '#222'; cx.fill();
        }
      }
    }

    // ── Projectiles ──
    for (const p of projs) {
      cx.beginPath(); cx.arc(p.x, p.y, 4, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.8); cx.fill();
      cx.beginPath(); cx.arc(p.x, p.y, 8, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.1); cx.fill();
    }

    // ── Slash effects ──
    for (const sl of slashes) {
      const p = sl.t / 0.25;
      const len = 30 + sl.combo * 15;
      const alpha = (1 - p) * (0.5 + sl.combo * 0.12);
      cx.save(); cx.translate(sl.x + sl.dir * 20, gY - 35);
      cx.rotate(sl.dir * (-0.8 + p * 1.6));
      cx.strokeStyle = rgba(sl.combo >= 3 ? C.yellow : C.accent, alpha);
      cx.lineWidth = 2 + sl.combo;
      cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(sl.dir * len, -10); cx.stroke();
      // Arc slash
      cx.beginPath(); cx.arc(0, 0, len * 0.7, sl.dir > 0 ? -0.6 : Math.PI - 0.4, sl.dir > 0 ? 0.6 : Math.PI + 0.4);
      cx.strokeStyle = rgba(sl.combo >= 3 ? C.yellow : C.accent, alpha * 0.5); cx.stroke();
      cx.restore();
    }

    // ── Player ──
    const blink = iFrames > 0 && Math.sin(now * 30) > 0;
    if (!blink) {
      const lunge = combat === 'atk' ? playerDir * 8 : 0;
      const px = pX + lunge;
      // Shadow
      cx.beginPath(); cx.ellipse(pX, gY + 3, 14, 4, 0, 0, Math.PI * 2);
      cx.fillStyle = rgba(C.accent, 0.06); cx.fill();
      // Body
      cx.fillStyle = rgba(C.accent, 0.12); cx.fillRect(px - 9, gY - 48, 18, 42);
      cx.strokeStyle = rgba(C.accent, playerHp <= 1 ? 0.8 : 0.5); cx.lineWidth = 1.5;
      if (playerHp <= 1) cx.strokeStyle = rgba(C.red, 0.6 + Math.sin(now * 6) * 0.3);
      cx.strokeRect(px - 9, gY - 48, 18, 42);
      // Head
      cx.fillStyle = rgba(C.accent, 0.18); cx.fillRect(px - 7, gY - 62, 14, 15);
      cx.strokeStyle = rgba(C.accent, 0.6); cx.lineWidth = 1.5; cx.strokeRect(px - 7, gY - 62, 14, 15);
      // Eyes
      cx.fillStyle = C.accent;
      cx.fillRect(px + playerDir * 1 - 1, gY - 57, 2, 3);
      cx.fillRect(px + playerDir * 1 + 4, gY - 57, 2, 3);
      // Sword
      cx.save(); cx.translate(px + playerDir * 9, gY - 38);
      const sAngle = combat === 'atk' ? playerDir * (-0.6 + (1 - atkT / ATK_DUR) * 2.0) : playerDir * 0.3;
      cx.rotate(sAngle);
      cx.fillStyle = rgba(C.accent, 0.7); cx.fillRect(0, -1.5, 20, 3);
      cx.fillStyle = rgba(C.yellow, 0.5); cx.fillRect(-3, -3, 4, 6); // guard
      cx.restore();
    }

    // ── Combo window indicator ──
    if (combat === 'win') {
      const p = winT / WIN_DUR;
      cx.beginPath(); cx.arc(pX, gY - 30, 28 * p, 0, Math.PI * 2);
      cx.strokeStyle = rgba(C.accent, 0.3 * p); cx.lineWidth = 2; cx.stroke();
    }

    // ── Particles & Popups ──
    for (const p of pts) { cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, Math.min(p.a, 1)); cx.fill(); }
    for (const p of pops) {
      cx.font = p.big ? '700 16px "JetBrains Mono",monospace' : '600 13px "JetBrains Mono",monospace';
      cx.fillStyle = rgba(p.big ? C.yellow : C.accent, Math.min(p.a, 1)); cx.textAlign = 'center'; cx.fillText(p.text, p.x, p.y);
    }

    // ── HUD ──
    cx.textAlign = 'left';
    cx.font = '600 11px "JetBrains Mono",monospace'; cx.fillStyle = C.pink; cx.fillText('◆ 루비의 모험', 20, 28);
    cx.font = '500 10px "JetBrains Mono",monospace'; cx.fillStyle = '#7a7a8a'; cx.fillText(`SCORE  ${score}`, 20, 46);
    cx.fillStyle = '#3a3a44'; cx.fillText(`WAVE ${wave + 1}/${WAVES.length}`, 20, 62);
    // HP hearts
    cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('HP', W - 20, 28);
    for (let i = 0; i < MAX_HP; i++) {
      cx.font = '12px monospace';
      cx.fillStyle = i < playerHp ? C.pink : '#1a1a1f';
      cx.fillText('♥', W - 18 - i * 16, 44);
    }
    // Close
    cx.font = '400 16px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.textAlign = 'center'; cx.fillText('✕', W - 22, 78);
    // Hint
    if (phase === 'play' && combat === 'idle' && mons.filter(m => m.alive).length > 0 && now % 6 > 4.5) {
      cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#2a2a33'; cx.textAlign = 'center';
      cx.fillText(mob ? '← TAP LEFT · TAP RIGHT →' : '← CLICK LEFT · CLICK RIGHT →', W / 2, H - 14);
    }

    cx.restore(); // undo shake

    // ── Overlays (no shake) ──
    if (phase === 'intro') {
      const p = Math.min(1, (1.3 - phaseT) / 0.4);
      cx.fillStyle = rgba(C.bg, 0.5 * (1 - Math.max(0, (phaseT - 0.3) / 1.0))); cx.fillRect(0, 0, W, H);
      cx.textAlign = 'center'; cx.globalAlpha = p;
      cx.font = '700 26px "JetBrains Mono",monospace'; cx.fillStyle = C.pink; cx.fillText(`WAVE ${wave + 1}`, W / 2, H / 2 - 12);
      cx.font = '400 11px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66';
      cx.fillText(`${WAVES[wave].length} ENEMIES`, W / 2, H / 2 + 16);
      cx.globalAlpha = 1;
    }
    if (phase === 'result' || phase === 'dead') {
      cx.fillStyle = rgba(C.bg, 0.8); cx.fillRect(0, 0, W, H);
      const mx = W / 2, my = H / 2; cx.textAlign = 'center';
      cx.font = '600 12px "JetBrains Mono",monospace';
      cx.fillStyle = phase === 'result' ? C.accent : C.red;
      cx.fillText(phase === 'result' ? 'COMPLETE' : 'DEFEATED', mx, my - 62);
      cx.font = '700 36px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${score}`, mx, my - 16);
      cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', mx, my + 4);
      cx.fillText(`${kills} KILLS · MAX COMBO ×${maxCombo + 1}`, mx, my + 24);
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

  // ── Input ──
  function onCl(e: MouseEvent) { if (hitX(e.clientX, e.clientY)) { stop(); return; } if (phase === 'result' || phase === 'dead') { hitR(e.clientX, e.clientY); return; } doAttack(e.clientX); }
  function onTS(e: TouchEvent) { e.preventDefault(); const t = e.changedTouches[0]; if (hitX(t.clientX, t.clientY)) { stop(); return; } if (phase === 'result' || phase === 'dead') { hitR(t.clientX, t.clientY); return; } doAttack(t.clientX); }
  function onKy(e: KeyboardEvent) { if (e.key === 'Escape') stop(); }
  function hitX(x: number, y: number) { return x > cv.width - 40 && y > 60 && y < 90; }
  function hitR(x: number, y: number) {
    const mx = cv.width / 2, my = cv.height / 2;
    if (x > mx - 112 && x < mx - 12 && y > my + 48 && y < my + 82) resetAll();
    if (x > mx + 12 && x < mx + 112 && y > my + 48 && y < my + 82) stop();
  }
  function stop() {
    on = false; cancelAnimationFrame(aId);
    cv.removeEventListener('click', onCl); cv.removeEventListener('touchstart', onTS);
    document.removeEventListener('keydown', onKy); window.removeEventListener('resize', rsz);
    container.style.display = 'none'; container.innerHTML = ''; onExit();
  }
  return { start: init, stop };
}