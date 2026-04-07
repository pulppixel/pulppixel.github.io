// Nomads Planet: Bumper-car arena
// Collect coins, ram opponents to steal theirs, survive 3 stages.
// 5 NPCs with simple BT, drift physics, boost power-up, scoreboard.
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

// =============================================
// Constants
// =============================================

const ACCEL = 520;
const MAX_SPD = 180;
const BOOST_MULT = 1.7;
const FRICTION = 3.6;
const TURN_SPD = 7.5;

const HIT_R = 16;
const COIN_R = 7;
const CAR_W = 22, CAR_H = 14;
const RAM_COOLDOWN = 0.6;
const STUN_DUR = 1.0;
const INVUL_AFTER_STUN = 0.6;

const DROP_PCT = 0.35;        // 흩뿌리는 코인 비율
const DROPPED_LIFE = 5.0;
const DROP_SCATTER = 50;

const BOOST_DUR = 4.0;
const BOOST_SPAWN = 12.0;     // 부스트 패드 재생성 간격

const HP_MAX = 5;
const HP_NPC = 7;
const NPC_COUNT = 5;

const STAGES = [
    { time: 40, coinCount: 14, npcAggression: 0.4, coinRespawn: 1.5 },
    { time: 50, coinCount: 16, npcAggression: 0.65, coinRespawn: 1.2 },
    { time: 60, coinCount: 18, npcAggression: 0.9, coinRespawn: 0.9 },
];

const NPC_NAMES = ['ROVER', 'BLITZ', 'NOVA', 'GRIM', 'ZEPH'];
const NPC_COLORS = [C.pink, C.purple, C.cyan, C.yellow, C.blue];

// =============================================
// Types
// =============================================

interface Car {
    id: number;            // 0 = player, 1+ = NPC
    name: string;
    color: string;
    x: number; y: number;
    vx: number; vy: number;
    dir: number;           // facing
    coins: number;
    hp: number;
    stunT: number;         // 스턴 남은 시간
    invulT: number;        // 무적 (스턴 직후 + 부스트 중)
    ramCd: number;         // 다음 공격까지 쿨다운
    boostT: number;
    isPlayer: boolean;
    eliminated: boolean;
    // BT state (NPC only)
    btTarget: { type: 'coin' | 'dropped' | 'car' | 'boost' | 'wander'; x: number; y: number; targetId?: number } | null;
    btDecideCd: number;    // 다음 결정까지 (반응 딜레이)
    btDumbness: number;    // 0~1: 높을수록 바보
}

interface Coin {
    x: number; y: number;
    collected: boolean;
    dropped: boolean;
    dropLife: number;      // dropped일 때만 사용
}

interface BoostPad {
    x: number; y: number;
    active: boolean;
    respawnT: number;
}

interface Trail { x: number; y: number; a: number; thick: boolean; color: string; }
interface SparkBurst { x: number; y: number; t: number; }

type Phase = 'intro' | 'play' | 'clear' | 'result' | 'dead';

// =============================================
// Game
// =============================================

class NomadsGame extends MinigameBase {
    protected readonly title = 'NOMADS — BUMPER';
    protected readonly titleColor = C.yellow;

    private cars: Car[] = [];
    private coins: Coin[] = [];
    private boostPads: BoostPad[] = [];
    private trails: Trail[] = [];
    private sparks: SparkBurst[] = [];

    private phase: Phase = 'intro';
    private phaseT = 0;
    private stage = 0;
    private stageTime = 0;
    private spawnCoinT = 0;

    private score = 0;
    private maxRank = 99;
    private shX = 0; private shY = 0;
    private lbStarted = false;

    // --- Lifecycle ---

    protected resetGame(): void {
        this.setupMobileControls({ joystick: true });
        this.lbStarted = false;
        this.lbStatus = 'idle';
        this.lbScores = [];
        this.lbNewId = null;
        this.stage = 0;
        this.score = 0;
        this.maxRank = 99;
        this.startStage();
    }

    protected onResized(): void { /* arena uses W/H directly */ }

