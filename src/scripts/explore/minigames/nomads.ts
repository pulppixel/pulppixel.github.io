// ─── Nomads Planet: Coin Dash v2 ───
// 드리프트 물리 · NPC 4종 · 신호위반 추적 · 니어미스 · 타이머 · 코인트레일
import { MinigameBase, rgba, C } from './base';

// ══════════════════════════════════════════
// ── Constants ──
// ══════════════════════════════════════════

const ROAD_W = 52;
const HIT_R = 15;
const COIN_R = 6;
const COMBO_WIN = 2.0;
const TF_GREEN = 8, TF_YELLOW = 3;
const NEAR_MAX = HIT_R * 2.8;

// Drift Physics
const ACCEL = 550;
const MAX_SPD = 195;
const BOOST_MULT = 1.7;
const FRICTION = 3.8;
const TURN_SPD = 8;
const DRIFT_TH = 0.4;

// NPC Types
const NPCS: Record<string, { l: number; w: number; sMul: number; color: string; sym: string; signal: boolean }> = {
    normal:    { l: 22, w: 14, sMul: 1.0, color: C.pink,   sym: '',  signal: true },
    truck:     { l: 30, w: 18, sMul: 0.6, color: C.yellow, sym: '■', signal: true },
    sports:    { l: 20, w: 10, sMul: 1.5, color: C.purple, sym: '▶', signal: true },
    ambulance: { l: 24, w: 14, sMul: 1.2, color: C.red,    sym: '+', signal: false },
};
const NPC_WEIGHTS = [
    { normal: 0.8, truck: 0.2, sports: 0,    ambulance: 0 },
    { normal: 0.4, truck: 0.2, sports: 0.25, ambulance: 0.15 },
    { normal: 0.2, truck: 0.15, sports: 0.35, ambulance: 0.3 },
];

const STAGES = [
    { coins: 10, rate: 2.0, spd: 95,  time: 35, boosts: 2 },
    { coins: 14, rate: 1.2, spd: 140, time: 40, boosts: 3 },
    { coins: 18, rate: 0.6, spd: 185, time: 45, boosts: 3 },
];

// ══════════════════════════════════════════
// ── Types ──
// ══════════════════════════════════════════

interface NpcCar { x: number; y: number; dir: 'n'|'s'|'e'|'w'; speed: number; curSpd: number; type: string; l: number; w: number; color: string; sym: string; obeysSignal: boolean; }
interface Police { x: number; y: number; life: number; flash: number; }
interface CoinObj { x: number; y: number; collected: boolean; danger: boolean; trail: number; value: number; }
interface BoostPad { x: number; y: number; dir: 'h'|'v'; }
interface ShieldPk { x: number; y: number; }
interface Pulse { x: number; y: number; t: number; col: string; }
interface Trail { x: number; y: number; a: number; thick: boolean; }
type TfDir = 'h'|'v';
type TfCol = 'green'|'yellow'|'red';
type Phase = 'intro'|'play'|'clear'|'result'|'dead';

// ══════════════════════════════════════════
// ── Game ──
// ══════════════════════════════════════════

class NomadsGame extends MinigameBase {
    protected readonly title = 'NOMADS PLANET';
    protected readonly titleColor = C.yellow;

    private vx = [0,0]; private hy = [0,0];
    private tfAct: TfDir = 'h'; private tfCol: TfCol = 'green'; private tfT = TF_GREEN;

    // Player — drift
    private px = 0; private py = 0; private pDir = 0;
    private pvx = 0; private pvy = 0;
    private hp = 3; private iFrames = 0;
    private isDrifting = false;
    private shield = false; private boostT = 0;

    // Entities
    private npcs: NpcCar[] = []; private police: Police[] = [];
    private coins: CoinObj[] = []; private boostPads: BoostPad[] = [];
    private shields: ShieldPk[] = []; private trails: Trail[] = [];
    private pulses: Pulse[] = [];

    // State
    private phase: Phase = 'intro'; private phaseT = 0;
    private stage = 0; private score = 0;
    private combo = 0; private maxCombo = 0; private lastCoinT = -10;
    private spawnT = 0; private stageTime = 0;
    private touchDir = { x: 0, y: 0 };
    private shX = 0; private shY = 0;
    private nearMissCd = 0; private nmFlash = 0;
    private inIntersection = false; private stageStars: number[] = [];
    private violationPending: { ix: number; iy: number; heading: 'n'|'s'|'e'|'w' } | null = null;

    private sig(d: TfDir): TfCol { return d === this.tfAct ? this.tfCol : 'red'; }
    private sigCol(s: TfCol): string { return s === 'green' ? C.accent : s === 'yellow' ? C.yellow : C.red; }

    // ── Lifecycle ──

    protected resetGame(): void {
        this.stage = 0; this.score = 0; this.combo = 0; this.maxCombo = 0;
        this.lastCoinT = -10; this.stageStars = [];
        this.startStage();
    }
    protected onResized(): void { this.layout(); }

    private layout(): void { this.vx = [this.W * 0.25, this.W * 0.5, this.W * 0.75]; this.hy = [this.H * 0.35, this.H * 0.65]; }

    private startStage(): void {
        this.layout();
        this.px = this.vx[1]; this.py = this.H * 0.8; this.pDir = -Math.PI / 2;
        this.pvx = 0; this.pvy = 0;
        this.hp = 3; this.iFrames = 0; this.shield = false; this.boostT = 0;
        this.isDrifting = false; this.inIntersection = false; this.violationPending = null;
        this.npcs = []; this.police = []; this.trails = []; this.pulses = [];
        this.pts = []; this.pops = [];
        this.tfAct = 'h'; this.tfCol = 'green'; this.tfT = TF_GREEN;
        this.spawnT = 1.5; this.stageTime = STAGES[this.stage].time;
        this.shX = 0; this.shY = 0; this.nearMissCd = 0; this.nmFlash = 0;
        this.touchDir = { x: 0, y: 0 };
        this.placeCoins(); this.placeBoosts(); this.placeShield();
        this.phase = 'intro'; this.phaseT = 1.3;
    }

