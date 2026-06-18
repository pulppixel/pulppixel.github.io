// Minigame abstract base: canvas lifecycle, input, particles, popups, shared UI
// + Audio integration + Mobile virtual controls

import type { GameAudio } from '../system/audio';

// --- Utilities ---

export function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// 게임 그래픽 팔레트 — Rosé Pine 액센트로 통일(네온/고채도 제거).
// accent/cyan은 maze·nomads에서 플레이어 vs 수집물로 공존 → 밝기로 구분 유지.
export const C = {
  bg: '#191724',
  accent: '#9ccfd8',  // foam — 플레이어·벽·기본 UI·긍정 피드백
  pink: '#ebbcba',    // rose
  purple: '#c4a7e7',  // iris
  yellow: '#f6c177',  // gold — 보상·강조
  cyan: '#31748f',    // pine — 수집물(보석/코인)·테크 틴트
  red: '#eb6f92',     // love — 위험·적
  blue: '#31748f',    // pine — 장식용 변주 팔레트에서만 사용
} as const;

// 공용 chrome(HUD·버튼·닫기·결과화면) 전용 Rosé Pine 색. 게임 그래픽 색(C.*)과 분리.
export const UI = {
  foam: '#9ccfd8', iris: '#c4a7e7',
  muted: '#6e6a86', subtle: '#908caa', line: '#403d52',
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

  // Leaderboard state — Supabase 제거됨. 게임 코드 호환을 위한 잔여 필드 (오프라인 no-op).
  protected lbScores: any[] = [];
  protected lbNewId: number | null = null;
  protected lbStatus: 'idle' = 'idle';

  // Mobile virtual controls state
  protected mJoy = { x: 0, y: 0 };  // joystick normalized -1~1
  protected mAction = false;          // action button pressed
  protected mJump = false;            // jump button pressed

  protected abstract readonly title: string;
  protected abstract readonly titleColor: string;
  protected cursorStyle = 'default';
  private _dpr = 1;
  private _lw = 0;   // 창 본문(content) 폭 — W getter가 반환
  private _lh = 0;   // 창 본문 높이 — H getter가 반환

  // --- 맥OS 터미널 창 chrome 지오메트리 ---
  private _vw = 0;            // 뷰포트 폭
  private _vh = 0;            // 뷰포트 높이
  private winM = 0;           // 창 바깥 여백(데스크탑 마진)
  private winTB = 0;          // 타이틀바 높이
  private winR = 0;           // 모서리 라운드 반경
  private cX = 0;             // 본문 좌상단 x (CSS px)
  private cY = 0;             // 본문 좌상단 y (CSS px)
  private scanPat: CanvasPattern | null = null;  // CRT 스캔라인 패턴(데스크탑만)

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
      border:1.5px solid rgba(156,207,216,0.25);
      background:rgba(156,207,216,0.04);
      pointer-events:auto; touch-action:none;
    `;
    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position:absolute; top:50%; left:50%;
      width:40px; height:40px; border-radius:50%;
      background:rgba(156,207,216,0.2);
      border:1px solid rgba(156,207,216,0.4);
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
      width:60px; height:60px; border-radius:14px;
      border:1.5px solid rgba(156,207,216,0.3);
      background:rgba(156,207,216,0.08);
      color:#9ccfd8; font-size:12px; font-family:'Cascadia Code','JetBrains Mono',monospace;
      pointer-events:auto; touch-action:none;
      display:flex; align-items:center; justify-content:center;
    `;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.mAction = true;
      btn.style.background = 'rgba(156,207,216,0.25)';
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      this.mAction = false;
      btn.style.background = 'rgba(156,207,216,0.08)';
    });
    this.mobileOverlay!.appendChild(btn);
  }

  private createJumpBtn(): void {
    const btn = document.createElement('button');
    btn.textContent = '▲';
    btn.style.cssText = `
      position:absolute; bottom:110px; right:30px;
      width:50px; height:50px; border-radius:14px;
      border:1.5px solid rgba(156,207,216,0.2);
      background:rgba(156,207,216,0.04);
      color:#9ccfd8; font-size:16px; font-family:'Cascadia Code','JetBrains Mono',monospace;
      pointer-events:auto; touch-action:none;
      display:flex; align-items:center; justify-content:center;
    `;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.mJump = true;
      btn.style.background = 'rgba(156,207,216,0.25)';
    }, { passive: false });
    btn.addEventListener('touchend', () => {
      this.mJump = false;
      btn.style.background = 'rgba(156,207,216,0.04)';
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
    this.buildScanPattern();
    this.rsz();

    this.bind(window, 'resize', () => this.rsz());
    this.bind(this.cv, 'click', (e: Event) => this.handleClick(e as MouseEvent));
    this.bind(this.cv, 'mousemove', (e: Event) => { const me = e as MouseEvent; this.onMouseMoveAt(me.clientX - this.cX, me.clientY - this.cY); });
    this.bind(this.cv, 'touchstart', (e: Event) => this.handleTouchStart(e as TouchEvent), { passive: false });
    this.bind(this.cv, 'touchmove', (e: Event) => { (e as TouchEvent).preventDefault(); const t = (e as TouchEvent).changedTouches[0]; this.onTouchMoveAt(t.clientX - this.cX, t.clientY - this.cY); }, { passive: false });
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
    cx.fillStyle = primary ? rgba(UI.foam, 0.12) : 'transparent'; cx.fill();
    cx.strokeStyle = primary ? UI.foam : UI.line; cx.lineWidth = 1; cx.stroke();
    cx.font = '500 12px "Cascadia Code","D2Coding","JetBrains Mono",monospace';
    cx.fillStyle = primary ? UI.foam : UI.subtle;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, x + w / 2, y + h / 2);
    cx.textBaseline = 'alphabetic';
  }

  // 닫기·타이틀은 맥OS 터미널 창 타이틀바(신호등 + 중앙 타이틀)로 흡수됨 → 본문 내 no-op.
  // (게임 코드 호환을 위해 시그니처 유지)
  protected drawCloseBtn(_y = 38): void {}

  protected drawHudTitle(): void {}

  protected drawHudLine(text: string, y: number, color = UI.subtle): void {
    this.cx.font = '500 10px "Cascadia Code","D2Coding","JetBrains Mono",monospace';
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
    cx.font = '700 26px "Cascadia Code","D2Coding","JetBrains Mono",monospace'; cx.fillStyle = this.titleColor;
    cx.fillText(line1, W / 2, H / 2 - 16);
    cx.font = '400 11px "Cascadia Code","D2Coding","JetBrains Mono",monospace'; cx.fillStyle = UI.muted;
    cx.fillText(line2, W / 2, H / 2 + 12);
    if (line3) cx.fillText(line3, W / 2, H / 2 + 30);
    cx.globalAlpha = 1;
  }

  protected drawResultBg(title: string, color: string = UI.foam): { bx: number; by: number } {
    this.cx.fillStyle = rgba(C.bg, 0.88); this.cx.fillRect(0, 0, this.W, this.H);
    const bx = this.W / 2, by = this.H / 2;
    this.cx.textAlign = 'center'; this.cx.font = '600 12px "Cascadia Code","D2Coding","JetBrains Mono",monospace';
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
  // LEADERBOARD — Supabase 제거됨. 오프라인 no-op 스텁 (게임 코드 호환용).
  // 결과 화면의 Top10 패널 자리는 비어 있음 → 브루탈리스트 UI 리스타일 때 정리 예정.
  // =============================================

  protected async startLeaderboard(_gameId: string, _score: number, _metadata: any = {}): Promise<void> {}

  protected drawLeaderboard(_cx: number, _cy: number, _width = 280): void {}

  protected isLeaderboardBusy(): boolean { return false; }

  // --- Internal ---

  private rsz(): void {
    this._dpr = Math.min(devicePixelRatio || 1, 2.5);
    this._vw = innerWidth;
    this._vh = innerHeight;
    this.cv.width = this._vw * this._dpr;
    this.cv.height = this._vh * this._dpr;
    this.cx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    // 맥OS 터미널 창 지오메트리: 모바일은 전체화면(마진 0), 데스크탑은 살짝 띄운 창
    this.winM = this.mob ? 0 : 22;
    this.winTB = this.mob ? 30 : 36;
    this.winR = this.mob ? 0 : 9;
    this.cX = this.winM;
    this.cY = this.winM + this.winTB;
    this._lw = this._vw - this.winM * 2;            // 본문 폭
    this._lh = this._vh - this.winM * 2 - this.winTB; // 본문 높이
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
    this.updateGame(dt);

    const { cx } = this;
    // 1) 데스크탑 배경 + 터미널 창 본체 + 타이틀바(신호등)
    this.drawWindow();
    // 2) 게임 렌더 — 창 본문 영역으로 평행이동 + 클립
    cx.save();
    cx.beginPath();
    cx.roundRect(this.cX, this.cY, this._lw, this._lh, [0, 0, this.winR, this.winR]);
    cx.clip();
    cx.translate(this.cX, this.cY);
    this.renderGame(n / 1000);
    cx.restore();
    // 3) 창 테두리 + 스캔라인(본문 위)
    this.drawWindowFrame();

    this.setMobileControlsVisible(this.isInteractive());
    this.aId = requestAnimationFrame(this.loop);
  };

  // 1x3 스캔라인 패턴 생성(데스크탑 CRT 질감) — 한 번만
  private buildScanPattern(): void {
    if (this.mob) { this.scanPat = null; return; }
    const pc = document.createElement('canvas');
    pc.width = 1; pc.height = 3;
    const pcx = pc.getContext('2d')!;
    pcx.fillStyle = 'rgba(0,0,0,0.14)';
    pcx.fillRect(0, 2, 1, 1);
    this.scanPat = this.cx.createPattern(pc, 'repeat');
  }

  // 데스크탑 배경 + 창 본체 + 타이틀바 + 신호등 버튼
  private drawWindow(): void {
    const { cx } = this;
    const m = this.winM, tb = this.winTB, r = this.winR;
    const ww = this._vw - m * 2, wh = this._vh - m * 2;

    // 데스크탑 배경(창보다 어둡게)
    cx.fillStyle = '#100e18';
    cx.fillRect(0, 0, this._vw, this._vh);

    // 창 본체
    cx.beginPath(); cx.roundRect(m, m, ww, wh, r);
    cx.fillStyle = C.bg; cx.fill();

    // 타이틀바
    cx.save();
    cx.beginPath(); cx.roundRect(m, m, ww, tb, [r, r, 0, 0]); cx.clip();
    cx.fillStyle = '#1f1d2e'; cx.fillRect(m, m, ww, tb);
    cx.restore();
    // 타이틀바 하단 구분선
    cx.strokeStyle = UI.line; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(m, m + tb - 0.5); cx.lineTo(m + ww, m + tb - 0.5); cx.stroke();

    // 신호등 버튼 (close=love / min=gold / max=green)
    const dotY = m + tb / 2;
    const dotX = m + (this.mob ? 16 : 18);
    const gap = 20, rad = 6;
    const lights = ['#eb6f92', '#f6c177', '#8ec8a3'];  // love / gold / 세이지(Rosé Pine 톤)
    for (let i = 0; i < 3; i++) {
      cx.beginPath(); cx.arc(dotX + i * gap, dotY, rad, 0, Math.PI * 2);
      cx.fillStyle = lights[i]; cx.fill();
    }

    // 타이틀 텍스트(중앙)
    cx.fillStyle = UI.subtle;
    cx.font = '600 11px "Cascadia Code","D2Coding","JetBrains Mono",monospace';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(this.title, m + ww / 2, dotY + 0.5);
    cx.textBaseline = 'alphabetic';
  }

  // 창 테두리 + 본문 스캔라인
  private drawWindowFrame(): void {
    const { cx } = this;
    const m = this.winM, r = this.winR;
    const ww = this._vw - m * 2, wh = this._vh - m * 2;
    if (this.scanPat) {
      cx.save();
      cx.fillStyle = this.scanPat;
      cx.fillRect(this.cX, this.cY, this._lw, this._lh);
      cx.restore();
    }
    cx.beginPath(); cx.roundRect(m, m, ww, wh, r);
    cx.strokeStyle = UI.line; cx.lineWidth = 1; cx.stroke();
  }

  // 닫기 히트 = 빨간 신호등(타이틀바 좌측). 모바일은 넉넉하게.
  private isCloseHit(x: number, y: number): boolean {
    const dx = x - (this.winM + (this.mob ? 16 : 18));
    const dy = y - (this.winM + this.winTB / 2);
    const r = this.mob ? 16 : 11;
    return dx * dx + dy * dy < r * r;
  }

  private handleClick(e: MouseEvent): void {
    if (this.isCloseHit(e.clientX, e.clientY)) { this.stop(); return; }
    this.onClickAt(e.clientX - this.cX, e.clientY - this.cY);
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (this.isCloseHit(t.clientX, t.clientY)) { this.stop(); return; }
    this.onClickAt(t.clientX - this.cX, t.clientY - this.cY);
  }
}
