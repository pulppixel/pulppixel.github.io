// ─── Math Master: 미로 탈출 ───
// Recursive Backtracker 미로 생성 + A* 최단 경로 힌트
// Stage 1: 7×7 · Stage 2: 11×11 · Stage 3: 15×15 (안개+미니맵)

function rgba(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}
const CC = { bg: '#0a0a0b', accent: '#6ee7b7', pink: '#ff6b9d', purple: '#a78bfa', yellow: '#fbbf24', cyan: '#67e8f9' };
const WL = 1, WR = 2, WU = 4, WD = 8, WV = 128;
const STAGES = [
    { w: 7, h: 7, fog: 0 },
    { w: 11, h: 11, fog: 0 },
    { w: 15, h: 15, fog: 4 },
];
const MOVE_SPD = 200;

// ══════════════════════════════════════════
// ── Recursive Backtracker (MazeGenerator.cs 포팅) ──
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
// ── A* Pathfinder (MazePathFinder.cs 포팅) ──
// ══════════════════════════════════════════
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
        const dirs: [number, number, number][] = [];
        if (!(maze[cur.x][cur.y] & WL) && cur.x > 0) dirs.push([cur.x - 1, cur.y, WL]);
        if (!(maze[cur.x][cur.y] & WR) && cur.x < w - 1) dirs.push([cur.x + 1, cur.y, WR]);
        if (!(maze[cur.x][cur.y] & WU) && cur.y > 0) dirs.push([cur.x, cur.y - 1, WU]);
        if (!(maze[cur.x][cur.y] & WD) && cur.y < h - 1) dirs.push([cur.x, cur.y + 1, WD]);
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

// ── Dead-end finder ──
function findDeadEnds(maze: number[][], w: number, h: number): { x: number; y: number }[] {
    const ends: { x: number; y: number }[] = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        if (x === 0 && y === 0) continue;
        if (x === w - 1 && y === h - 1) continue;
        let wc = 0;
        if (maze[x][y] & WL) wc++; if (maze[x][y] & WR) wc++;
        if (maze[x][y] & WU) wc++; if (maze[x][y] & WD) wc++;
        if (wc >= 3) ends.push({ x, y });
    }
    return ends;
}

