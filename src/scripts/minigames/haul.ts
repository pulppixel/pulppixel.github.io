// HAUL — 1-hit 플랫포머 (Celeste 영감)
// Phase C: Stage 3 + 함정 종류 랜덤화 + 위장 적 떨림 힌트 + 점수 정식화
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

// =============================================
// Constants
// =============================================

const GRAV = 1400;
const MOVE_SPD = 220;
const JUMP_V = -520;
const COYOTE_TIME = 0.08;
const JUMP_BUFFER = 0.10;
const PLAYER_W = 14;
const PLAYER_H = 18;
const CORE_R = 8;
const RESPAWN_FADE = 0.4;
const VIEW_BOTTOM_PAD = 80;

// 트롤 함정
const FALL_DELAY = 0.15;         // 단축: 빨리 지나가도 못 피함
const FALL_RESPAWN = 4.0;
const FAKE_RESPAWN = 4.0;

// 위장 적 떨림
const FAKE_TWITCH_INTERVAL = 3.0;  // 평균 간격
const FAKE_TWITCH_DUR = 0.45;      // 떨림 지속

// 인간 NPC
const HUMAN_W = 14;
const HUMAN_H = 22;
const HUMAN_SPD = 60;

// 점수
const STAGE_CORE_VALUE = [50, 100, 200];   // S1, S2, S3 코어 가치
const TIME_BONUS_BASE = 600;                // 600초 기준
const DEATH_PENALTY = 30;

// =============================================
// Types
// =============================================

interface Plat {
    x: number; y: number; w: number; h: number;
    kind: 'solid' | 'falling' | 'fake';
    trapSlot?: boolean;     // S3 랜덤화 후보
    state?: 'idle' | 'shaking' | 'falling' | 'gone';
    timer?: number;
    fallVy?: number;
    origX?: number; origY?: number;
}

interface Core {
    x: number; y: number;
    collected: boolean;
    tier: number;           // 점수 가중치 (1, 2, 3)
    fake: boolean;
    fakeSlot?: boolean;     // S3 랜덤화 후보
    twitchT: number;        // 떨림 타이머 (다음 떨림까지)
    twitchActive: number;   // 현재 떨림 남은 시간
}

interface ExitZone { x: number; y: number; w: number; h: number; }

interface Human {
    x: number; y: number;
    pL: number; pR: number;
    dir: 1 | -1;
    walkPhase: number;
}

type Phase = 'intro' | 'play' | 'respawn' | 'clear' | 'result' | 'dead';

interface CoreDef {
    x: number; y: number;
    fake?: boolean;        // 고정 가짜
    fakeSlot?: boolean;    // 랜덤 후보 (S3)
}

interface StageDef {
    spawnX: number; spawnY: number;
    plats: Plat[];
    cores: CoreDef[];
    humans: { x: number; y: number; pL: number; pR: number }[];
    exit: ExitZone;
    width: number;
    bottomY: number;
    coreTier: number;       // 이 스테이지 코어 점수 가중치
    randomTraps?: { fallingCount: number; fakeCount: number; fakeCoreCount: number };
}

// =============================================
// Stage 1 — 정직한 튜토리얼
// =============================================

function buildStage1(W: number, H: number): StageDef {
    const groundY = H * 0.78;
    const plats: Plat[] = [
        { x: 0,    y: groundY,       w: 280, h: 20, kind: 'solid' },
        { x: 320,  y: groundY - 50,  w: 100, h: 20, kind: 'solid' },
        { x: 460,  y: groundY - 90,  w: 100, h: 20, kind: 'solid' },
        { x: 600,  y: groundY - 60,  w: 200, h: 20, kind: 'solid' },
        { x: 850,  y: groundY - 130, w: 90,  h: 20, kind: 'solid' },
        { x: 1000, y: groundY - 80,  w: 140, h: 20, kind: 'solid' },
        { x: 1200, y: groundY - 110, w: 100, h: 20, kind: 'solid' },
        { x: 1340, y: groundY,       w: 280, h: 20, kind: 'solid' },
    ];
    const cores: CoreDef[] = [
        { x: 200,  y: groundY - 30  },
        { x: 510,  y: groundY - 120 },
        { x: 700,  y: groundY - 90  },
        { x: 895,  y: groundY - 160 },
        { x: 1250, y: groundY - 140 },
    ];
    return {
        spawnX: 60, spawnY: groundY - 30,
        plats, cores, humans: [],
        exit: { x: 1500, y: groundY - 60, w: 60, h: 60 },
        width: 1620,
        bottomY: H + VIEW_BOTTOM_PAD,
        coreTier: 0,
    };
}

// =============================================
// Stage 2 — 학습용 (디자인된 트롤)
// =============================================

