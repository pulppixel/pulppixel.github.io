// Math Master: 미로 탈출 (Refactored)
// Recursive Backtracker + A*, 3 Stages, Fog of War
import { MinigameBase, rgba, C, type Popup } from './base';
import type { GameAudio } from '../system/audio';

// Constants & Types

const WL = 1, WR = 2, WU = 4, WD = 8, WV = 128;
const MOVE_SPD = 200;
const MOVE_SPD_MOBILE = 120;
const STAGES = [
    { w: 7, h: 7, fog: 0, time: 60 },
    { w: 11, h: 11, fog: 6, time: 90 },
    { w: 15, h: 15, fog: 4, time: 120 },
];
const GOAL_HOLD = 0.7;

interface Gem { x: number; y: number; collected: boolean; }
interface DPart { x: number; y: number; vx: number; vy: number; a: number; sz: number; }
interface HintTrail { x: number; y: number; a: number; }
interface Trail { x: number; y: number; a: number; }

type Phase = 'intro' | 'play' | 'clear' | 'result';

// Maze Generation (MazeGenerator.cs 포팅)

function generateMaze(w: number, h: number): number[][] {
    const maze: number[][] = [];
    for (let x = 0; x < w; x++) { maze[x] = []; for (let y = 0; y < h; y++) maze[x][y] = WL | WR | WU | WD; }
    const stack: { x: number; y: number }[] = [];
    const sx = Math.floor(Math.random() * w), sy = Math.floor(Math.random() * h);
    maze[sx][sy] |= WV; stack.push({ x: sx, y: sy });
    while (stack.length > 0) {
        const cur = stack.pop()!;
        const nb: { x: number; y: number; wall: number }[] = [];
        if (cur.x > 0 && !(maze[cur.x - 1][cur.y] & WV)) nb.push({ x: cur.x - 1, y: cur.y, wall: WL });
        if (cur.x < w - 1 && !(maze[cur.x + 1][cur.y] & WV)) nb.push({ x: cur.x + 1, y: cur.y, wall: WR });
        if (cur.y > 0 && !(maze[cur.x][cur.y - 1] & WV)) nb.push({ x: cur.x, y: cur.y - 1, wall: WU });
        if (cur.y < h - 1 && !(maze[cur.x][cur.y + 1] & WV)) nb.push({ x: cur.x, y: cur.y + 1, wall: WD });
        if (nb.length === 0) continue;
        stack.push(cur);
        const pick = nb[Math.floor(Math.random() * nb.length)];
        maze[cur.x][cur.y] &= ~pick.wall;
        const opp = pick.wall === WL ? WR : pick.wall === WR ? WL : pick.wall === WU ? WD : WU;
        maze[pick.x][pick.y] &= ~opp;
        maze[pick.x][pick.y] |= WV;
        stack.push({ x: pick.x, y: pick.y });
    }
    return maze;
}

// A* Pathfinder (MazePathFinder.cs 포팅)

function astar(maze: number[][], w: number, h: number, sx: number, sy: number, ex: number, ey: number): { x: number; y: number }[] {
    const key = (x: number, y: number) => x * h + y;
    const open: { x: number; y: number; f: number; g: number }[] = [{ x: sx, y: sy, f: 0, g: 0 }];
    const closed = new Set<number>();
    const parent = new Map<number, number>();
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift()!;
        if (cur.x === ex && cur.y === ey) {
            const path: { x: number; y: number }[] = [];
            let k = key(cur.x, cur.y);
            while (k !== key(sx, sy)) { path.push({ x: Math.floor(k / h), y: k % h }); k = parent.get(k)!; }
            path.push({ x: sx, y: sy }); path.reverse(); return path;
        }
        closed.add(key(cur.x, cur.y));
        const dirs: [number, number][] = [];
        if (!(maze[cur.x][cur.y] & WL) && cur.x > 0) dirs.push([cur.x - 1, cur.y]);
        if (!(maze[cur.x][cur.y] & WR) && cur.x < w - 1) dirs.push([cur.x + 1, cur.y]);
        if (!(maze[cur.x][cur.y] & WU) && cur.y > 0) dirs.push([cur.x, cur.y - 1]);
        if (!(maze[cur.x][cur.y] & WD) && cur.y < h - 1) dirs.push([cur.x, cur.y + 1]);
        for (const [nx, ny] of dirs) {
            const nk = key(nx, ny);
            if (closed.has(nk)) continue;
            const g = cur.g + 1, hh = Math.abs(nx - ex) + Math.abs(ny - ey), f = g + hh;
            const ex2 = open.find(o => o.x === nx && o.y === ny);
            if (!ex2) { open.push({ x: nx, y: ny, f, g }); parent.set(nk, key(cur.x, cur.y)); }
            else if (g < ex2.g) { ex2.g = g; ex2.f = f; parent.set(nk, key(cur.x, cur.y)); }
        }
    }
    return [];
}

