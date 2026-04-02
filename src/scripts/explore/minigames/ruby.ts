// ─── 루비의 모험 v4: 디아블로식 탑다운 ARPG ───
// 빈 땅 클릭 = 이동 · 적 클릭 = 추적→공격 · WASD = 직접 이동

function rgba(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}
const C = { bg: '#0a0a0b', accent: '#6ee7b7', pink: '#ff6b9d', purple: '#a78bfa', yellow: '#fbbf24', red: '#ef4444' };
const MAX_HP = 5, MOVE_SPD = 155, ATK_DUR = 0.2, CD_DUR = 0.12, MELEE_R = 58, COMBO_WIN = 2.0, LUNGE = 18;

const MD: Record<string, { hp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; shoots?: boolean }> = {
    normal: { hp: 1, spd: 48, r: 16, color: C.pink, sym: '●', pts: 50, rng: 32 },
    orc: { hp: 2, spd: 74, r: 20, color: C.yellow, sym: '◆', pts: 100, rng: 38 },
    mage: { hp: 1, spd: 26, r: 16, color: C.purple, sym: '★', pts: 80, rng: 185, shoots: true },
};
const WAVES = [
    [0.6, 'normal', 1.4, 'normal', 1.3, 'normal', 1.4, 'normal', 1.3, 'normal'],
    [0.5, 'normal', 1.0, 'orc', 1.0, 'normal', 0.9, 'normal', 1.0, 'orc', 0.8, 'normal', 1.0, 'orc'],
    [0.4, 'normal', 0.9, 'mage', 0.9, 'orc', 0.8, 'normal', 0.7, 'orc', 0.9, 'mage', 0.7, 'normal', 0.7, 'orc', 0.7, 'normal'],
];

