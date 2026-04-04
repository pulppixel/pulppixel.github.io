// Nine to Six (Frenzy Circle): Concentric rings shrink to center.
// Each ring rotates at its own speed. Player rotates WITH current ring.
// Jump outward when a safe arc aligns. Land on color, avoid gaps. Survive!
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

// --- Constants ---
const RING_W = 22;
const MIN_R = 22;
const RING_GAP = 36;
const BASE_SHRINK = 14;
const BASE_ROT = 0.8;
const JUMP_DUR = 0.14;
const PLAYER_R = 7;
const COMBO_WIN = 3.0;
const TAU = Math.PI * 2;

const RCOLS = [C.accent, C.cyan, C.blue, C.purple, C.yellow, C.pink];

// --- Ring ---
interface Ring {
    radius: number;
    rotSpd: number;   // per-ring rotation speed (rad/s)
    angle: number;     // per-ring accumulated rotation
    arcs: { s: number; e: number }[];
    color: string;
}

function mkRing(radius: number, safeRatio: number, speedMul: number, idx: number): Ring {
    const nArcs = 2 + Math.floor(Math.random() * 2);
    const totalSafe = TAU * safeRatio;
    const arcLen = totalSafe / nArcs;
    const gap = (TAU - totalSafe) / nArcs;
    const arcs: { s: number; e: number }[] = [];
    const off = Math.random() * TAU;
    for (let j = 0; j < nArcs; j++) {
        const s = off + j * (arcLen + gap);
        arcs.push({ s, e: s + arcLen });
    }
    // Alternate direction, slight speed variation -> looks like gears
    const dir = idx % 2 === 0 ? 1 : -1;
    const spd = BASE_ROT * speedMul * dir * (0.85 + Math.random() * 0.3);
    return {
        radius,
        rotSpd: spd,
        angle: Math.random() * TAU,
        arcs,
        color: RCOLS[idx % RCOLS.length],
    };
}

type Phase = 'intro' | 'play' | 'dead' | 'result';

// --- Game ---
class NineToSixGame extends MinigameBase {
    protected readonly title = 'NINE TO SIX';
    protected readonly titleColor = C.accent;

    private phase: Phase = 'intro';
    private phT = 0;
    private gcx = 0;
    private gcy = 0;

    private shrinkSpd = BASE_SHRINK;
    private spdMul = 1.0;          // global speed multiplier (increases over time)

    // Player: pAngle = LOCAL angle on current ring (relative to ring rotation)
    private pAngle = 0;
    private pRing = 0;
    private jumping = false;
    private jT = 0;
    private jFromR = 0;
    private jToR = 0;
    private jFromAngle = 0;        // absolute angle at jump start

    // Player visual = absolute angle = pAngle + currentRing.angle
    private get vA(): number {
        if (this.pRing < this.rings.length) return this.pAngle + this.rings[this.pRing].angle;
        return this.pAngle;
    }

    private rings: Ring[] = [];
    private maxR = 0;
    private safeRatio = 0.52;
    private ringCounter = 0;       // total rings created (for alternating direction)

    private score = 0;
    private best = 0;
    private jumps = 0;
    private elapsed = 0;
    private alive = true;
    private combo = 0;
    private maxCombo = 0;
    private lastJumpT = -10;
    private shX = 0;
    private shY = 0;

    // --- Lifecycle ---

    protected resetGame(): void {
        this.gcx = this.W / 2;
        this.gcy = this.H / 2;
        this.maxR = Math.min(this.W, this.H) * 0.42;
        this.shrinkSpd = BASE_SHRINK;
        this.spdMul = 1.0;
        this.safeRatio = 0.52;
        this.pRing = 0;
        this.jumping = false;
        this.jT = 0;
        this.score = 0;
        this.jumps = 0;
        this.elapsed = 0;
        this.alive = true;
        this.combo = 0;
        this.maxCombo = 0;
        this.lastJumpT = -10;
        this.shX = 0;
        this.shY = 0;
        this.pts = [];
        this.pops = [];
        this.ringCounter = 0;

        // Build initial rings
        this.rings = [];
        let r = MIN_R + RING_GAP;
        while (r < this.maxR + RING_GAP * 2) {
            this.rings.push(mkRing(r, this.safeRatio, this.spdMul, this.ringCounter++));
            r += RING_GAP;
        }

        // Start player on the MIDDLE of the first ring's first safe arc
        const first = this.rings[0];
        this.pAngle = first.arcs[0].s + (first.arcs[0].e - first.arcs[0].s) / 2;

        this.phase = 'intro';
        this.phT = 1.3;
    }