function findDeadEnds(maze: number[][], w: number, h: number): { x: number; y: number }[] {
    const ends: { x: number; y: number }[] = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        if ((x === 0 && y === 0) || (x === w - 1 && y === h - 1)) continue;
        let wc = 0;
        if (maze[x][y] & WL) wc++; if (maze[x][y] & WR) wc++;
        if (maze[x][y] & WU) wc++; if (maze[x][y] & WD) wc++;
        if (wc >= 3) ends.push({ x, y });
    }
    return ends;
}

// Game Class

class MazeGame extends MinigameBase {
    protected readonly title = 'MAZE ESCAPE';
    protected readonly titleColor = C.purple;

    private phase: Phase = 'intro';
    private phaseT = 0;
    private stage = 0;
    private maze!: number[][];
    private mW = 0; private mH = 0;
    private cs = 0; private ox = 0; private oy = 0;
    private px = 0; private py = 0;
    private goalX = 0; private goalY = 0;
    private timer = 0;
    private timeLeft = 0;
    private stageTimes: number[] = [];
    private totalGems: number[] = [];
    private gems: Gem[] = [];
    private explored = new Set<string>();
    private trails: Trail[] = [];
    private hintPath: { x: number; y: number }[] | null = null;
    private hintProg = 0;
    private hintTrails: HintTrail[] = [];
    private dissolve: DPart[] = [];
    private lbStarted = false;
    private goalCharge = 0;

    protected resetGame(): void {
        this.setupMobileControls({ joystick: true });
        this.lbStarted = false;
        this.lbStatus = 'idle';
        this.lbScores = [];
        this.lbNewId = null;
        this.stage = 0;
        this.stageTimes = [];
        this.totalGems = [];
        this.startStage();
    }

    protected isInteractive(): boolean { return this.phase === 'play'; }

    protected onResized(): void {
        if (this.maze) this.calcLayout();
    }

    private startStage(): void {
        const s = STAGES[this.stage];
        this.mW = s.w; this.mH = s.h;
        this.maze = generateMaze(this.mW, this.mH);
        this.calcLayout();
        this.px = this.ox + this.cs * 0.5;
        this.py = this.oy + this.cs * 0.5;
        this.goalX = this.mW - 1; this.goalY = this.mH - 1;
        this.timer = 0;
        this.timeLeft = s.time;
        this.goalCharge = 0;
        this.hintPath = null; this.hintProg = 0;
        this.trails = []; this.hintTrails = []; this.dissolve = [];
        this.explored = new Set(['0,0']);
        const ends = findDeadEnds(this.maze, this.mW, this.mH);
        const count = Math.min(ends.length, this.stage === 0 ? 3 : this.stage === 1 ? 4 : 5);
        this.gems = ends.sort(() => Math.random() - 0.5).slice(0, count).map(e => ({ ...e, collected: false }));
        this.phase = 'intro'; this.phaseT = 1.2;
    }

    private calcLayout(): void {
        const pad = 80;
        this.cs = Math.floor(Math.min((this.W - pad * 2) / this.mW, (this.H - pad * 2) / this.mH));
        this.ox = Math.floor((this.W - this.mW * this.cs) / 2);
        this.oy = Math.floor((this.H - this.mH * this.cs) / 2);
    }

    private gridOf(px: number, py: number) {
        return { x: Math.floor((px - this.ox) / this.cs), y: Math.floor((py - this.oy) / this.cs) };
    }