function buildStage2(W: number, H: number): StageDef {
    const groundY = H * 0.78;
    const plats: Plat[] = [
        { x: 0,    y: groundY,       w: 240, h: 20, kind: 'solid' },
        { x: 290,  y: groundY - 30,  w: 70,  h: 20, kind: 'fake' },
        { x: 390,  y: groundY - 60,  w: 90,  h: 20, kind: 'solid' },
        { x: 530,  y: groundY - 80,  w: 80,  h: 20, kind: 'falling' },
        { x: 660,  y: groundY - 100, w: 80,  h: 20, kind: 'falling' },
        { x: 790,  y: groundY - 80,  w: 100, h: 20, kind: 'solid' },
        { x: 940,  y: groundY,       w: 280, h: 20, kind: 'solid' },
        { x: 1270, y: groundY - 70,  w: 70,  h: 20, kind: 'fake' },
        { x: 1370, y: groundY - 100, w: 70,  h: 20, kind: 'solid' },
        { x: 1470, y: groundY - 70,  w: 70,  h: 20, kind: 'fake' },
        { x: 1580, y: groundY,       w: 280, h: 20, kind: 'solid' },
    ];
    const cores: CoreDef[] = [
        { x: 130,  y: groundY - 30  },
        { x: 325,  y: groundY - 60  },
        { x: 435,  y: groundY - 90  },
        { x: 700,  y: groundY - 130 },
        { x: 1405, y: groundY - 130 },
        { x: 1080, y: groundY - 30, fake: true },
        { x: 1700, y: groundY - 30  },
    ];
    const humans = [
        { x: 1050, y: groundY - HUMAN_H / 2, pL: 950, pR: 1210 },
    ];
    return {
        spawnX: 60, spawnY: groundY - 30,
        plats, cores, humans,
        exit: { x: 1780, y: groundY - 60, w: 60, h: 60 },
        width: 1860,
        bottomY: H + VIEW_BOTTOM_PAD,
        coreTier: 1,
    };
}

// =============================================
// Stage 3 — Celeste 딸기 (랜덤 함정, ~2000px)
// =============================================

function buildStage3(W: number, H: number): StageDef {
    const groundY = H * 0.78;
    // trapSlot: 랜덤화 후보 (실제 종류는 loadStageData에서 결정)
    // 9개 슬롯을 3그룹으로 나눠서 그룹 셔플 → 클리어 보장
    const plats: Plat[] = [
        // 시작 — 안전 지대
        { x: 0,    y: groundY,       w: 200, h: 20, kind: 'solid' },

        // === 구간 1: 좁은 발판 갭 + 트랩 그룹 A (slot 0,1,2) ===
        { x: 250,  y: groundY - 50,  w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 360,  y: groundY - 80,  w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 470,  y: groundY - 100, w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 580,  y: groundY - 80,  w: 60,  h: 20, kind: 'solid' },  // 그룹간 안전 발판

        // === 구간 2: 좁은 평지 + 인간 ===
        { x: 680,  y: groundY - 60,  w: 200, h: 20, kind: 'solid' },

        // === 구간 3: 점프 시퀀스 + 트랩 그룹 B (slot 3,4,5) ===
        { x: 920,  y: groundY - 90,  w: 55,  h: 20, kind: 'solid', trapSlot: true },
        { x: 1015, y: groundY - 130, w: 55,  h: 20, kind: 'solid', trapSlot: true },
        { x: 1110, y: groundY - 100, w: 55,  h: 20, kind: 'solid', trapSlot: true },

        // === 구간 4: 높은 절벽 (정밀 점프) ===
        { x: 1220, y: groundY - 140, w: 80,  h: 20, kind: 'solid' },

        // === 구간 5: 마지막 트랩 그룹 C (slot 6,7,8) + 인간 ===
        { x: 1340, y: groundY - 110, w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 1440, y: groundY - 80,  w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 1540, y: groundY - 110, w: 60,  h: 20, kind: 'solid', trapSlot: true },
        { x: 1650, y: groundY - 80,  w: 60,  h: 20, kind: 'solid' },  // 그룹간 안전 발판

        // 도착 지대
        { x: 1750, y: groundY,       w: 250, h: 20, kind: 'solid' },
    ];

    // 인간 위치는 플랫폼 참조로 (절대좌표 박지 말 것)
    // 평지(680~880)와 도착 지대(1750~2000)에 두기 — 좁은 trapSlot은 피함
    const platPlaza = plats[5];   // {x:680, w:200, y:groundY-60}
    const platEnd = plats[plats.length - 1]; // {x:1750, w:250, y:groundY}
    const humans = [
        { x: 780,  y: platPlaza.y - HUMAN_H / 2, pL: 700, pR: 860 },
        { x: 1850, y: platEnd.y   - HUMAN_H / 2, pL: 1780, pR: 1970 },
    ];

    const cores: CoreDef[] = [
        // 안전한 코어 (시작)
        { x: 100,  y: groundY - 30  },
        // 트랩 그룹 A 위 (위험)
        { x: 390,  y: groundY - 110 },
        { x: 500,  y: groundY - 130 },
        // 평지 — fakeSlot 후보 (단독, 넓은 발판이라 회피 가능)
        { x: 720,  y: platPlaza.y - 18, fakeSlot: true },
        // 평지 가운데 — 진짜 (인간 회피하면서 줍기)
        { x: 820,  y: platPlaza.y - 18 },
        // 트랩 그룹 B 위
        { x: 945,  y: groundY - 120 },
        { x: 1135, y: groundY - 130 },
        // 높은 절벽 위 — 정밀 점프 보상
        { x: 1260, y: groundY - 170 },
        // 트랩 그룹 C 위
        { x: 1470, y: groundY - 110 },
        // 도착 지대 — fakeSlot 후보 (단독, 넓어서 회피 가능)
        { x: 1820, y: platEnd.y - 18, fakeSlot: true },
    ];

    return {
        spawnX: 60, spawnY: groundY - 30,
        plats, cores, humans,
        exit: { x: 1920, y: groundY - 60, w: 60, h: 60 },
        width: 2000,
        bottomY: H + VIEW_BOTTOM_PAD,
        coreTier: 2,
        // 9개 trapSlot, 3그룹 × 3 — 그룹 셔플로 클리어 보장
        // 비율 2-4-3: 그룹당 (falling/fake/안전)이 균등하게 → 각 그룹에 안전 1 보장
        // 2개 fakeSlot 코어 중 1개가 가짜
        randomTraps: { fallingCount: 2, fakeCount: 4, fakeCoreCount: 1 },
    };
}