interface Mon { type: string; x: number; y: number; hp: number; maxHp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; alive: boolean; hitT: number; flashT: number; atkCd: number; shootCd: number; shoots: boolean; }
interface Proj { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface Slash { x: number; y: number; dir: number; combo: number; t: number; }
interface Ptc { x: number; y: number; vx: number; vy: number; a: number; color: string; s: number; }
interface Pop { x: number; y: number; a: number; text: string; big: boolean; }
type CState = 'idle' | 'atk' | 'cd';
type Phase = 'intro' | 'play' | 'clear' | 'result' | 'dead';

export function createRubyGame(container: HTMLElement, onExit: () => void) {
    let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, aId = 0, on = false, mob = false;
    // Player
    let px: number, py: number, pDir: number, cState: CState, cTimer: number;
    let moveTo: { x: number; y: number } | null, chaseTarget: Mon | null;
    let hp: number, iFrames: number;
    // Game
    let phase: Phase, wave: number, score: number, kills: number;
    let combo: number, maxCombo: number, lastKillT: number;
    let mons: Mon[], projs: Proj[], slashes: Slash[], pts: Ptc[], pops: Pop[];
    let spawnQ: (string | number)[], spawnI: number, spawnT: number;
    let shX: number, shY: number, phaseT: number, prevT: number;
    let mX = 0, mY = 0;
    let keys: Record<string, boolean> = {};
    // 이동 표시용 click marker
    let clickMark: { x: number; y: number; a: number } | null = null;

    function init() {
        mob = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
        cv = document.createElement('canvas');
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:default;';
        container.innerHTML = ''; container.appendChild(cv); container.style.display = 'block';
        cx = cv.getContext('2d')!;
        rsz(); window.addEventListener('resize', rsz);
        cv.addEventListener('mousemove', onMM);
        cv.addEventListener('click', onCl);
        cv.addEventListener('touchstart', onTS, { passive: false });
        document.addEventListener('keydown', e => { keys[e.code] = true; if (e.key === 'Escape') stop(); });
        document.addEventListener('keyup', e => { keys[e.code] = false; });
        resetAll(); on = true; prevT = performance.now(); loop();
    }
    function rsz() { cv.width = innerWidth; cv.height = innerHeight; }

    function resetAll() {
        px = cv.width / 2; py = cv.height / 2; pDir = 0; cState = 'idle'; cTimer = 0;
        moveTo = null; chaseTarget = null;
        hp = MAX_HP; iFrames = 0; score = 0; kills = 0; combo = 0; maxCombo = 0; lastKillT = -10;
        shX = 0; shY = 0; keys = {}; clickMark = null; wave = 0; startWave();
    }

    function startWave() {
        mons = []; projs = []; slashes = []; pts = []; pops = [];
        spawnQ = [...WAVES[wave]]; spawnI = 0; spawnT = spawnQ[0] as number; spawnI++;
        phase = 'intro'; phaseT = 1.3;
    }

    function spawnMon(type: string) {
        const d = MD[type], W = cv.width, H = cv.height;
        const edge = Math.random() * 4;
        let x: number, y: number;
        if (edge < 1) { x = -25; y = 50 + Math.random() * (H - 100); }
        else if (edge < 2) { x = W + 25; y = 50 + Math.random() * (H - 100); }
        else if (edge < 3) { x = 50 + Math.random() * (W - 100); y = -25; }
        else { x = 50 + Math.random() * (W - 100); y = H + 25; }
        mons.push({ type, x, y, hp: d.hp, maxHp: d.hp, spd: d.spd, r: d.r, color: d.color, sym: d.sym, pts: d.pts, rng: d.rng, alive: true, hitT: 0, flashT: 0, atkCd: 1.5, shootCd: 2.2, shoots: !!d.shoots });
    }

    // ── Input Action ──
    function handleClick(cx: number, cy: number) {
        if (phase !== 'play') return;
        // 적 위에 클릭했나?
        let tgt: Mon | null = null, minD = Infinity;
        for (const m of mons) {
            if (!m.alive) continue;
            const d = Math.hypot(m.x - cx, m.y - cy);
            if (d < m.r + 28 && d < minD) { minD = d; tgt = m; }
        }
        if (tgt) {
            chaseTarget = tgt; moveTo = null;
        } else {
            moveTo = { x: cx, y: cy }; chaseTarget = null;
            clickMark = { x: cx, y: cy, a: 0.6 };
        }
    }

    // ── Execute Attack ──
    function execAtk(m: Mon) {
        const now = performance.now() / 1000;
        const mult = 1 + combo * 0.3;
        const dmg = Math.ceil(mult);
        m.hp -= dmg; m.flashT = 0.12;
        // Lunge
        const a = Math.atan2(m.y - py, m.x - px);
        px += Math.cos(a) * LUNGE; py += Math.sin(a) * LUNGE;
        // Knockback
        m.x += Math.cos(a) * (10 + combo * 3); m.y += Math.sin(a) * (10 + combo * 3);
        pDir = a;
        slashes.push({ x: px, y: py, dir: a, combo, t: 0 });
        shX = (1.5 + combo) * (Math.random() > 0.5 ? 1 : -1); shY = (1 + combo * 0.5) * (Math.random() - 0.5);

        if (m.hp <= 0) {
            m.alive = false; m.hitT = now; kills++;
            combo = (now - lastKillT < COMBO_WIN) ? combo + 1 : 1;
            if (combo > maxCombo) maxCombo = combo;
            lastKillT = now;
            const p = Math.round(m.pts * mult); score += p;
            for (let i = 0; i < 7; i++) { const a2 = (i / 7) * Math.PI * 2 + Math.random() * 0.3; pts.push({ x: m.x, y: m.y, vx: Math.cos(a2) * (60 + Math.random() * 100), vy: Math.sin(a2) * (60 + Math.random() * 100), a: 1, color: m.color, s: 2 + Math.random() * 3 }); }
            pops.push({ x: m.x, y: m.y - 20, a: 1.2, text: `+${p}`, big: false });
            if (combo >= 2) pops.push({ x: m.x, y: m.y - 44, a: 1.4, text: combo >= 5 ? 'FRENZY!' : `×${combo} COMBO`, big: true });
            chaseTarget = null; // 죽으면 추적 해제
        }
        cState = 'atk'; cTimer = ATK_DUR;
    }

    function hurtPlayer() {
        hp--; iFrames = 0.7; combo = 0;
        shX = 6 * (Math.random() > 0.5 ? 1 : -1); shY = 4 * (Math.random() - 0.5);
        if (hp <= 0) phase = 'dead';
    }

    // ── Update ──
    function update(dt: number) {
        const now = performance.now() / 1000;
        // Phase
        if (phase === 'intro' || phase === 'clear') { phaseT -= dt; if (phaseT <= 0) { if (phase === 'intro') phase = 'play'; else { wave++; if (wave >= WAVES.length) phase = 'result'; else startWave(); } } }
        if (phase !== 'play') return;

        if (now - lastKillT > COMBO_WIN) combo = 0;

        // Spawn
        if (spawnI < spawnQ.length) { spawnT -= dt; if (spawnT <= 0) { spawnMon(spawnQ[spawnI] as string); spawnI++; if (spawnI < spawnQ.length) { spawnT = spawnQ[spawnI] as number; spawnI++; } } }

        // Combat state
        if (cState === 'atk') { cTimer -= dt; if (cTimer <= 0) { cState = 'cd'; cTimer = CD_DUR; } }
        else if (cState === 'cd') { cTimer -= dt; if (cTimer <= 0) cState = 'idle'; }

        iFrames = Math.max(0, iFrames - dt);

        // ── Player Movement (공격 중 아닐 때만) ──
        if (cState === 'idle') {
            let mx = 0, my = 0;
            // WASD
            if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
            if (keys['KeyS'] || keys['ArrowDown']) my += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

            if (mx !== 0 || my !== 0) {
                // WASD 이동 — 클릭 이동/추적 해제
                const len = Math.hypot(mx, my);
                px += (mx / len) * MOVE_SPD * dt;
                py += (my / len) * MOVE_SPD * dt;
                pDir = Math.atan2(my, mx);
                moveTo = null; chaseTarget = null;
            } else if (chaseTarget) {
                // 적 추적
                if (!chaseTarget.alive) { chaseTarget = null; }
                else {
                    const dist = Math.hypot(chaseTarget.x - px, chaseTarget.y - py);
                    if (dist <= MELEE_R) {
                        // 사거리 안 — 공격!
                        execAtk(chaseTarget);
                    } else {
                        // 걸어가기
                        const a = Math.atan2(chaseTarget.y - py, chaseTarget.x - px);
                        px += Math.cos(a) * MOVE_SPD * dt;
                        py += Math.sin(a) * MOVE_SPD * dt;
                        pDir = a;
                    }
                }
            } else if (moveTo) {
                // 빈 땅 이동
                const dx = moveTo.x - px, dy = moveTo.y - py, dist = Math.hypot(dx, dy);
                if (dist < 5) { moveTo = null; }
                else {
                    const a = Math.atan2(dy, dx);
                    px += Math.cos(a) * MOVE_SPD * dt;
                    py += Math.sin(a) * MOVE_SPD * dt;
                    pDir = a;
                }
            }
        }
        // Clamp
        const mg = 25; px = Math.max(mg, Math.min(cv.width - mg, px)); py = Math.max(mg, Math.min(cv.height - mg, py));

        // Click marker fade
        if (clickMark) { clickMark.a -= dt * 2; if (clickMark.a <= 0) clickMark = null; }

        // Monsters
        for (const m of mons) {
            if (!m.alive) continue;
            m.flashT = Math.max(0, m.flashT - dt);
            const dx = px - m.x, dy = py - m.y, dist = Math.hypot(dx, dy);
            if (m.shoots) {
                if (dist > m.rng + 15) { m.x += (dx / dist) * m.spd * dt; m.y += (dy / dist) * m.spd * dt; }
                m.shootCd -= dt;
                if (m.shootCd <= 0 && dist < m.rng + 40) {
                    const a = Math.atan2(py - m.y, px - m.x);
                    projs.push({ x: m.x, y: m.y, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, color: m.color, life: 2.0 });
                    m.shootCd = 2.2;
                }
            } else {
                if (dist > m.rng) { m.x += (dx / dist) * m.spd * dt; m.y += (dy / dist) * m.spd * dt; }
                else { m.atkCd -= dt; if (m.atkCd <= 0 && iFrames <= 0) { hurtPlayer(); m.atkCd = 1.4; } }
            }
        }

        // Projectiles
        for (let i = projs.length - 1; i >= 0; i--) {
            const p = projs[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (Math.hypot(p.x - px, p.y - py) < 18 && iFrames <= 0) { hurtPlayer(); projs.splice(i, 1); }
            else if (p.life <= 0 || p.x < -40 || p.x > cv.width + 40 || p.y < -40 || p.y > cv.height + 40) projs.splice(i, 1);
        }

        // Wave clear
        if (spawnI >= spawnQ.length && !mons.some(m => m.alive) && phase === 'play') {
            score += 300; pops.push({ x: cv.width / 2, y: cv.height / 2, a: 1.8, text: `WAVE ${wave + 1} CLEAR +300`, big: true });
            phase = 'clear'; phaseT = 1.5;
        }

        shX *= 0.82; shY *= 0.82;
        for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t > 0.22) slashes.splice(i, 1); }
        for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 2.5; if (p.a <= 0) pts.splice(i, 1); }
        for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= (p.big ? 38 : 24) * dt; p.a -= dt * 0.6; if (p.a <= 0) pops.splice(i, 1); }
    }

    // ── Render ──
    function render() {
        const now = performance.now() / 1000;
        const W = cv.width, H = cv.height;
        const isMoving = moveTo !== null || chaseTarget !== null || Object.values(keys).some(v => v);
        cx.save(); cx.translate(shX, shY);
        cx.fillStyle = C.bg; cx.fillRect(-10, -10, W + 20, H + 20);

        // Grid
        cx.strokeStyle = rgba(C.accent, 0.02); cx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
        for (let y = 0; y < H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
        cx.strokeStyle = rgba(C.accent, 0.05); cx.lineWidth = 1; cx.strokeRect(8, 8, W - 16, H - 16);

        // Click marker
        if (clickMark) {
            cx.beginPath(); cx.arc(clickMark.x, clickMark.y, 8 + (1 - clickMark.a) * 10, 0, Math.PI * 2);
            cx.strokeStyle = rgba(C.accent, clickMark.a * 0.5); cx.lineWidth = 1; cx.stroke();
        }

        // Melee range (faint)
        if (cState === 'idle') {
            cx.beginPath(); cx.arc(px, py, MELEE_R, 0, Math.PI * 2);
            cx.strokeStyle = rgba(C.accent, 0.04); cx.lineWidth = 1; cx.stroke();
        }

        // ── Monsters ──
        for (const m of mons) {
            if (!m.alive) {
                const age = now - m.hitT;
                if (age < 0.3) { cx.beginPath(); cx.arc(m.x, m.y, m.r * (1 + age * 6), 0, Math.PI * 2); cx.strokeStyle = rgba(m.color, 1 - age / 0.3); cx.lineWidth = 2; cx.stroke(); }
                continue;
            }
            const bob = Math.sin(now * 3.5 + m.x * 0.1) * 2;
            const flash = m.flashT > 0;
            // hover highlight
            const hover = !mob && Math.hypot(m.x - mX, m.y - mY) < m.r + 28;
            cx.beginPath(); cx.arc(m.x, m.y + bob, m.r + (hover ? 11 : 7), 0, Math.PI * 2);
            cx.fillStyle = rgba(m.color, hover ? 0.09 : 0.04); cx.fill();
            cx.beginPath(); cx.arc(m.x, m.y + bob, m.r, 0, Math.PI * 2);
            cx.fillStyle = flash ? rgba('#fff', 0.4) : rgba(m.color, 0.14); cx.fill();
            cx.strokeStyle = rgba(m.color, hover ? 0.85 : 0.5); cx.lineWidth = hover ? 2.5 : 2; cx.stroke();
            cx.font = `600 ${Math.round(m.r * 0.8)}px "JetBrains Mono",monospace`;
            cx.fillStyle = rgba(m.color, 0.85); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(m.sym, m.x, m.y + bob + 1);
            if (m.maxHp > 1) { for (let i = 0; i < m.maxHp; i++) { cx.beginPath(); cx.arc(m.x - (m.maxHp - 1) * 4 + i * 8, m.y + bob - m.r - 8, 3, 0, Math.PI * 2); cx.fillStyle = i < m.hp ? m.color : '#222'; cx.fill(); } }
            if (m.shoots && m.shootCd < 0.6) { cx.beginPath(); cx.arc(m.x, m.y + bob, m.r + 4, 0, Math.PI * 2 * (1 - m.shootCd / 0.6)); cx.strokeStyle = rgba(m.color, 0.55); cx.lineWidth = 2; cx.stroke(); }
        }

        // Projectiles
        for (const p of projs) {
            cx.beginPath(); cx.arc(p.x, p.y, 4, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.7); cx.fill();
            cx.beginPath(); cx.arc(p.x, p.y, 9, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.08); cx.fill();
        }

        // Slashes
        for (const sl of slashes) {
            const p = sl.t / 0.22, len = 30 + sl.combo * 10, alpha = (1 - p) * (0.45 + sl.combo * 0.1);
            cx.save(); cx.translate(sl.x, sl.y); cx.rotate(sl.dir);
            const sweep = 1.2 + sl.combo * 0.25;
            cx.beginPath(); cx.arc(0, 0, len, -sweep / 2 + p * sweep, sweep / 2);
            cx.strokeStyle = rgba(sl.combo >= 3 ? C.yellow : C.accent, alpha); cx.lineWidth = 2 + sl.combo; cx.stroke();
            cx.restore();
        }

        // ── Player ──
        const blink = iFrames > 0 && Math.sin(now * 30) > 0;
        if (!blink) {
            // Shadow
            cx.beginPath(); cx.ellipse(px, py + 13, 10, 3.5, 0, 0, Math.PI * 2); cx.fillStyle = rgba(C.accent, 0.05); cx.fill();
            // Body
            cx.beginPath(); cx.arc(px, py, 12, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.accent, 0.13); cx.fill();
            cx.strokeStyle = hp <= 1 ? rgba(C.red, 0.6 + Math.sin(now * 6) * 0.3) : rgba(C.accent, 0.55);
            cx.lineWidth = 2; cx.stroke();
            // Visor (direction indicator)
            cx.beginPath(); cx.arc(px + Math.cos(pDir) * 5, py + Math.sin(pDir) * 5, 3, 0, Math.PI * 2);
            cx.fillStyle = C.accent; cx.fill();
            // Sword during attack
            if (cState === 'atk') {
                const sw = 1 - cTimer / ATK_DUR;
                cx.save(); cx.translate(px, py); cx.rotate(pDir - 0.8 + sw * 1.6);
                cx.fillStyle = rgba(C.accent, 0.7); cx.fillRect(12, -1.5, 18, 3);
                cx.fillStyle = rgba(C.yellow, 0.5); cx.fillRect(10, -3, 4, 6);
                cx.restore();
            }
        }

        // Particles & popups
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
        cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('HP', W - 20, 28);
        for (let i = 0; i < MAX_HP; i++) { cx.font = '12px monospace'; cx.fillStyle = i < hp ? C.pink : '#1a1a1f'; cx.fillText('♥', W - 18 - i * 16, 44); }
        if (combo >= 2) { cx.textAlign = 'center'; cx.font = `700 ${14 + Math.min(combo, 5) * 2}px "JetBrains Mono",monospace`; cx.fillStyle = rgba(C.yellow, 0.5 + Math.sin(now * 5) * 0.15); cx.fillText(`×${combo}`, W / 2, 38); }
        cx.font = '400 16px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.textAlign = 'center'; cx.fillText('✕', W - 22, 78);
        cx.restore();

        // Overlays
        if (phase === 'intro') {
            const p = Math.min(1, (1.3 - phaseT) / 0.4);
            cx.fillStyle = rgba(C.bg, 0.5 * (1 - Math.max(0, (phaseT - 0.3) / 1.0))); cx.fillRect(0, 0, W, H);
            cx.textAlign = 'center'; cx.globalAlpha = p;
            cx.font = '700 26px "JetBrains Mono",monospace'; cx.fillStyle = C.pink; cx.fillText(`WAVE ${wave + 1}`, W / 2, H / 2 - 16);
            cx.font = '400 11px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66';
            cx.fillText(mob ? '빈 곳 탭 = 이동 · 적 탭 = 공격' : 'WASD 이동 · 적 클릭 = 공격', W / 2, H / 2 + 12);
            cx.fillText(`${WAVES[wave].filter((_, i) => i % 2 === 1).length} ENEMIES`, W / 2, H / 2 + 30);
            cx.globalAlpha = 1;
        }
        if (phase === 'result' || phase === 'dead') {
            cx.fillStyle = rgba(C.bg, 0.8); cx.fillRect(0, 0, W, H);
            const bx = W / 2, by = H / 2; cx.textAlign = 'center';
            cx.font = '600 12px "JetBrains Mono",monospace';
            cx.fillStyle = phase === 'result' ? C.accent : C.red;
            cx.fillText(phase === 'result' ? 'COMPLETE' : 'DEFEATED', bx, by - 62);
            cx.font = '700 36px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${score}`, bx, by - 16);
            cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', bx, by + 4);
            cx.fillText(`${kills} KILLS · MAX COMBO ×${maxCombo}`, bx, by + 24);
            drawBtn(bx - 112, by + 48, 100, 34, '다시', true);
            drawBtn(bx + 12, by + 48, 100, 34, '나가기', false);
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
    function onCl(e: MouseEvent) { if (hitXBtn(e.clientX, e.clientY)) { stop(); return; } if (phase === 'result' || phase === 'dead') { hitR(e.clientX, e.clientY); return; } handleClick(e.clientX, e.clientY); }
    function onTS(e: TouchEvent) { e.preventDefault(); const t = e.changedTouches[0]; if (hitXBtn(t.clientX, t.clientY)) { stop(); return; } if (phase === 'result' || phase === 'dead') { hitR(t.clientX, t.clientY); return; } handleClick(t.clientX, t.clientY); }
    function hitXBtn(x: number, y: number) { return x > cv.width - 40 && y > 60 && y < 90; }
    function hitR(x: number, y: number) { const mx = cv.width / 2, my = cv.height / 2; if (x > mx - 112 && x < mx - 12 && y > my + 48 && y < my + 82) resetAll(); if (x > mx + 12 && x < mx + 112 && y > my + 48 && y < my + 82) stop(); }
    function stop() { on = false; cancelAnimationFrame(aId); cv.removeEventListener('mousemove', onMM); cv.removeEventListener('click', onCl); cv.removeEventListener('touchstart', onTS); document.removeEventListener('keydown', () => {}); document.removeEventListener('keyup', () => {}); window.removeEventListener('resize', rsz); container.style.display = 'none'; container.innerHTML = ''; onExit(); }
    return { start: init, stop };
}