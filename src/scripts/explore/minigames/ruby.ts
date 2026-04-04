// 루비의 모험: 디아블로식 탑다운 ARPG (Refactored)
// 클릭 이동/공격, WASD 직접 이동, 콤보 시스템
import { MinigameBase, rgba, C } from './base';

// Constants & Types

const MAX_HP = 5, MOVE_SPD = 155, ATK_DUR = 0.2, CD_DUR = 0.12;
const MELEE_R = 58, COMBO_WIN = 2.0, LUNGE = 18;

const MD: Record<string, { hp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; shoots?: boolean }> = {
    normal: { hp: 1, spd: 48, r: 16, color: C.pink, sym: '●', pts: 50, rng: 32 },
    orc: { hp: 2, spd: 74, r: 20, color: C.yellow, sym: '◆', pts: 100, rng: 38 },
    mage: { hp: 1, spd: 26, r: 16, color: C.purple, sym: '★', pts: 80, rng: 185, shoots: true },
};

const WAVES: (string | number)[][] = [
    [0.6, 'normal', 1.4, 'normal', 1.3, 'normal', 1.4, 'normal', 1.3, 'normal'],
    [0.5, 'normal', 1.0, 'orc', 1.0, 'normal', 0.9, 'normal', 1.0, 'orc', 0.8, 'normal', 1.0, 'orc'],
    [0.4, 'normal', 0.9, 'mage', 0.9, 'orc', 0.8, 'normal', 0.7, 'orc', 0.9, 'mage', 0.7, 'normal', 0.7, 'orc', 0.7, 'normal'],
];

interface Mon { type: string; x: number; y: number; hp: number; maxHp: number; spd: number; r: number; color: string; sym: string; pts: number; rng: number; alive: boolean; hitT: number; flashT: number; atkCd: number; shootCd: number; shoots: boolean; }
interface Proj { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface Slash { x: number; y: number; dir: number; combo: number; t: number; }
type CState = 'idle' | 'atk' | 'cd';
type Phase = 'intro' | 'play' | 'clear' | 'result' | 'dead';

// Game Class

class RubyGame extends MinigameBase {
    protected readonly title = '루비의 모험';
    protected readonly titleColor = C.pink;

    private phase: Phase = 'intro';
    private phaseT = 0;
    private px = 0; private py = 0; private pDir = 0;
    private cState: CState = 'idle'; private cTimer = 0;
    private moveTo: { x: number; y: number } | null = null;
    private chaseTarget: Mon | null = null;
    private hp = MAX_HP; private iFrames = 0;
    private wave = 0; private score = 0; private kills = 0;
    private combo = 0; private maxCombo = 0; private lastKillT = -10;
    private mons: Mon[] = []; private projs: Proj[] = []; private slashes: Slash[] = [];
    private spawnQ: (string | number)[] = []; private spawnI = 0; private spawnT = 0;
    private shX = 0; private shY = 0;
    private mX = 0; private mY = 0;
    private clickMark: { x: number; y: number; a: number } | null = null;

    protected resetGame(): void {
        this.px = this.W / 2; this.py = this.H / 2; this.pDir = 0;
        this.cState = 'idle'; this.cTimer = 0;
        this.moveTo = null; this.chaseTarget = null;
        this.hp = MAX_HP; this.iFrames = 0;
        this.score = 0; this.kills = 0;
        this.combo = 0; this.maxCombo = 0; this.lastKillT = -10;
        this.shX = 0; this.shY = 0; this.clickMark = null;
        this.wave = 0;
        this.startWave();
    }

    private startWave(): void {
        this.mons = []; this.projs = []; this.slashes = [];
        this.pts = []; this.pops = [];
        this.spawnQ = [...WAVES[this.wave]];
        this.spawnI = 0; this.spawnT = this.spawnQ[0] as number; this.spawnI++;
        this.phase = 'intro'; this.phaseT = 1.3;
    }