    // --- Movement ---
    private tryMove(dx: number, dy: number, dt: number, speed = MOVE_SPD): void {
        const spd = speed * dt, pad = 4;
        let nx = this.px + dx * spd, ny = this.py + dy * spd;
        const { ox, oy, cs, mW, mH, maze } = this;
        if (dx !== 0) {
            const g = this.gridOf(this.px, this.py);
            const ng = this.gridOf(nx, this.py);
            if (g.x !== ng.x && g.x >= 0 && g.x < mW && g.y >= 0 && g.y < mH) {
                if (dx > 0 && (maze[g.x][g.y] & WR)) nx = ox + (g.x + 1) * cs - pad;
                if (dx < 0 && (maze[g.x][g.y] & WL)) nx = ox + g.x * cs + pad;
            }
        }
        if (dy !== 0) {
            const g = this.gridOf(nx, this.py);
            const ng = this.gridOf(nx, ny);
            if (g.y !== ng.y && g.x >= 0 && g.x < mW && g.y >= 0 && g.y < mH) {
                if (dy > 0 && (maze[g.x][g.y] & WD)) ny = oy + (g.y + 1) * cs - pad;
                if (dy < 0 && (maze[g.x][g.y] & WU)) ny = oy + g.y * cs + pad;
            }
        }
        nx = Math.max(ox + pad, Math.min(ox + mW * cs - pad, nx));
        ny = Math.max(oy + pad, Math.min(oy + mH * cs - pad, ny));
        if (nx !== this.px || ny !== this.py) this.trails.push({ x: this.px, y: this.py, a: 0.5 });
        this.px = nx; this.py = ny;
    }

    private showHint(): void {
        const g = this.gridOf(this.px, this.py);
        if (g.x < 0 || g.x >= this.mW || g.y < 0 || g.y >= this.mH) return;
        this.hintPath = astar(this.maze, this.mW, this.mH, g.x, g.y, this.goalX, this.goalY);
        this.hintProg = 0; this.hintTrails = [];
        this.audio?.mgPickup(); // 🔊 힌트 활성화
    }

    private spawnDissolve(): void {
        this.dissolve = [];
        const { ox, oy, cs, mW, mH, maze } = this;
        for (let x = 0; x < mW; x++) for (let y = 0; y < mH; y++) {
            const sx = ox + x * cs, sy = oy + y * cs, w = maze[x][y];
            const segs: [number, number, number, number][] = [];
            if (w & WU) segs.push([sx, sy, sx + cs, sy]);
            if (w & WD) segs.push([sx, sy + cs, sx + cs, sy + cs]);
            if (w & WL) segs.push([sx, sy, sx, sy + cs]);
            if (w & WR) segs.push([sx + cs, sy, sx + cs, sy + cs]);
            for (const [x1, y1, x2, y2] of segs) {
                for (let i = 0; i < 2; i++) {
                    const t = (i + 0.5) / 2, ppx = x1 + (x2 - x1) * t, ppy = y1 + (y2 - y1) * t;
                    const ang = Math.random() * Math.PI * 2, spd = 30 + Math.random() * 60;
                    this.dissolve.push({ x: ppx, y: ppy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, a: 0.6 + Math.random() * 0.3, sz: 1.5 + Math.random() * 2 });
                }
            }
        }
    }

    // --- Update ---
    protected updateGame(dt: number): void {
        // Dissolve particles
        let i = this.dissolve.length;
        while (i-- > 0) {
            const p = this.dissolve[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 0.7;
            if (p.a <= 0) { this.dissolve[i] = this.dissolve[this.dissolve.length - 1]; this.dissolve.pop(); }
        }

        if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'play'; return; }
        if (this.phase === 'clear') {
            this.phaseT -= dt;
            if (this.phaseT <= 0) {
                this.totalGems.push(this.gems.filter(g => g.collected).length);
                this.stage++;
                if (this.stage >= STAGES.length) { this.phase = 'result'; this.tryStartLb(); }
                else this.startStage();
            }
            return;
        }
        if (this.phase !== 'play') return;

        this.timer += dt;
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.stageTimes.push(this.timer);
            this.totalGems.push(this.gems.filter(g => g.collected).length);
            this.spawnDissolve();
            this.audio?.mgFail();
            this.stage++;
            if (this.stage >= STAGES.length) { this.phase = 'result'; this.tryStartLb(); }
            else this.startStage();
            return;
        }