    private startStage(): void {
        const s = STAGES[this.stage];
        this.cars = [];
        this.coins = [];
        this.boostPads = [];
        this.trails = [];
        this.sparks = [];
        this.pts = []; this.pops = [];

        // Player
        this.cars.push({
            id: 0, name: 'YOU', color: C.accent,
            x: this.W / 2, y: this.H / 2,
            vx: 0, vy: 0, dir: 0,
            coins: 0, hp: HP_MAX,
            stunT: 0, invulT: 0, ramCd: 0, boostT: 0,
            isPlayer: true, eliminated: false,
            btTarget: null, btDecideCd: 0, btDumbness: 0,
        });

        // NPCs
        for (let i = 0; i < NPC_COUNT; i++) {
            const angle = (i / NPC_COUNT) * Math.PI * 2;
            const r = Math.min(this.W, this.H) * 0.35;
            this.cars.push({
                id: i + 1,
                name: NPC_NAMES[i],
                color: NPC_COLORS[i],
                x: this.W / 2 + Math.cos(angle) * r,
                y: this.H / 2 + Math.sin(angle) * r,
                vx: 0, vy: 0,
                dir: angle + Math.PI,
                coins: 0, hp: HP_NPC,
                stunT: 0, invulT: 0, ramCd: 0, boostT: 0,
                isPlayer: false, eliminated: false,
                btTarget: null, btDecideCd: Math.random() * 0.5,
                btDumbness: 0.4 - s.npcAggression * 0.25 + Math.random() * 0.2,
            });
        }

        // Initial coins
        for (let i = 0; i < s.coinCount; i++) {
            this.spawnCoin();
        }

        // Boost pads (2개)
        for (let i = 0; i < 2; i++) {
            this.boostPads.push({
                x: this.W * (0.3 + i * 0.4),
                y: this.H * (0.3 + (i % 2) * 0.4),
                active: true,
                respawnT: 0,
            });
        }

        this.stageTime = s.time;
        this.spawnCoinT = s.coinRespawn;
        this.phase = 'intro';
        this.phaseT = 1.4;
    }

    private spawnCoin(): void {
        for (let tries = 0; tries < 20; tries++) {
            const x = 50 + Math.random() * (this.W - 100);
            const y = 50 + Math.random() * (this.H - 100);
            // 차 너무 가까이 안 됨
            let ok = true;
            for (const c of this.cars) {
                if (Math.hypot(c.x - x, c.y - y) < 60) { ok = false; break; }
            }
            if (ok) {
                this.coins.push({ x, y, collected: false, dropped: false, dropLife: 0 });
                return;
            }
        }
    }

    // =============================================
    // BT (NPC AI)
    // =============================================

    private btTick(npc: Car, dt: number): void {
        npc.btDecideCd -= dt;
        if (npc.btDecideCd > 0 && npc.btTarget) return;
        npc.btDecideCd = 0.3 + Math.random() * 0.4;

        // 1. 위기 회피: 부스트 받은 적이 가까운가?
        for (const c of this.cars) {
            if (c.id === npc.id || c.eliminated) continue;
            if (c.boostT > 0) {
                const d = Math.hypot(c.x - npc.x, c.y - npc.y);
                if (d < 120) {
                    // 반대 방향으로 도망
                    const ang = Math.atan2(npc.y - c.y, npc.x - c.x);
                    npc.btTarget = {
                        type: 'wander',
                        x: npc.x + Math.cos(ang) * 200,
                        y: npc.y + Math.sin(ang) * 200,
                    };
                    return;
                }
            }
        }

        // Dumbness check — 가끔 결정 무시
        if (Math.random() < npc.btDumbness * 0.4) {
            npc.btTarget = {
                type: 'wander',
                x: 60 + Math.random() * (this.W - 120),
                y: 60 + Math.random() * (this.H - 120),
            };
            return;
        }

        // 2. 떨어진 코인 — 가까우면 우선
        let nearestDropped: Coin | null = null;
        let dDrop = 200;
        for (const c of this.coins) {
            if (!c.dropped || c.collected) continue;
            const d = Math.hypot(c.x - npc.x, c.y - npc.y);
            if (d < dDrop) { dDrop = d; nearestDropped = c; }
        }
        if (nearestDropped) {
            npc.btTarget = { type: 'dropped', x: nearestDropped.x, y: nearestDropped.y };
            return;
        }

        // 3. 부스트 패드 (낮은 확률, 똑똑한 NPC만)
        if (Math.random() < (1 - npc.btDumbness) * 0.3) {
            for (const bp of this.boostPads) {
                if (!bp.active) continue;
                const d = Math.hypot(bp.x - npc.x, bp.y - npc.y);
                if (d < 180) {
                    npc.btTarget = { type: 'boost', x: bp.x, y: bp.y };
                    return;
                }
            }
        }

        // 4. 약한 적 공격 (코인 많은 차 + 플레이어 가중치)
        if (Math.random() < 0.6 + (1 - npc.btDumbness) * 0.3) {
            let target: Car | null = null;
            let bestScore = 0;
            for (const c of this.cars) {
                if (c.id === npc.id || c.eliminated || c.boostT > 0) continue;
                if (c.invulT > 0) continue;
                const d = Math.hypot(c.x - npc.x, c.y - npc.y);
                if (d > 280) continue;
                // 코인 + 거리 + 플레이어 보너스
                let sc = c.coins * 2 - d * 0.02;
                if (c.isPlayer) sc += 15; // 플레이어 우선
                if (sc > bestScore) { bestScore = sc; target = c; }
            }
            if (target) {
                npc.btTarget = { type: 'car', x: target.x, y: target.y, targetId: target.id };
                return;
            }
        }

        // 5. 일반 코인
        let nearestCoin: Coin | null = null;
        let dCoin = Infinity;
        for (const c of this.coins) {
            if (c.collected || c.dropped) continue;
            const d = Math.hypot(c.x - npc.x, c.y - npc.y);
            if (d < dCoin) { dCoin = d; nearestCoin = c; }
        }
        if (nearestCoin) {
            npc.btTarget = { type: 'coin', x: nearestCoin.x, y: nearestCoin.y };
            return;
        }

        // 6. Wander
        npc.btTarget = {
            type: 'wander',
            x: 60 + Math.random() * (this.W - 120),
            y: 60 + Math.random() * (this.H - 120),
        };
    }