    protected onResized(): void {
        this.gcx = this.W / 2;
        this.gcy = this.H / 2;
        this.maxR = Math.min(this.W, this.H) * 0.42;
    }

    // --- Safety check ---
    // absAngle = player's absolute angle on screen
    // Converts to ring-local coords by subtracting ring.angle
    private isSafe(ring: Ring, absAngle: number): boolean {
        let rel = ((absAngle - ring.angle) % TAU + TAU * 2) % TAU;
        for (const a of ring.arcs) {
            let s = (a.s % TAU + TAU * 2) % TAU;
            let e = (a.e % TAU + TAU * 2) % TAU;
            if (s <= e) { if (rel >= s && rel <= e) return true; }
            else { if (rel >= s || rel <= e) return true; }
        }
        return false;
    }

    // --- Jump (outward) ---
    private doJump(): void {
        if (this.jumping || !this.alive || this.phase !== 'play') return;
        if (this.pRing + 1 >= this.rings.length) return;
        this.jumping = true;
        this.jT = 0;
        this.jFromR = this.rings[this.pRing].radius;
        this.jToR = this.rings[this.pRing + 1].radius;
        this.jFromAngle = this.vA;  // freeze absolute angle at jump moment
        this.audio?.mgShoot();
    }

    private land(): void {
        const targetIdx = this.pRing + 1;
        this.jumping = false;
        this.jumps++;

        if (targetIdx >= this.rings.length) { this.die('NO RING!'); return; }

        const targetRing = this.rings[targetIdx];
        const landAngle = this.jFromAngle;  // absolute angle preserved during jump

        if (this.isSafe(targetRing, landAngle)) {
            // -- Safe landing --
            this.pRing = targetIdx;
            // Recalculate local angle for the new ring
            this.pAngle = ((landAngle - targetRing.angle) % TAU + TAU * 2) % TAU;

            const now = this.elapsed;
            this.combo = (now - this.lastJumpT < COMBO_WIN) ? this.combo + 1 : 1;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.lastJumpT = now;

            const pts = 10 + Math.floor(this.elapsed * 0.5) + (this.combo >= 2 ? this.combo * 5 : 0);
            this.score += pts;

            const px = this.gcx + Math.cos(landAngle) * targetRing.radius;
            const py = this.gcy + Math.sin(landAngle) * targetRing.radius;
            this.addBurst(px, py, targetRing.color, 6, 70);
            this.addPop(px, py - 22, `+${pts}`);
            this.audio?.mgCoin(this.combo);

            if (this.combo >= 3) {
                this.addPop(px, py - 44, `x${this.combo}`, true, 1.0);
                this.audio?.mgCombo(this.combo);
            }
        } else {
            // -- Landed on gap --
            this.pRing = targetIdx;
            this.pAngle = ((landAngle - targetRing.angle) % TAU + TAU * 2) % TAU;
            this.die('MISS!');
        }
    }

    private die(msg: string): void {
        this.alive = false;
        const absA = this.vA;
        const r = this.pRing < this.rings.length ? this.rings[this.pRing].radius : MIN_R;
        const px = this.gcx + Math.cos(absA) * r;
        const py = this.gcy + Math.sin(absA) * r;
        this.shX = 8 * (Math.random() > 0.5 ? 1 : -1);
        this.shY = 6 * (Math.random() - 0.5);
        this.addBurst(px, py, C.red, 14, 150);
        this.addPop(px, py - 30, msg, true, 1.2);
        if (this.score > this.best) this.best = this.score;
        this.audio?.mgFail();
        this.phase = 'dead';
        this.phT = 1.0;
    }

    // --- Update ---