        // Movement
        let mx = 0, my = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        if (mx === 0 && my === 0 && (this.mJoy.x || this.mJoy.y)) {
            mx = this.mJoy.x > 0.3 ? 1 : this.mJoy.x < -0.3 ? -1 : 0;
            my = this.mJoy.y > 0.3 ? 1 : this.mJoy.y < -0.3 ? -1 : 0;
        }
        if (mx !== 0 || my !== 0) this.tryMove(mx, my, dt, this.mob ? MOVE_SPD_MOBILE : MOVE_SPD);

        const pg = this.gridOf(this.px, this.py);
        if (pg.x >= 0 && pg.x < this.mW && pg.y >= 0 && pg.y < this.mH) this.explored.add(`${pg.x},${pg.y}`);

        // Gem collection
        for (const gem of this.gems) {
            if (!gem.collected && pg.x === gem.x && pg.y === gem.y) {
                gem.collected = true;
                this.audio?.mgCoin(); // 🔊 젬 획득
            }
        }

        // Hint scout
        if (this.hintPath && this.hintProg < this.hintPath.length - 1) {
            const prev = this.hintProg;
            this.hintProg = Math.min(this.hintProg + dt * 10, this.hintPath.length - 1);
            const step = 0.15;
            let t = Math.ceil(prev / step) * step;
            while (t <= this.hintProg) {
                const idx = Math.min(Math.floor(t), this.hintPath.length - 2), frac = t - idx;
                const a = this.hintPath[idx], b = this.hintPath[idx + 1];
                this.hintTrails.push({
                    x: this.ox + (a.x + (b.x - a.x) * frac) * this.cs + this.cs / 2,
                    y: this.oy + (a.y + (b.y - a.y) * frac) * this.cs + this.cs / 2, a: 0.7
                });
                t += step;
            }
        }
        i = this.hintTrails.length;
        while (i-- > 0) { this.hintTrails[i].a -= dt * 0.55; if (this.hintTrails[i].a <= 0) { this.hintTrails[i] = this.hintTrails[this.hintTrails.length - 1]; this.hintTrails.pop(); } }
        if (this.hintPath && this.hintProg >= this.hintPath.length - 1 && this.hintTrails.length === 0) this.hintPath = null;

        // Trail fade
        i = this.trails.length;
        while (i-- > 0) { this.trails[i].a -= dt * 0.4; if (this.trails[i].a <= 0) { this.trails[i] = this.trails[this.trails.length - 1]; this.trails.pop(); } }