// =============================================
// Game
// =============================================

class HaulGame extends MinigameBase {
    protected readonly title = 'HAUL';
    protected readonly titleColor = C.yellow;

    private phase: Phase = 'intro';
    private phT = 0;

    private stage = 0;
    private stageDef!: StageDef;
    private cores: Core[] = [];
    private humans: Human[] = [];

    // Player
    private px = 0; private py = 0;
    private pvx = 0; private pvy = 0;
    private pDir: 1 | -1 = 1;
    private onGnd = false;
    private coyoteT = 0;
    private jumpBufT = 0;
    private wasJumpHeld = false;

    // Stats (per stage + total)
    private deaths = 0;
    private elapsed = 0;
    private stageCoreCount: number[] = [0, 0, 0];

    private camX = 0;
    private respawnT = 0;
    private lbStarted = false;

    protected isInteractive(): boolean { return this.phase === 'play'; }

    // --- Lifecycle ---

    protected resetGame(): void {
        this.setupMobileControls({ joystick: true, jumpBtn: true });
        this.lbStarted = false;
        this.lbStatus = 'idle';
        this.lbScores = [];
        this.lbNewId = null;
        this.stage = 0;
        this.deaths = 0;
        this.elapsed = 0;
        this.stageCoreCount = [0, 0, 0];
        this.startStage();
    }

    protected onResized(): void {
        this.loadStageData();
    }

    private loadStageData(): void {
        const builders = [buildStage1, buildStage2, buildStage3];
        const builder = builders[this.stage] || buildStage1;
        this.stageDef = builder(this.W, this.H);

        // 랜덤 트랩 적용 (Stage 3 등)
        if (this.stageDef.randomTraps) {
            this.applyRandomTraps();
        }

        for (const p of this.stageDef.plats) {
            p.state = 'idle';
            p.timer = 0;
            p.fallVy = 0;
            p.origX = p.x;
            p.origY = p.y;
        }

        this.cores = this.stageDef.cores.map(c => ({
            x: c.x, y: c.y,
            collected: false,
            tier: this.stageDef.coreTier,
            fake: !!c.fake,
            fakeSlot: c.fakeSlot,
            twitchT: 1 + Math.random() * FAKE_TWITCH_INTERVAL,
            twitchActive: 0,
        }));

        this.humans = this.stageDef.humans.map(h => ({
            x: h.x, y: h.y,
            pL: h.pL, pR: h.pR,
            dir: 1,
            walkPhase: 0,
        }));
    }

