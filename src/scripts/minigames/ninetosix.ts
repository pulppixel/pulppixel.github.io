// Nine to Six (Frenzy Circle): Concentric ring timing game
// Land on colored arcs, avoid the black gaps. One-button gameplay.
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

const RING_W = 22;
const MIN_R = 28;
const ORBIT_BASE = 2.2;
const JUMP_DUR = 0.18;
const COMBO_WIN = 1.5;
const PLAYER_R = 7;

const STAGES = [
    { rings: 5, safe: 0.55, rotBase: 0.6, rotVar: 0.5, arcsMin: 2, arcsMax: 3 },
    { rings: 6, safe: 0.45, rotBase: 0.8, rotVar: 0.6, arcsMin: 2, arcsMax: 3 },
    { rings: 7, safe: 0.38, rotBase: 1.0, rotVar: 0.8, arcsMin: 2, arcsMax: 4 },
    { rings: 8, safe: 0.30, rotBase: 1.2, rotVar: 1.0, arcsMin: 3, arcsMax: 4 },
];

const RCOLS = [C.accent, C.cyan, C.blue, C.purple, C.yellow, C.pink, C.accent, C.cyan];

interface Ring {
    radius: number;
    rotSpd: number;
    angle: number;
    arcs: { s: number; e: number }[];
    color: string;
}

type Phase = 'intro' | 'play' | 'dead' | 'result';

class NineToSixGame extends MinigameBase {
    protected readonly title = 'NINE TO SIX';
    protected readonly titleColor = C.accent;

    private phase: Phase = 'intro';
    private phT = 0;
    private gcx = 0;
    private gcy = 0;
    private rings: Ring[] = [];
    private rIdx = 0;
    private pA = -Math.PI / 2;
    private oDir = 1;
    private jumping = false;
    private jT = 0;
    private jFromR = 0;
    private jToR = 0;
    private score = 0;
    private best = 0;
    private stage = 0;
    private clears = 0;
    private combo = 0;
    private maxCombo = 0;
    private lastJT = -10;
    private alive = true;
    private elapsed = 0;
    private spdMul = 1;
    private shX = 0;
    private shY = 0;
    private trails: { x: number; y: number; a: number }[] = [];
    private cPulse = 0;

    protected resetGame(): void {
        this.gcx = this.W / 2;
        this.gcy = this.H / 2;
        this.score = 0;
        this.stage = 0;
        this.clears = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.lastJT = -10;
        this.alive = true;
        this.elapsed = 0;
        this.spdMul = 1;
        this.jumping = false;
        this.jT = 0;
        this.rIdx = 0;
        this.pA = -Math.PI / 2;
        this.oDir = 1;
        this.shX = 0;
        this.shY = 0;
        this.trails = [];
        this.cPulse = 0;
        this.pts = [];
        this.pops = [];
        this.mkRings();
        this.phase = 'intro';
        this.phT = 1.3;
    }

    protected onResized(): void {
        this.gcx = this.W / 2;
        this.gcy = this.H / 2;
        if (this.rings.length) this.mkRings();
    }

    private mkRings(): void {
        const s = STAGES[Math.min(this.stage, STAGES.length - 1)];
        const maxR = Math.min(this.W, this.H) * 0.38;
        const gap = (maxR - MIN_R) / s.rings;
        this.rings = [];
        for (let i = 0; i < s.rings; i++) {
            const r = maxR - i * gap;
            if (r < MIN_R) break;
            const nArcs = s.arcsMin + Math.floor(Math.random() * (s.arcsMax - s.arcsMin + 1));
            const totalSafe = Math.PI * 2 * s.safe;
            const arcLen = totalSafe / nArcs;
            const arcGap = (Math.PI * 2 - totalSafe) / nArcs;
            const arcs: { s: number; e: number }[] = [];
            const off = Math.random() * Math.PI * 2;
            for (let j = 0; j < nArcs; j++) {
                const start = off + j * (arcLen + arcGap);
                arcs.push({ s: start, e: start + arcLen });
            }
            const dir = i % 2 === 0 ? 1 : -1;
            this.rings.push({
                radius: r,
                rotSpd: (s.rotBase + Math.random() * s.rotVar) * dir,
                angle: Math.random() * Math.PI * 2,
                arcs,
                color: RCOLS[i % RCOLS.length],
            });
        }
        this.rIdx = 0;
        this.pA = -Math.PI / 2;
        this.oDir = 1;
        this.jumping = false;
    }