        // Goal check (hold to clear)
        if (pg.x === this.goalX && pg.y === this.goalY) {
            this.goalCharge += dt;
            if (this.goalCharge >= GOAL_HOLD) {
                this.stageTimes.push(this.timer);
                this.spawnDissolve();
                this.audio?.mgWaveClear();
                this.phase = 'clear'; this.phaseT = 1.8;
            }
        } else {
            this.goalCharge = 0;
        }
    }

    // --- Render ---
    protected renderGame(now: number): void {
        this.drawBg();
        this.drawGrid();

        const { cx, W, H, ox, oy, cs, mW, mH, maze } = this;
        const fog = STAGES[Math.min(this.stage, STAGES.length - 1)].fog;
        const pg = this.gridOf(this.px, this.py);
        const mazeAlpha = this.phase === 'clear' ? Math.max(0, (this.phaseT - 0.6) / 1.2) : 1;

        // Maze cells + walls
        if (mazeAlpha > 0) {
            for (let x = 0; x < mW; x++) for (let y = 0; y < mH; y++) {
                let vis = 1;
                if (fog > 0 && this.phase === 'play') {
                    const dist = Math.abs(x - pg.x) + Math.abs(y - pg.y);
                    vis = dist <= fog ? 1 : dist <= fog + 2 ? Math.max(0, 1 - (dist - fog) / 2) : 0;
                }
                if (vis <= 0) continue;
                vis *= mazeAlpha;
                const sx = ox + x * cs, sy = oy + y * cs;
                cx.fillStyle = rgba(C.accent, 0.02 * vis);
                cx.fillRect(sx + 1, sy + 1, cs - 2, cs - 2);
                cx.strokeStyle = rgba(C.accent, 0.4 * vis); cx.lineWidth = 2;
                const w = maze[x][y];
                if (w & WU) { cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(sx + cs, sy); cx.stroke(); }
                if (w & WD) { cx.beginPath(); cx.moveTo(sx, sy + cs); cx.lineTo(sx + cs, sy + cs); cx.stroke(); }
                if (w & WL) { cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(sx, sy + cs); cx.stroke(); }
                if (w & WR) { cx.beginPath(); cx.moveTo(sx + cs, sy); cx.lineTo(sx + cs, sy + cs); cx.stroke(); }
            }
        }

        // Gems
        for (const gem of this.gems) {
            if (gem.collected) continue;
            let vis = 1;
            if (fog > 0 && this.phase === 'play') {
                const dist = Math.abs(gem.x - pg.x) + Math.abs(gem.y - pg.y);
                vis = dist <= fog ? 1 : dist <= fog + 2 ? Math.max(0, 1 - (dist - fog) / 2) : 0;
            }
            if (vis <= 0) continue;
            vis *= mazeAlpha;
            const gx = ox + gem.x * cs + cs / 2, gy = oy + gem.y * cs + cs / 2;
            const bob = Math.sin(now * 3 + gem.x * 2 + gem.y) * 2;
            cx.beginPath(); cx.arc(gx, gy + bob, cs * 0.22, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.cyan, 0.1 * vis); cx.fill();
            const s = cs * 0.14;
            cx.beginPath(); cx.moveTo(gx, gy + bob - s); cx.lineTo(gx + s * 0.7, gy + bob); cx.lineTo(gx, gy + bob + s); cx.lineTo(gx - s * 0.7, gy + bob); cx.closePath();
            cx.fillStyle = rgba(C.cyan, 0.7 * vis); cx.fill();
        }

        // Goal
        const gsx = ox + this.goalX * cs + cs / 2, gsy = oy + this.goalY * cs + cs / 2;
        if (fog > 0 && this.phase === 'play') {
            const ba = 0.08 + Math.sin(now * 2) * 0.04;
            cx.beginPath(); cx.arc(gsx, gsy, cs * (1.5 + Math.sin(now * 1.5) * 0.5), 0, Math.PI * 2);
            cx.fillStyle = rgba(C.yellow, ba * mazeAlpha); cx.fill();
        }
        let gVis = 1;
        if (fog > 0 && this.phase === 'play') {
            const gd = Math.abs(this.goalX - pg.x) + Math.abs(this.goalY - pg.y);
            gVis = gd <= fog ? 1 : gd <= fog + 2 ? Math.max(0, 1 - (gd - fog) / 2) : 0.12;
        }
        gVis *= mazeAlpha;
        cx.beginPath(); cx.arc(gsx, gsy, cs * 0.3, 0, Math.PI * 2);
        cx.fillStyle = rgba(C.yellow, 0.15 * gVis); cx.fill();
        cx.font = `${Math.round(cs * 0.35)}px "JetBrains Mono",monospace`;
        cx.fillStyle = rgba(C.yellow, 0.8 * gVis); cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('★', gsx, gsy + 1);

        // Goal hold charge ring
        if (this.goalCharge > 0 && this.phase === 'play') {
            const p = Math.min(1, this.goalCharge / GOAL_HOLD);
            cx.beginPath();
            cx.arc(gsx, gsy, cs * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
            cx.strokeStyle = rgba(C.yellow, 0.85);
            cx.lineWidth = 3;
            cx.stroke();
        }

        // Hint trails + scout
        for (const t of this.hintTrails) {
            cx.beginPath(); cx.arc(t.x, t.y, cs * 0.08 * (t.a / 0.7), 0, Math.PI * 2);
            cx.fillStyle = rgba(C.accent, t.a * 0.5); cx.fill();
        }
        if (this.hintPath && this.hintProg < this.hintPath.length - 1) {
            const idx = Math.min(Math.floor(this.hintProg), this.hintPath.length - 2), frac = this.hintProg - idx;
            const a = this.hintPath[idx], b = this.hintPath[idx + 1];
            const hx = ox + (a.x + (b.x - a.x) * frac) * cs + cs / 2;
            const hy = oy + (a.y + (b.y - a.y) * frac) * cs + cs / 2;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            cx.save(); cx.translate(hx, hy); cx.rotate(angle);
            const as = cs * 0.18;
            cx.beginPath(); cx.moveTo(as, 0); cx.lineTo(-as * 0.4, -as * 0.6); cx.lineTo(-as * 0.15, 0); cx.lineTo(-as * 0.4, as * 0.6); cx.closePath();
            cx.fillStyle = rgba(C.accent, 0.85); cx.fill(); cx.restore();
        }

        // Breadcrumb trail
        for (const t of this.trails) {
            cx.beginPath(); cx.arc(t.x, t.y, 2, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.accent, t.a * 0.25); cx.fill();
        }

        // Player
        cx.beginPath(); cx.arc(this.px, this.py, cs * 0.2, 0, Math.PI * 2);
        cx.fillStyle = C.accent; cx.fill();
        cx.beginPath(); cx.arc(this.px, this.py, cs * 0.2 + 4, 0, Math.PI * 2);
        cx.strokeStyle = rgba(C.accent, 0.2 + Math.sin(now * 4) * 0.1); cx.lineWidth = 1.5; cx.stroke();

        // Start marker
        cx.font = `${Math.round(cs * 0.25)}px "JetBrains Mono",monospace`;
        cx.fillStyle = rgba(C.accent, 0.3); cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('S', ox + cs / 2, oy + cs / 2);

        // Dissolve particles
        for (const p of this.dissolve) {
            cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.accent, Math.max(0, p.a) * 0.6); cx.fill();
        }

        // Mini-map (fog stage only)
        if (fog > 0 && this.phase === 'play') this.renderMinimap();

        // HUD
        this.drawHudTitle();
        const mm = Math.floor(this.timer / 60), ss = Math.floor(this.timer % 60), ms = Math.floor((this.timer % 1) * 10);
        this.drawHudLine(`TIME  ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${ms}`, 46);
        const gc = this.gems.filter(g => g.collected).length;
        cx.fillStyle = C.cyan; cx.fillText(`◇ ${gc}/${this.gems.length}`, 130, 46);
        this.drawHudLine(`STAGE ${this.stage + 1}/${STAGES.length}${fog > 0 ? ' · FOG' : ''}`, 62, '#3a3a44');

        // Time-left countdown (center top)
        const tFlash = this.timeLeft < 10 && Math.sin(now * 8) > 0;
        const tCol = this.timeLeft > 30 ? C.accent : this.timeLeft > 10 ? C.yellow : C.red;
        cx.font = '600 18px "JetBrains Mono",monospace';
        cx.fillStyle = tFlash ? rgba(C.red, 0.9) : rgba(tCol, 0.75);
        cx.textAlign = 'center';
        cx.fillText(`${Math.ceil(this.timeLeft)}s`, W / 2, 32);

        // Hint button
        const hbx = W - 90, hby = 55;
        cx.beginPath(); cx.roundRect(hbx, hby, 70, 28, 5);
        cx.strokeStyle = rgba(C.accent, 0.3); cx.lineWidth = 1; cx.stroke();
        cx.fillStyle = rgba(C.accent, 0.05); cx.fill();
        cx.font = '500 10px "JetBrains Mono",monospace'; cx.fillStyle = rgba(C.accent, 0.6);
        cx.textAlign = 'center'; cx.fillText('HINT (A*)', hbx + 35, hby + 17);

        this.drawCloseBtn();

        // Phase overlays
        if (this.phase === 'intro') {
            this.drawIntro(this.phaseT, `STAGE ${this.stage + 1}`,
                `${mW}×${mH} · ${STAGES[this.stage].time}s${fog > 0 ? ' · FOG' : ''}`,
                '★ 위에서 잠시 멈춰야 클리어');
        }
        if (this.phase === 'clear') this.renderClearOverlay();
        if (this.phase === 'result') this.renderResult();
    }

    private renderMinimap(): void {
        const { cx, W, H, mW, mH } = this;
        const mmSz = 75, mmX = W - mmSz - 18, mmY = H - mmSz - 18;
        const mmCs = mmSz / Math.max(mW, mH);
        const mmOx = mmX + (mmSz - mW * mmCs) / 2, mmOy = mmY + (mmSz - mH * mmCs) / 2;
        const pg = this.gridOf(this.px, this.py);

        // Background
        cx.fillStyle = rgba(C.bg, 0.85);
        cx.beginPath(); cx.roundRect(mmX - 5, mmY - 5, mmSz + 10, mmSz + 10, 4); cx.fill();
        cx.strokeStyle = rgba(C.accent, 0.15); cx.lineWidth = 1; cx.stroke();

        // Explored cells
        for (const k of this.explored) {
            const [ex, ey] = k.split(',').map(Number);
            cx.fillStyle = rgba(C.accent, 0.2);
            cx.fillRect(mmOx + ex * mmCs + 0.5, mmOy + ey * mmCs + 0.5, mmCs - 1, mmCs - 1);
        }

        // Goal
        cx.fillStyle = rgba(C.yellow, 0.5);
        cx.fillRect(mmOx + this.goalX * mmCs, mmOy + this.goalY * mmCs, mmCs, mmCs);

        // Gems (uncollected only) - cyan dots
        for (const gem of this.gems) {
            if (gem.collected) continue;
            const gxc = mmOx + gem.x * mmCs + mmCs / 2;
            const gyc = mmOy + gem.y * mmCs + mmCs / 2;
            cx.beginPath();
            cx.arc(gxc, gyc, Math.max(1.2, mmCs * 0.3), 0, Math.PI * 2);
            cx.fillStyle = rgba(C.cyan, 0.85);
            cx.fill();
        }

        // Player (drawn last so it's on top)
        cx.fillStyle = C.accent;
        cx.fillRect(mmOx + pg.x * mmCs, mmOy + pg.y * mmCs, mmCs, mmCs);
    }

    private renderClearOverlay(): void {
        const fade = Math.min(1, (1.8 - this.phaseT) / 0.5);
        this.cx.fillStyle = rgba(C.bg, 0.5 * fade); this.cx.fillRect(0, 0, this.W, this.H);
        this.cx.textAlign = 'center'; this.cx.globalAlpha = fade;
        this.cx.font = '700 22px "JetBrains Mono",monospace'; this.cx.fillStyle = C.accent;
        this.cx.fillText('CLEAR!', this.W / 2, this.H / 2 - 16);
        const st = this.stageTimes[this.stageTimes.length - 1];
        this.cx.font = '400 12px "JetBrains Mono",monospace'; this.cx.fillStyle = '#8a8a9a';
        this.cx.fillText(this.fmtTime(st), this.W / 2, this.H / 2 + 12);
        if (this.gems.length > 0) {
            this.cx.fillStyle = C.cyan;
            this.cx.fillText(`◇ ${this.gems.filter(g => g.collected).length}/${this.gems.length} collected`, this.W / 2, this.H / 2 + 32);
        }
        this.cx.globalAlpha = 1;
    }

    private tryStartLb(): void {
        if (this.lbStarted) return;
        this.lbStarted = true;
        const totalTime = this.stageTimes.reduce((a, b) => a + b, 0);
        const totalGems = this.totalGems.reduce((a, b) => a + b, 0);
        const score = totalGems * 1000 - Math.round(totalTime * 10);
        this.startLeaderboard('maze', score, {
            gems: totalGems,
            time: totalTime,
        }).then(_ => {});
    }

    private renderResult(): void {
        const { bx, by } = this.drawResultBg('ALL CLEAR');
        const { cx } = this;
        const total = this.stageTimes.reduce((a, b) => a + b, 0);
        const allGems = this.totalGems.reduce((a, b) => a + b, 0);
        const score = allGems * 1000 - Math.round(total * 10);

        cx.font = '700 32px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec';
        cx.fillText(`${score}`, bx, by - 40);
        cx.font = '400 9px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66';
        cx.fillText('SCORE', bx, by - 24);
        cx.fillText(`${allGems} GEMS · ${this.fmtTime(total)}`, bx, by - 8);

        this.drawLeaderboard(bx, by + 100, 280);
        this.drawResultBtns(bx, by + 220);
    }

    private get resultBtnY(): number {
        return this.H / 2 + 220;
    }

    private fmtTime(t: number): string {
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
    }

    // --- Input ---
    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result') {
            if (this.isLeaderboardBusy()) return;
            const hit = this.hitResultBtn(x, y, this.W / 2, this.resultBtnY);
            if (hit === 'retry') this.resetGame();
            if (hit === 'exit') this.stop();
            return;
        }
        if (x > this.W - 90 && x < this.W - 20 && y > 55 && y < 83 && this.phase === 'play') {
            this.showHint();
        }
    }

    // Touch input handled by base class virtual joystick
}

// Factory (main.ts 호환)
export function createMazeGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    const game = new MazeGame(container, onExit, audio);
    return { start: () => game.start(), stop: () => game.stop() };
}