// ══════════════════════════════════════════
// ── 게임 본체 ──
// ══════════════════════════════════════════
export function createMazeGame(container: HTMLElement, onExit: () => void) {
    let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, aId = 0, on = false, mob = false;
    let stage: number, maze: number[][], mW: number, mH: number, cs: number, ox: number, oy: number;
    let px: number, py: number;
    let goalX: number, goalY: number;
    let timer: number, stageTimes: number[], hintPath: { x: number; y: number }[] | null, hintProg: number;
    let trails: { x: number; y: number; a: number }[], hintTrails: { x: number; y: number; a: number }[];
    let phase: 'intro' | 'play' | 'clear' | 'result', phaseT: number, prevT: number;
    let keys: Record<string, boolean> = {};
    let touchDir: { x: number; y: number } = { x: 0, y: 0 };
    // New systems
    let gems: { x: number; y: number; collected: boolean }[];
    let totalGems: number[], explored: Set<string>;
    let dissolveParticles: { x: number; y: number; vx: number; vy: number; a: number; sz: number }[];

    function init() {
        mob = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
        cv = document.createElement('canvas');
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        container.innerHTML = ''; container.appendChild(cv); container.style.display = 'block';
        cx = cv.getContext('2d')!;
        rsz(); window.addEventListener('resize', rsz);
        document.addEventListener('keydown', e => { keys[e.code] = true; if (e.key === 'Escape') stop(); });
        document.addEventListener('keyup', e => { keys[e.code] = false; });
        cv.addEventListener('click', onCl);
        cv.addEventListener('touchstart', onTS, { passive: false });
        cv.addEventListener('touchmove', onTM, { passive: false });
        cv.addEventListener('touchend', onTE);
        resetAll(); on = true; prevT = performance.now(); loop();
    }
    function rsz() { cv.width = innerWidth; cv.height = innerHeight; if (maze) calcLayout(); }

    function resetAll() { stage = 0; stageTimes = []; totalGems = []; startStage(); }

    function startStage() {
        const s = STAGES[stage]; mW = s.w; mH = s.h;
        maze = generateMaze(mW, mH);
        calcLayout();
        px = ox + cs * 0.5; py = oy + cs * 0.5;
        goalX = mW - 1; goalY = mH - 1;
        timer = 0; hintPath = null; hintProg = 0; trails = []; hintTrails = [];
        explored = new Set(); explored.add('0,0');
        dissolveParticles = [];
        // Place gems at random dead-ends
        const ends = findDeadEnds(maze, mW, mH);
        const count = Math.min(ends.length, stage === 0 ? 3 : stage === 1 ? 4 : 5);
        const shuffled = ends.sort(() => Math.random() - 0.5).slice(0, count);
        gems = shuffled.map(e => ({ x: e.x, y: e.y, collected: false }));
        phase = 'intro'; phaseT = 1.2;
    }

    function calcLayout() {
        const pad = 80;
        cs = Math.floor(Math.min((cv.width - pad * 2) / mW, (cv.height - pad * 2) / mH));
        ox = Math.floor((cv.width - mW * cs) / 2);
        oy = Math.floor((cv.height - mH * cs) / 2);
    }

    function gridOf(px2: number, py2: number) { return { x: Math.floor((px2 - ox) / cs), y: Math.floor((py2 - oy) / cs) }; }

    // ── Movement with wall collision ──
    function tryMove(dx: number, dy: number, dt: number) {
        const spd = MOVE_SPD * dt;
        const pad = 4;
        let nx = px + dx * spd, ny = py + dy * spd;
        if (dx !== 0) {
            const g = gridOf(px, py), ng = gridOf(nx, py);
            if (g.x !== ng.x && g.x >= 0 && g.x < mW && g.y >= 0 && g.y < mH) {
                if (dx > 0 && (maze[g.x][g.y] & WR)) nx = ox + (g.x + 1) * cs - pad;
                if (dx < 0 && (maze[g.x][g.y] & WL)) nx = ox + g.x * cs + pad;
            }
        }
        if (dy !== 0) {
            const g = gridOf(nx, py), ng = gridOf(nx, ny);
            if (g.y !== ng.y && g.x >= 0 && g.x < mW && g.y >= 0 && g.y < mH) {
                if (dy > 0 && (maze[g.x][g.y] & WD)) ny = oy + (g.y + 1) * cs - pad;
                if (dy < 0 && (maze[g.x][g.y] & WU)) ny = oy + g.y * cs + pad;
            }
        }
        nx = Math.max(ox + pad, Math.min(ox + mW * cs - pad, nx));
        ny = Math.max(oy + pad, Math.min(oy + mH * cs - pad, ny));
        if (nx !== px || ny !== py) { trails.push({ x: px, y: py, a: 0.5 }); }
        px = nx; py = ny;
    }

    function showHint() {
        const g = gridOf(px, py);
        if (g.x < 0 || g.x >= mW || g.y < 0 || g.y >= mH) return;
        hintPath = astar(maze, mW, mH, g.x, g.y, goalX, goalY);
        hintProg = 0; hintTrails = [];
    }

    // ── Dissolve: 벽을 파티클로 흩뜨리기 ──
    function spawnDissolve() {
        dissolveParticles = [];
        for (let x = 0; x < mW; x++) for (let y = 0; y < mH; y++) {
            const sx = ox + x * cs, sy = oy + y * cs;
            const w = maze[x][y];
            const segs: [number, number, number, number][] = [];
            if (w & WU) segs.push([sx, sy, sx + cs, sy]);
            if (w & WD) segs.push([sx, sy + cs, sx + cs, sy + cs]);
            if (w & WL) segs.push([sx, sy, sx, sy + cs]);
            if (w & WR) segs.push([sx + cs, sy, sx + cs, sy + cs]);
            for (const [x1, y1, x2, y2] of segs) {
                for (let i = 0; i < 2; i++) {
                    const t = (i + 0.5) / 2;
                    const ppx = x1 + (x2 - x1) * t, ppy = y1 + (y2 - y1) * t;
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 30 + Math.random() * 60;
                    dissolveParticles.push({
                        x: ppx, y: ppy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                        a: 0.6 + Math.random() * 0.3, sz: 1.5 + Math.random() * 2
                    });
                }
            }
        }
    }

    // ── Update ──
    function update(dt: number) {
        // Dissolve particles always update
        for (const p of dissolveParticles) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 0.7; }
        dissolveParticles = dissolveParticles.filter(p => p.a > 0);

        if (phase === 'intro') { phaseT -= dt; if (phaseT <= 0) phase = 'play'; return; }
        if (phase === 'clear') {
            phaseT -= dt;
            if (phaseT <= 0) {
                const collected = gems.filter(g => g.collected).length;
                totalGems.push(collected);
                stage++;
                if (stage >= STAGES.length) phase = 'result'; else startStage();
            }
            return;
        }
        if (phase !== 'play') return;
        timer += dt;

        // Movement
        let mx = 0, my = 0;
        if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) my += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
        if (mx === 0 && my === 0 && (touchDir.x !== 0 || touchDir.y !== 0)) { mx = touchDir.x; my = touchDir.y; }
        if (mx !== 0 || my !== 0) tryMove(mx, my, dt);

        // Track explored cells
        const pg = gridOf(px, py);
        if (pg.x >= 0 && pg.x < mW && pg.y >= 0 && pg.y < mH) explored.add(`${pg.x},${pg.y}`);

        // Gem collection
        for (const gem of gems) {
            if (gem.collected) continue;
            if (pg.x === gem.x && pg.y === gem.y) gem.collected = true;
        }

        // Hint: 척후병이 경로를 따라 달려감 (셀 사이도 보간)
        if (hintPath && hintProg < hintPath.length - 1) {
            const prevProg = hintProg;
            hintProg = Math.min(hintProg + dt * 10, hintPath.length - 1);
            const step = 0.15; // 0.15셀 간격으로 잔상
            let t = Math.ceil(prevProg / step) * step;
            while (t <= hintProg) {
                const idx = Math.min(Math.floor(t), hintPath.length - 2);
                const frac = t - idx;
                const a = hintPath[idx], b = hintPath[idx + 1];
                hintTrails.push({
                    x: ox + (a.x + (b.x - a.x) * frac) * cs + cs / 2,
                    y: oy + (a.y + (b.y - a.y) * frac) * cs + cs / 2, a: 0.7
                });
                t += step;
            }
        }
        for (let i = hintTrails.length - 1; i >= 0; i--) { hintTrails[i].a -= dt * 0.55; if (hintTrails[i].a <= 0) hintTrails.splice(i, 1); }
        if (hintPath && hintProg >= hintPath.length - 1 && hintTrails.length === 0) hintPath = null;

        // Trails fade
        for (let i = trails.length - 1; i >= 0; i--) { trails[i].a -= dt * 0.4; if (trails[i].a <= 0) trails.splice(i, 1); }

        // Goal check
        if (pg.x === goalX && pg.y === goalY) {
            stageTimes.push(timer);
            spawnDissolve();
            phase = 'clear'; phaseT = 1.8;
        }
    }

    // ── Render ──
    function render() {
        const now = performance.now() / 1000;
        const W = cv.width, H = cv.height;
        cx.fillStyle = CC.bg; cx.fillRect(0, 0, W, H);
        // Subtle bg grid
        cx.strokeStyle = rgba(CC.accent, 0.015); cx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
        for (let y = 0; y < H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }

        const fog = STAGES[Math.min(stage, STAGES.length - 1)].fog;
        const pg = gridOf(px, py);

        const mazeAlpha = phase === 'clear' ? Math.max(0, (phaseT - 0.6) / 1.2) : 1;

        // ── Maze cells ──
        if (mazeAlpha > 0) {
            for (let x = 0; x < mW; x++) {
                for (let y = 0; y < mH; y++) {
                    const sx = ox + x * cs, sy = oy + y * cs;
                    let vis = 1;
                    if (fog > 0 && phase === 'play') {
                        const dist = Math.abs(x - pg.x) + Math.abs(y - pg.y);
                        vis = dist <= fog ? 1 : dist <= fog + 2 ? Math.max(0, 1 - (dist - fog) / 2) : 0;
                    }
                    if (vis <= 0) continue;
                    vis *= mazeAlpha;

                    cx.fillStyle = rgba(CC.accent, 0.02 * vis);
                    cx.fillRect(sx + 1, sy + 1, cs - 2, cs - 2);

                    cx.strokeStyle = rgba(CC.accent, 0.4 * vis); cx.lineWidth = 2;
                    const w = maze[x][y];
                    if (w & WU) { cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(sx + cs, sy); cx.stroke(); }
                    if (w & WD) { cx.beginPath(); cx.moveTo(sx, sy + cs); cx.lineTo(sx + cs, sy + cs); cx.stroke(); }
                    if (w & WL) { cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(sx, sy + cs); cx.stroke(); }
                    if (w & WR) { cx.beginPath(); cx.moveTo(sx + cs, sy); cx.lineTo(sx + cs, sy + cs); cx.stroke(); }
                }
            }
        }

        // ── Gems (◇) ──
        for (const gem of gems) {
            if (gem.collected) continue;
            let vis = 1;
            if (fog > 0 && phase === 'play') {
                const dist = Math.abs(gem.x - pg.x) + Math.abs(gem.y - pg.y);
                vis = dist <= fog ? 1 : dist <= fog + 2 ? Math.max(0, 1 - (dist - fog) / 2) : 0;
            }
            if (vis <= 0) continue;
            vis *= mazeAlpha;
            const gx = ox + gem.x * cs + cs / 2, gy = oy + gem.y * cs + cs / 2;
            const bob = Math.sin(now * 3 + gem.x * 2 + gem.y) * 2;
            // Glow
            cx.beginPath(); cx.arc(gx, gy + bob, cs * 0.22, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.cyan, 0.1 * vis); cx.fill();
            // Diamond shape
            const s = cs * 0.14;
            cx.beginPath();
            cx.moveTo(gx, gy + bob - s); cx.lineTo(gx + s * 0.7, gy + bob);
            cx.lineTo(gx, gy + bob + s); cx.lineTo(gx - s * 0.7, gy + bob);
            cx.closePath();
            cx.fillStyle = rgba(CC.cyan, 0.7 * vis); cx.fill();
            cx.strokeStyle = rgba(CC.cyan, 0.3 * vis); cx.lineWidth = 1; cx.stroke();
        }

        // ── Goal beacon ──
        const gsx = ox + goalX * cs + cs / 2, gsy = oy + goalY * cs + cs / 2;
        // Beacon pulse visible through fog
        if (fog > 0 && phase === 'play') {
            const ba = 0.08 + Math.sin(now * 2) * 0.04;
            const r1 = cs * (1.5 + Math.sin(now * 1.5) * 0.5);
            cx.beginPath(); cx.arc(gsx, gsy, r1, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.yellow, ba * mazeAlpha); cx.fill();
        }
        // Goal icon
        let gVis = 1;
        if (fog > 0 && phase === 'play') {
            const gd = Math.abs(goalX - pg.x) + Math.abs(goalY - pg.y);
            gVis = gd <= fog ? 1 : gd <= fog + 2 ? Math.max(0, 1 - (gd - fog) / 2) : 0.12;
        }
        gVis *= mazeAlpha;
        for (let i = 0; i < 2; i++) {
            const rr = cs * 0.3 + (Math.sin(now * 2.5 + i * Math.PI) + 1) * cs * 0.15;
            cx.beginPath(); cx.arc(gsx, gsy, rr, 0, Math.PI * 2);
            cx.strokeStyle = rgba(CC.yellow, 0.15 * gVis * (1 - i * 0.4)); cx.lineWidth = 1; cx.stroke();
        }
        cx.beginPath(); cx.arc(gsx, gsy, cs * 0.3, 0, Math.PI * 2);
        cx.fillStyle = rgba(CC.yellow, 0.15 * gVis); cx.fill();
        cx.font = `${Math.round(cs * 0.35)}px "JetBrains Mono",monospace`;
        cx.fillStyle = rgba(CC.yellow, 0.8 * gVis); cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('★', gsx, gsy + 1);

        // ── A* Hint trail (척후병) ──
        for (const t of hintTrails) {
            const sz = cs * 0.08 * (t.a / 0.7);
            cx.beginPath(); cx.arc(t.x, t.y, sz, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.accent, t.a * 0.5); cx.fill();
        }
        // Scout head: arrow (보간 위치)
        if (hintPath && hintProg < hintPath.length - 1) {
            const idx = Math.min(Math.floor(hintProg), hintPath.length - 2);
            const frac = hintProg - idx;
            const a = hintPath[idx], b = hintPath[idx + 1];
            const hx = ox + (a.x + (b.x - a.x) * frac) * cs + cs / 2;
            const hy = oy + (a.y + (b.y - a.y) * frac) * cs + cs / 2;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            cx.beginPath(); cx.arc(hx, hy, cs * 0.25, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.accent, 0.12); cx.fill();
            cx.save(); cx.translate(hx, hy); cx.rotate(angle);
            const as = cs * 0.18;
            cx.beginPath();
            cx.moveTo(as, 0); cx.lineTo(-as * 0.4, -as * 0.6); cx.lineTo(-as * 0.15, 0); cx.lineTo(-as * 0.4, as * 0.6);
            cx.closePath();
            cx.fillStyle = rgba(CC.accent, 0.85); cx.fill();
            cx.strokeStyle = rgba(CC.accent, 0.4); cx.lineWidth = 1; cx.stroke();
            cx.restore();
        }

        // ── Trail (breadcrumb) ──
        for (const t of trails) {
            cx.beginPath(); cx.arc(t.x, t.y, 2, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.accent, t.a * 0.25); cx.fill();
        }

        // ── Player ──
        cx.beginPath(); cx.arc(px, py, cs * 0.25 + 2, 0, Math.PI * 2);
        cx.fillStyle = rgba(CC.accent, 0.1); cx.fill();
        cx.beginPath(); cx.arc(px, py, cs * 0.2, 0, Math.PI * 2);
        cx.fillStyle = CC.accent; cx.fill();
        cx.beginPath(); cx.arc(px, py, cs * 0.2 + 4, 0, Math.PI * 2);
        cx.strokeStyle = rgba(CC.accent, 0.2 + Math.sin(now * 4) * 0.1); cx.lineWidth = 1.5; cx.stroke();

        // Start marker
        const ssx = ox + cs / 2, ssy = oy + cs / 2;
        cx.font = `${Math.round(cs * 0.25)}px "JetBrains Mono",monospace`;
        cx.fillStyle = rgba(CC.accent, 0.3); cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('S', ssx, ssy);

        // ── Dissolve particles ──
        for (const p of dissolveParticles) {
            cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
            cx.fillStyle = rgba(CC.accent, Math.max(0, p.a) * 0.6); cx.fill();
        }

        // ── Mini-map (fog 스테이지) ──
        if (fog > 0 && phase === 'play') {
            const mmSz = 75;
            const mmX = W - mmSz - 18, mmY = H - mmSz - 18;
            const mmCs = mmSz / Math.max(mW, mH);
            const mmOx = mmX + (mmSz - mW * mmCs) / 2, mmOy = mmY + (mmSz - mH * mmCs) / 2;
            cx.fillStyle = rgba(CC.bg, 0.85);
            cx.beginPath(); cx.roundRect(mmX - 5, mmY - 5, mmSz + 10, mmSz + 10, 4); cx.fill();
            cx.strokeStyle = rgba(CC.accent, 0.15); cx.lineWidth = 1; cx.stroke();
            for (const k of explored) {
                const [ex, ey] = k.split(',').map(Number);
                cx.fillStyle = rgba(CC.accent, 0.2);
                cx.fillRect(mmOx + ex * mmCs + 0.5, mmOy + ey * mmCs + 0.5, mmCs - 1, mmCs - 1);
            }
            for (const gem of gems) {
                if (gem.collected || !explored.has(`${gem.x},${gem.y}`)) continue;
                cx.fillStyle = rgba(CC.cyan, 0.6);
                cx.fillRect(mmOx + gem.x * mmCs + mmCs * 0.25, mmOy + gem.y * mmCs + mmCs * 0.25, mmCs * 0.5, mmCs * 0.5);
            }
            cx.fillStyle = rgba(CC.yellow, 0.5);
            cx.fillRect(mmOx + goalX * mmCs, mmOy + goalY * mmCs, mmCs, mmCs);
            cx.fillStyle = CC.accent;
            cx.fillRect(mmOx + pg.x * mmCs, mmOy + pg.y * mmCs, mmCs, mmCs);
            cx.font = '500 8px "JetBrains Mono",monospace'; cx.fillStyle = rgba(CC.accent, 0.3);
            cx.textAlign = 'right'; cx.textBaseline = 'alphabetic'; cx.fillText('MAP', W - 20, mmY - 10);
        }

        // ── HUD ──
        cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
        cx.font = '600 11px "JetBrains Mono",monospace'; cx.fillStyle = CC.purple;
        cx.fillText('◆ MAZE ESCAPE', 20, 28);
        cx.font = '500 10px "JetBrains Mono",monospace'; cx.fillStyle = '#7a7a8a';
        const mm = Math.floor(timer / 60), ss = Math.floor(timer % 60), ms = Math.floor((timer % 1) * 10);
        cx.fillText(`TIME  ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${ms}`, 20, 46);
        const gc = gems.filter(g => g.collected).length, gt = gems.length;
        cx.fillStyle = CC.cyan; cx.fillText(`◇ ${gc}/${gt}`, 130, 46);
        cx.fillStyle = '#3a3a44'; cx.fillText(`STAGE ${stage + 1}/${STAGES.length}${fog > 0 ? ' · FOG' : ''}`, 20, 62);
        // Hint button
        const hbx = W - 90, hby = 55;
        cx.beginPath(); cx.roundRect(hbx, hby, 70, 28, 5);
        cx.strokeStyle = rgba(CC.accent, 0.3); cx.lineWidth = 1; cx.stroke();
        cx.fillStyle = rgba(CC.accent, 0.05); cx.fill();
        cx.font = '500 10px "JetBrains Mono",monospace'; cx.fillStyle = rgba(CC.accent, 0.6);
        cx.textAlign = 'center'; cx.fillText('HINT (A*)', hbx + 35, hby + 17);
        cx.font = '400 16px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('✕', W - 22, 38);
        if (mob && phase === 'play' && timer < 3) {
            cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#2a2a33'; cx.textAlign = 'center';
            cx.fillText('터치한 방향으로 이동', W / 2, H - 16);
        }

        // ── Overlays ──
        if (phase === 'intro') {
            const p = Math.min(1, (1.2 - phaseT) / 0.4);
            cx.fillStyle = rgba(CC.bg, 0.55 * (1 - Math.max(0, (phaseT - 0.3) / 0.9))); cx.fillRect(0, 0, W, H);
            cx.textAlign = 'center'; cx.globalAlpha = p;
            cx.font = '700 26px "JetBrains Mono",monospace'; cx.fillStyle = CC.purple;
            cx.fillText(`STAGE ${stage + 1}`, W / 2, H / 2 - 16);
            cx.font = '400 11px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66';
            cx.fillText(`${mW}×${mH}${fog > 0 ? ' · FOG OF WAR' : ''}`, W / 2, H / 2 + 12);
            cx.fillText(mob ? '터치 = 이동 · HINT = A* 경로' : 'WASD 이동 · HINT = A* 경로', W / 2, H / 2 + 30);
            cx.globalAlpha = 1;
        }
        if (phase === 'clear') {
            const fade = Math.min(1, (1.8 - phaseT) / 0.5);
            cx.fillStyle = rgba(CC.bg, 0.5 * fade); cx.fillRect(0, 0, W, H);
            cx.textAlign = 'center'; cx.globalAlpha = fade;
            cx.font = '700 22px "JetBrains Mono",monospace'; cx.fillStyle = CC.accent;
            cx.fillText('CLEAR!', W / 2, H / 2 - 16);
            cx.font = '400 12px "JetBrains Mono",monospace'; cx.fillStyle = '#8a8a9a';
            const st = stageTimes[stageTimes.length - 1];
            cx.fillText(`${String(Math.floor(st / 60)).padStart(2, '0')}:${String(Math.floor(st % 60)).padStart(2, '0')}.${Math.floor((st % 1) * 10)}`, W / 2, H / 2 + 12);
            if (gems.length > 0) {
                cx.fillStyle = CC.cyan;
                cx.fillText(`◇ ${gems.filter(g => g.collected).length}/${gems.length} collected`, W / 2, H / 2 + 32);
            }
            cx.globalAlpha = 1;
        }
        if (phase === 'result') {
            cx.fillStyle = rgba(CC.bg, 0.85); cx.fillRect(0, 0, W, H);
            const bx = W / 2, by = H / 2; cx.textAlign = 'center';
            cx.font = '600 12px "JetBrains Mono",monospace'; cx.fillStyle = CC.accent; cx.fillText('ALL CLEAR', bx, by - 80);
            const total = stageTimes.reduce((a, b) => a + b, 0);
            cx.font = '700 32px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec';
            cx.fillText(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(Math.floor(total % 60)).padStart(2, '0')}.${Math.floor((total % 1) * 10)}`, bx, by - 35);
            cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('TOTAL TIME', bx, by - 15);
            stageTimes.forEach((t, i) => {
                const gemStr = totalGems[i] !== undefined ? `  ◇ ${totalGems[i]}` : '';
                cx.fillStyle = '#5a5a66';
                cx.fillText(`Stage ${i + 1}: ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}${gemStr}`, bx, by + 8 + i * 16);
            });
            const allGems = totalGems.reduce((a, b) => a + b, 0);
            if (allGems > 0) {
                cx.fillStyle = CC.cyan; cx.font = '500 11px "JetBrains Mono",monospace';
                cx.fillText(`TOTAL ◇ ${allGems}`, bx, by + 8 + STAGES.length * 16 + 6);
            }
            const btnY = by + 8 + STAGES.length * 16 + 30;
            drawBtn(bx - 112, btnY, 100, 34, '다시', true);
            drawBtn(bx + 12, btnY, 100, 34, '나가기', false);
        }
    }

    function drawBtn(x: number, y: number, w: number, h: number, text: string, pri: boolean) {
        cx.beginPath(); cx.roundRect(x, y, w, h, 6);
        if (pri) { cx.fillStyle = rgba(CC.accent, 0.1); cx.fill(); cx.strokeStyle = rgba(CC.accent, 0.4); }
        else { cx.fillStyle = 'transparent'; cx.strokeStyle = '#333'; }
        cx.lineWidth = 1; cx.stroke(); cx.font = '500 12px "JetBrains Mono",monospace';
        cx.fillStyle = pri ? CC.accent : '#8a8a9a'; cx.textAlign = 'center'; cx.fillText(text, x + w / 2, y + h / 2 + 4);
    }

    function loop() { if (!on) return; const n = performance.now(), dt = Math.min((n - prevT) / 1000, 0.05); prevT = n; update(dt); render(); aId = requestAnimationFrame(loop); }

    // ── Input ──
    function onCl(e: MouseEvent) {
        const W = cv.width;
        if (e.clientX > W - 40 && e.clientY < 50) { stop(); return; }
        if (phase === 'result') { hitR(e.clientX, e.clientY); return; }
        if (e.clientX > W - 90 && e.clientX < W - 20 && e.clientY > 55 && e.clientY < 83 && phase === 'play') { showHint(); return; }
    }
    function onTS(e: TouchEvent) {
        e.preventDefault(); const t = e.changedTouches[0];
        const W = cv.width;
        if (t.clientX > W - 40 && t.clientY < 50) { stop(); return; }
        if (phase === 'result') { hitR(t.clientX, t.clientY); return; }
        if (t.clientX > W - 90 && t.clientX < W - 20 && t.clientY > 55 && t.clientY < 83 && phase === 'play') { showHint(); return; }
        if (phase === 'play') updateTouchDir(t.clientX, t.clientY);
    }
    function onTM(e: TouchEvent) { e.preventDefault(); if (phase === 'play') updateTouchDir(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }
    function onTE() { touchDir = { x: 0, y: 0 }; }

    function updateTouchDir(tx: number, ty: number) {
        const dx = tx - px, dy = ty - py;
        if (Math.hypot(dx, dy) < 15) { touchDir = { x: 0, y: 0 }; return; }
        if (Math.abs(dx) > Math.abs(dy)) { touchDir = { x: dx > 0 ? 1 : -1, y: 0 }; }
        else { touchDir = { x: 0, y: dy > 0 ? 1 : -1 }; }
    }

    function hitR(x: number, y: number) {
        const mx = cv.width / 2, my = cv.height / 2;
        const btnY = my + 8 + STAGES.length * 16 + 30;
        if (x > mx - 112 && x < mx - 12 && y > btnY && y < btnY + 34) resetAll();
        if (x > mx + 12 && x < mx + 112 && y > btnY && y < btnY + 34) stop();
    }
    function stop() {
        on = false; cancelAnimationFrame(aId);
        cv.removeEventListener('click', onCl); cv.removeEventListener('touchstart', onTS);
        cv.removeEventListener('touchmove', onTM); cv.removeEventListener('touchend', onTE);
        window.removeEventListener('resize', rsz);
        container.style.display = 'none'; container.innerHTML = ''; onExit();
    }
    return { start: init, stop };
}