    protected updateGame(dt: number): void {
        // Rotate each ring individually (always, even during intro/dead)
        const rdt = this.phase === 'dead' ? dt * 0.3 : dt;
        for (const r of this.rings) r.angle += r.rotSpd * rdt;

        if (this.phase === 'intro') {
            for (const r of this.rings) r.radius -= this.shrinkSpd * rdt * 0.3;
            this.phT -= dt;
            if (this.phT <= 0) this.phase = 'play';
            return;
        }

        if (this.phase === 'dead') {
            this.phT -= dt;
            this.shX *= 0.85;
            this.shY *= 0.85;
            this.updatePts(dt, 100);
            this.updatePops(dt);
            if (this.phT <= 0) this.phase = 'result';
            return;
        }

        if (this.phase !== 'play') return;

        this.elapsed += dt;

        // Difficulty scaling
        this.shrinkSpd = BASE_SHRINK + this.elapsed * 0.35;
        this.spdMul = 1.0 + this.elapsed * 0.015;
        this.safeRatio = Math.max(0.30, 0.52 - this.elapsed * 0.003);

        // Shrink all rings toward center
        for (const r of this.rings) r.radius -= this.shrinkSpd * dt;

        // Remove rings that reached center
        while (this.rings.length > 0 && this.rings[0].radius < MIN_R) {
            if (this.pRing === 0) {
                this.die('TOO SLOW!');
                return;
            }
            this.rings.shift();
            this.pRing--;
        }

        // Spawn new rings at outer edge
        while (true) {
            const outerR = this.rings.length > 0
                ? this.rings[this.rings.length - 1].radius
                : MIN_R;
            if (outerR >= this.maxR + RING_GAP) break;
            this.rings.push(mkRing(outerR + RING_GAP, this.safeRatio, this.spdMul, this.ringCounter++));
        }

        // Jump animation
        if (this.jumping) {
            this.jT += dt;
            if (this.jT >= JUMP_DUR) this.land();
        }

        // Input
        if (this.keys['Space']) {
            this.doJump();
            this.keys['Space'] = false;
        }

        // Combo decay
        if (this.elapsed - this.lastJumpT > COMBO_WIN) this.combo = 0;

        this.shX *= 0.85;
        this.shY *= 0.85;
        this.updatePts(dt, 100);
        this.updatePops(dt);
    }

    // --- Render ---

    protected renderGame(now: number): void {
        const { W, H } = this;
        const gx = this.gcx, gy = this.gcy;
        const c = this.cx;

        c.save();
        c.translate(this.shX, this.shY);
        this.drawBg();
        this.drawGrid(0.012);

        // Radial bg glow
        const grad = c.createRadialGradient(gx, gy, MIN_R, gx, gy, this.maxR);
        grad.addColorStop(0, rgba(C.red, 0.03));
        grad.addColorStop(0.3, rgba(C.accent, 0.015));
        grad.addColorStop(1, 'transparent');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);

        // --- Rings (each with own rotation) ---
        c.lineCap = 'butt';
        for (let ri = 0; ri < this.rings.length; ri++) {
            const ring = this.rings[ri];
            if (ring.radius < MIN_R - RING_W || ring.radius > this.maxR + RING_W * 2) continue;

            const isCur = ri === this.pRing;
            const isNext = ri === this.pRing + 1;
            const isPast = ri < this.pRing;

            // Dark background ring
            c.beginPath();
            c.arc(gx, gy, ring.radius, 0, TAU);
            c.strokeStyle = rgba('#1a1a1f', isPast ? 0.12 : 0.45);
            c.lineWidth = RING_W;
            c.stroke();

            // Colored safe arcs (each ring uses its OWN angle)
            for (const arc of ring.arcs) {
                const gs = arc.s + ring.angle;
                const ge = arc.e + ring.angle;
                const alpha = isPast ? 0.08
                    : isCur ? 0.55
                        : isNext ? 0.35 + Math.sin(now * 3) * 0.08
                            : 0.18;

                if (!isPast) {
                    c.beginPath();
                    c.arc(gx, gy, ring.radius, gs, ge);
                    c.strokeStyle = rgba(ring.color, alpha * 0.25);
                    c.lineWidth = RING_W + 8;
                    c.stroke();
                }

                c.beginPath();
                c.arc(gx, gy, ring.radius, gs, ge);
                c.strokeStyle = rgba(ring.color, alpha);
                c.lineWidth = RING_W;
                c.stroke();

                c.beginPath();
                c.arc(gx, gy, ring.radius - RING_W / 2 + 1, gs, ge);
                c.strokeStyle = rgba(ring.color, alpha * 0.35);
                c.lineWidth = 1.5;
                c.stroke();
            }

            // Urgency pulse when current ring nears death
            if (isCur && ring.radius < MIN_R + RING_GAP * 0.6) {
                const urgency = 1 - (ring.radius - MIN_R) / (RING_GAP * 0.6);
                c.beginPath();
                c.arc(gx, gy, ring.radius, 0, TAU);
                c.strokeStyle = rgba(C.red, urgency * 0.3 + Math.sin(now * 8) * urgency * 0.15);
                c.lineWidth = RING_W + 4;
                c.stroke();
            }
        }