    // =============================================
    // Update
    // =============================================

    private updatePlayer(dt: number): void {
        const p = this.cars[0];
        if (p.eliminated) return;

        if (p.stunT > 0) {
            p.stunT -= dt;
            p.vx *= 0.85; p.vy *= 0.85;
            return;
        }

        let mx = 0, my = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        if (mx === 0 && my === 0 && (this.mJoy.x || this.mJoy.y)) { mx = this.mJoy.x; my = this.mJoy.y; }

        if (mx !== 0 || my !== 0) {
            const len = Math.hypot(mx, my);
            p.vx += (mx / len) * ACCEL * dt;
            p.vy += (my / len) * ACCEL * dt;
            const tDir = Math.atan2(my, mx);
            let df = tDir - p.dir;
            while (df > Math.PI) df -= Math.PI * 2;
            while (df < -Math.PI) df += Math.PI * 2;
            p.dir += df * TURN_SPD * dt;
        }
    }

    private updateNPC(npc: Car, dt: number): void {
        if (npc.eliminated) return;
        if (npc.stunT > 0) {
            npc.stunT -= dt;
            npc.vx *= 0.85; npc.vy *= 0.85;
            return;
        }

        this.btTick(npc, dt);

        if (!npc.btTarget) return;

        // Target이 사라진 경우 (코인 누가 먹음 등)
        if (npc.btTarget.type === 'coin' || npc.btTarget.type === 'dropped') {
            const stillThere = this.coins.some(c =>
                !c.collected && Math.abs(c.x - npc.btTarget!.x) < 1 && Math.abs(c.y - npc.btTarget!.y) < 1,
            );
            if (!stillThere) { npc.btTarget = null; npc.btDecideCd = 0; return; }
        }
        if (npc.btTarget.type === 'car' && npc.btTarget.targetId !== undefined) {
            const tgt = this.cars[npc.btTarget.targetId];
            if (!tgt || tgt.eliminated || tgt.boostT > 0) {
                npc.btTarget = null; npc.btDecideCd = 0; return;
            }
            // Update target position (추격)
            npc.btTarget.x = tgt.x;
            npc.btTarget.y = tgt.y;
        }

        const dx = npc.btTarget.x - npc.x;
        const dy = npc.btTarget.y - npc.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) { npc.btTarget = null; npc.btDecideCd = 0; return; }

