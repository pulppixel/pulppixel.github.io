// Minigame abstract base: canvas lifecycle, input, particles, popups, shared UI
// + Audio integration + Mobile virtual controls

import type { GameAudio } from '../system/audio';
import { fetchTop10, willMakeTop10, submitScore, loadNickname, type ScoreEntry } from './leaderboard.ts';

// --- Utilities ---

export function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const C = {
  bg: '#0a0a0b',
  accent: '#6ee7b7',
  pink: '#ff6b9d',
  purple: '#a78bfa',
  yellow: '#fbbf24',
  cyan: '#67e8f9',
  red: '#ef4444',
  blue: '#38bdf8',
} as const;

export interface Particle { x: number; y: number; vx: number; vy: number; a: number; color: string; s: number; }
export interface Popup { x: number; y: number; a: number; text: string; big: boolean; }

// --- Mobile controls config ---

export interface MobileControlsConfig {
  joystick?: boolean;       // 가상 조이스틱 (왼쪽 하단)
  actionBtn?: string;       // 액션 버튼 라벨 (오른쪽 하단). null이면 비활성
  jumpBtn?: boolean;        // 점프 버튼
}

// --- Abstract base ---

export abstract class MinigameBase {
  protected cv!: HTMLCanvasElement;
  protected cx!: CanvasRenderingContext2D;
  protected on = false;
  protected mob = false;
  protected prevT = 0;
  protected keys: Record<string, boolean> = {};
  protected pts: Particle[] = [];
  protected pops: Popup[] = [];
  protected audio: GameAudio | null;

  // Leaderboard state
  protected lbScores: ScoreEntry[] = [];
  protected lbLoaded = false;
  protected lbNewId: number | null = null;
  protected lbStatus: 'idle' | 'loading' | 'eligible' | 'submitting' | 'done' | 'skipped' = 'idle';
  protected lbForm: HTMLDivElement | null = null;
  private lbCurrentGame: string | null = null;

  // Mobile virtual controls state
  protected mJoy = { x: 0, y: 0 };  // joystick normalized -1~1
  protected mAction = false;          // action button pressed
  protected mJump = false;            // jump button pressed

  protected abstract readonly title: string;
  protected abstract readonly titleColor: string;
  protected cursorStyle = 'default';
  private _dpr = 1;
  private _lw = 0;
  private _lh = 0;

  private aId = 0;
  private readonly container: HTMLElement;
  private readonly onExit: () => void;
  private boundHandlers: { el: EventTarget; type: string; fn: EventListener }[] = [];

  // Mobile UI elements
  private mobileOverlay: HTMLDivElement | null = null;
  private joyBase: HTMLDivElement | null = null;
  private joyThumb: HTMLDivElement | null = null;
  private joyTouchId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private _lastInteractive = true;

  constructor(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    this.container = container;
    this.onExit = onExit;
    this.audio = audio ?? null;
  }

  // --- Lifecycle hooks ---
  protected abstract resetGame(): void;
  protected abstract updateGame(dt: number): void;
  protected abstract renderGame(now: number): void;
  protected abstract onClickAt(x: number, y: number): void;

  protected onTouchMoveAt(_x: number, _y: number): void {}
  protected onTouchEndAt(): void {}
  protected onMouseMoveAt(_x: number, _y: number): void {}
  protected onResized(): void {}

  get W(): number { return this._lw; }
  get H(): number { return this._lh; }

  // --- MOBILE CONTROLS ---

  protected setupMobileControls(config: MobileControlsConfig): void {
    if (!this.mob) return;

    this.mobileOverlay = document.createElement('div');
    this.mobileOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30;';
    this.container.appendChild(this.mobileOverlay);

    if (config.joystick) this.createJoystick();
    if (config.actionBtn) this.createActionBtn(config.actionBtn);
    if (config.jumpBtn) this.createJumpBtn();
  }