    /** Stage 3용: 그룹 셔플로 trapSlot 분배 — 각 그룹에 안전 1개 보장 → 클리어 보장 */
    private applyRandomTraps(): void {
        const cfg = this.stageDef.randomTraps!;

        // 1. trapSlot 플랫폼을 3그룹으로 분할 (배열 순서대로 0-2, 3-5, 6-8)
        const slots = this.stageDef.plats.filter(p => p.trapSlot);
        const groupSize = Math.floor(slots.length / 3);
        const groups: Plat[][] = [
            slots.slice(0, groupSize),
            slots.slice(groupSize, groupSize * 2),
            slots.slice(groupSize * 2),
        ];

        // 2. 각 그룹에서 안전 슬롯 1개씩 미리 선정 → 클리어 보장
        const safeSet = new Set<Plat>();
        for (const g of groups) {
            const safe = g[Math.floor(Math.random() * g.length)];
            safeSet.add(safe);
        }

        // 3. 나머지 슬롯(6개)에 falling/fake 분배
        const trapPool = slots.filter(s => !safeSet.has(s));
        this.shuffle(trapPool);

        let idx = 0;
        for (let i = 0; i < cfg.fallingCount && idx < trapPool.length; i++, idx++) {
            trapPool[idx].kind = 'falling';
        }
        for (let i = 0; i < cfg.fakeCount && idx < trapPool.length; i++, idx++) {
            trapPool[idx].kind = 'fake';
        }
        // safeSet에 든 슬롯은 solid 유지

        // 4. fakeSlot 코어 셔플
        const coreSlots = this.stageDef.cores.filter(c => c.fakeSlot);
        this.shuffle(coreSlots);
        for (let i = 0; i < cfg.fakeCoreCount && i < coreSlots.length; i++) {
            coreSlots[i].fake = true;
        }
    }

    private shuffle<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    private startStage(): void {
        this.loadStageData();
        this.respawnPlayer();
        this.phase = 'intro';
        this.phT = 1.3;
    }

    private respawnPlayer(): void {
        this.px = this.stageDef.spawnX;
        this.py = this.stageDef.spawnY;
        this.pvx = 0; this.pvy = 0;
        this.pDir = 1;
        this.onGnd = false;
        this.coyoteT = 0;
        this.jumpBufT = 0;
        this.camX = Math.max(0, this.px - this.W / 2);
    }

    private resetTrapsForRespawn(): void {
        for (const p of this.stageDef.plats) {
            p.state = 'idle';
            p.timer = 0;
            p.fallVy = 0;
            if (p.kind === 'falling') {
                p.x = p.origX!;
                p.y = p.origY!;
            }
        }
    }

    private die(): void {
        if (this.phase !== 'play') return;
        this.deaths++;
        this.audio?.mgFail();
        this.addBurst(this.px, this.py, C.red, 12, 160);
        this.phase = 'respawn';
        this.respawnT = RESPAWN_FADE;
    }

    // --- Physics ---

