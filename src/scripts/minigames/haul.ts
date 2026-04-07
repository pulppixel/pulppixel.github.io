// HAUL — 1-hit 플랫포머 (Celeste 영감)
// Phase A: 코어 구조 — 플레이어 물리, 점프, 카메라, S1, 코어, 탈출, 사망/리스폰
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

// =============================================
// Constants
// =============================================

const GRAV = 1400;
const MOVE_SPD = 220;
const JUMP_V = -520;
const COYOTE_TIME = 0.08;       // 떨어진 직후에도 점프 허용
const JUMP_BUFFER = 0.10;       // 착지 직전 점프 입력 버퍼
const PLAYER_W = 14;
const PLAYER_H = 18;
const CORE_R = 8;
const RESPAWN_FADE = 0.4;
const VIEW_BOTTOM_PAD = 80;     // 이 아래로 떨어지면 사망

// =============================================
// Types
// =============================================

interface Plat { x: number; y: number; w: number; h: number; }
interface Core { x: number; y: number; collected: boolean; tier: number; }
interface ExitZone { x: number; y: number; w: number; h: number; }

type Phase = 'intro' | 'play' | 'respawn' | 'clear' | 'result' | 'dead';

interface StageDef {
    spawnX: number; spawnY: number;
    plats: Plat[];
    cores: { x: number; y: number; tier: number }[];
    exit: ExitZone;
    width: number;     // 맵 전체 가로 크기
    bottomY: number;   // 이 y 아래로 가면 사망
}

// =============================================
// Stage 1 — 정직한 튜토리얼
// =============================================