    private spawnMon(type: string): void {
        const d = MD[type], W = this.W, H = this.H;
        const edge = Math.random() * 4;
        let x: number, y: number;
        if (edge < 1) { x = -25; y = 50 + Math.random() * (H - 100); }
        else if (edge < 2) { x = W + 25; y = 50 + Math.random() * (H - 100); }
        else if (edge < 3) { x = 50 + Math.random() * (W - 100); y = -25; }
        else { x = 50 + Math.random() * (W - 100); y = H + 25; }
        this.mons.push({ type, x, y, hp: d.hp, maxHp: d.hp, spd: d.spd, r: d.r, color: d.color, sym: d.sym, pts: d.pts, rng: d.rng, alive: true, hitT: 0, flashT: 0, atkCd: 1.5, shootCd: 2.2, shoots: !!d.shoots });
    }

    private execAtk(m: Mon): void {
        const now = performance.now() / 1000;
        const mult = 1 + this.combo * 0.3, dmg = Math.ceil(mult);
        m.hp -= dmg; m.flashT = 0.12;
        const a = Math.atan2(m.y - this.py, m.x - this.px);
        this.px += Math.cos(a) * LUNGE; this.py += Math.sin(a) * LUNGE;
        m.x += Math.cos(a) * (10 + this.combo * 3); m.y += Math.sin(a) * (10 + this.combo * 3);
        this.pDir = a;
        this.slashes.push({ x: this.px, y: this.py, dir: a, combo: this.combo, t: 0 });
        this.shX = (1.5 + this.combo) * (Math.random() > 0.5 ? 1 : -1);
        this.shY = (1 + this.combo * 0.5) * (Math.random() - 0.5);

        if (m.hp <= 0) {
            m.alive = false; m.hitT = now; this.kills++;
            this.combo = (now - this.lastKillT < COMBO_WIN) ? this.combo + 1 : 1;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.lastKillT = now;
            const p = Math.round(m.pts * mult); this.score += p;
            this.addBurst(m.x, m.y, m.color);
            this.addPop(m.x, m.y - 20, `+${p}`);
            if (this.combo >= 2) this.addPop(m.x, m.y - 44, this.combo >= 5 ? 'FRENZY!' : `×${this.combo} COMBO`, true, 1.4);
            this.chaseTarget = null;
        }
        this.cState = 'atk'; this.cTimer = ATK_DUR;
    }

    private hurtPlayer(): void {
        this.hp--; this.iFrames = 0.7; this.combo = 0;
        this.shX = 6 * (Math.random() > 0.5 ? 1 : -1); this.shY = 4 * (Math.random() - 0.5);
        if (this.hp <= 0) this.phase = 'dead';
    }