    private updatePhysics(dt: number): void {
        let mx = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        if (mx === 0 && this.mJoy.x) mx = this.mJoy.x > 0.3 ? 1 : this.mJoy.x < -0.3 ? -1 : 0;

        if (mx !== 0) {
            this.pvx = mx * MOVE_SPD;
            this.pDir = mx > 0 ? 1 : -1;
        } else {
            this.pvx *= 0.78;
            if (Math.abs(this.pvx) < 5) this.pvx = 0;
        }

        const jumpHeld = !!(this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp'] || this.mJump);
        const jumpPressed = jumpHeld && !this.wasJumpHeld;
        this.wasJumpHeld = jumpHeld;
        if (jumpPressed) this.jumpBufT = JUMP_BUFFER;

        if (this.jumpBufT > 0 && this.coyoteT > 0) {
            this.pvy = JUMP_V;
            this.coyoteT = 0;
            this.jumpBufT = 0;
            this.onGnd = false;
            this.audio?.jump();
        }

        if (!jumpHeld && this.pvy < -200) this.pvy = -200;

        this.pvy += GRAV * dt;
        if (this.pvy > 900) this.pvy = 900;

        // X 충돌
        this.px += this.pvx * dt;
        for (const p of this.stageDef.plats) {
            if (!this.platSolid(p)) continue;
            if (this.aabb(this.px, this.py, p)) {
                if (this.pvx > 0) this.px = p.x - PLAYER_W / 2 - 0.1;
                else if (this.pvx < 0) this.px = p.x + p.w + PLAYER_W / 2 + 0.1;
                this.pvx = 0;
            }
        }

        // Y 충돌
        this.py += this.pvy * dt;
        let landed = false;
        let landedOn: Plat | null = null;
        for (const p of this.stageDef.plats) {
            if (!this.platSolid(p)) continue;
            if (this.aabb(this.px, this.py, p)) {
                if (this.pvy > 0) {
                    this.py = p.y - PLAYER_H / 2 - 0.1;
                    landed = true;
                    landedOn = p;
                } else if (this.pvy < 0) {
                    this.py = p.y + p.h + PLAYER_H / 2 + 0.1;
                }
                this.pvy = 0;
            }
        }

        if (landed) {
            this.onGnd = true;
            this.coyoteT = COYOTE_TIME;
            if (landedOn) this.triggerTrap(landedOn);
        } else {
            this.onGnd = false;
            this.coyoteT = Math.max(0, this.coyoteT - dt);
        }

        if (this.jumpBufT > 0) this.jumpBufT -= dt;

        if (this.px < PLAYER_W / 2) { this.px = PLAYER_W / 2; this.pvx = 0; }
        if (this.px > this.stageDef.width - PLAYER_W / 2) {
            this.px = this.stageDef.width - PLAYER_W / 2;
            this.pvx = 0;
        }

        if (this.py > this.stageDef.bottomY) this.die();
    }

    private platSolid(p: Plat): boolean {
        return p.state !== 'gone';
    }

    private triggerTrap(p: Plat): void {
        if (p.kind === 'falling' && p.state === 'idle') {
            p.state = 'shaking';
            p.timer = FALL_DELAY;
        } else if (p.kind === 'fake' && p.state === 'idle') {
            p.state = 'gone';
            p.timer = FAKE_RESPAWN;
            this.audio?.mgHurt();
            this.addBurst(p.x + p.w / 2, p.y, C.red, 6, 100);
        }
    }

    private updateTraps(dt: number): void {
        for (const p of this.stageDef.plats) {
            if (p.kind === 'falling') {
                if (p.state === 'shaking') {
                    p.timer! -= dt;
                    if (p.timer! <= 0) {
                        p.state = 'falling';
                        p.fallVy = 0;
                    }
                } else if (p.state === 'falling') {
                    p.fallVy! += GRAV * 0.6 * dt;
                    p.y += p.fallVy! * dt;
                    if (p.y > this.stageDef.bottomY) {
                        p.state = 'gone';
                        p.timer = FALL_RESPAWN;
                    }
                } else if (p.state === 'gone') {
                    p.timer! -= dt;
                    if (p.timer! <= 0) {
                        p.state = 'idle';
                        p.x = p.origX!;
                        p.y = p.origY!;
                        p.fallVy = 0;
                    }
                }
            } else if (p.kind === 'fake') {
                if (p.state === 'gone') {
                    p.timer! -= dt;
                    if (p.timer! <= 0) p.state = 'idle';
                }
            }
        }
    }

    private updateHumans(dt: number): void {
        for (const h of this.humans) {
            h.x += h.dir * HUMAN_SPD * dt;
            if (h.x > h.pR) { h.x = h.pR; h.dir = -1; }
            if (h.x < h.pL) { h.x = h.pL; h.dir = 1; }
            h.walkPhase += dt * 6;

            if (Math.abs(this.px - h.x) < (PLAYER_W + HUMAN_W) / 2 &&
                Math.abs(this.py - h.y) < (PLAYER_H + HUMAN_H) / 2) {
                this.die();
                return;
            }
        }
    }

    /** 위장 적 떨림 갱신 */
    private updateFakeCoreTwitch(dt: number): void {
        for (const c of this.cores) {
            if (!c.fake || c.collected) continue;
            if (c.twitchActive > 0) {
                c.twitchActive -= dt;
            } else {
                c.twitchT -= dt;
                if (c.twitchT <= 0) {
                    c.twitchActive = FAKE_TWITCH_DUR;
                    c.twitchT = FAKE_TWITCH_INTERVAL + (Math.random() - 0.5) * 3;
                }
            }
        }
    }

    private aabb(px: number, py: number, p: Plat): boolean {
        return (
            px - PLAYER_W / 2 < p.x + p.w &&
            px + PLAYER_W / 2 > p.x &&
            py - PLAYER_H / 2 < p.y + p.h &&
            py + PLAYER_H / 2 > p.y
        );
    }

    // --- Cores & exit ---

    private collectCores(): void {
        for (const c of this.cores) {
            if (c.collected) continue;
            if (Math.abs(this.px - c.x) < PLAYER_W / 2 + CORE_R &&
                Math.abs(this.py - c.y) < PLAYER_H / 2 + CORE_R) {
                if (c.fake) {
                    this.audio?.mgHurt();
                    this.addBurst(c.x, c.y, C.red, 10, 130);
                    this.die();
                    return;
                }
                c.collected = true;
                this.stageCoreCount[this.stage]++;
                this.audio?.mgCoin(this.stageCoreCount[this.stage]);
                this.addBurst(c.x, c.y, C.yellow, 8, 120);
                this.addPop(c.x, c.y - 18, '+◆');
            }
        }
    }

    private checkExit(): void {
        const e = this.stageDef.exit;
        if (this.px > e.x && this.px < e.x + e.w &&
            this.py > e.y && this.py < e.y + e.h) {
            this.audio?.mgExtract();
            if (this.stage < 2) {
                this.stage++;
                this.startStage();
            } else {
                this.phase = 'result';
                this.tryStartLb();
            }
        }
    }

    // --- Update ---

    protected updateGame(dt: number): void {
        if (this.phase === 'intro') {
            this.phT -= dt;
            if (this.phT <= 0) this.phase = 'play';
        }

        if (this.phase === 'respawn') {
            const prev = this.respawnT;
            this.respawnT -= dt;
            if (prev > RESPAWN_FADE * 0.5 && this.respawnT <= RESPAWN_FADE * 0.5) {
                this.respawnPlayer();
                this.resetTrapsForRespawn();
            }
            if (this.respawnT <= 0) this.phase = 'play';
            this.updateTraps(dt);
        }

        if (this.phase === 'play') {
            this.elapsed += dt;
            this.updatePhysics(dt);
            this.updateTraps(dt);
            this.updateHumans(dt);
            this.updateFakeCoreTwitch(dt);
            if (this.phase === 'play' as Phase) this.collectCores();
            if (this.phase === 'play' as Phase) this.checkExit();

            const targetCamX = this.px - this.W / 2;
            this.camX += (targetCamX - this.camX) * 6 * dt;
            this.camX = Math.max(0, Math.min(this.stageDef.width - this.W, this.camX));
        }

        this.updatePts(dt, 200);
        this.updatePops(dt);
    }

    // --- Render ---

    protected renderGame(now: number): void {
        const { cx, W, H } = this;

        const sg = cx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, '#06060e');
        sg.addColorStop(0.7, '#0a0a14');
        sg.addColorStop(1, '#14142a');
        cx.fillStyle = sg;
        cx.fillRect(0, 0, W, H);

        cx.fillStyle = rgba('#fff', 0.12);
        for (let i = 0; i < 30; i++) {
            const sx = (i * 137 + this.camX * 0.05) % W;
            const sy = (i * 89) % (H * 0.5);
            cx.fillRect(sx, sy, 1.2, 1.2);
        }

        const horizonY = H * 0.78;
        cx.strokeStyle = rgba(C.cyan, 0.08);
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(0, horizonY);
        cx.lineTo(W, horizonY);
        cx.stroke();

        // === World ===
        cx.save();
        cx.translate(-this.camX, 0);

        for (const p of this.stageDef.plats) {
            if (p.x + p.w < this.camX - 20 || p.x > this.camX + W + 20) continue;
            this.drawPlatform(cx, p, now);
        }

        for (const c of this.cores) {
            if (c.collected) continue;
            if (c.x < this.camX - 20 || c.x > this.camX + W + 20) continue;
            this.drawCore(cx, c, now);
        }

        const e = this.stageDef.exit;
        const epulse = 0.4 + Math.sin(now * 3) * 0.2;
        cx.fillStyle = rgba(C.accent, 0.08 + epulse * 0.06);
        cx.fillRect(e.x, e.y, e.w, e.h);
        cx.strokeStyle = rgba(C.accent, 0.5 + epulse * 0.2);
        cx.lineWidth = 1.5;
        cx.setLineDash([4, 4]);
        cx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
        cx.setLineDash([]);
        cx.font = '600 9px "JetBrains Mono"';
        cx.fillStyle = rgba(C.accent, 0.7);
        cx.textAlign = 'center';
        cx.fillText('EXIT', e.x + e.w / 2, e.y - 6);

        for (const h of this.humans) {
            if (h.x < this.camX - 30 || h.x > this.camX + W + 30) continue;
            this.drawHuman(cx, h, now);
        }

        if (this.phase === 'play' || this.phase === 'intro') {
            this.drawCat(cx, this.px, this.py, now);
        } else if (this.phase === 'respawn') {
            const a = Math.max(0, this.respawnT / RESPAWN_FADE);
            cx.globalAlpha = a;
            this.drawCat(cx, this.px, this.py, now);
            cx.globalAlpha = 1;
        }

        this.renderPts();
        this.renderPops();

        cx.restore();
        // === End World ===

        // HUD
        this.drawHudTitle();
        cx.font = '500 10px "JetBrains Mono"';
        cx.fillStyle = C.yellow;
        cx.textAlign = 'left';
        const totalReal = this.cores.filter(c => !c.fake).length;
        const collected = this.cores.filter(c => c.collected && !c.fake).length;
        cx.fillText(`◆ ${collected} / ${totalReal}`, 20, 46);
        cx.fillStyle = '#7a7a8a';
        cx.fillText(`☠ ${this.deaths}`, 20, 62);

        const ts = `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`;
        cx.font = '600 13px "JetBrains Mono"';
        cx.fillStyle = rgba(C.cyan, 0.6);
        cx.textAlign = 'center';
        cx.fillText(ts, W / 2, 28);

        cx.font = '400 9px "JetBrains Mono"';
        cx.fillStyle = '#3a3a44';
        cx.textAlign = 'right';
        cx.fillText(`STAGE ${this.stage + 1} / 3`, W - 20, 28);

        this.drawCloseBtn();

        if (this.phase === 'intro') {
            const titles = ['STAGE 1', 'STAGE 2', 'STAGE 3'];
            const subs = [
                this.mob ? '드래그=이동 · ▲=점프' : 'A/D 이동 · Space 점프',
                '⚠ 함정 주의 · 인간 회피',
                '💀 최종 — 코어 가치 ×4',
            ];
            this.drawIntro(this.phT, titles[this.stage] || `STAGE ${this.stage + 1}`,
                subs[this.stage] || '',
                '◆ 코어를 모으고 EXIT로');
        }

        if (this.phase === 'respawn') {
            cx.fillStyle = rgba(C.bg, 1 - this.respawnT / RESPAWN_FADE);
            cx.fillRect(0, 0, W, H);
        }

        if (this.phase === 'result' || this.phase === 'dead') this.renderRes();
    }