    private placeCoins(): void {
        const s = STAGES[this.stage]; this.coins = [];
        for (let a = 0, placed = 0; a < s.coins * 30 && placed < s.coins; a++) {
            const isV = Math.random() < 0.5, ri = Math.floor(Math.random() * (isV ? this.vx.length : this.hy.length));
            let x: number, y: number;
            if (isV) { x = this.vx[ri] + (Math.random() - 0.5) * ROAD_W * 0.4; y = 50 + Math.random() * (this.H - 100); }
            else { x = 50 + Math.random() * (this.W - 100); y = this.hy[ri] + (Math.random() - 0.5) * ROAD_W * 0.4; }
            let skip = false;
            for (const vxi of this.vx) for (const hyi of this.hy)
                if (Math.abs(x - vxi) < ROAD_W && Math.abs(y - hyi) < ROAD_W) skip = true;
            if (Math.hypot(x - this.vx[1], y - this.H * 0.8) < 50) skip = true;
            if (this.coins.some(c => Math.hypot(c.x - x, c.y - y) < 28)) skip = true;
            if (!skip) { this.coins.push({ x, y, collected: false, danger: false, trail: -1, value: 1 }); placed++; }
        }
        // Danger coins at intersections
        for (const vxi of this.vx) for (const hyi of this.hy)
            if (Math.random() < 0.5) this.coins.push({ x: vxi, y: hyi, collected: false, danger: true, trail: -1, value: 3 });
        // Coin trails
        let trailId = 0;
        const roads = [...this.vx.map(x => ({ c: x, isV: true })), ...this.hy.map(y => ({ c: y, isV: false }))];
        for (const rd of roads) {
            if (Math.random() > 0.5) continue;
            const len = rd.isV ? this.H : this.W;
            const start = 60 + Math.random() * len * 0.3;
            const cnt = 3 + Math.floor(Math.random() * 2);
            for (let i = 0; i < cnt; i++) {
                const pos = start + i * 28;
                const x = rd.isV ? rd.c + (Math.random() - 0.5) * 8 : pos;
                const y = rd.isV ? pos : rd.c + (Math.random() - 0.5) * 8;
                let skip = false;
                for (const vxi of this.vx) for (const hyi of this.hy)
                    if (Math.abs(x - vxi) < ROAD_W * 0.8 && Math.abs(y - hyi) < ROAD_W * 0.8) skip = true;
                if (!skip) this.coins.push({ x, y, collected: false, danger: false, trail: trailId, value: 1 });
            }
            trailId++;
        }
    }

    private placeBoosts(): void {
        this.boostPads = [];
        for (let i = 0; i < STAGES[this.stage].boosts; i++) {
            const isV = Math.random() < 0.5, ri = Math.floor(Math.random() * (isV ? this.vx.length : this.hy.length));
            const len = isV ? this.H : this.W;
            this.boostPads.push({ x: isV ? this.vx[ri] : 80 + Math.random() * (len - 160), y: isV ? 80 + Math.random() * (len - 160) : this.hy[ri], dir: isV ? 'v' : 'h' });
        }
    }

    private placeShield(): void {
        this.shields = [];
        if (this.stage < 2) {
            const isV = Math.random() < 0.5, ri = Math.floor(Math.random() * (isV ? this.vx.length : this.hy.length)), len = isV ? this.H : this.W;
            this.shields.push({ x: isV ? this.vx[ri] : 80 + Math.random() * (len - 160), y: isV ? 80 + Math.random() * (len - 160) : this.hy[ri] });
        }
    }

    private isOnRoad(x: number, y: number): boolean {
        const hw = ROAD_W / 2;
        for (const vxi of this.vx) if (Math.abs(x - vxi) < hw) return true;
        for (const hyi of this.hy) if (Math.abs(y - hyi) < hw) return true;
        return false;
    }

    // ── Traffic FSM ──

    private updateTraffic(dt: number): void {
        this.tfT -= dt;
        if (this.tfT <= 0) {
            const prev = this.tfCol;
            if (this.tfCol === 'green') { this.tfCol = 'yellow'; this.tfT = TF_YELLOW; }
            else { this.tfAct = this.tfAct === 'h' ? 'v' : 'h'; this.tfCol = 'green'; this.tfT = TF_GREEN; }
            if (prev !== this.tfCol) {
                const col = this.sigCol(this.tfCol);
                for (const vxi of this.vx) for (const hyi of this.hy)
                    this.pulses.push({ x: vxi, y: hyi, t: 0, col });
            }
        }
    }

    private checkViolation(): void {
        const hw = ROAD_W / 2;
        let inAny = false;
        for (const vxi of this.vx) for (const hyi of this.hy) {
            if (Math.abs(this.px - vxi) < hw && Math.abs(this.py - hyi) < hw) {
                inAny = true;
                if (!this.inIntersection && Math.hypot(this.pvx, this.pvy) > 20) {
                    const heading = this.getHeading();
                    const goH = heading === 'e' || heading === 'w';
                    if (this.sig(goH ? 'h' : 'v') === 'red') {
                        this.violationPending = { ix: vxi, iy: hyi, heading };
                    }
                }
            }
        }
        // 교차로 이탈 시 판정: 직진/좌회전 = 위반, 우회전 = 허용
        if (this.violationPending && !inAny) {
            const exit = this.getHeading();
            const entry = this.violationPending.heading;
            // 우측통행 기준 우회전: N→E, E→S, S→W, W→N
            const isRightTurn =
                (entry === 'n' && exit === 'e') || (entry === 'e' && exit === 's') ||
                (entry === 's' && exit === 'w') || (entry === 'w' && exit === 'n');
            if (!isRightTurn) {
                // 직진 또는 좌회전 = 위반!
                this.spawnPolice(this.violationPending.ix, this.violationPending.iy);
                this.addPop(this.px, this.py - 40, '⚠ VIOLATION!', true, 1.5);
            }
            this.violationPending = null;
        }
        if (!inAny) this.violationPending = null;
        this.inIntersection = inAny;
    }