        // --- Safety indicator on next ring ---
        if (this.phase === 'play' && !this.jumping && this.pRing + 1 < this.rings.length) {
            const nextRing = this.rings[this.pRing + 1];
            const absA = this.vA;
            const safe = this.isSafe(nextRing, absA);
            const ix = gx + Math.cos(absA) * nextRing.radius;
            const iy = gy + Math.sin(absA) * nextRing.radius;

            c.beginPath();
            c.arc(ix, iy, safe ? 5 : 3, 0, TAU);
            c.fillStyle = safe
                ? rgba(C.accent, 0.5 + Math.sin(now * 6) * 0.2)
                : rgba(C.red, 0.15 + Math.sin(now * 4) * 0.05);
            c.fill();

            // Connecting line
            if (this.pRing < this.rings.length) {
                const curR = this.rings[this.pRing].radius;
                const ppx = gx + Math.cos(absA) * curR;
                const ppy = gy + Math.sin(absA) * curR;
                c.beginPath();
                c.moveTo(ppx, ppy);
                c.lineTo(ix, iy);
                c.strokeStyle = rgba(safe ? C.accent : C.red, safe ? 0.15 : 0.05);
                c.lineWidth = 1;
                c.setLineDash([3, 4]);
                c.stroke();
                c.setLineDash([]);
            }
        }

        // --- Center death zone ---
        c.beginPath();
        c.arc(gx, gy, MIN_R, 0, TAU);
        c.fillStyle = rgba(C.red, 0.04 + Math.sin(now * 2) * 0.02);
        c.fill();
        c.strokeStyle = rgba(C.red, 0.15);
        c.lineWidth = 1.5;
        c.stroke();
        const xSz = 6;
        c.strokeStyle = rgba(C.red, 0.2);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(gx - xSz, gy - xSz);
        c.lineTo(gx + xSz, gy + xSz);
        c.moveTo(gx + xSz, gy - xSz);
        c.lineTo(gx - xSz, gy + xSz);
        c.stroke();

        // --- Player ---
        if (this.alive || this.phase === 'dead') {
            let pr: number;
            let drawAngle: number;

            if (this.jumping) {
                const p = this.jT / JUMP_DUR;
                const eased = 1 - (1 - p) * (1 - p);
                pr = this.jFromR + (this.jToR - this.jFromR) * eased;
                drawAngle = this.jFromAngle;  // frozen during jump
            } else if (this.pRing < this.rings.length) {
                pr = this.rings[this.pRing].radius;
                drawAngle = this.vA;          // rotates with ring
            } else {
                pr = MIN_R;
                drawAngle = this.pAngle;
            }

            const px = gx + Math.cos(drawAngle) * pr;
            const py = gy + Math.sin(drawAngle) * pr;
            const blink = this.phase === 'dead' && Math.sin(now * 20) > 0;

            if (!blink) {
                c.beginPath();
                c.arc(px, py, PLAYER_R + 5, 0, TAU);
                c.fillStyle = rgba(C.accent, 0.08);
                c.fill();

                c.beginPath();
                c.arc(px, py, PLAYER_R, 0, TAU);
                c.fillStyle = rgba(C.accent, 0.25);
                c.fill();
                c.strokeStyle = rgba(C.accent, 0.8);
                c.lineWidth = 2;
                c.stroke();

                // Eyes (look outward)
                c.fillStyle = '#e8e8ec';
                c.beginPath();
                c.arc(px + Math.cos(drawAngle - 0.3) * 3, py + Math.sin(drawAngle - 0.3) * 3, 1.5, 0, TAU);
                c.fill();
                c.beginPath();
                c.arc(px + Math.cos(drawAngle + 0.3) * 3, py + Math.sin(drawAngle + 0.3) * 3, 1.5, 0, TAU);
                c.fill();

                // Direction arrow
                if (this.phase === 'play' && !this.jumping) {
                    const aR = PLAYER_R + 10;
                    const ax = gx + Math.cos(drawAngle) * (pr + aR);
                    const ay = gy + Math.sin(drawAngle) * (pr + aR);
                    c.beginPath();
                    c.moveTo(ax + Math.cos(drawAngle) * 4, ay + Math.sin(drawAngle) * 4);
                    c.lineTo(ax + Math.cos(drawAngle - 0.5) * -3, ay + Math.sin(drawAngle - 0.5) * -3);
                    c.lineTo(ax + Math.cos(drawAngle + 0.5) * -3, ay + Math.sin(drawAngle + 0.5) * -3);
                    c.closePath();
                    c.fillStyle = rgba(C.accent, 0.2 + Math.sin(now * 4) * 0.1);
                    c.fill();
                }
            }
        }

