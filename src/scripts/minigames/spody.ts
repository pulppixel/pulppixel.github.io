// SPODY: 돌아다니는 타겟을 공으로 터뜨리기 (Refactored)
// + Sound integration
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

const TCOL = [C.pink, C.accent, C.purple, C.yellow, C.blue];
const SYMS = [['★', '+', '♥', '◆'], ['▲', '●', '×', '÷', '='], ['π', '∑', '√', '∞', '±', '≡', '∫']];
const WAVES = [
  { n: 4, r: 24, sMin: 70, sMax: 130, splash: 54 },
  { n: 5, r: 19, sMin: 120, sMax: 200, splash: 44 },
  { n: 7, r: 15, sMin: 160, sMax: 280, splash: 36 },
];
const MAX_AMMO = 3, AMMO_CD = 0.85, COMBO_WIN = 1.8;

interface Tgt { x: number; y: number; vx: number; vy: number; r: number; color: string; sym: string; alive: boolean; hitT: number; sq: number; sqA: 'x' | 'y'; }
interface Fly { sx: number; sy: number; ex: number; ey: number; t: number; dur: number; }
interface Spl { x: number; y: number; t: number; r: number; }
type Phase = 'intro' | 'play' | 'clear' | 'result';

class SpodyGame extends MinigameBase {
  protected readonly title = 'SPODY';
  protected readonly titleColor = C.accent;
  protected cursorStyle = 'crosshair';

  private phase: Phase = 'intro';
  private phaseT = 0;
  private wave = 0;
  private tgts: Tgt[] = [];
  private fly: Fly | null = null;
  private spls: Spl[] = [];
  private score = 0; private hits = 0; private totalTgt = 0;
  private ammo = MAX_AMMO; private ammoT = 0;
  private combo = 0; private maxCombo = 0; private lastHit = -10;
  private mX = 0; private mY = 0;

  protected resetGame(): void {
    this.score = 0; this.hits = 0; this.totalTgt = 0;
    this.combo = 0; this.maxCombo = 0; this.lastHit = -10;
    this.wave = 0;
    this.startWave();
  }