function buildStage1(W: number, H: number): StageDef {
    const groundY = H * 0.78;
    const plats: Plat[] = [
        // 시작 지면
        { x: 0,    y: groundY, w: 280, h: 20 },
        // 작은 점프
        { x: 320,  y: groundY - 50,  w: 100, h: 20 },
        { x: 460,  y: groundY - 90,  w: 100, h: 20 },
        // 평지
        { x: 600,  y: groundY - 60,  w: 200, h: 20 },
        // 코어 발판 (살짝 높이)
        { x: 850,  y: groundY - 130, w: 90,  h: 20 },
        // 갭
        { x: 1000, y: groundY - 80,  w: 140, h: 20 },
        { x: 1200, y: groundY - 110, w: 100, h: 20 },
        // 도착 지대
        { x: 1340, y: groundY,       w: 280, h: 20 },
    ];
    const cores = [
        { x: 200,  y: groundY - 30,  tier: 1 },
        { x: 510,  y: groundY - 120, tier: 1 },
        { x: 700,  y: groundY - 90,  tier: 1 },
        { x: 895,  y: groundY - 160, tier: 1 },
        { x: 1250, y: groundY - 140, tier: 1 },
    ];
    return {
        spawnX: 60,
        spawnY: groundY - 30,
        plats,
        cores,
        exit: { x: 1500, y: groundY - 60, w: 60, h: 60 },
        width: 1620,
        bottomY: H + VIEW_BOTTOM_PAD,
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

    // Player
    private px = 0; private py = 0;
    private pvx = 0; private pvy = 0;
    private pDir: 1 | -1 = 1;
    private onGnd = false;
    private coyoteT = 0;
    private jumpBufT = 0;
    private wasJumpHeld = false;

    // Stats
    private deaths = 0;
    private elapsed = 0;
    private totalCores = 0;

    // Camera
    private camX = 0;

    // FX
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
        this.totalCores = 0;
        this.startStage();
    }

    protected onResized(): void {
        if (this.stage === 0) this.stageDef = buildStage1(this.W, this.H);
    }

    private startStage(): void {
        // Phase A에선 stage 1만
        this.stageDef = buildStage1(this.W, this.H);
        this.cores = this.stageDef.cores.map(c => ({ x: c.x, y: c.y, collected: false, tier: c.tier }));
        this.respawnPlayer();
        this.phase = 'intro';
        this.phT = 1.3;
    }

    private respawnPlayer(): void {
        this.px = this.stageDef.spawnX;
        this.py = this.stageDef.spawnY;
        this.pvx = 0;
        this.pvy = 0;
        this.pDir = 1;
        this.onGnd = false;
        this.coyoteT = 0;
        this.jumpBufT = 0;
        this.camX = Math.max(0, this.px - this.W / 2);
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
        // Horizontal input
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

        // Jump input (edge-triggered + buffer)
        const jumpHeld = !!(this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp'] || this.mJump);
        const jumpPressed = jumpHeld && !this.wasJumpHeld;
        this.wasJumpHeld = jumpHeld;
        if (jumpPressed) this.jumpBufT = JUMP_BUFFER;

        // Coyote/buffer evaluation
        if (this.jumpBufT > 0 && this.coyoteT > 0) {
            this.pvy = JUMP_V;
            this.coyoteT = 0;
            this.jumpBufT = 0;
            this.onGnd = false;
            this.audio?.jump();
        }

        // Variable jump height — 점프 키 떼면 상승 중단
        if (!jumpHeld && this.pvy < -200) this.pvy = -200;

        // Gravity
        this.pvy += GRAV * dt;
        if (this.pvy > 900) this.pvy = 900;

        // Move X + collide
        this.px += this.pvx * dt;
        for (const p of this.stageDef.plats) {
            if (this.aabb(this.px, this.py, p)) {
                if (this.pvx > 0) this.px = p.x - PLAYER_W / 2 - 0.1;
                else if (this.pvx < 0) this.px = p.x + p.w + PLAYER_W / 2 + 0.1;
                this.pvx = 0;
            }
        }

        // Move Y + collide
        this.py += this.pvy * dt;
        let landed = false;
        for (const p of this.stageDef.plats) {
            if (this.aabb(this.px, this.py, p)) {
                if (this.pvy > 0) {
                    this.py = p.y - PLAYER_H / 2 - 0.1;
                    landed = true;
                } else if (this.pvy < 0) {
                    this.py = p.y + p.h + PLAYER_H / 2 + 0.1;
                }
                this.pvy = 0;
            }
        }

        if (landed) {
            this.onGnd = true;
            this.coyoteT = COYOTE_TIME;
        } else {
            this.onGnd = false;
            this.coyoteT = Math.max(0, this.coyoteT - dt);
        }

        if (this.jumpBufT > 0) this.jumpBufT -= dt;

        // 맵 좌우 경계
        if (this.px < PLAYER_W / 2) { this.px = PLAYER_W / 2; this.pvx = 0; }
        if (this.px > this.stageDef.width - PLAYER_W / 2) {
            this.px = this.stageDef.width - PLAYER_W / 2;
            this.pvx = 0;
        }

        // 낙사
        if (this.py > this.stageDef.bottomY) this.die();
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
                c.collected = true;
                this.totalCores++;
                this.audio?.mgCoin(this.totalCores);
                this.addBurst(c.x, c.y, C.yellow, 8, 120);
                this.addPop(c.x, c.y - 18, '+◆');
            }
        }
    }

    private checkExit(): void {
        const e = this.stageDef.exit;
        if (this.px > e.x && this.px < e.x + e.w &&
            this.py > e.y && this.py < e.y + e.h) {
            // Phase A: 결과 화면으로 직행
            this.phase = 'result';
            this.audio?.mgExtract();
            this.tryStartLb();
        }
    }

    // --- Update ---

    protected updateGame(dt: number): void {
        if (this.phase === 'intro') {
            this.phT -= dt;
            if (this.phT <= 0) this.phase = 'play';
        }

        if (this.phase === 'respawn') {
            this.respawnT -= dt;
            if (this.respawnT <= RESPAWN_FADE * 0.5) {
                // 중간에 위치 리셋
                this.respawnPlayer();
            }
            if (this.respawnT <= 0) this.phase = 'play';
        }

        if (this.phase === 'play') {
            this.elapsed += dt;
            this.updatePhysics(dt);
            this.collectCores();
            this.checkExit();

            // 카메라 follow (좌우만)
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

        // Background gradient
        const sg = cx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, '#06060e');
        sg.addColorStop(0.7, '#0a0a14');
        sg.addColorStop(1, '#14142a');
        cx.fillStyle = sg;
        cx.fillRect(0, 0, W, H);

        // 별 (parallax)
        cx.fillStyle = rgba('#fff', 0.12);
        for (let i = 0; i < 30; i++) {
            const sx = (i * 137 + this.camX * 0.05) % W;
            const sy = (i * 89) % (H * 0.5);
            cx.fillRect(sx, sy, 1.2, 1.2);
        }

        // 지평선 라인
        const horizonY = H * 0.78;
        cx.strokeStyle = rgba(C.cyan, 0.08);
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(0, horizonY);
        cx.lineTo(W, horizonY);
        cx.stroke();

        // === World (camera-shifted) ===
        cx.save();
        cx.translate(-this.camX, 0);

        // Platforms
        for (const p of this.stageDef.plats) {
            if (p.x + p.w < this.camX - 20 || p.x > this.camX + W + 20) continue;
            // 본체
            cx.fillStyle = rgba(C.cyan, 0.06);
            cx.fillRect(p.x, p.y, p.w, p.h);
            cx.strokeStyle = rgba(C.cyan, 0.35);
            cx.lineWidth = 1.5;
            cx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
            // 윗면 하이라이트
            cx.fillStyle = rgba(C.cyan, 0.18);
            cx.fillRect(p.x, p.y, p.w, 2);
        }

        // Cores
        for (const c of this.cores) {
            if (c.collected) continue;
            if (c.x < this.camX - 20 || c.x > this.camX + W + 20) continue;
            const bob = Math.sin(now * 3 + c.x * 0.03) * 2;
            // glow
            cx.beginPath();
            cx.arc(c.x, c.y + bob, CORE_R * 1.6, 0, Math.PI * 2);
            cx.fillStyle = rgba(C.yellow, 0.08);
            cx.fill();
            // 다이아몬드
            cx.beginPath();
            cx.moveTo(c.x, c.y + bob - CORE_R);
            cx.lineTo(c.x + CORE_R * 0.7, c.y + bob);
            cx.lineTo(c.x, c.y + bob + CORE_R);
            cx.lineTo(c.x - CORE_R * 0.7, c.y + bob);
            cx.closePath();
            cx.fillStyle = rgba(C.yellow, 0.7);
            cx.fill();
            cx.strokeStyle = rgba(C.yellow, 0.9);
            cx.lineWidth = 1;
            cx.stroke();
        }

        // Exit zone
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

        // Player
        if (this.phase === 'play' || this.phase === 'intro') {
            this.drawCat(cx, this.px, this.py, now);
        } else if (this.phase === 'respawn') {
            // 사라지는 효과
            const a = Math.max(0, this.respawnT / RESPAWN_FADE);
            cx.globalAlpha = a;
            this.drawCat(cx, this.px, this.py, now);
            cx.globalAlpha = 1;
        }

        this.renderPts();
        this.renderPops();

        cx.restore();
        // === End world ===

        // HUD
        this.drawHudTitle();
        cx.font = '500 10px "JetBrains Mono"';
        cx.fillStyle = C.yellow;
        cx.textAlign = 'left';
        cx.fillText(`◆ ${this.totalCores} / ${this.cores.length}`, 20, 46);
        cx.fillStyle = '#7a7a8a';
        cx.fillText(`☠ ${this.deaths}`, 20, 62);

        // 시간
        const ts = `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`;
        cx.font = '600 13px "JetBrains Mono"';
        cx.fillStyle = rgba(C.cyan, 0.6);
        cx.textAlign = 'center';
        cx.fillText(ts, W / 2, 28);

        // Stage 표시
        cx.font = '400 9px "JetBrains Mono"';
        cx.fillStyle = '#3a3a44';
        cx.textAlign = 'right';
        cx.fillText(`STAGE ${this.stage + 1} / 1`, W - 20, 28);

        this.drawCloseBtn();

        if (this.phase === 'intro') {
            this.drawIntro(this.phT, `STAGE ${this.stage + 1}`,
                this.mob ? '드래그=이동 · ▲=점프' : 'A/D 이동 · Space 점프',
                '◆ 코어를 모으고 EXIT로');
        }

        if (this.phase === 'respawn') {
            cx.fillStyle = rgba(C.bg, 1 - this.respawnT / RESPAWN_FADE);
            cx.fillRect(0, 0, W, H);
        }

        if (this.phase === 'result' || this.phase === 'dead') this.renderRes();
    }

    private drawCat(cx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
        const col = C.accent;
        cx.save();
        cx.translate(x, y);
        cx.scale(this.pDir, 1);

        // 그림자
        cx.beginPath();
        cx.ellipse(0, PLAYER_H / 2 + 2, 8, 2, 0, 0, Math.PI * 2);
        cx.fillStyle = rgba('#000', 0.3);
        cx.fill();

        // 몸통
        cx.fillStyle = rgba(col, 0.22);
        cx.fillRect(-7, -7, 14, 14);
        cx.strokeStyle = rgba(col, 0.7);
        cx.lineWidth = 1.5;
        cx.strokeRect(-7, -7, 14, 14);

        // 귀
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

        // 눈
        cx.fillStyle = rgba(col, 0.85);
        cx.fillRect(1, -4, 2, 2.5);
        cx.fillRect(-3, -4, 2, 2.5);

        // 꼬리 (살짝 흔들림)
        cx.strokeStyle = rgba(col, 0.4);
        cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(-7, 1);
        cx.quadraticCurveTo(-15, 1 + Math.sin(now * 4) * 4, -13, -6);
        cx.stroke();

        cx.restore();
    }

    // --- Result ---

    private tryStartLb(): void {
        if (this.lbStarted) return;
        this.lbStarted = true;
        // 임시 점수 (Phase C에서 정식화)
        const score = this.totalCores * 100 - this.deaths * 20 - Math.floor(this.elapsed);
        this.startLeaderboard('haul', Math.max(0, score), {
            cores: this.totalCores,
            deaths: this.deaths,
            time: Math.floor(this.elapsed),
        });
    }

    private renderRes(): void {
        const { bx, by } = this.drawResultBg('STAGE CLEAR', C.accent);
        const cx = this.cx;
        const score = Math.max(0, this.totalCores * 100 - this.deaths * 20 - Math.floor(this.elapsed));
        cx.font = '700 32px "JetBrains Mono"';
        cx.fillStyle = '#e8e8ec';
        cx.fillText(`${score}`, bx, by - 40);
        cx.font = '400 9px "JetBrains Mono"';
        cx.fillStyle = '#5a5a66';
        cx.fillText('POINTS', bx, by - 24);
        cx.fillText(`◆ ${this.totalCores}/${this.cores.length} · ☠ ${this.deaths} · ${Math.floor(this.elapsed)}s`, bx, by - 8);

        this.drawLeaderboard(bx, by + 100, 280);
        this.drawResultBtns(bx, by + 220);
    }

    private get rBY(): number { return this.H / 2 + 220; }

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