    private drawPlatform(cx: CanvasRenderingContext2D, p: Plat, now: number): void {
        if (p.state === 'gone') return;

        let offX = 0;
        if (p.kind === 'falling' && p.state === 'shaking') {
            offX = Math.sin(now * 60) * 1.5;
        }

        cx.fillStyle = rgba(C.cyan, 0.06);
        cx.fillRect(p.x + offX, p.y, p.w, p.h);
        cx.strokeStyle = rgba(C.cyan, 0.35);
        cx.lineWidth = 1.5;
        cx.strokeRect(p.x + offX + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
        cx.fillStyle = rgba(C.cyan, 0.18);
        cx.fillRect(p.x + offX, p.y, p.w, 2);
    }

    private drawCore(cx: CanvasRenderingContext2D, c: Core, now: number): void {
        const bob = Math.sin(now * 3 + c.x * 0.03) * 2;
        // 위장 적 떨림 (관찰력 있는 사람만 봄)
        let twitchX = 0;
        if (c.fake && c.twitchActive > 0) {
            const phase = (FAKE_TWITCH_DUR - c.twitchActive) / FAKE_TWITCH_DUR;
            twitchX = Math.sin(phase * Math.PI * 8) * 2.5;
        }
        const dx = c.x + twitchX;

        cx.beginPath();
        cx.arc(dx, c.y + bob, CORE_R * 1.6, 0, Math.PI * 2);
        cx.fillStyle = rgba(C.yellow, 0.08);
        cx.fill();
        cx.beginPath();
        cx.moveTo(dx, c.y + bob - CORE_R);
        cx.lineTo(dx + CORE_R * 0.7, c.y + bob);
        cx.lineTo(dx, c.y + bob + CORE_R);
        cx.lineTo(dx - CORE_R * 0.7, c.y + bob);
        cx.closePath();
        cx.fillStyle = rgba(C.yellow, 0.7);
        cx.fill();
        cx.strokeStyle = rgba(C.yellow, 0.9);
        cx.lineWidth = 1;
        cx.stroke();
    }

    private drawHuman(cx: CanvasRenderingContext2D, h: Human, now: number): void {
        cx.save();
        cx.translate(h.x, h.y);
        cx.scale(h.dir, 1);

        cx.beginPath();
        cx.ellipse(0, HUMAN_H / 2 + 2, 9, 2, 0, 0, Math.PI * 2);
        cx.fillStyle = rgba('#000', 0.3);
        cx.fill();

        const col = C.red;
        const legBob = Math.sin(h.walkPhase) * 1;

        cx.fillStyle = rgba(col, 0.18);
        cx.fillRect(-HUMAN_W / 2, -HUMAN_H / 2 + 4, HUMAN_W, HUMAN_H - 6);
        cx.strokeStyle = rgba(col, 0.65);
        cx.lineWidth = 1.5;
        cx.strokeRect(-HUMAN_W / 2, -HUMAN_H / 2 + 4, HUMAN_W, HUMAN_H - 6);

        cx.fillStyle = rgba(col, 0.25);
        cx.fillRect(-5, -HUMAN_H / 2 - 2, 10, 8);
        cx.strokeStyle = rgba(col, 0.7);
        cx.strokeRect(-5, -HUMAN_H / 2 - 2, 10, 8);

        cx.fillStyle = rgba(col, 0.9);
        cx.fillRect(1, -HUMAN_H / 2 + 1, 2, 2);

        cx.fillStyle = rgba(col, 0.5);
        cx.fillRect(-4, HUMAN_H / 2 - 4, 3, 3 + Math.abs(legBob));
        cx.fillRect(1, HUMAN_H / 2 - 4, 3, 3 + Math.abs(-legBob));

        cx.restore();

        cx.font = '10px "JetBrains Mono"';
        cx.fillStyle = rgba(C.red, 0.6 + Math.sin(now * 4) * 0.2);
        cx.textAlign = 'center';
        cx.fillText('!', h.x, h.y - HUMAN_H / 2 - 8);
    }

    private drawCat(cx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
        const col = C.accent;
        cx.save();
        cx.translate(x, y);
        cx.scale(this.pDir, 1);

        cx.beginPath();
        cx.ellipse(0, PLAYER_H / 2 + 2, 8, 2, 0, 0, Math.PI * 2);
        cx.fillStyle = rgba('#000', 0.3);
        cx.fill();

        cx.fillStyle = rgba(col, 0.22);
        cx.fillRect(-7, -7, 14, 14);
        cx.strokeStyle = rgba(col, 0.7);
        cx.lineWidth = 1.5;
        cx.strokeRect(-7, -7, 14, 14);

        cx.beginPath();
        cx.moveTo(-5, -7);
        cx.lineTo(-3, -12);
        cx.lineTo(-1, -7);
        cx.fillStyle = rgba(col, 0.3);
        cx.fill();
        cx.beginPath();
        cx.moveTo(1, -7);
        cx.lineTo(3, -12);
        cx.lineTo(5, -7);
        cx.fill();

        cx.fillStyle = rgba(col, 0.85);
        cx.fillRect(1, -4, 2, 2.5);
        cx.fillRect(-3, -4, 2, 2.5);

        cx.strokeStyle = rgba(col, 0.4);
        cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(-7, 1);
        cx.quadraticCurveTo(-15, 1 + Math.sin(now * 4) * 4, -13, -6);
        cx.stroke();

        cx.restore();
    }

    // --- Score ---

    private computeScore(): number {
        const coreScore =
            this.stageCoreCount[0] * STAGE_CORE_VALUE[0] +
            this.stageCoreCount[1] * STAGE_CORE_VALUE[1] +
            this.stageCoreCount[2] * STAGE_CORE_VALUE[2];
        const timeBonus = Math.max(0, TIME_BONUS_BASE - this.elapsed) * 2;
        const deathPenalty = this.deaths * DEATH_PENALTY;
        return Math.max(0, Math.floor(coreScore + timeBonus - deathPenalty));
    }

    private totalCoresCollected(): number {
        return this.stageCoreCount[0] + this.stageCoreCount[1] + this.stageCoreCount[2];
    }

    // --- Result ---

    private tryStartLb(): void {
        if (this.lbStarted) return;
        this.lbStarted = true;
        const score = this.computeScore();
        this.startLeaderboard('haul', score, {
            cores: this.totalCoresCollected(),
            deaths: this.deaths,
            time: Math.floor(this.elapsed),
        });
    }

    private renderRes(): void {
        const { bx, by } = this.drawResultBg('CLEAR', C.accent);
        const cx = this.cx;
        const score = this.computeScore();

        cx.font = '700 32px "JetBrains Mono"';
        cx.fillStyle = '#e8e8ec';
        cx.fillText(`${score}`, bx, by - 40);
        cx.font = '400 9px "JetBrains Mono"';
        cx.fillStyle = '#5a5a66';
        cx.fillText('POINTS', bx, by - 24);

        // 스테이지별 코어 표시
        cx.font = '500 10px "JetBrains Mono"';
        cx.fillStyle = '#a8a8b3';
        cx.fillText(
            `S1 ◆${this.stageCoreCount[0]}  ·  S2 ◆${this.stageCoreCount[1]}  ·  S3 ◆${this.stageCoreCount[2]}`,
            bx, by - 8,
        );
        cx.fillStyle = '#7a7a8a';
        cx.font = '400 9px "JetBrains Mono"';
        cx.fillText(`☠ ${this.deaths}  ·  ${Math.floor(this.elapsed)}s`, bx, by + 8);

        this.drawLeaderboard(bx, by + 110, 280);
        this.drawResultBtns(bx, by + 230);
    }

    private get rBY(): number { return this.H / 2 + 230; }

    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'result' || this.phase === 'dead') {
            if (this.isLeaderboardBusy()) return;
            const h = this.hitResultBtn(x, y, this.W / 2, this.rBY);
            if (h === 'retry') this.resetGame();
            if (h === 'exit') this.stop();
        }
    }
}

export function createHaulGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    const game = new HaulGame(container, onExit, audio);
    return { start: () => game.start(), stop: () => game.stop() };
}