    /** 현재 속도 기반 진행 방향 */
    private getHeading(): 'n' | 's' | 'e' | 'w' {
        if (Math.abs(this.pvx) > Math.abs(this.pvy))
            return this.pvx > 0 ? 'e' : 'w';
        return this.pvy > 0 ? 's' : 'n';
    }

    // ── NPC ──

    private pickType(): string {
        const w = NPC_WEIGHTS[this.stage]; let r = Math.random(), sum = 0;
        for (const [t, wt] of Object.entries(w)) { sum += wt; if (r < sum) return t; }
        return 'normal';
    }

    private spawnNpc(): void {
        const s = STAGES[this.stage];
        const dirs: ('n'|'s'|'e'|'w')[] = ['n','s','e','w'];
        const dir = dirs[Math.floor(Math.random() * 4)];
        const isNS = dir === 'n' || dir === 's';
        const road = Math.floor(Math.random() * (isNS ? this.vx.length : this.hy.length));
        const off = ROAD_W * 0.18, type = this.pickType(), d = NPCS[type];
        let x: number, y: number;
        // 우측통행: 진행 방향 기준 오른쪽 차선
        if (dir === 's') { x = this.vx[road] - off; y = -d.l; }       // 남행 = 서쪽 차선
        else if (dir === 'n') { x = this.vx[road] + off; y = this.H + d.l; } // 북행 = 동쪽 차선
        else if (dir === 'e') { x = -d.l; y = this.hy[road] + off; }   // 동행 = 남쪽 차선 (수정)
        else { x = this.W + d.l; y = this.hy[road] - off; }            // 서행 = 북쪽 차선 (수정)
        // 같은 차선에 NPC가 너무 가까이 있으면 스폰 취소
        for (const ex of this.npcs) {
            if (ex.dir !== dir) continue;
            const lat = isNS ? Math.abs(x - ex.x) : Math.abs(y - ex.y);
            if (lat > ROAD_W * 0.4) continue;
            const gap = isNS ? Math.abs(y - ex.y) : Math.abs(x - ex.x);
            if (gap < 50) return;
        }
        const spd = s.spd * d.sMul + Math.random() * 25;
        this.npcs.push({ x, y, dir, type, speed: spd, curSpd: spd, l: d.l, w: d.w, color: d.color, sym: d.sym, obeysSignal: d.signal });
    }

    private updateNpcs(dt: number): void {
        const hw = ROAD_W / 2, mg = 15, BRAKE_ZONE = 80, MIN_GAP = 35;
        const NPC_ACCEL = 180, NPC_BRAKE = 350;
        let i = this.npcs.length;
        while (i-- > 0) {
            const n = this.npcs[i];
            const isNS = n.dir === 'n' || n.dir === 's';
            const sig = this.sig(isNS ? 'v' : 'h');
            const cross = isNS ? this.hy : this.vx;

            // ── 목표 속도 결정 ──
            let targetSpd = n.speed;

            // 적색 신호 브레이킹 존
            if (n.obeysSignal && sig === 'red') {
                const pos = isNS ? n.y : n.x;
                for (const ci of cross) {
                    const stopLine = (n.dir === 's' || n.dir === 'e') ? ci - hw - mg : ci + hw + mg;
                    const distToStop = (n.dir === 's' || n.dir === 'e') ? stopLine - pos : pos - stopLine;
                    if (distToStop > 0 && distToStop < BRAKE_ZONE) targetSpd = Math.min(targetSpd, n.speed * (distToStop / BRAKE_ZONE));
                    if (distToStop >= -2 && distToStop <= 2) targetSpd = 0; // 정지선 도착
                }
            }

            // 앞차 간격 유지
            for (const o of this.npcs) {
                if (o === n || o.dir !== n.dir) continue;
                const lat = isNS ? Math.abs(n.x - o.x) : Math.abs(n.y - o.y);
                if (lat > ROAD_W * 0.4) continue;
                let gap = 0;
                if (n.dir === 's') gap = o.y - n.y; else if (n.dir === 'n') gap = n.y - o.y;
                else if (n.dir === 'e') gap = o.x - n.x; else gap = n.x - o.x;
                if (gap > 0 && gap < MIN_GAP * 2) targetSpd = Math.min(targetSpd, o.curSpd * (gap / (MIN_GAP * 2)));
            }

            // ── 가감속 보간 ──
            if (n.curSpd < targetSpd) n.curSpd = Math.min(targetSpd, n.curSpd + NPC_ACCEL * dt);
            else if (n.curSpd > targetSpd) n.curSpd = Math.max(targetSpd, n.curSpd - NPC_BRAKE * dt);

            // ── 이동 ──
            const spd = n.curSpd * dt;
            if (n.dir === 's') n.y += spd; else if (n.dir === 'n') n.y -= spd;
            else if (n.dir === 'e') n.x += spd; else n.x -= spd;

            // 정지선 안전 클램프 (오버슈트 방지)
            if (n.obeysSignal && sig === 'red') {
                for (const ci of cross) {
                    if (n.dir === 's') { const s = ci - hw - mg; if (n.y > s && n.y < s + 5) { n.y = s; n.curSpd = 0; } }
                    else if (n.dir === 'n') { const s = ci + hw + mg; if (n.y < s && n.y > s - 5) { n.y = s; n.curSpd = 0; } }
                    else if (n.dir === 'e') { const s = ci - hw - mg; if (n.x > s && n.x < s + 5) { n.x = s; n.curSpd = 0; } }
                    else { const s = ci + hw + mg; if (n.x < s && n.x > s - 5) { n.x = s; n.curSpd = 0; } }
                }
            }

            if (n.x < -70 || n.x > this.W + 70 || n.y < -70 || n.y > this.H + 70) { this.npcs[i] = this.npcs[this.npcs.length - 1]; this.npcs.pop(); }
        }
    }