        this.renderPts();
        this.renderPops();
        c.restore();

        // --- HUD ---
        this.drawHudTitle();
        this.drawHudLine(`SCORE  ${this.score}`, 46);
        const ts = `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`;
        this.drawHudLine(`TIME  ${ts}  JUMPS  ${this.jumps}`, 62, '#3a3a44');
        if (this.best > 0) this.drawHudLine(`BEST  ${this.best}`, 78, '#3a3a44');

        // Time-to-death indicator
        if (this.phase === 'play' && this.pRing < this.rings.length) {
            const curR = this.rings[this.pRing].radius;
            const tLeft = Math.max(0, (curR - MIN_R) / this.shrinkSpd);
            const urgent = tLeft < 1.5;
            c.font = `600 ${urgent ? 14 : 12}px "JetBrains Mono"`;
            c.fillStyle = urgent
                ? rgba(C.red, 0.7 + Math.sin(now * 8) * 0.2)
                : rgba(C.accent, 0.4);
            c.textAlign = 'center';
            c.fillText(`${tLeft.toFixed(1)}s`, W / 2, 32);
        }

        this.drawComboHud(this.combo, now, W / 2, H - 50);
        this.drawCloseBtn();

        // Controls hint
        if (this.phase === 'play' && this.elapsed < 5) {
            c.font = '400 9px "JetBrains Mono"';
            c.fillStyle = rgba(C.accent, Math.max(0, 1 - this.elapsed / 5) * 0.5);
            c.textAlign = 'center';
            c.fillText(this.mob ? 'TAP when green dot appears' : 'SPACE / CLICK when green dot appears', W / 2, H - 16);
        }

        if (this.phase === 'intro') {
            this.drawIntro(this.phT, 'NINE TO SIX',
                this.mob ? 'TAP = JUMP OUTWARD' : 'SPACE / CLICK = JUMP',
                'Wait for the green dot, then jump!');
        }
        if (this.phase === 'result') this.renderRes();
    }

    // --- Result ---

    private renderRes(): void {
        const ok = this.jumps >= 10;
        const { bx, by } = this.drawResultBg(ok ? 'GREAT RUN!' : 'GAME OVER', ok ? C.accent : C.red);
        const c = this.cx;
        c.font = '700 32px "JetBrains Mono"';
        c.fillStyle = '#e8e8ec';
        c.textAlign = 'center';
        c.fillText(`${this.score}`, bx, by - 20);
        c.font = '400 10px "JetBrains Mono"';
        c.fillStyle = '#5a5a66';
        c.fillText('POINTS', bx, by);
        const ts = `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`;
        c.fillText(`${ts} survived · ${this.jumps} jumps · x${this.maxCombo} combo`, bx, by + 18);
        if (this.best > 0) { c.fillStyle = C.accent; c.fillText(`BEST: ${this.best}`, bx, by + 36); }
        this.drawResultBtns(bx, by + 56);
    }

    private get resBY(): number { return this.H / 2 + 56; }

    // --- Input ---

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