  private startWave(): void {
    const w = WAVES[this.wave];
    this.tgts = []; this.spls = []; this.fly = null;
    this.pts = []; this.pops = [];
    this.ammo = MAX_AMMO; this.ammoT = 0;
    const mg = 65, syms = SYMS[this.wave];
    for (let i = 0; i < w.n; i++) {
      const x = mg + Math.random() * (this.W - mg * 2);
      const y = mg + Math.random() * (this.H * 0.55 - mg);
      const a = Math.random() * Math.PI * 2;
      const sp = w.sMin + Math.random() * (w.sMax - w.sMin);
      this.tgts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: w.r + (Math.random() - 0.5) * 4, color: TCOL[i % TCOL.length], sym: syms[i % syms.length], alive: true, hitT: 0, sq: 0, sqA: 'x' });
    }
    this.totalTgt += w.n;
    this.phase = 'intro'; this.phaseT = 1.3;
  }

  private throwBall(tx: number, ty: number): void {
    if (this.phase !== 'play' || this.ammo <= 0 || this.fly) return;
    this.ammo--;
    this.audio?.mgShoot(); // 🔊 투사체 발사
    const sx = this.W / 2, sy = this.H - 38;
    this.fly = { sx, sy, ex: tx, ey: ty, t: 0, dur: Math.max(0.07, Math.min(0.18, Math.hypot(tx - sx, ty - sy) / 3200)) };
  }

  private doSplash(x: number, y: number): void {
    const sr = WAVES[this.wave].splash;
    this.spls.push({ x, y, t: 0, r: sr });
    const now = performance.now() / 1000;
    let h = 0;
    for (const tg of this.tgts) {
      if (!tg.alive) continue;
      if (Math.hypot(tg.x - x, tg.y - y) < sr + tg.r * 0.3) {
        tg.alive = false; tg.hitT = now; h++;
        this.addBurst(tg.x, tg.y, tg.color, 9, 140);
      }
    }
    if (h === 0) {
      this.audio?.mgExplosion(); // 🔊 빈 스플래시
      return;
    }
    this.hits += h;
    this.combo = (now - this.lastHit < COMBO_WIN) ? this.combo + 1 : 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.lastHit = now;
    const cm = Math.min(this.combo, 8);
    let p = h * 100 * cm; if (h >= 2) p += (h - 1) * 150;
    this.score += p;

    this.audio?.mgCoin(this.combo); // 🔊 타격 (콤보 음정 상승)
    if (this.combo >= 2) this.audio?.mgCombo(this.combo); // 🔊 콤보
    if (h >= 2) this.audio?.mgExplosion(); // 🔊 멀티 히트

    this.addPop(x, y - 12, `+${p}`);
    if (this.combo >= 2) this.addPop(x, y - 38, `COMBO ×${cm}`, true, 1.4);
    if (h >= 2) this.addPop(x, y + 14, h === 2 ? 'DOUBLE!' : h === 3 ? 'TRIPLE!' : `×${h} HIT!`, true, 1.3);
    if (!this.tgts.some(t => t.alive)) {
      this.score += 300;
      this.audio?.mgWaveClear(); // 🔊 웨이브 클리어
      this.addPop(this.W / 2, this.H / 2, `WAVE ${this.wave + 1} CLEAR +300`, true, 1.8);
      this.phase = 'clear'; this.phaseT = 1.4;
    }
  }

  protected updateGame(dt: number): void {
    const now = performance.now() / 1000;
    if (this.phase === 'intro' || this.phase === 'clear') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.phase === 'intro') this.phase = 'play';
        else { this.wave++; if (this.wave >= WAVES.length) this.phase = 'result'; else this.startWave(); }
      }
    }
    if (this.phase === 'play' && now - this.lastHit > COMBO_WIN) this.combo = 0;
    if (this.phase === 'play' && this.ammo < MAX_AMMO) {
      this.ammoT += dt;
      if (this.ammoT >= AMMO_CD) {
        this.ammo++; this.ammoT = 0;
        this.audio?.mgPickup(); // 🔊 탄약 충전
      }
    }

    if (this.phase === 'play' || this.phase === 'intro') {
      const bnd = this.H * 0.85;
      for (const tg of this.tgts) {
        if (!tg.alive) continue;
        tg.x += tg.vx * dt; tg.y += tg.vy * dt;
        tg.sq = Math.max(0, tg.sq - dt * 5);
        if (tg.x - tg.r < 0) { tg.x = tg.r; tg.vx = Math.abs(tg.vx); tg.sq = 1; tg.sqA = 'x'; }
        if (tg.x + tg.r > this.W) { tg.x = this.W - tg.r; tg.vx = -Math.abs(tg.vx); tg.sq = 1; tg.sqA = 'x'; }
        if (tg.y - tg.r < 0) { tg.y = tg.r; tg.vy = Math.abs(tg.vy); tg.sq = 1; tg.sqA = 'y'; }
        if (tg.y + tg.r > bnd) { tg.y = bnd - tg.r; tg.vy = -Math.abs(tg.vy); tg.sq = 1; tg.sqA = 'y'; }
      }
    }

    if (this.fly) { this.fly.t += dt; if (this.fly.t >= this.fly.dur) { this.doSplash(this.fly.ex, this.fly.ey); this.fly = null; } }

    let i = this.spls.length;
    while (i-- > 0) { this.spls[i].t += dt; if (this.spls[i].t > 0.4) { this.spls[i] = this.spls[this.spls.length - 1]; this.spls.pop(); } }

    this.updatePts(dt, 120);
    this.updatePops(dt);
  }

  protected renderGame(now: number): void {
    const { cx, W, H } = this;
    this.drawBg(); this.drawGrid(0.025);

    cx.strokeStyle = rgba(C.accent, 0.08); cx.lineWidth = 1.5; cx.strokeRect(1, 1, W - 2, H * 0.85);
    cx.setLineDash([5, 7]); cx.strokeStyle = rgba(C.pink, 0.06);
    cx.beginPath(); cx.moveTo(0, H * 0.85); cx.lineTo(W, H * 0.85); cx.stroke(); cx.setLineDash([]);

    for (const tg of this.tgts) {
      if (!tg.alive) {
        const age = now - tg.hitT;
        if (age < 0.35) { cx.beginPath(); cx.arc(tg.x, tg.y, tg.r * (1 + age * 7), 0, Math.PI * 2); cx.strokeStyle = rgba(tg.color, 1 - age / 0.35); cx.lineWidth = 2; cx.stroke(); }
        continue;
      }
      cx.save(); cx.translate(tg.x, tg.y);
      if (tg.sq > 0) { const s = tg.sq * 0.3; if (tg.sqA === 'x') cx.scale(1 - s, 1 + s * 0.5); else cx.scale(1 + s * 0.5, 1 - s); }
      cx.beginPath(); cx.arc(0, 0, tg.r, 0, Math.PI * 2);
      cx.fillStyle = rgba(tg.color, 0.14); cx.fill();
      cx.strokeStyle = rgba(tg.color, 0.55); cx.lineWidth = 2; cx.stroke();
      cx.font = `600 ${Math.round(tg.r * 0.85)}px "JetBrains Mono",monospace`;
      cx.fillStyle = rgba(tg.color, 0.8); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(tg.sym, 0, 1);
      cx.restore();
    }

    for (const sp of this.spls) {
      const p = sp.t / 0.4;
      cx.beginPath(); cx.arc(sp.x, sp.y, sp.r * p, 0, Math.PI * 2);
      cx.strokeStyle = rgba(C.accent, 0.45 * (1 - p)); cx.lineWidth = 2.5; cx.stroke();
      cx.beginPath(); cx.arc(sp.x, sp.y, sp.r * p, 0, Math.PI * 2);
      cx.fillStyle = rgba(C.accent, 0.07 * (1 - p)); cx.fill();
    }

    if (this.fly) {
      const p = this.fly.t / this.fly.dur;
      const bx = this.fly.sx + (this.fly.ex - this.fly.sx) * p;
      const by = this.fly.sy + (this.fly.ey - this.fly.sy) * p;
      for (let i = 1; i <= 5; i++) {
        const tp = Math.max(0, p - i * 0.05);
        const tx = this.fly.sx + (this.fly.ex - this.fly.sx) * tp;
        const ty = this.fly.sy + (this.fly.ey - this.fly.sy) * tp;
        cx.beginPath(); cx.arc(tx, ty, 4 - i * 0.5, 0, Math.PI * 2); cx.fillStyle = rgba(C.accent, 0.25 - i * 0.04); cx.fill();
      }
      cx.beginPath(); cx.arc(bx, by, 6, 0, Math.PI * 2); cx.fillStyle = C.accent; cx.fill();
    }

    if (this.phase === 'play') {
      cx.beginPath(); cx.arc(W / 2, H - 38, 7, 0, Math.PI * 2); cx.fillStyle = '#111115'; cx.fill();
      cx.strokeStyle = rgba(C.accent, this.ammo > 0 ? 0.45 : 0.12); cx.lineWidth = 1.5; cx.stroke();
    }

    if (!this.mob && this.phase === 'play') {
      cx.beginPath(); cx.arc(this.mX, this.mY, 18, 0, Math.PI * 2);
      cx.strokeStyle = rgba(C.accent, this.ammo > 0 ? 0.15 : 0.05); cx.lineWidth = 1; cx.stroke();
      cx.beginPath(); cx.moveTo(this.mX - 6, this.mY); cx.lineTo(this.mX + 6, this.mY);
      cx.moveTo(this.mX, this.mY - 6); cx.lineTo(this.mX, this.mY + 6);
      cx.strokeStyle = rgba(C.accent, this.ammo > 0 ? 0.25 : 0.08); cx.lineWidth = 1; cx.stroke();
    }

    this.renderPts(); this.renderPops();

    this.drawHudTitle();
    this.drawHudLine(`SCORE  ${this.score}`, 46);
    this.drawHudLine(`WAVE ${this.wave + 1}/${WAVES.length}`, 62, '#3a3a44');

    cx.textAlign = 'right'; cx.font = '500 9px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('AMMO', W - 20, 28);
    for (let i = 0; i < MAX_AMMO; i++) {
      cx.beginPath(); cx.arc(W - 24 - i * 16, 42, 5, 0, Math.PI * 2);
      cx.fillStyle = i < this.ammo ? C.accent : (i === this.ammo ? rgba(C.accent, 0.12 + (this.ammoT / AMMO_CD) * 0.35) : '#1a1a1f');
      cx.fill();
    }

    this.drawComboHud(this.combo, now, W / 2, H - 60);
    this.drawCloseBtn();

    if (this.phase === 'intro') {
      this.drawIntro(this.phaseT, `WAVE ${this.wave + 1}`, `${WAVES[this.wave].n} TARGETS`);
    }
    if (this.phase === 'result') this.renderResult();
  }

  private renderResult(): void {
    const { bx, by } = this.drawResultBg('COMPLETE');
    const { cx } = this;
    cx.font = '700 36px "JetBrains Mono",monospace'; cx.fillStyle = '#e8e8ec'; cx.fillText(`${this.score}`, bx, by - 16);
    cx.font = '400 10px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66'; cx.fillText('POINTS', bx, by + 4);
    cx.fillText(`${this.hits}/${this.totalTgt} HITS · BEST COMBO ×${this.maxCombo}`, bx, by + 24);
    this.drawResultBtns(bx, by + 48);
  }

  protected onClickAt(x: number, y: number): void {
    if (this.phase === 'result') {
      const hit = this.hitResultBtn(x, y, this.W / 2, this.H / 2 + 48);
      if (hit === 'retry') this.resetGame();
      if (hit === 'exit') this.stop();
      return;
    }
    if (this.phase === 'play') this.throwBall(x, y);
  }

  protected onMouseMoveAt(x: number, y: number): void { this.mX = x; this.mY = y; }
}

export function createSpodyGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
  const game = new SpodyGame(container, onExit, audio);
  return { start: () => game.start(), stop: () => game.stop() };
}
