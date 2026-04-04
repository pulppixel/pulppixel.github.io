// Minigame abstract base: canvas lifecycle, input, particles, popups, shared UI
// + Audio integration

import type { GameAudio } from '../system/audio';

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

// --- Shared types ---

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  a: number; color: string; s: number;
}

export interface Popup {
  x: number; y: number;
  a: number; text: string; big: boolean;
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

  protected abstract readonly title: string;
  protected abstract readonly titleColor: string;
  protected cursorStyle = 'default';

  private aId = 0;
  private readonly container: HTMLElement;
  private readonly onExit: () => void;
  private boundHandlers: { el: EventTarget; type: string; fn: EventListener }[] = [];

  constructor(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    this.container = container;
    this.onExit = onExit;
    this.audio = audio ?? null;
  }

  // --- Lifecycle hooks (subclass implements) ---
  protected abstract resetGame(): void;
  protected abstract updateGame(dt: number): void;
  protected abstract renderGame(now: number): void;
  protected abstract onClickAt(x: number, y: number): void;

  protected onTouchMoveAt(_x: number, _y: number): void {}
  protected onTouchEndAt(): void {}
  protected onMouseMoveAt(_x: number, _y: number): void {}
  protected onResized(): void {}

  get W(): number { return this.cv.width; }
  get H(): number { return this.cv.height; }

  // --- Public API ---

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
    for (const h of this.boundHandlers) h.el.removeEventListener(h.type, h.fn);
    this.boundHandlers = [];
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.onExit();
  }

  // --- Drawing helpers ---

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
    cx.textAlign = 'center'; cx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  protected drawCloseBtn(y = 38): void {
    this.cx.font = '400 16px "JetBrains Mono",monospace';
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

  // --- Particle system (swap-and-pop) ---

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

  // --- Popup system (swap-and-pop) ---

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

  // --- Internal ---

  private rsz(): void { this.cv.width = innerWidth; this.cv.height = innerHeight; this.onResized(); }

  private bind(el: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    el.addEventListener(type, fn, opts); this.boundHandlers.push({ el, type, fn });
  }

  private loop = (): void => {
    if (!this.on) return;
    const n = performance.now();
    const dt = Math.min((n - this.prevT) / 1000, 0.05);
    this.prevT = n;
    this.updateGame(dt); this.renderGame(n / 1000);
    this.aId = requestAnimationFrame(this.loop);
  };

  private isCloseHit(x: number, y: number): boolean { return x > this.W - 40 && y < 50; }

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