  private createJoystick(): void {
    const base = document.createElement('div');
    base.style.cssText = `
      position:absolute; bottom:30px; left:30px;
      width:100px; height:100px; border-radius:50%;
      border:1.5px solid rgba(110,231,183,0.25);
      background:rgba(110,231,183,0.04);
      pointer-events:auto; touch-action:none;
    `;
    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position:absolute; top:50%; left:50%;
      width:40px; height:40px; border-radius:50%;
      background:rgba(110,231,183,0.2);
      border:1px solid rgba(110,231,183,0.4);
      transform:translate(-50%,-50%);
      pointer-events:none;
    `;
    base.appendChild(thumb);
    this.mobileOverlay!.appendChild(base);
    this.joyBase = base;
    this.joyThumb = thumb;

    const JR = 50;

    base.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (this.joyTouchId !== null) return;
      const t = e.changedTouches[0];
      this.joyTouchId = t.identifier;
      const rect = base.getBoundingClientRect();
      this.joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, { passive: false });

    const onMove = (e: TouchEvent) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joyTouchId) continue;
        let dx = t.clientX - this.joyOrigin.x;
        let dy = t.clientY - this.joyOrigin.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; }
        this.mJoy.x = dx / JR;
        this.mJoy.y = dy / JR;
        thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    };

    const onEnd = (e: TouchEvent) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joyTouchId) continue;
        this.joyTouchId = null;
        this.mJoy = { x: 0, y: 0 };
        thumb.style.transform = 'translate(-50%,-50%)';
      }
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    this.boundHandlers.push(
      { el: document, type: 'touchmove', fn: onMove as EventListener },
      { el: document, type: 'touchend', fn: onEnd as EventListener },
      { el: document, type: 'touchcancel', fn: onEnd as EventListener },
    );
  }

  private createActionBtn(label: string): void {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      position:absolute; bottom:40px; right:30px;
      width:60px; height:60px; border-radius:50%;
      border:1.5px solid rgba(110,231,183,0.3);
      background:rgba(110,231,183,0.08);
      color:#6ee7b7; font-size:12px; font-family:'JetBrains Mono',monospace;
      pointer-events:auto; touch-action:none;
      display:flex; align-items:center; justify-content:center;
    `;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.mAction = true;
      btn.style.background = 'rgba(110,231,183,0.25)';
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      this.mAction = false;
      btn.style.background = 'rgba(110,231,183,0.08)';
    });
    this.mobileOverlay!.appendChild(btn);
  }

  private createJumpBtn(): void {
    const btn = document.createElement('button');
    btn.textContent = '▲';
    btn.style.cssText = `
      position:absolute; bottom:110px; right:30px;
      width:50px; height:50px; border-radius:50%;
      border:1.5px solid rgba(110,231,183,0.2);
      background:rgba(110,231,183,0.04);
      color:#6ee7b7; font-size:16px; font-family:'JetBrains Mono',monospace;
      pointer-events:auto; touch-action:none;
      display:flex; align-items:center; justify-content:center;
    `;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.mJump = true;
      btn.style.background = 'rgba(110,231,183,0.25)';
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      this.mJump = false;
      btn.style.background = 'rgba(110,231,183,0.04)';
    });
    this.mobileOverlay!.appendChild(btn);
  }

  private cleanupMobileControls(): void {
    if (this.mobileOverlay) {
      this.mobileOverlay.remove();
      this.mobileOverlay = null;
    }
    this.joyBase = null; this.joyThumb = null; this.joyTouchId = null;
    this.mJoy = { x: 0, y: 0 }; this.mAction = false; this.mJump = false;
  }

  protected setMobileControlsVisible(visible: boolean): void {
    if (!this.mobileOverlay) return;
    if (this._lastInteractive === visible) return;
    this._lastInteractive = visible;
    this.mobileOverlay.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this.joyTouchId = null;
      this.mJoy = { x: 0, y: 0 };
      this.mAction = false;
      this.mJump = false;
      if (this.joyThumb) this.joyThumb.style.transform = 'translate(-50%,-50%)';
    }
  }

  /** 입력을 받아야 하는 phase인지 — 각 게임에서 override */
  protected isInteractive(): boolean { return true; }

  // =============================================
  // PUBLIC API
  // =============================================

  start(): void {
    this.mob = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    this.cv = document.createElement('canvas');
    this.cv.style.cssText = `position:absolute;inset:0;width:100%;height:100%;cursor:${this.cursorStyle};`;
    this.container.innerHTML = '';
    this.container.appendChild(this.cv);
    this.container.style.display = 'block';
    this.cx = this.cv.getContext('2d')!;
    this.rsz();

    this.bind(window, 'resize', () => this.rsz());
    this.bind(this.cv, 'click', (e: Event) => this.handleClick(e as MouseEvent));
    this.bind(this.cv, 'mousemove', (e: Event) => { const me = e as MouseEvent; this.onMouseMoveAt(me.clientX, me.clientY); });
    this.bind(this.cv, 'touchstart', (e: Event) => this.handleTouchStart(e as TouchEvent), { passive: false });
    this.bind(this.cv, 'touchmove', (e: Event) => { (e as TouchEvent).preventDefault(); const t = (e as TouchEvent).changedTouches[0]; this.onTouchMoveAt(t.clientX, t.clientY); }, { passive: false });
    this.bind(this.cv, 'touchend', () => this.onTouchEndAt());
    this.bind(document, 'keydown', (e: Event) => { const ke = e as KeyboardEvent; this.keys[ke.code] = true; if (ke.key === 'Escape') this.stop(); });
    this.bind(document, 'keyup', (e: Event) => { this.keys[(e as KeyboardEvent).code] = false; });

    this.keys = {}; this.pts = []; this.pops = [];
    this.resetGame();
    this.on = true;
    this.prevT = performance.now();
    this.loop();
  }

  stop(): void {
    this.on = false;
    cancelAnimationFrame(this.aId);
    this.destroyLbForm();
    this.cleanupMobileControls();
    for (const h of this.boundHandlers) h.el.removeEventListener(h.type, h.fn);
    this.boundHandlers = [];
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.onExit();
  }

  // --- DRAWING HELPERS ---

  protected drawBg(): void { this.cx.fillStyle = C.bg; this.cx.fillRect(0, 0, this.W, this.H); }

  protected drawGrid(opacity = 0.015): void {
    const { cx } = this;
    cx.strokeStyle = rgba(C.accent, opacity); cx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, this.H); cx.stroke(); }
    for (let y = 0; y < this.H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(this.W, y); cx.stroke(); }
  }

  protected drawBtn(x: number, y: number, w: number, h: number, text: string, primary: boolean): void {
    const { cx } = this;
    cx.beginPath(); cx.roundRect(x, y, w, h, 6);
    cx.fillStyle = primary ? rgba(C.accent, 0.1) : 'transparent'; cx.fill();
    cx.strokeStyle = primary ? rgba(C.accent, 0.4) : '#333'; cx.lineWidth = 1; cx.stroke();
    cx.font = '500 12px "JetBrains Mono",monospace';
    cx.fillStyle = primary ? C.accent : '#8a8a9a';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, x + w / 2, y + h / 2);
    cx.textBaseline = 'alphabetic';
  }

  protected drawCloseBtn(y = 38): void {
    // 모바일에서 닫기 버튼 더 크게
    const sz = this.mob ? 48 : 40;
    this.cx.font = `400 ${this.mob ? 20 : 16}px "JetBrains Mono",monospace`;
    this.cx.fillStyle = '#5a5a66'; this.cx.textAlign = 'center';
    this.cx.fillText('\u2715', this.W - 22, y);
  }

  protected drawHudTitle(): void {
    this.cx.textAlign = 'left';
    this.cx.font = '600 11px "JetBrains Mono",monospace';
    this.cx.fillStyle = this.titleColor;
    this.cx.fillText('\u25C6 ' + this.title, 20, 28);
  }

  protected drawHudLine(text: string, y: number, color = '#7a7a8a'): void {
    this.cx.font = '500 10px "JetBrains Mono",monospace';
    this.cx.fillStyle = color; this.cx.textAlign = 'left'; this.cx.fillText(text, 20, y);
  }

  // --- Particle system ---

  protected updatePts(dt: number, gravity = 0): void {
    let i = this.pts.length;
    while (i-- > 0) {
      const p = this.pts[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (gravity) p.vy += gravity * dt;
      p.a -= dt * 2.5;
      if (p.a <= 0) { this.pts[i] = this.pts[this.pts.length - 1]; this.pts.pop(); }
    }
  }

  protected renderPts(): void {
    for (const p of this.pts) {
      this.cx.beginPath(); this.cx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      this.cx.fillStyle = rgba(p.color, Math.min(p.a, 1)); this.cx.fill();
    }
  }

  protected addBurst(x: number, y: number, color: string, count = 7, force = 100): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 60 + Math.random() * force;
      this.pts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, a: 1, color, s: 2 + Math.random() * 3 });
    }
  }

  // --- Popup system ---

  protected updatePops(dt: number): void {
    let i = this.pops.length;
    while (i-- > 0) {
      const p = this.pops[i];
      p.y -= (p.big ? 38 : 24) * dt; p.a -= dt * 0.6;
      if (p.a <= 0) { this.pops[i] = this.pops[this.pops.length - 1]; this.pops.pop(); }
    }
  }

  protected renderPops(): void {
    for (const p of this.pops) {
      this.cx.font = p.big ? '700 16px "JetBrains Mono",monospace' : '600 13px "JetBrains Mono",monospace';
      this.cx.fillStyle = rgba(p.big ? C.yellow : C.accent, Math.min(p.a, 1));
      this.cx.textAlign = 'center'; this.cx.fillText(p.text, p.x, p.y);
    }
  }

  protected addPop(x: number, y: number, text: string, big = false, duration = 1.2): void {
    this.pops.push({ x, y, a: duration, text, big });
  }

  // --- Phase overlay helpers ---

  protected drawIntro(phaseT: number, line1: string, line2: string, line3?: string): void {
    const { cx, W, H } = this;
    const p = Math.min(1, (1.3 - phaseT) / 0.4);
    cx.fillStyle = rgba(C.bg, 0.55 * (1 - Math.max(0, (phaseT - 0.3) / 1.0)));
    cx.fillRect(0, 0, W, H);
    cx.textAlign = 'center'; cx.globalAlpha = p;
    cx.font = '700 26px "JetBrains Mono",monospace'; cx.fillStyle = this.titleColor;
    cx.fillText(line1, W / 2, H / 2 - 16);
    cx.font = '400 11px "JetBrains Mono",monospace'; cx.fillStyle = '#5a5a66';
    cx.fillText(line2, W / 2, H / 2 + 12);
    if (line3) cx.fillText(line3, W / 2, H / 2 + 30);
    cx.globalAlpha = 1;
  }

  protected drawResultBg(title: string, color: string = C.accent): { bx: number; by: number } {
    this.cx.fillStyle = rgba(C.bg, 0.85); this.cx.fillRect(0, 0, this.W, this.H);
    const bx = this.W / 2, by = this.H / 2;
    this.cx.textAlign = 'center'; this.cx.font = '600 12px "JetBrains Mono",monospace';
    this.cx.fillStyle = color; this.cx.fillText(title, bx, by - 62);
    return { bx, by };
  }

  protected drawResultBtns(bx: number, btnY: number): void {
    this.drawBtn(bx - 112, btnY, 100, 34, '\uB2E4\uC2DC', true);
    this.drawBtn(bx + 12, btnY, 100, 34, '\uB098\uAC00\uAE30', false);
  }

  protected hitResultBtn(x: number, y: number, bx: number, btnY: number): 'retry' | 'exit' | null {
    if (x > bx - 112 && x < bx - 12 && y > btnY && y < btnY + 34) return 'retry';
    if (x > bx + 12 && x < bx + 112 && y > btnY && y < btnY + 34) return 'exit';
    return null;
  }

  protected drawComboHud(combo: number, now: number, x: number, y: number): void {
    if (combo < 2) return;
    this.cx.textAlign = 'center';
    this.cx.font = `700 ${14 + Math.min(combo, 5) * 2}px "JetBrains Mono",monospace`;
    this.cx.fillStyle = rgba(C.yellow, 0.5 + Math.sin(now * 5) * 0.15);
    this.cx.fillText('\u00D7' + combo, x, y);
  }

  // =============================================
  // LEADERBOARD
  // =============================================

  /** result 진입 시 호출. 점수 fetch + Top10이면 form 띄움 */
  protected async startLeaderboard(gameId: string, score: number, metadata: any = {}): Promise<void> {
    if (this.lbStatus !== 'idle') return;
    this.lbCurrentGame = gameId;
    this.lbStatus = 'loading';
    this.lbScores = await fetchTop10(gameId);
    this.lbLoaded = true;

    if (willMakeTop10(this.lbScores, score)) {
      this.lbStatus = 'eligible';
      this.createLbForm(gameId, score, metadata);
    } else {
      this.lbStatus = 'skipped';
    }
  }

  private createLbForm(gameId: string, score: number, metadata: any): void {
    if (this.lbForm) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${Math.min(340, this.W - 40)}px;background:rgba(10,10,11,0.95);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:20px;z-index:30;font-family:'JetBrains Mono',monospace;backdrop-filter:blur(12px);box-shadow:0 0 40px rgba(251,191,36,0.15);`;

    wrap.innerHTML = `
      <div style="font-size:9px;color:#fbbf24;letter-spacing:0.12em;margin-bottom:6px;">★ TOP 10 ENTRY</div>
      <div style="font-size:18px;color:#e8e8ec;font-weight:600;margin-bottom:14px;">SCORE ${Math.round(score)}</div>
      <input id="lb-nick" type="text" maxlength="20" placeholder="닉네임 (선택)"
        style="width:100%;background:#161618;border:1px solid #2a2a30;color:#e8e8ec;padding:10px 12px;border-radius:4px;font-family:inherit;font-size:12px;box-sizing:border-box;margin-bottom:10px;outline:none;" />
      <div id="lb-err" style="font-size:10px;color:#ef4444;min-height:14px;margin-bottom:6px;"></div>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button id="lb-skip" style="background:none;border:1px solid #333;color:#8a8a9a;padding:7px 14px;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer;">건너뛰기</button>
        <button id="lb-submit" style="background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.4);color:#fbbf24;padding:7px 14px;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer;">등록</button>
      </div>
    `;

    this.cv.parentElement!.appendChild(wrap);
    this.lbForm = wrap;

    const nickEl = wrap.querySelector('#lb-nick') as HTMLInputElement;
    const errEl = wrap.querySelector('#lb-err') as HTMLElement;
    const placeholder = loadNickname();
    if (placeholder) nickEl.placeholder = placeholder;

    const doSubmit = async () => {
      if (this.lbStatus !== 'eligible') return;
      this.lbStatus = 'submitting';
      const result = await submitScore(gameId, nickEl.value || placeholder || 'anonymous', score, metadata);
      if (result.ok) {
        this.lbNewId = result.newId ?? null;
        this.lbScores = await fetchTop10(gameId);
        this.lbStatus = 'done';
        this.audio?.mgCoin(3);
        this.destroyLbForm();
      } else {
        errEl.textContent = result.error || '실패';
        this.lbStatus = 'eligible';
      }
    };

    nickEl.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doSubmit();
      }
    });
    wrap.querySelector('#lb-submit')!.addEventListener('click', doSubmit);
    wrap.querySelector('#lb-skip')!.addEventListener('click', () => {
      this.lbStatus = 'skipped';
      this.destroyLbForm();
    });

    setTimeout(() => nickEl.focus(), 50);
  }

  private destroyLbForm(): void {
    this.lbForm?.remove();
    this.lbForm = null;
  }

  /** Result 화면에서 호출. (cx, cy) 중심으로 Top10 리스트 그림 */
  protected drawLeaderboard(cx: number, cy: number, width = 280): void {
    const c = this.cx;
    const lineH = 16;
    const headerH = 18;
    const totalH = headerH + 10 * lineH + 8;
    const x = cx - width / 2;
    const y = cy - totalH / 2;

    // Background
    c.fillStyle = rgba(C.bg, 0.7);
    c.beginPath();
    c.roundRect(x, y, width, totalH, 6);
    c.fill();
    c.strokeStyle = rgba(C.accent, 0.15);
    c.lineWidth = 1;
    c.stroke();

    // Header
    c.font = '600 9px "JetBrains Mono",monospace';
    c.fillStyle = '#5a5a66';
    c.textAlign = 'left';
    c.fillText('★ TOP 10', x + 12, y + 13);
    c.textAlign = 'right';
    c.fillText(this.lbLoaded ? `${this.lbScores.length} ENTRIES` : 'LOADING...', x + width - 12, y + 13);

    // Entries
    c.font = '500 10px "JetBrains Mono",monospace';
    for (let i = 0; i < 10; i++) {
      const ey = y + headerH + 6 + i * lineH + 8;
      const entry = this.lbScores[i];
      const isNew = entry && entry.id === this.lbNewId;

      // Rank
      c.textAlign = 'left';
      c.fillStyle = isNew ? C.yellow : i < 3 ? rgba(C.accent, 0.7) : '#3a3a44';
      c.fillText(`${i + 1}`.padStart(2, '0'), x + 12, ey);

      if (entry) {
        // Nickname (truncate)
        c.fillStyle = isNew ? C.yellow : '#a8a8b3';
        const nick = entry.nickname.length > 12 ? entry.nickname.slice(0, 11) + '…' : entry.nickname;
        c.fillText(nick, x + 36, ey);

        // Score (right-aligned)
        c.textAlign = 'right';
        c.fillStyle = isNew ? C.yellow : '#e8e8ec';
        c.fillText(`${Math.round(entry.score)}`, x + width - 12, ey);

        // NEW badge
        if (isNew) {
          c.font = '700 8px "JetBrains Mono",monospace';
          c.fillStyle = C.yellow;
          c.textAlign = 'left';
          c.fillText('NEW', x + width - 80, ey);
          c.font = '500 10px "JetBrains Mono",monospace';
        }
      } else {
        c.fillStyle = '#1f1f24';
        c.fillText('—', x + 36, ey);
      }
    }
  }

  protected isLeaderboardBusy(): boolean {
    return this.lbStatus === 'loading' || this.lbStatus === 'submitting' || this.lbForm !== null;
  }

  // --- Internal ---

  private rsz(): void {
    this._dpr = Math.min(devicePixelRatio || 1, 2.5);
    this._lw = innerWidth;
    this._lh = innerHeight;
    this.cv.width = this._lw * this._dpr;
    this.cv.height = this._lh * this._dpr;
    this.cx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this.onResized();
  }

  private bind(el: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    el.addEventListener(type, fn, opts); this.boundHandlers.push({ el, type, fn });
  }

  private loop = (): void => {
    if (!this.on) return;
    const n = performance.now();
    const dt = Math.min((n - this.prevT) / 1000, 0.05);
    this.prevT = n;
    this.updateGame(dt); this.renderGame(n / 1000);
    this.setMobileControlsVisible(this.isInteractive());
    this.aId = requestAnimationFrame(this.loop);
  };

  private isCloseHit(x: number, y: number): boolean {
    const sz = this.mob ? 60 : 44;
    return x > this.W - sz && y < sz;
  }

  private handleClick(e: MouseEvent): void {
    if (this.isCloseHit(e.clientX, e.clientY)) { this.stop(); return; }
    this.onClickAt(e.clientX, e.clientY);
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (this.isCloseHit(t.clientX, t.clientY)) { this.stop(); return; }
    this.onClickAt(t.clientX, t.clientY);
  }
}