    private spawnPolice(ix: number, iy: number): void {
        this.police.push({ x: ix + (Math.random() - 0.5) * 200, y: iy + (Math.random() - 0.5) * 200, life: 5, flash: 0 });
    }

    private updatePolice(dt: number): void {
        let i = this.police.length;
        while (i-- > 0) {
            const p = this.police[i]; p.life -= dt; p.flash += dt;
            const dx = this.px - p.x, dy = this.py - p.y, dist = Math.hypot(dx, dy);
            if (dist > 5) { const spd = MAX_SPD * 1.25; p.x += (dx / dist) * spd * dt; p.y += (dy / dist) * spd * dt; }
            if (dist < HIT_R + 4 && this.iFrames <= 0) { this.hurtPlayer(); p.life = 0; this.addPop(this.px, this.py - 30, 'BUSTED!', true, 1.2); }
            if (p.life <= 0) { this.police[i] = this.police[this.police.length - 1]; this.police.pop(); }
        }
    }

    // ── Player ──

    private hurtPlayer(): void {
        if (this.shield) { this.shield = false; this.addBurst(this.px, this.py, C.blue, 10, 150); this.addPop(this.px, this.py - 30, 'SHIELD!', true, 1.0); this.iFrames = 0.4; return; }
        this.hp--; this.iFrames = 1.0; this.combo = 0;
        this.shX = 6 * (Math.random() > 0.5 ? 1 : -1); this.shY = 4 * (Math.random() - 0.5);
        this.addBurst(this.px, this.py, C.pink, 8, 120);
        if (this.hp <= 0) this.phase = 'dead';
    }

    private updatePlayer(dt: number): void {
        let mx = 0, my = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        if (mx === 0 && my === 0 && (this.touchDir.x || this.touchDir.y)) { mx = this.touchDir.x; my = this.touchDir.y; }

        // Drift physics
        if (mx !== 0 || my !== 0) {
            const len = Math.hypot(mx, my);
            this.pvx += (mx / len) * ACCEL * dt; this.pvy += (my / len) * ACCEL * dt;
            const tDir = Math.atan2(my, mx);
            let df = tDir - this.pDir; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
            this.pDir += df * TURN_SPD * dt;
        }
        const spd = Math.hypot(this.pvx, this.pvy);
        if (spd > 0.5) { const f = Math.max(0, 1 - FRICTION * dt); this.pvx *= f; this.pvy *= f; } else { this.pvx = 0; this.pvy = 0; }

        let maxSpd = MAX_SPD;
        if (this.boostT > 0) maxSpd *= BOOST_MULT;
        const curSpd = Math.hypot(this.pvx, this.pvy);
        if (curSpd > maxSpd) { this.pvx *= maxSpd / curSpd; this.pvy *= maxSpd / curSpd; }

        // 건물 벽 충돌 — 축 분리로 슬라이딩
        const nx = this.px + this.pvx * dt, ny = this.py + this.pvy * dt;
        if (this.isOnRoad(nx, ny)) { this.px = nx; this.py = ny; }
        else if (this.isOnRoad(nx, this.py)) { this.px = nx; this.pvy *= 0.2; }
        else if (this.isOnRoad(this.px, ny)) { this.py = ny; this.pvx *= 0.2; }
        else { this.pvx *= 0.2; this.pvy *= 0.2; }

        // Pac-Man wrap + 도로 스냅
        if (this.px < 0) this.px += this.W; if (this.px > this.W) this.px -= this.W;
        if (this.py < 0) this.py += this.H; if (this.py > this.H) this.py -= this.H;
        if (!this.isOnRoad(this.px, this.py)) {
            let best = Infinity;
            for (const vxi of this.vx) { const d = Math.abs(this.px - vxi); if (d < best) { best = d; this.px = vxi; } }
            for (const hyi of this.hy) { const d = Math.abs(this.py - hyi); if (d < best) { best = d; this.py = hyi; } }
        }

        // Drift detection
        if (curSpd > 30) {
            const velDir = Math.atan2(this.pvy, this.pvx);
            let da = Math.abs(velDir - this.pDir); if (da > Math.PI) da = Math.PI * 2 - da;
            this.isDrifting = da > DRIFT_TH;
        } else this.isDrifting = false;

        // Trails
        if (curSpd > 15) {
            if (this.isDrifting) {
                const perp = this.pDir + Math.PI / 2;
                this.trails.push({ x: this.px + Math.cos(perp) * 5, y: this.py + Math.sin(perp) * 5, a: 0.6, thick: true });
                this.trails.push({ x: this.px - Math.cos(perp) * 5, y: this.py - Math.sin(perp) * 5, a: 0.6, thick: true });
                if (Math.random() < 0.3) { const a = this.pDir + Math.PI + (Math.random() - 0.5) * 1.5; this.pts.push({ x: this.px, y: this.py, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, a: 0.8, color: C.yellow, s: 1.5 }); }
            } else this.trails.push({ x: this.px, y: this.py, a: 0.35, thick: false });
        }
        this.iFrames = Math.max(0, this.iFrames - dt);
        this.boostT = Math.max(0, this.boostT - dt);
    }

    // ── Update ──