    private isSafe(ring: Ring, ga: number): boolean {
        let rel = ((ga - ring.angle) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
        for (const a of ring.arcs) {
            let s = (a.s % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
            let e = (a.e % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
            if (s <= e) { if (rel >= s && rel <= e) return true; }
            else { if (rel >= s || rel <= e) return true; }
        }
        return false;
    }

    private doJump(): void {
        if (this.jumping || !this.alive || this.phase !== 'play') return;
        if (this.rIdx >= this.rings.length - 1) return;
        this.jumping = true;
        this.jT = 0;
        this.jFromR = this.rings[this.rIdx].radius;
        this.jToR = this.rings[this.rIdx + 1].radius;
        this.audio?.mgShoot();
    }

    private land(): void {
        this.rIdx++;
        this.jumping = false;
        const now = this.elapsed;

        // Cleared all rings -> next round
        if (this.rIdx >= this.rings.length) {
            const bonus = 50 + this.stage * 25;
            this.score += bonus;
            this.clears++;
            if (this.clears % 2 === 0) this.stage = Math.min(this.stage + 1, STAGES.length - 1);
            this.spdMul += 0.08;
            this.addPop(this.gcx, this.gcy, `CLEAR! +${bonus}`, true, 1.5);
            this.audio?.mgWaveClear();
            this.cPulse = 1;
            this.mkRings();
            return;
        }

        const ring = this.rings[this.rIdx];
        if (this.isSafe(ring, this.pA)) {
            // Safe landing
            this.oDir = -this.oDir;
            this.combo = (now - this.lastJT < COMBO_WIN) ? this.combo + 1 : 1;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.lastJT = now;
            const pts = 10 * Math.min(this.combo, 8);
            this.score += pts;
            const px = this.gcx + Math.cos(this.pA) * ring.radius;
            const py = this.gcy + Math.sin(this.pA) * ring.radius;
            this.addBurst(px, py, ring.color, 6, 70);
            this.addPop(px, py - 22, `+${pts}`);
            this.audio?.mgCoin(this.combo);
            if (this.combo >= 3) {
                this.addPop(px, py - 44, `x${this.combo}`, true, 1.0);
                this.audio?.mgCombo(this.combo);
            }
        } else {
            // Hit a gap -> die
            this.alive = false;
            const px = this.gcx + Math.cos(this.pA) * ring.radius;
            const py = this.gcy + Math.sin(this.pA) * ring.radius;
            this.shX = 8 * (Math.random() > 0.5 ? 1 : -1);
            this.shY = 6 * (Math.random() - 0.5);
            this.addBurst(px, py, C.red, 14, 150);
            this.addPop(px, py - 30, 'MISS!', true, 1.2);
            if (this.score > this.best) this.best = this.score;
            this.audio?.mgFail();
            this.phase = 'dead';
            this.phT = 1.0;
        }
    }

    protected updateGame(dt: number): void {
        // Rotate rings always (slower during death)
        const rotDt = this.phase === 'dead' ? dt * 0.3 : dt;
        for (const r of this.rings) r.angle += r.rotSpd * this.spdMul * rotDt;

        if (this.phase === 'intro') { this.phT -= dt; if (this.phT <= 0) this.phase = 'play'; return; }
        if (this.phase === 'dead') {
            this.phT -= dt;
            this.shX *= 0.85; this.shY *= 0.85;
            this.updatePts(dt, 100); this.updatePops(dt);
            if (this.phT <= 0) this.phase = 'result';
            return;
        }
        if (this.phase !== 'play') return;

        this.elapsed += dt;
        this.cPulse = Math.max(0, this.cPulse - dt * 2);

        // Player orbit on current ring
        if (!this.jumping && this.rIdx < this.rings.length) {
            const spd = ORBIT_BASE * this.spdMul * (1 + this.rIdx * 0.12);
            this.pA += spd * this.oDir * dt;
            const ring = this.rings[this.rIdx];
            this.trails.push({
                x: this.gcx + Math.cos(this.pA) * ring.radius,
                y: this.gcy + Math.sin(this.pA) * ring.radius,
                a: 0.5,
            });
        }

        // Jump animation
        if (this.jumping) { this.jT += dt; if (this.jT >= JUMP_DUR) this.land(); }

        // Keyboard input
        if (this.keys['Space']) { this.doJump(); this.keys['Space'] = false; }

        // Combo decay
        if (this.elapsed - this.lastJT > COMBO_WIN) this.combo = 0;

        // Trail fade
        let i = this.trails.length;
        while (i-- > 0) {
            this.trails[i].a -= dt * 2;
            if (this.trails[i].a <= 0) { this.trails[i] = this.trails[this.trails.length - 1]; this.trails.pop(); }
        }

        this.shX *= 0.85; this.shY *= 0.85;
        this.updatePts(dt, 100); this.updatePops(dt);
    }

    protected renderGame(now: number): void {
        const { W, H } = this;
        const gx = this.gcx, gy = this.gcy;
        const c = this.cx;

        c.save();
        c.translate(this.shX, this.shY);
        this.drawBg();
        this.drawGrid(0.012);

        // Radial bg glow
        const grad = c.createRadialGradient(gx, gy, 0, gx, gy, Math.min(W, H) * 0.42);
        grad.addColorStop(0, rgba(C.accent, 0.025));
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);

        // --- Rings ---
        c.lineCap = 'butt';
        for (let ri = 0; ri < this.rings.length; ri++) {
            const ring = this.rings[ri];
            const isCur = ri === this.rIdx;
            const isNext = ri === this.rIdx + 1;
            const isPast = ri < this.rIdx;

            // Dark background ring
            c.beginPath();
            c.arc(gx, gy, ring.radius, 0, Math.PI * 2);
            c.strokeStyle = rgba('#1a1a1f', isPast ? 0.15 : 0.45);
            c.lineWidth = RING_W;
            c.stroke();

            // Safe arc segments
            for (const arc of ring.arcs) {
                const gs = arc.s + ring.angle;
                const ge = arc.e + ring.angle;
                const alpha = isPast ? 0.1 : isCur ? 0.55 : isNext ? 0.35 + Math.sin(now * 3) * 0.08 : 0.2;

                // Outer glow
                if (!isPast) {
                    c.beginPath();
                    c.arc(gx, gy, ring.radius, gs, ge);
                    c.strokeStyle = rgba(ring.color, alpha * 0.3);
                    c.lineWidth = RING_W + 8;
                    c.stroke();
                }

                // Main colored arc
                c.beginPath();
                c.arc(gx, gy, ring.radius, gs, ge);
                c.strokeStyle = rgba(ring.color, alpha);
                c.lineWidth = RING_W;
                c.stroke();

                // Inner edge highlight
                c.beginPath();
                c.arc(gx, gy, ring.radius - RING_W / 2 + 1, gs, ge);
                c.strokeStyle = rgba(ring.color, alpha * 0.4);
                c.lineWidth = 1.5;
                c.stroke();
            }
        }

        // Safety indicator dot on next ring (shows if current angle is safe to jump)
        if (this.phase === 'play' && !this.jumping && this.rIdx < this.rings.length - 1) {
            const nextRing = this.rings[this.rIdx + 1];
            const safe = this.isSafe(nextRing, this.pA);
            const ix = gx + Math.cos(this.pA) * nextRing.radius;
            const iy = gy + Math.sin(this.pA) * nextRing.radius;
            if (safe) {
                // Green indicator = safe to jump now
                c.beginPath();
                c.arc(ix, iy, 4, 0, Math.PI * 2);
                c.fillStyle = rgba(C.accent, 0.4 + Math.sin(now * 6) * 0.2);
                c.fill();
            } else {
                // Red indicator = danger
                c.beginPath();
                c.arc(ix, iy, 3, 0, Math.PI * 2);
                c.fillStyle = rgba(C.red, 0.15 + Math.sin(now * 4) * 0.05);
                c.fill();
            }
        }

        // Center zone
        const ca = 0.06 + this.cPulse * 0.25;
        c.beginPath();
        c.arc(gx, gy, MIN_R, 0, Math.PI * 2);
        c.fillStyle = rgba(C.accent, ca * 0.5);
        c.fill();
        c.strokeStyle = rgba(C.accent, ca + 0.1);
        c.lineWidth = 1.5;
        c.stroke();
        c.font = '500 8px "JetBrains Mono"';
        c.fillStyle = rgba(C.accent, 0.35);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('GOAL', gx, gy);

        // Trails
        for (const t of this.trails) {
            c.beginPath();
            c.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
            c.fillStyle = rgba(C.accent, t.a * 0.35);
            c.fill();
        }

        // Player
        if (this.alive || this.phase === 'dead') {
            let pr: number;
            if (this.jumping) {
                const p = this.jT / JUMP_DUR;
                const eased = 1 - (1 - p) * (1 - p); // ease-out quad
                pr = this.jFromR + (this.jToR - this.jFromR) * eased;
            } else if (this.rIdx < this.rings.length) {
                pr = this.rings[this.rIdx].radius;
            } else {
                pr = MIN_R;
            }
            const px = gx + Math.cos(this.pA) * pr;
            const py = gy + Math.sin(this.pA) * pr;
            const blink = this.phase === 'dead' && Math.sin(now * 20) > 0;

            if (!blink) {
                // Glow
                c.beginPath();
                c.arc(px, py, PLAYER_R + 5, 0, Math.PI * 2);
                c.fillStyle = rgba(C.accent, 0.08);
                c.fill();

                // Body
                c.beginPath();
                c.arc(px, py, PLAYER_R, 0, Math.PI * 2);
                c.fillStyle = rgba(C.accent, 0.25);
                c.fill();
                c.strokeStyle = rgba(C.accent, 0.75);
                c.lineWidth = 2;
                c.stroke();

                // Eyes (facing orbit direction)
                const fA = this.pA + this.oDir * 0.5;
                c.fillStyle = '#e8e8ec';
                c.beginPath();
                c.arc(px + Math.cos(fA - 0.3) * 3, py + Math.sin(fA - 0.3) * 3, 1.5, 0, Math.PI * 2);
                c.fill();
                c.beginPath();
                c.arc(px + Math.cos(fA + 0.3) * 3, py + Math.sin(fA + 0.3) * 3, 1.5, 0, Math.PI * 2);
                c.fill();
            }
        }

        this.renderPts();
        this.renderPops();
        c.restore();

        // --- HUD ---
        this.drawHudTitle();
        this.drawHudLine(`SCORE  ${this.score}`, 46);
        this.drawHudLine(`STAGE ${this.stage + 1}  RING ${this.rIdx + 1}/${this.rings.length}`, 62, '#3a3a44');
        if (this.best > 0) this.drawHudLine(`BEST  ${this.best}`, 78, '#3a3a44');
        this.drawComboHud(this.combo, now, W / 2, H - 50);
        this.drawCloseBtn();

        // Controls hint (fades out)
        if (this.phase === 'play' && this.elapsed < 4) {
            c.font = '400 9px "JetBrains Mono"';
            c.fillStyle = rgba(C.accent, Math.max(0, 1 - this.elapsed / 4) * 0.5);
            c.textAlign = 'center';
            c.fillText(this.mob ? 'TAP to jump inward' : 'SPACE / CLICK to jump', W / 2, H - 20);
        }

        // Phase overlays
        if (this.phase === 'intro') {
            this.drawIntro(this.phT, 'NINE TO SIX',
                this.mob ? 'TAP = JUMP' : 'SPACE / CLICK = JUMP',
                'Land on arcs, avoid gaps!');
        }
        if (this.phase === 'result') this.renderRes();
    }

    private renderRes(): void {
        const ok = this.score >= 100;
        const { bx, by } = this.drawResultBg(ok ? 'GREAT RUN!' : 'GAME OVER', ok ? C.accent : C.red);
        const c = this.cx;
        c.font = '700 32px "JetBrains Mono"';
        c.fillStyle = '#e8e8ec';
        c.textAlign = 'center';
        c.fillText(`${this.score}`, bx, by - 20);
        c.font = '400 10px "JetBrains Mono"';
        c.fillStyle = '#5a5a66';
        c.fillText('POINTS', bx, by);
        c.fillText(`STAGE ${this.stage + 1} · CLEARS ${this.clears} · COMBO x${this.maxCombo}`, bx, by + 18);
        if (this.best > 0) { c.fillStyle = C.accent; c.fillText(`BEST: ${this.best}`, bx, by + 36); }
        this.drawResultBtns(bx, by + 56);
    }

    private get resBY(): number { return this.H / 2 + 56; }

    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result') {
            const h = this.hitResultBtn(x, y, this.W / 2, this.resBY);
            if (h === 'retry') this.resetGame();
            if (h === 'exit') this.stop();
            return;
        }
        if (this.phase === 'play') this.doJump();
    }
}

export function createNineToSixGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    const game = new NineToSixGame(container, onExit, audio);
    return { start: () => game.start(), stop: () => game.stop() };
}