    // --- Update ---
    protected updateGame(dt: number): void {
        const now = performance.now() / 1000;
        if (this.phase === 'intro' || this.phase === 'clear') {
            this.phaseT -= dt;
            if (this.phaseT <= 0) {
                if (this.phase === 'intro') this.phase = 'play';
                else { this.wave++; if (this.wave >= WAVES.length) this.phase = 'result'; else this.startWave(); }
            }
        }
        if (this.phase !== 'play') return;
        if (now - this.lastKillT > COMBO_WIN) this.combo = 0;

        // Spawn
        if (this.spawnI < this.spawnQ.length) {
            this.spawnT -= dt;
            if (this.spawnT <= 0) {
                this.spawnMon(this.spawnQ[this.spawnI] as string); this.spawnI++;
                if (this.spawnI < this.spawnQ.length) { this.spawnT = this.spawnQ[this.spawnI] as number; this.spawnI++; }
            }
        }

        // Combat state machine
        if (this.cState === 'atk') { this.cTimer -= dt; if (this.cTimer <= 0) { this.cState = 'cd'; this.cTimer = CD_DUR; } }
        else if (this.cState === 'cd') { this.cTimer -= dt; if (this.cTimer <= 0) this.cState = 'idle'; }
        this.iFrames = Math.max(0, this.iFrames - dt);

        // Player movement
        if (this.cState === 'idle') {
            let mx = 0, my = 0;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

            if (mx !== 0 || my !== 0) {
                const len = Math.hypot(mx, my);
                this.px += (mx / len) * MOVE_SPD * dt; this.py += (my / len) * MOVE_SPD * dt;
                this.pDir = Math.atan2(my, mx); this.moveTo = null; this.chaseTarget = null;
            } else if (this.chaseTarget) {
                if (!this.chaseTarget.alive) { this.chaseTarget = null; }
                else {
                    const dist = Math.hypot(this.chaseTarget.x - this.px, this.chaseTarget.y - this.py);
                    if (dist <= MELEE_R) this.execAtk(this.chaseTarget);
                    else {
                        const a = Math.atan2(this.chaseTarget.y - this.py, this.chaseTarget.x - this.px);
                        this.px += Math.cos(a) * MOVE_SPD * dt; this.py += Math.sin(a) * MOVE_SPD * dt; this.pDir = a;
                    }
                }
            } else if (this.moveTo) {
                const dx = this.moveTo.x - this.px, dy = this.moveTo.y - this.py;
                if (Math.hypot(dx, dy) < 5) this.moveTo = null;
                else {
                    const a = Math.atan2(dy, dx);
                    this.px += Math.cos(a) * MOVE_SPD * dt; this.py += Math.sin(a) * MOVE_SPD * dt; this.pDir = a;
                }
            }
        }
        this.px = Math.max(25, Math.min(this.W - 25, this.px));
        this.py = Math.max(25, Math.min(this.H - 25, this.py));

        if (this.clickMark) { this.clickMark.a -= dt * 2; if (this.clickMark.a <= 0) this.clickMark = null; }

        // Monsters
        for (const m of this.mons) {
            if (!m.alive) continue;
            m.flashT = Math.max(0, m.flashT - dt);
            const dx = this.px - m.x, dy = this.py - m.y, dist = Math.hypot(dx, dy);
            if (m.shoots) {
                if (dist > m.rng + 15) { m.x += (dx / dist) * m.spd * dt; m.y += (dy / dist) * m.spd * dt; }
                m.shootCd -= dt;
                if (m.shootCd <= 0 && dist < m.rng + 40) {
                    const a = Math.atan2(this.py - m.y, this.px - m.x);
                    this.projs.push({ x: m.x, y: m.y, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, color: m.color, life: 2.0 });
                    m.shootCd = 2.2;
                }
            } else {
                if (dist > m.rng) { m.x += (dx / dist) * m.spd * dt; m.y += (dy / dist) * m.spd * dt; }
                else { m.atkCd -= dt; if (m.atkCd <= 0 && this.iFrames <= 0) { this.hurtPlayer(); m.atkCd = 1.4; } }
            }
        }

        // Projectiles (swap-and-pop)
        let i = this.projs.length;
        while (i-- > 0) {
            const p = this.projs[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (Math.hypot(p.x - this.px, p.y - this.py) < 18 && this.iFrames <= 0) {
                this.hurtPlayer(); this.projs[i] = this.projs[this.projs.length - 1]; this.projs.pop();
            } else if (p.life <= 0 || p.x < -40 || p.x > this.W + 40 || p.y < -40 || p.y > this.H + 40) {
                this.projs[i] = this.projs[this.projs.length - 1]; this.projs.pop();
            }
        }

        // Wave clear
        if (this.spawnI >= this.spawnQ.length && !this.mons.some(m => m.alive) && this.phase === 'play') {
            this.score += 300;
            this.addPop(this.W / 2, this.H / 2, `WAVE ${this.wave + 1} CLEAR +300`, true, 1.8);
            this.phase = 'clear'; this.phaseT = 1.5;
        }

        this.shX *= 0.82; this.shY *= 0.82;
        i = this.slashes.length;
        while (i-- > 0) { this.slashes[i].t += dt; if (this.slashes[i].t > 0.22) { this.slashes[i] = this.slashes[this.slashes.length - 1]; this.slashes.pop(); } }
        this.updatePts(dt);
        this.updatePops(dt);
    }

    // --- Render ---
    protected renderGame(now: number): void {
        const { cx, W, H } = this;

        cx.save(); cx.translate(this.shX, this.shY);
        this.drawBg();
        cx.fillRect(-10, -10, W + 20, H + 20); // shake overflow

        this.drawGrid(0.02);
        cx.strokeStyle = rgba(C.accent, 0.05); cx.lineWidth = 1; cx.strokeRect(8, 8, W - 16, H - 16);

        // Click marker
        if (this.clickMark) {
            cx.beginPath(); cx.arc(this.clickMark.x, this.clickMark.y, 8 + (1 - this.clickMark.a) * 10, 0, Math.PI * 2);
            cx.strokeStyle = rgba(C.accent, this.clickMark.a * 0.5); cx.lineWidth = 1; cx.stroke();
        }

        // Melee range
        if (this.cState === 'idle') {
            cx.beginPath(); cx.arc(this.px, this.py, MELEE_R, 0, Math.PI * 2);
            cx.strokeStyle = rgba(C.accent, 0.04); cx.lineWidth = 1; cx.stroke();
        }

        // Monsters
        for (const m of this.mons) {
            if (!m.alive) {
                const age = now - m.hitT;
                if (age < 0.3) { cx.beginPath(); cx.arc(m.x, m.y, m.r * (1 + age * 6), 0, Math.PI * 2); cx.strokeStyle = rgba(m.color, 1 - age / 0.3); cx.lineWidth = 2; cx.stroke(); }
                continue;
            }
            const bob = Math.sin(now * 3.5 + m.x * 0.1) * 2;
            const hover = !this.mob && Math.hypot(m.x - this.mX, m.y - this.mY) < m.r + 28;
            cx.beginPath(); cx.arc(m.x, m.y + bob, m.r + (hover ? 11 : 7), 0, Math.PI * 2);
            cx.fillStyle = rgba(m.color, hover ? 0.09 : 0.04); cx.fill();
            cx.beginPath(); cx.arc(m.x, m.y + bob, m.r, 0, Math.PI * 2);
            cx.fillStyle = m.flashT > 0 ? rgba('#fff', 0.4) : rgba(m.color, 0.14); cx.fill();
            cx.strokeStyle = rgba(m.color, hover ? 0.85 : 0.5); cx.lineWidth = hover ? 2.5 : 2; cx.stroke();
            cx.font = `600 ${Math.round(m.r * 0.8)}px "JetBrains Mono",monospace`;
            cx.fillStyle = rgba(m.color, 0.85); cx.textAlign = 'center'; cx.textBaseline = 'middle';
            cx.fillText(m.sym, m.x, m.y + bob + 1);
            if (m.maxHp > 1) { for (let i = 0; i < m.maxHp; i++) { cx.beginPath(); cx.arc(m.x - (m.maxHp - 1) * 4 + i * 8, m.y + bob - m.r - 8, 3, 0, Math.PI * 2); cx.fillStyle = i < m.hp ? m.color : '#222'; cx.fill(); } }
            if (m.shoots && m.shootCd < 0.6) { cx.beginPath(); cx.arc(m.x, m.y + bob, m.r + 4, 0, Math.PI * 2 * (1 - m.shootCd / 0.6)); cx.strokeStyle = rgba(m.color, 0.55); cx.lineWidth = 2; cx.stroke(); }
        }

        // Projectiles
        for (const p of this.projs) {
            cx.beginPath(); cx.arc(p.x, p.y, 4, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.7); cx.fill();
            cx.beginPath(); cx.arc(p.x, p.y, 9, 0, Math.PI * 2); cx.fillStyle = rgba(p.color, 0.08); cx.fill();
        }

        // Slashes
        for (const sl of this.slashes) {
            const p = sl.t / 0.22, len = 30 + sl.combo * 10, alpha = (1 - p) * (0.45 + sl.combo * 0.1);
            cx.save(); cx.translate(sl.x, sl.y); cx.rotate(sl.dir);
            const sweep = 1.2 + sl.combo * 0.25;
            cx.beginPath(); cx.arc(0, 0, len, -sweep / 2 + p * sweep, sweep / 2);
            cx.strokeStyle = rgba(sl.combo >= 3 ? C.yellow : C.accent, alpha); cx.lineWidth = 2 + sl.combo; cx.stroke();
            cx.restore();
        }

        // Player
        const blink = this.iFrames > 0 && Math.sin(now * 30) > 0;
        if (!blink) {
            cx.beginPath(); cx.ellipse(this.px, this.py + 13, 10, 3.5, 0, 0, Math.PI * 2); cx.fillStyle = rgba(C.accent, 0.05); cx.fill();
            cx.beginPath(); cx.arc(this.px, this.py, 12, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.accent, 0.13); cx.fill();
            cx.strokeStyle = this.hp <= 1 ? rgba(C.red, 0.6 + Math.sin(now * 6) * 0.3) : rgba(C.accent, 0.55);
            cx.lineWidth = 2; cx.stroke();
            cx.beginPath(); cx.arc(this.px + Math.cos(this.pDir) * 5, this.py + Math.sin(this.pDir) * 5, 3, 0, Math.PI * 2);
            cx.fillStyle = C.accent; cx.fill();
            if (this.cState === 'atk') {
                const sw = 1 - this.cTimer / ATK_DUR;
                cx.save(); cx.translate(this.px, this.py); cx.rotate(this.pDir - 0.8 + sw * 1.6);
                cx.fillStyle = rgba(C.accent, 0.7); cx.fillRect(12, -1.5, 18, 3);
                cx.fillStyle = rgba(C.yellow, 0.5); cx.fillRect(10, -3, 4, 6); cx.restore();
            }
        }

        this.renderPts();
        this.renderPops();

        // HUD
        this.drawHudTitle();
        this.drawHudLine(`SCORE  ${this.score}`, 46);
        this.drawHudLine(`WAVE ${this.wave + 1}/${WAVES.length}`, 62, '#3a3a44');
        cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('HP', W - 20, 28);
        for (let i = 0; i < MAX_HP; i++) { cx.font = '12px monospace'; cx.fillStyle = i < this.hp ? C.pink : '#1a1a1f'; cx.fillText('♥', W - 18 - i * 16, 44); }
        this.drawComboHud(this.combo, now, W / 2, 38);

        cx.restore(); // end screen shake

        this.drawCloseBtn();

        // Phase overlays
        if (this.phase === 'intro') {
            const enemies = WAVES[this.wave].filter((_, i) => i % 2 === 1).length;
            this.drawIntro(this.phaseT, `WAVE ${this.wave + 1}`,
                this.mob ? '빈 곳 탭 = 이동 · 적 탭 = 공격' : 'WASD 이동 · 적 클릭 = 공격',
                `${enemies} ENEMIES`);
        }
        if (this.phase === 'result' || this.phase === 'dead') this.renderResult();
    }

    private renderResult(): void {
        const isWin = this.phase === 'result';
        const { bx, by } = this.drawResultBg(isWin ? 'COMPLETE' : 'DEFEATED', isWin ? C.accent : C.red);
        const { cx } = this;
        cx.font = '700 36px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${this.score}`, bx, by - 16);
        cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', bx, by + 4);
        cx.fillText(`${this.kills} KILLS · MAX COMBO ×${this.maxCombo}`, bx, by + 24);
        this.drawResultBtns(bx, by + 48);
    }

    // --- Input ---
    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result' || this.phase === 'dead') {
            const hit = this.hitResultBtn(x, y, this.W / 2, this.H / 2 + 48);
            if (hit === 'retry') this.resetGame();
            if (hit === 'exit') this.stop();
            return;
        }
        this.handleGameClick(x, y);
    }

    protected onMouseMoveAt(x: number, y: number): void {
        this.mX = x; this.mY = y;
    }

    private handleGameClick(cx: number, cy: number): void {
        if (this.phase !== 'play') return;
        let tgt: Mon | null = null, minD = Infinity;
        for (const m of this.mons) {
            if (!m.alive) continue;
            const d = Math.hypot(m.x - cx, m.y - cy);
            if (d < m.r + 28 && d < minD) { minD = d; tgt = m; }
        }
        if (tgt) { this.chaseTarget = tgt; this.moveTo = null; }
        else { this.moveTo = { x: cx, y: cy }; this.chaseTarget = null; this.clickMark = { x: cx, y: cy, a: 0.6 }; }
    }
}

// Factory
export function createRubyGame(container: HTMLElement, onExit: () => void) {
    const game = new RubyGame(container, onExit);
    return { start: () => game.start(), stop: () => game.stop() };
}