        const ang = Math.atan2(dy, dx);
        npc.vx += Math.cos(ang) * ACCEL * 0.85 * dt;
        npc.vy += Math.sin(ang) * ACCEL * 0.85 * dt;
        let df = ang - npc.dir;
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        npc.dir += df * TURN_SPD * 0.7 * dt;
    }

    private moveCar(c: Car, dt: number): void {
        if (c.eliminated) return;

        c.invulT = Math.max(0, c.invulT - dt);
        c.ramCd = Math.max(0, c.ramCd - dt);
        c.boostT = Math.max(0, c.boostT - dt);

        // Friction
        const spd = Math.hypot(c.vx, c.vy);
        if (spd > 0.5) { const f = Math.max(0, 1 - FRICTION * dt); c.vx *= f; c.vy *= f; }
        else { c.vx = 0; c.vy = 0; }

        // Speed cap
        const maxSpd = c.boostT > 0 ? MAX_SPD * BOOST_MULT : MAX_SPD;
        const cur = Math.hypot(c.vx, c.vy);
        if (cur > maxSpd) { c.vx *= maxSpd / cur; c.vy *= maxSpd / cur; }

        c.x += c.vx * dt;
        c.y += c.vy * dt;

        // Wall bounce
        const m = 18;
        if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx) * 0.5; }
        if (c.x > this.W - m) { c.x = this.W - m; c.vx = -Math.abs(c.vx) * 0.5; }
        if (c.y < m) { c.y = m; c.vy = Math.abs(c.vy) * 0.5; }
        if (c.y > this.H - m) { c.y = this.H - m; c.vy = -Math.abs(c.vy) * 0.5; }

        // Trail
        if (cur > 30) {
            this.trails.push({ x: c.x, y: c.y, a: 0.4, thick: c.boostT > 0, color: c.color });
        }
    }

    private separateCars(a: Car, b: Car, dist: number): void {
        // 겹친 만큼 서로 밀어냄 (통과 방지)
        const minDist = HIT_R * 2;
        if (dist >= minDist) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = dist < 0.01 ? 0.01 : dist;
        const overlap = (minDist - d) * 0.5 + 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
    }

    private checkRams(): void {
        for (let i = 0; i < this.cars.length; i++) {
            const a = this.cars[i];
            if (a.eliminated) continue;
            for (let j = i + 1; j < this.cars.length; j++) {
                const b = this.cars[j];
                if (b.eliminated) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.hypot(dx, dy);
                if (d > HIT_R * 2) continue;

                // 항상 분리 (통과 방지) — ramCd, stun, invul 무관
                this.separateCars(a, b, d);

                // 판정/데미지는 쿨다운 체크
                if (a.ramCd > 0 || b.ramCd > 0) continue;
                if (a.stunT > 0 && b.stunT > 0) continue;

                // Closing speed: 서로 다가오는 속도 성분
                const nx = dx / (d < 0.01 ? 0.01 : d);
                const ny = dy / (d < 0.01 ? 0.01 : d);
                const relVx = b.vx - a.vx;
                const relVy = b.vy - a.vy;
                const closing = -(relVx * nx + relVy * ny); // 양수면 다가오는 중

                if (closing < 30) {
                    // 거의 안 부딪힘 (스치거나 같이 가는 중) — 살짝 튕기고 끝
                    a.vx -= nx * 40; a.vy -= ny * 40;
                    b.vx += nx * 40; b.vy += ny * 40;
                    a.ramCd = b.ramCd = 0.2;
                    continue;
                }

                const aSpd = Math.hypot(a.vx, a.vy);
                const bSpd = Math.hypot(b.vx, b.vy);

                // 부스트 우선
                if (a.boostT > 0 && b.boostT <= 0) {
                    if (b.invulT <= 0) this.executeRam(a, b);
                    a.ramCd = RAM_COOLDOWN;
                    continue;
                }
                if (b.boostT > 0 && a.boostT <= 0) {
                    if (a.invulT <= 0) this.executeRam(b, a);
                    b.ramCd = RAM_COOLDOWN;
                    continue;
                }

                // 정면충돌 판정: closing speed가 크면 양쪽 다 데미지
                if (closing > 180) {
                    // HEAD-ON: 둘 다 victim
                    const aWasInvul = a.invulT > 0;
                    const bWasInvul = b.invulT > 0;
                    if (!aWasInvul && !bWasInvul) {
                        this.executeMutualRam(a, b);
                        a.ramCd = b.ramCd = RAM_COOLDOWN;
                        continue;
                    }
                }

                // 일반 측면/후면 충돌: 빠른 쪽이 attacker
                let attacker: Car, victim: Car;
                if (aSpd > bSpd + 10) { attacker = a; victim = b; }
                else if (bSpd > aSpd + 10) { attacker = b; victim = a; }
                else {
                    // 비등하면 양쪽 튕김
                    a.vx -= nx * 100; a.vy -= ny * 100;
                    b.vx += nx * 100; b.vy += ny * 100;
                    a.ramCd = b.ramCd = 0.25;
                    continue;
                }

                if (victim.invulT > 0 || victim.boostT > 0) {
                    // victim 보호 상태 — 그냥 튕김
                    a.vx -= nx * 100; a.vy -= ny * 100;
                    b.vx += nx * 100; b.vy += ny * 100;
                    a.ramCd = b.ramCd = 0.25;
                    continue;
                }

                this.executeRam(attacker, victim);
                attacker.ramCd = RAM_COOLDOWN;
            }
        }
    }

    private executeMutualRam(a: Car, b: Car): void {
        // 양쪽 모두 스턴 + HP -1 + 코인 드롭
        this.executeRam(a, b, true);
        this.executeRam(b, a, true);
    }

    private executeRam(attacker: Car, victim: Car, mutual = false): void {
        // NPC끼리 충돌은 데미지 절반 (자살 방지)
        const npcVsNpc = !attacker.isPlayer && !victim.isPlayer;
        const dmg = npcVsNpc ? 0.5 : 1;

        // Stun + HP
        victim.stunT = STUN_DUR;
        victim.invulT = STUN_DUR + INVUL_AFTER_STUN;
        victim.hp -= dmg;

        // 코인 드롭 (NPC끼리도 동일하게 흘리도록)
        const drop = Math.ceil(victim.coins * DROP_PCT);
        if (drop > 0) {
            victim.coins -= drop;
            for (let i = 0; i < drop; i++) {
                const ang = Math.random() * Math.PI * 2;
                const r = 20 + Math.random() * DROP_SCATTER;
                this.coins.push({
                    x: victim.x + Math.cos(ang) * r,
                    y: victim.y + Math.sin(ang) * r,
                    collected: false, dropped: true,
                    dropLife: DROPPED_LIFE,
                });
            }
        }

        // Knockback
        const ang = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
        const force = mutual ? 320 : (attacker.boostT > 0 ? 380 : 260);
        victim.vx += Math.cos(ang) * force;
        victim.vy += Math.sin(ang) * force;
        if (!mutual) {
            attacker.vx -= Math.cos(ang) * 60;
            attacker.vy -= Math.sin(ang) * 60;
        }

        // FX
        this.sparks.push({ x: (attacker.x + victim.x) / 2, y: (attacker.y + victim.y) / 2, t: 0 });
        this.addBurst((attacker.x + victim.x) / 2, (attacker.y + victim.y) / 2, C.yellow, 8, 130);

        if (victim.isPlayer) {
            this.shX = 8 * (Math.random() > 0.5 ? 1 : -1);
            this.shY = 5 * (Math.random() - 0.5);
            this.audio?.mgHurt();
            if (victim.hp <= 0) {
                victim.eliminated = true;
                this.phase = 'dead';
                this.audio?.mgFail();
                this.tryStartLb();
            }
        } else if (attacker.isPlayer && !mutual) {
            this.audio?.mgHit();
            this.score += 50;
            this.addPop(victim.x, victim.y - 25, 'RAM!', false, 0.9);
            if (victim.hp <= 0) {
                victim.eliminated = true;
                this.score += 200;
                this.addPop(victim.x, victim.y - 40, 'KO! +200', true, 1.4);
                this.audio?.mgCombo(3);
            }
        } else {
            if (victim.hp <= 0) victim.eliminated = true;
        }
    }

    private collectCoins(): void {
        for (const car of this.cars) {
            if (car.eliminated || car.stunT > 0) continue;
            for (const coin of this.coins) {
                if (coin.collected) continue;
                if (Math.hypot(car.x - coin.x, car.y - coin.y) < CAR_W * 0.7 + COIN_R) {
                    coin.collected = true;
                    car.coins++;
                    if (car.isPlayer) {
                        this.score += coin.dropped ? 30 : 20;
                        this.audio?.mgCoin(car.coins);
                        this.addBurst(coin.x, coin.y, coin.dropped ? C.yellow : C.cyan, 5, 70);
                    }
                }
            }
        }
    }

    private collectBoost(): void {
        for (const car of this.cars) {
            if (car.eliminated || car.stunT > 0) continue;
            for (const bp of this.boostPads) {
                if (!bp.active) continue;
                if (Math.hypot(car.x - bp.x, car.y - bp.y) < CAR_W * 0.7 + 14) {
                    bp.active = false;
                    bp.respawnT = BOOST_SPAWN;
                    car.boostT = BOOST_DUR;
                    if (car.isPlayer) {
                        this.audio?.mgPickup();
                        this.addPop(car.x, car.y - 28, 'BOOST!', true, 1.0);
                    }
                }
            }
        }
    }

    protected updateGame(dt: number): void {
        if (this.phase === 'intro') {
            this.phaseT -= dt;
            if (this.phaseT <= 0) this.phase = 'play';
            return;
        }
        if (this.phase === 'clear') {
            this.phaseT -= dt;
            if (this.phaseT <= 0) {
                this.stage++;
                if (this.stage >= STAGES.length) { this.phase = 'result'; this.tryStartLb(); }
                else this.startStage();
            }
            return;
        }
        if (this.phase !== 'play') return;

        this.stageTime -= dt;
        if (this.stageTime <= 0) {
            this.stageTime = 0;
            // 보너스: 1등 보너스
            const ranked = [...this.cars].filter(c => !c.eliminated).sort((a, b) => b.coins - a.coins);
            const playerRank = ranked.findIndex(c => c.isPlayer) + 1;
            if (playerRank > 0) {
                if (playerRank < this.maxRank) this.maxRank = playerRank;
                const bonus = playerRank === 1 ? 500 : playerRank === 2 ? 250 : 100;
                this.score += bonus + this.cars[0].coins * 30;
                this.addPop(this.W / 2, this.H / 2, `${playerRank}ST · +${bonus}`, true, 1.8);
            }
            this.audio?.mgWaveClear();
            this.phase = 'clear'; this.phaseT = 1.6;
            return;
        }

        // Coin respawn
        const liveCoins = this.coins.filter(c => !c.collected && !c.dropped).length;
        const target = STAGES[this.stage].coinCount;
        if (liveCoins < target) {
            this.spawnCoinT -= dt;
            if (this.spawnCoinT <= 0) {
                this.spawnCoin();
                this.spawnCoinT = STAGES[this.stage].coinRespawn;
            }
        }

        // Boost pad respawn
        for (const bp of this.boostPads) {
            if (!bp.active) {
                bp.respawnT -= dt;
                if (bp.respawnT <= 0) {
                    bp.active = true;
                    bp.x = 60 + Math.random() * (this.W - 120);
                    bp.y = 60 + Math.random() * (this.H - 120);
                }
            }
        }

        // Update entities
        this.updatePlayer(dt);
        for (let i = 1; i < this.cars.length; i++) this.updateNPC(this.cars[i], dt);
        for (const c of this.cars) this.moveCar(c, dt);
        this.checkRams();
        this.collectCoins();
        this.collectBoost();

        // Dropped coin lifetime + collected cleanup
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const c = this.coins[i];
            if (c.dropped) {
                c.dropLife -= dt;
                if (c.dropLife <= 0) c.collected = true;
            }
            if (c.collected) this.coins.splice(i, 1);
        }

        // FX
        this.shX *= 0.84; this.shY *= 0.84;
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].a -= dt * (this.trails[i].thick ? 0.8 : 1.5);
            if (this.trails[i].a <= 0) { this.trails[i] = this.trails[this.trails.length - 1]; this.trails.pop(); }
        }
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            this.sparks[i].t += dt;
            if (this.sparks[i].t > 0.4) { this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop(); }
        }
        this.updatePts(dt);
        this.updatePops(dt);
    }

    // =============================================
    // Render
    // =============================================

    protected renderGame(now: number): void {
        const { cx, W, H } = this;
        cx.save(); cx.translate(this.shX, this.shY);
        this.drawBg();
        this.drawGrid(0.018);

        // Arena border
        cx.strokeStyle = rgba(C.accent, 0.12);
        cx.lineWidth = 2;
        cx.strokeRect(8, 8, W - 16, H - 16);

        // Boost pads
        for (const bp of this.boostPads) {
            if (!bp.active) continue;
            const pulse = 0.5 + Math.sin(now * 5) * 0.25;
            cx.save(); cx.translate(bp.x, bp.y);
            cx.beginPath(); cx.arc(0, 0, 18, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.yellow, 0.06);
            cx.fill();
            cx.strokeStyle = rgba(C.yellow, pulse);
            cx.lineWidth = 1.5; cx.stroke();
            for (let i = 0; i < 3; i++) {
                cx.beginPath();
                cx.moveTo(-8 + i * 6, -6);
                cx.lineTo(-2 + i * 6, 0);
                cx.lineTo(-8 + i * 6, 6);
                cx.strokeStyle = rgba(C.yellow, pulse - i * 0.15);
                cx.lineWidth = 2; cx.stroke();
            }
            cx.restore();
        }

        // Trails
        for (const t of this.trails) {
            cx.beginPath();
            cx.arc(t.x, t.y, t.thick ? 3 : 1.5, 0, Math.PI * 2);
            cx.fillStyle = rgba(t.color, t.a * 0.35);
            cx.fill();
        }

        // Coins
        for (const coin of this.coins) {
            if (coin.collected) continue;
            const bob = Math.sin(now * 3 + coin.x * 0.1) * 2;
            if (coin.dropped) {
                // Dropped: pulse + life fade
                const lifePct = coin.dropLife / DROPPED_LIFE;
                const flash = lifePct < 0.3 && Math.sin(now * 14) > 0;
                if (flash) continue;
                cx.beginPath();
                cx.arc(coin.x, coin.y + bob, COIN_R * 1.6, 0, Math.PI * 2);
                cx.fillStyle = rgba(C.yellow, 0.06 * lifePct);
                cx.fill();
                cx.beginPath();
                cx.moveTo(coin.x, coin.y + bob - COIN_R);
                cx.lineTo(coin.x + COIN_R * 0.7, coin.y + bob);
                cx.lineTo(coin.x, coin.y + bob + COIN_R);
                cx.lineTo(coin.x - COIN_R * 0.7, coin.y + bob);
                cx.closePath();
                cx.fillStyle = rgba(C.yellow, 0.75 * lifePct);
                cx.fill();
            } else {
                cx.beginPath();
                cx.arc(coin.x, coin.y + bob, COIN_R * 1.5, 0, Math.PI * 2);
                cx.fillStyle = rgba(C.cyan, 0.05);
                cx.fill();
                cx.beginPath();
                cx.moveTo(coin.x, coin.y + bob - COIN_R);
                cx.lineTo(coin.x + COIN_R * 0.7, coin.y + bob);
                cx.lineTo(coin.x, coin.y + bob + COIN_R);
                cx.lineTo(coin.x - COIN_R * 0.7, coin.y + bob);
                cx.closePath();
                cx.fillStyle = rgba(C.cyan, 0.7);
                cx.fill();
            }
        }

        // Cars
        for (const car of this.cars) {
            if (car.eliminated) continue;
            const blink = (car.invulT > 0 && Math.sin(now * 25) > 0);
            if (blink) continue;

            cx.save(); cx.translate(car.x, car.y); cx.rotate(car.dir);

            // 플레이어 강조 링 (rotate 전에 그려야 회전 안 됨 → 그냥 여기서 원이라 ok)
            if (car.isPlayer) {
                cx.beginPath();
                cx.arc(0, 0, CAR_W * 0.95, 0, Math.PI * 2);
                cx.strokeStyle = rgba(C.accent, 0.4 + Math.sin(now * 4) * 0.2);
                cx.lineWidth = 2;
                cx.stroke();
            }

            // Boost glow
            if (car.boostT > 0) {
                cx.beginPath();
                cx.ellipse(0, 0, CAR_W * 1.1, CAR_H * 1.4, 0, 0, Math.PI * 2);
                cx.fillStyle = rgba(C.yellow, 0.12 + Math.sin(now * 8) * 0.05);
                cx.fill();
            }

            // Body
            cx.fillStyle = rgba(car.color, 0.22);
            cx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);
            cx.strokeStyle = rgba(car.color, car.isPlayer ? 0.85 : 0.6);
            cx.lineWidth = car.isPlayer ? 2 : 1.5;
            cx.strokeRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);

            // Headlights
            cx.fillStyle = rgba(car.color, 0.9);
            cx.fillRect(CAR_W / 2 - 3, -CAR_H / 2 + 2, 3, 3);
            cx.fillRect(CAR_W / 2 - 3, CAR_H / 2 - 5, 3, 3);

            // Stun stars
            if (car.stunT > 0) {
                cx.rotate(-car.dir);
                cx.font = '10px monospace';
                cx.fillStyle = rgba(C.yellow, 0.8);
                cx.textAlign = 'center';
                const sa = now * 8;
                cx.fillText('★', Math.cos(sa) * 12, -CAR_H - 4 + Math.sin(sa) * 3);
                cx.fillText('★', Math.cos(sa + 2) * 12, -CAR_H - 4 + Math.sin(sa + 2) * 3);
            }
            cx.restore();

            // Coin badge above car
            if (car.coins > 0 && !car.isPlayer) {
                cx.font = '9px "JetBrains Mono"';
                cx.fillStyle = rgba(C.yellow, 0.85);
                cx.textAlign = 'center';
                cx.fillText(`◆${car.coins}`, car.x, car.y - CAR_H - 6);
            }

            // YOU marker (player only)
            if (car.isPlayer) {
                const bob = Math.sin(now * 4) * 2;
                cx.font = '600 9px "JetBrains Mono"';
                cx.fillStyle = C.accent;
                cx.textAlign = 'center';
                cx.fillText('▼ YOU', car.x, car.y - CAR_H - 8 + bob);
                if (car.coins > 0) {
                    cx.fillStyle = rgba(C.yellow, 0.9);
                    cx.fillText(`◆${car.coins}`, car.x, car.y - CAR_H - 20 + bob);
                }
            }
        }

        // Sparks
        for (const sp of this.sparks) {
            const p = sp.t / 0.4;
            cx.beginPath();
            cx.arc(sp.x, sp.y, 8 + p * 18, 0, Math.PI * 2);
            cx.strokeStyle = rgba(C.yellow, (1 - p) * 0.6);
            cx.lineWidth = 2;
            cx.stroke();
        }

        this.renderPts();
        this.renderPops();
        cx.restore();

        // HUD: Title + Score + Stage
        this.drawHudTitle();
        this.drawHudLine(`SCORE  ${this.score}`, 46);
        this.drawHudLine(`STAGE ${this.stage + 1}/${STAGES.length}`, 62, '#3a3a44');

        // Player HP
        cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono"'; cx.fillStyle = '#5a5a66';
        cx.fillText('HP', W - 20, 28);
        const player = this.cars[0];
        for (let i = 0; i < HP_MAX; i++) {
            cx.font = '12px monospace';
            cx.fillStyle = i < player.hp ? C.accent : '#1a1a1f';
            cx.fillText('♥', W - 18 - i * 14, 44);
        }
        if (player.boostT > 0) {
            cx.font = '500 9px "JetBrains Mono"';
            cx.fillStyle = C.yellow;
            cx.fillText(`BOOST ${player.boostT.toFixed(1)}s`, W - 20, 60);
        }

        // Timer
        const tFlash = this.stageTime < 5 && Math.sin(now * 8) > 0;
        const tCol = this.stageTime > 15 ? C.accent : this.stageTime > 5 ? C.yellow : C.red;
        cx.font = '600 16px "JetBrains Mono"';
        cx.fillStyle = tFlash ? rgba(C.red, 0.9) : rgba(tCol, 0.75);
        cx.textAlign = 'center';
        cx.fillText(`${Math.ceil(this.stageTime)}s`, W / 2, 28);

        // Scoreboard (top-center)
        this.renderScoreboard(now);

        this.drawCloseBtn();

        if (this.phase === 'intro') {
            const s = STAGES[this.stage];
            this.drawIntro(this.phaseT, `STAGE ${this.stage + 1}`,
                `${s.time}s · ${NPC_COUNT} OPPONENTS`,
                this.mob ? 'Drag to move · Ram to steal coins' : 'WASD · Ram to steal · Yellow = boost');
        }
        if (this.phase === 'clear') {
            const fade = Math.min(1, (1.6 - this.phaseT) / 0.5);
            cx.fillStyle = rgba(C.bg, 0.5 * fade); cx.fillRect(0, 0, W, H);
            cx.textAlign = 'center'; cx.globalAlpha = fade;
            cx.font = '700 22px "JetBrains Mono"'; cx.fillStyle = C.accent;
            cx.fillText('STAGE CLEAR', W / 2, H / 2);
            cx.globalAlpha = 1;
        }
        if (this.phase === 'result' || this.phase === 'dead') this.renderResult();
    }

    private renderScoreboard(_now: number): void {
        const { cx, W } = this;
        const ranked = [...this.cars].sort((a, b) => {
            if (a.eliminated && !b.eliminated) return 1;
            if (!a.eliminated && b.eliminated) return -1;
            return b.coins - a.coins;
        });
        const x = W / 2 - 65;
        const y = 50;
        const lh = 14;

        cx.fillStyle = rgba(C.bg, 0.55);
        cx.fillRect(x - 8, y - 4, 130, ranked.length * lh + 10);
        cx.strokeStyle = rgba(C.accent, 0.12);
        cx.lineWidth = 1;
        cx.strokeRect(x - 8, y - 4, 130, ranked.length * lh + 10);

        cx.font = '500 9px "JetBrains Mono"';
        cx.textAlign = 'left';
        for (let i = 0; i < ranked.length; i++) {
            const c = ranked[i];
            const yy = y + 8 + i * lh;
            const dim = c.eliminated ? 0.3 : 1;
            cx.fillStyle = rgba(c.color, 0.7 * dim);
            cx.fillText(`${i + 1}`, x, yy);
            cx.fillStyle = rgba(c.isPlayer ? '#ffffff' : '#a8a8b3', 0.85 * dim);
            cx.fillText(c.name, x + 14, yy);
            cx.textAlign = 'right';
            cx.fillStyle = rgba(C.yellow, 0.85 * dim);
            cx.fillText(`◆${c.coins}`, x + 118, yy);
            cx.textAlign = 'left';
            if (c.eliminated) {
                cx.strokeStyle = rgba('#ef4444', 0.4);
                cx.lineWidth = 1;
                cx.beginPath();
                cx.moveTo(x - 2, yy - 3);
                cx.lineTo(x + 120, yy - 3);
                cx.stroke();
            }
        }
    }

    private tryStartLb(): void {
        if (this.lbStarted) return;
        this.lbStarted = true;
        this.startLeaderboard('nomads', this.score, {
            stage: this.stage + 1,
            rank: this.maxRank === 99 ? null : this.maxRank,
            coins: this.cars[0].coins,
        });
    }

    private renderResult(): void {
        const isWin = this.phase === 'result';
        const { bx, by } = this.drawResultBg(isWin ? 'CHAMPION' : 'WRECKED', isWin ? C.accent : C.red);
        const cx = this.cx;
        cx.font = '700 32px "JetBrains Mono"'; cx.fillStyle = '#e8e8ec';
        cx.fillText(`${this.score}`, bx, by - 40);
        cx.font = '400 9px "JetBrains Mono"'; cx.fillStyle = '#5a5a66';
        cx.fillText('POINTS', bx, by - 24);
        const rankStr = this.maxRank === 99 ? 'NO RANK' : `BEST RANK #${this.maxRank}`;
        cx.fillText(`${rankStr} · ◆${this.cars[0].coins}`, bx, by - 8);

        this.drawLeaderboard(bx, by + 100, 280);
        this.drawResultBtns(bx, by + 220);
    }

    private get rBtnY() { return this.H / 2 + 220; }

    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result' || this.phase === 'dead') {
            if (this.isLeaderboardBusy()) return;
            const h = this.hitResultBtn(x, y, this.W / 2, this.rBtnY);
            if (h === 'retry') this.resetGame();
            if (h === 'exit') this.stop();
        }
    }
}

export function createNomadsGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    const game = new NomadsGame(container, onExit, audio);
    return { start: () => game.start(), stop: () => game.stop() };
}