    protected updateGame(dt: number): void {
        const now = performance.now() / 1000;
        if (this.phase === 'intro') { this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'play'; return; }
        if (this.phase === 'clear') { this.phaseT -= dt; if (this.phaseT <= 0) { this.stage++; if (this.stage >= STAGES.length) this.phase = 'result'; else this.startStage(); } return; }
        if (this.phase !== 'play') return;

        if (now - this.lastCoinT > COMBO_WIN) this.combo = 0;

        // Timer — 0이 되면 스테이지 클리어 (코인 %로 별 등급)
        this.stageTime -= dt;
        if (this.stageTime <= 0) {
            this.stageTime = 0;
            const total = this.coins.length, got = this.coins.filter(c => c.collected).length;
            const pct = total > 0 ? got / total : 0;
            const stars = pct >= 0.7 ? 3 : pct >= 0.4 ? 2 : got > 0 ? 1 : 0;
            this.stageStars.push(stars);
            this.addPop(this.W / 2, this.H / 2, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} TIME UP`, true, 1.8);
            this.phase = 'clear'; this.phaseT = 1.5; return;
        }

        this.updateTraffic(dt);
        this.spawnT -= dt;
        if (this.spawnT <= 0) { this.spawnNpc(); this.spawnT = STAGES[this.stage].rate + Math.random() * 0.5; }
        this.updateNpcs(dt); this.updatePolice(dt); this.updatePlayer(dt); this.checkViolation();
        this.nearMissCd = Math.max(0, this.nearMissCd - dt); this.nmFlash = Math.max(0, this.nmFlash - dt);

        // Coin collection
        for (const coin of this.coins) {
            if (coin.collected) continue;
            if (Math.hypot(coin.x - this.px, coin.y - this.py) < COIN_R + 12) {
                coin.collected = true;
                this.combo = (now - this.lastCoinT < COMBO_WIN) ? this.combo + 1 : 1;
                if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                this.lastCoinT = now;
                let pts = 100 * coin.value * Math.min(this.combo, 8);
                if (this.isDrifting) { pts = Math.round(pts * 1.5); this.addPop(this.px, this.py - 50, 'DRIFT!', true, 0.8); }
                this.score += pts;
                this.addBurst(coin.x, coin.y, coin.danger ? C.yellow : C.cyan, 5, 80);
                this.addPop(coin.x, coin.y - 14, `+${pts}`);
                if (this.combo >= 2) this.addPop(coin.x, coin.y - 36, `×${this.combo}`, true, 1.2);
                if (coin.trail >= 0) { const tr = this.coins.filter(c => c.trail === coin.trail); if (tr.every(c => c.collected)) { const b = tr.length * 150; this.score += b; this.addPop(coin.x, coin.y - 60, `TRAIL ×${tr.length} +${b}`, true, 1.5); } }
            }
        }

        // NPC collision
        if (this.iFrames <= 0) for (const n of this.npcs) { if (Math.hypot(n.x - this.px, n.y - this.py) < HIT_R + n.w * 0.3) { this.hurtPlayer(); break; } }

        // Near-miss
        if (this.nearMissCd <= 0 && this.iFrames <= 0) for (const n of this.npcs) {
            const dist = Math.hypot(n.x - this.px, n.y - this.py);
            if (dist > HIT_R + n.w * 0.3 && dist < NEAR_MAX) {
                const cls = 1 - (dist - HIT_R) / (NEAR_MAX - HIT_R);
                const pts = Math.round(50 + cls * 150);
                this.score += pts; this.addPop(this.px, this.py - 30, `NEAR MISS +${pts}`, false, 0.9);
                this.nearMissCd = 0.5; this.nmFlash = 0.25; break;
            }
        }

        // Pickups
        for (const bp of this.boostPads) if (Math.hypot(bp.x - this.px, bp.y - this.py) < 18) { this.boostT = 2.0; this.addPop(this.px, this.py - 25, 'BOOST!', true, 0.8); }
        for (let i = this.shields.length - 1; i >= 0; i--) if (Math.hypot(this.shields[i].x - this.px, this.shields[i].y - this.py) < 14) { this.shield = true; this.addPop(this.px, this.py - 25, 'SHIELD +1', true, 1.0); this.shields.splice(i, 1); }

        // PERFECT — 전 코인 수집 시 조기 클리어 + 타임 보너스
        if (!this.coins.some(c => !c.collected)) {
            this.stageStars.push(3);
            const tb = Math.round(this.stageTime * 50);
            this.score += 500 + tb;
            this.addPop(this.W / 2, this.H / 2 - 20, `★★★ PERFECT! +${500 + tb}`, true, 2.0);
            this.phase = 'clear'; this.phaseT = 1.8;
        }

        this.shX *= 0.85; this.shY *= 0.85;
        let ti = this.trails.length; while (ti-- > 0) { this.trails[ti].a -= dt * (this.trails[ti].thick ? 0.8 : 1.5); if (this.trails[ti].a <= 0) { this.trails[ti] = this.trails[this.trails.length - 1]; this.trails.pop(); } }
        let pi = this.pulses.length; while (pi-- > 0) { this.pulses[pi].t += dt; if (this.pulses[pi].t > 0.5) { this.pulses[pi] = this.pulses[this.pulses.length - 1]; this.pulses.pop(); } }
        this.updatePts(dt); this.updatePops(dt);
    }

    // ── Render ──

    protected renderGame(now: number): void {
        const { cx, W, H, vx, hy } = this; const hw = ROAD_W / 2;
        const curSpd = Math.hypot(this.pvx, this.pvy);

        cx.save(); cx.translate(this.shX, this.shY);
        this.drawBg(); this.drawGrid();

        // Roads
        cx.fillStyle = rgba(C.accent, 0.025);
        for (const x of vx) cx.fillRect(x - hw, 0, ROAD_W, H);
        for (const y of hy) cx.fillRect(0, y - hw, W, ROAD_W);
        cx.setLineDash([8, 12]); cx.strokeStyle = rgba(C.accent, 0.06); cx.lineWidth = 1;
        for (const x of vx) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
        for (const y of hy) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
        cx.setLineDash([]);

        // Buildings (도로 사이 블록 — 동적 계산)
        const xs: number[] = [0]; for (const x of vx) { xs.push(x - hw); xs.push(x + hw); } xs.push(W);
        const ys: number[] = [0]; for (const y of hy) { ys.push(y - hw); ys.push(y + hw); } ys.push(H);
        const bColors = [C.purple,C.accent,C.pink,C.yellow,C.cyan,C.blue,C.pink,C.yellow,C.purple,C.accent,C.cyan,C.pink];
        let bi = 0;
        for (let ri = 0; ri < ys.length - 1; ri += 2) for (let ci = 0; ci < xs.length - 1; ci += 2) {
            const bx2 = xs[ci]+3, by2 = ys[ri]+3, bw2 = xs[ci+1]-xs[ci]-6, bh2 = ys[ri+1]-ys[ri]-6;
            if (bw2 < 10 || bh2 < 10) { bi++; continue; }
            const bc = bColors[bi % bColors.length];
            cx.fillStyle = rgba(bc, 0.015); cx.fillRect(bx2, by2, bw2, bh2);
            cx.strokeStyle = rgba(bc, 0.06); cx.lineWidth = 1; cx.strokeRect(bx2, by2, bw2, bh2);
            if (bw2 > 30 && bh2 > 30) for (let wi = 0; wi < Math.min(4, Math.floor(bw2/20)); wi++) for (let wj = 0; wj < Math.min(3, Math.floor(bh2/20)); wj++) {
                cx.fillStyle = rgba(bc, 0.04 + Math.sin(now*2+wi+wj+bi)*0.02);
                cx.fillRect(bx2+6+wi*(bw2-14)/Math.max(1,Math.floor(bw2/20)-1), by2+6+wj*(bh2-14)/Math.max(1,Math.floor(bh2/20)-1), 4, 4);
            }
            bi++;
        }

        // Signal pulses
        for (const p of this.pulses) { const pr = p.t/0.5; cx.beginPath(); cx.arc(p.x, p.y, ROAD_W*(1+pr*3), 0, Math.PI*2); cx.strokeStyle = rgba(p.col, 0.3*(1-pr)); cx.lineWidth = 2; cx.stroke(); }

        // Traffic lights (4면 방향별 — 건너편 신호를 보는 구조)
        for (const ix of vx) for (const iy of hy) {
            const vS = this.sig('v'), hS = this.sig('h');
            const vCol = this.sigCol(vS), hCol = this.sigCol(hS);
            cx.fillStyle = rgba(this.sigCol(this.tfCol), 0.015); // active 신호 색상 반영 (yellow 포함)
            cx.fillRect(ix-hw, iy-hw, ROAD_W, ROAD_W);
            // NS 방향 신호 (교차로 위/아래에 배치 — 남행/북행 운전자가 봄)
            const drawSig = (sx: number, sy: number, col: string, glow: boolean) => {
                if (glow) { cx.beginPath(); cx.arc(sx, sy, 9, 0, Math.PI*2); cx.fillStyle = rgba(col, 0.08); cx.fill(); }
                cx.beginPath(); cx.arc(sx, sy, 4.5, 0, Math.PI*2); cx.fillStyle = rgba(col, 0.75); cx.fill();
                cx.strokeStyle = rgba(col, 0.3); cx.lineWidth = 1; cx.stroke();
            };
            drawSig(ix, iy - hw - 8, vCol, vS === 'green');  // 위 (남행 차량용)
            drawSig(ix, iy + hw + 8, vCol, vS === 'green');  // 아래 (북행 차량용)
            drawSig(ix - hw - 8, iy, hCol, hS === 'green');  // 왼쪽 (동행 차량용)
            drawSig(ix + hw + 8, iy, hCol, hS === 'green');  // 오른쪽 (서행 차량용)
            // 적색 신호 시 우회전 허용 화살표 (작은 초록 ↱)
            if (vS === 'red') {
                cx.font = '7px "JetBrains Mono"'; cx.fillStyle = rgba(C.accent, 0.4); cx.textAlign = 'center';
                cx.fillText('↱', ix + 8, iy - hw - 4);  // 남행 우회전
                cx.fillText('↱', ix - 8, iy + hw + 12); // 북행 우회전
            }
            if (hS === 'red') {
                cx.font = '7px "JetBrains Mono"'; cx.fillStyle = rgba(C.accent, 0.4); cx.textAlign = 'center';
                cx.fillText('↱', ix - hw - 4, iy + 10);  // 동행 우회전
                cx.fillText('↱', ix + hw + 12, iy - 3);  // 서행 우회전
            }
        }

        // Boost pads
        for (const bp of this.boostPads) {
            const pulse = 0.4+Math.sin(now*4)*0.2;
            cx.save(); cx.translate(bp.x, bp.y); if (bp.dir === 'v') cx.rotate(Math.PI/2);
            for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(-12+i*10, -8); cx.lineTo(-6+i*10, 0); cx.lineTo(-12+i*10, 8); cx.strokeStyle = rgba(C.accent, pulse-i*0.1); cx.lineWidth = 2; cx.stroke(); }
            cx.restore();
        }

        // Shield
        for (const sh of this.shields) {
            cx.save(); cx.translate(sh.x, sh.y); cx.rotate(now*2);
            cx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2; cx[i===0?'moveTo':'lineTo'](Math.cos(a)*10, Math.sin(a)*10); }
            cx.closePath(); cx.strokeStyle = rgba(C.blue, 0.6); cx.lineWidth = 2; cx.stroke(); cx.fillStyle = rgba(C.blue, 0.1); cx.fill(); cx.restore();
        }

        // Coin trail lines
        const tIds = new Set(this.coins.filter(c => c.trail >= 0 && !c.collected).map(c => c.trail));
        for (const tid of tIds) { const tc = this.coins.filter(c => c.trail === tid && !c.collected); if (tc.length < 2) continue; cx.beginPath(); cx.moveTo(tc[0].x, tc[0].y); for (let i = 1; i < tc.length; i++) cx.lineTo(tc[i].x, tc[i].y); cx.strokeStyle = rgba(C.cyan, 0.08); cx.lineWidth = 1; cx.stroke(); }

        // Coins
        for (const coin of this.coins) {
            if (coin.collected) continue;
            const bob = Math.sin(now*3+coin.x*0.1+coin.y*0.1)*2;
            const col = coin.danger ? C.yellow : C.cyan;
            const s = coin.danger ? COIN_R*1.4 : COIN_R;
            if (coin.danger) { cx.beginPath(); cx.arc(coin.x, coin.y+bob, s*2.5, 0, Math.PI*2); cx.fillStyle = rgba(C.yellow, 0.04+Math.sin(now*4)*0.02); cx.fill(); }
            cx.beginPath(); cx.arc(coin.x, coin.y+bob, s*1.8, 0, Math.PI*2); cx.fillStyle = rgba(col, 0.06); cx.fill();
            cx.beginPath(); cx.moveTo(coin.x, coin.y+bob-s); cx.lineTo(coin.x+s*0.7, coin.y+bob); cx.lineTo(coin.x, coin.y+bob+s); cx.lineTo(coin.x-s*0.7, coin.y+bob); cx.closePath(); cx.fillStyle = rgba(col, 0.7); cx.fill();
            if (coin.danger) { cx.font = '8px "JetBrains Mono"'; cx.fillStyle = rgba(C.yellow, 0.5); cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillText('×3', coin.x, coin.y+bob+s+10); }
        }

        // NPC cars
        for (const n of this.npcs) {
            const angle = n.dir==='s'?Math.PI/2:n.dir==='n'?-Math.PI/2:n.dir==='e'?0:Math.PI;
            cx.save(); cx.translate(n.x, n.y); cx.rotate(angle);
            cx.fillStyle = rgba(n.color, 0.2); cx.fillRect(-n.l/2, -n.w/2, n.l, n.w);
            cx.strokeStyle = rgba(n.color, 0.5); cx.lineWidth = 1.5; cx.strokeRect(-n.l/2, -n.w/2, n.l, n.w);
            cx.fillStyle = rgba(n.color, 0.8); cx.fillRect(n.l/2-3, -n.w/2+2, 3, 3); cx.fillRect(n.l/2-3, n.w/2-5, 3, 3);
            if (n.sym) { cx.font = `${Math.round(n.w*0.6)}px "JetBrains Mono"`; cx.fillStyle = rgba(n.color, 0.6); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(n.sym, 0, 0); }
            cx.restore();
        }

        // Police
        for (const p of this.police) {
            const col = Math.sin(p.flash*15) > 0 ? C.red : C.blue;
            cx.beginPath(); cx.arc(p.x, p.y, 12, 0, Math.PI*2); cx.fillStyle = rgba(col, 0.15); cx.fill();
            cx.strokeStyle = rgba(col, 0.6); cx.lineWidth = 2; cx.stroke();
            cx.beginPath(); cx.arc(p.x, p.y, 20, 0, Math.PI*2); cx.fillStyle = rgba(col, 0.04); cx.fill();
        }

        // Trails
        for (const t of this.trails) { cx.beginPath(); cx.arc(t.x, t.y, t.thick?3:1.5, 0, Math.PI*2); cx.fillStyle = rgba(t.thick?C.yellow:C.accent, t.a*(t.thick?0.4:0.25)); cx.fill(); }

        // Player
        const blink = this.iFrames > 0 && Math.sin(now*25) > 0;
        if (!blink) {
            cx.save(); cx.translate(this.px, this.py); cx.rotate(this.pDir);
            // Headlight cone
            const hlL = 30+curSpd*0.2, hlW = 12+curSpd*0.05;
            cx.beginPath(); cx.moveTo(12, 0); cx.lineTo(12+hlL, -hlW); cx.lineTo(12+hlL, hlW); cx.closePath();
            cx.fillStyle = rgba(C.accent, 0.025+curSpd*0.0003); cx.fill();
            const ac = this.boostT > 0 ? C.yellow : this.shield ? C.blue : C.accent;
            cx.fillStyle = rgba(ac, 0.2); cx.fillRect(-11, -7, 22, 14);
            cx.strokeStyle = rgba(ac, 0.65); cx.lineWidth = 1.5; cx.strokeRect(-11, -7, 22, 14);
            cx.fillStyle = ac; cx.fillRect(9, -5, 3, 3); cx.fillRect(9, 2, 3, 3);
            if (this.isDrifting) { cx.beginPath(); cx.ellipse(0, 0, 18, 10, 0, 0, Math.PI*2); cx.fillStyle = rgba(C.yellow, 0.06); cx.fill(); }
            cx.restore();
        }
        if (this.shield && !blink) { cx.beginPath(); cx.arc(this.px, this.py, 16, 0, Math.PI*2); cx.strokeStyle = rgba(C.blue, 0.25+Math.sin(now*4)*0.1); cx.lineWidth = 1.5; cx.stroke(); }

        // Off-screen warnings
        for (const n of this.npcs) {
            if (n.x >= -10 && n.x <= W+10 && n.y >= -10 && n.y <= H+10) continue;
            const dist = Math.max(n.x<0?-n.x:n.x>W?n.x-W:0, n.y<0?-n.y:n.y>H?n.y-H:0);
            if (dist > 80) continue;
            const ex = Math.max(18, Math.min(W-18, n.x)), ey = Math.max(18, Math.min(H-18, n.y));
            const alpha = 0.4*(1-dist/80);
            cx.beginPath(); cx.arc(ex, ey, 6, 0, Math.PI*2); cx.fillStyle = rgba(n.color, alpha); cx.fill();
        }

        // Near-miss flash
        if (this.nmFlash > 0) { const a = this.nmFlash/0.25*0.08; cx.fillStyle = rgba(C.accent, a); cx.fillRect(0,0,3,H); cx.fillRect(W-3,0,3,H); cx.fillRect(0,0,W,3); cx.fillRect(0,H-3,W,3); }

        this.renderPts(); this.renderPops();

        // HUD
        this.drawHudTitle(); this.drawHudLine(`SCORE  ${this.score}`, 46);
        const rem = this.coins.filter(c => !c.collected).length;
        this.drawHudLine(`STAGE ${this.stage+1}/${STAGES.length}  ◇ ${rem}`, 62, '#3a3a44');

        // Timer (result/dead phase에서는 마지막 스테이지 기준)
        const stg = STAGES[Math.min(this.stage, STAGES.length - 1)];
        const tPct = stg ? this.stageTime / stg.time : 0;
        const tCol = tPct > 0.5 ? C.accent : tPct > 0.2 ? C.yellow : C.red;
        const tFlash = this.stageTime < 5 && Math.sin(now*8) > 0;
        cx.textAlign = 'center'; cx.font = '600 16px "JetBrains Mono"';
        cx.fillStyle = tFlash ? rgba(C.red, 0.9) : rgba(tCol, 0.7);
        cx.fillText(`${Math.ceil(this.stageTime)}s`, W/2, 28);
        cx.fillStyle = rgba(tCol, 0.08); cx.fillRect(W*0.35, 36, W*0.3, 3);
        cx.fillStyle = rgba(tCol, 0.35); cx.fillRect(W*0.35, 36, W*0.3*tPct, 3);

        // HP + status
        cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono"'; cx.fillStyle = '#5a5a66'; cx.fillText('HP', W-20, 28);
        for (let i = 0; i < 3; i++) { cx.font = '12px monospace'; cx.fillStyle = i < this.hp ? C.accent : '#1a1a1f'; cx.fillText('♥', W-18-i*16, 44); }
        cx.font = '500 8px "JetBrains Mono"';
        if (this.boostT > 0) { cx.fillStyle = C.yellow; cx.fillText('BOOST', W-20, 62); }
        else if (this.shield) { cx.fillStyle = C.blue; cx.fillText('SHIELD', W-20, 62); }
        this.drawComboHud(this.combo, now, W/2, 54);

        cx.restore();
        this.drawCloseBtn();

        // Overlays
        if (this.phase === 'intro') {
            const s = STAGES[this.stage];
            this.drawIntro(this.phaseT, `STAGE ${this.stage+1}`, `${s.time}s · ${this.coins.length} COINS`, this.mob ? '터치 드리프트 · 신호위반 주의' : 'WASD 드리프트 · 신호위반 주의');
        }
        if (this.phase === 'clear') {
            const fade = Math.min(1, (1.8-this.phaseT)/0.5);
            cx.fillStyle = rgba(C.bg, 0.4*fade); cx.fillRect(0,0,W,H);
            cx.textAlign = 'center'; cx.globalAlpha = fade; cx.font = '700 22px "JetBrains Mono"'; cx.fillStyle = C.accent;
            const s = this.stageStars[this.stageStars.length-1];
            cx.fillText(`${'★'.repeat(s)}${'☆'.repeat(3-s)} CLEAR!`, W/2, H/2);
            cx.globalAlpha = 1;
        }
        if (this.phase === 'result' || this.phase === 'dead') this.renderResult();
    }

    private renderResult(): void {
        const isWin = this.phase === 'result';
        const { bx, by } = this.drawResultBg(isWin ? 'ALL CLEAR' : 'CRASHED', isWin ? C.accent : C.red);
        const { cx } = this;
        cx.font = '700 36px "JetBrains Mono"'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${this.score}`, bx, by-16);
        cx.font = '400 10px "JetBrains Mono"'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', bx, by+4);
        this.stageStars.forEach((s, i) => { cx.fillStyle = '#5a5a66'; cx.fillText(`Stage ${i+1}: ${'★'.repeat(s)}${'☆'.repeat(3-s)}`, bx, by+22+i*16); });
        cx.fillText(`MAX COMBO ×${this.maxCombo}`, bx, by+22+this.stageStars.length*16+4);
        this.drawResultBtns(bx, by+22+this.stageStars.length*16+28);
    }
    private get rBtnY() { return this.H/2+22+this.stageStars.length*16+28; }

    // ── Input ──

    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result' || this.phase === 'dead') { const h = this.hitResultBtn(x, y, this.W/2, this.rBtnY); if (h === 'retry') this.resetGame(); if (h === 'exit') this.stop(); return; }
        if (this.phase === 'play' && this.mob) { const dx = x-this.px, dy = y-this.py, len = Math.hypot(dx, dy); if (len > 20) this.touchDir = { x: dx/len, y: dy/len }; }
    }
    protected onTouchMoveAt(x: number, y: number): void {
        if (this.phase !== 'play') return;
        const dx = x-this.px, dy = y-this.py, len = Math.hypot(dx, dy);
        if (len > 20) this.touchDir = { x: dx/len, y: dy/len }; else this.touchDir = { x: 0, y: 0 };
    }
    protected onTouchEndAt(): void { this.touchDir = { x: 0, y: 0 }; }
}

export function createNomadsGame(container: HTMLElement, onExit: () => void) {
    const game = new NomadsGame(container, onExit);
    return { start: () => game.start(), stop: () => game.stop() };
}