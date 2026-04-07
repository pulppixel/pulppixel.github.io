// PULPPIXEL Guestbook — Supabase REST API
import { MinigameBase, rgba, C } from './base';
import type { GameAudio } from '../system/audio';

const SB_URL = 'https://fmizlkvnlantaopdwwrn.supabase.co';
const SB_KEY = 'sb_publishable_-XhnhEFgHoZvBD8jEl1hlQ_IXoDJHO1';
const API = `${SB_URL}/rest/v1/guestbook`;
const AUTH_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const POST_HEADERS = { ...AUTH_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const MAX_MSG = 200;
const MAX_NICK = 20;
const FETCH_LIMIT = 50;
const ENTRY_H = 52;

interface GuestEntry {
    id: number;
    nickname: string;
    message: string;
    created_at: string;
}

type Phase = 'loading' | 'browse' | 'write';

class GuestbookGame extends MinigameBase {
    protected readonly title = 'PULPPIXEL GUESTBOOK';
    protected readonly titleColor = '#a78bfa';
    protected cursorStyle = 'default';

    private phase: Phase = 'loading';
    private entries: GuestEntry[] = [];
    private scroll = 0;
    private maxScroll = 0;
    private nickname = '';
    private message = '';
    private sending = false;
    private toast = '';
    private toastLife = 0;
    private formWrap: HTMLDivElement | null = null;
    private particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    protected resetGame(): void {
        this.phase = 'loading';
        this.entries = [];
        this.scroll = 0;
        this.message = '';
        this.sending = false;
        this.toast = '';
        this.toastLife = 0;
        this.fetchEntries().then(_ => {});
    }

    private async fetchEntries(): Promise<void> {
        try {
            const res = await fetch(
                `${API}?select=*&order=created_at.desc&limit=${FETCH_LIMIT}`,
                { headers: AUTH_HEADERS },
            );
            if (!res.ok) throw new Error(`${res.status}`);
            this.entries = await res.json();
        } catch {
            this.entries = [];
            this.showToast('불러오기 실패');
        }
        this.phase = 'browse';
        this.calcScroll();
    }

    private lastSubmitTime = 0;
    private static COOLDOWN = 10000;

    private async submitEntry(): Promise<void> {
        const now = Date.now();
        if (now - this.lastSubmitTime < GuestbookGame.COOLDOWN) {
            this.showToast(`${Math.ceil((GuestbookGame.COOLDOWN - (now - this.lastSubmitTime)) / 1000)}초 후 다시 시도해주세요`);
            return;
        }
        const nick = this.nickname.trim() || 'anonymous';
        const msg = this.message.trim();
        if (!msg || msg.length > MAX_MSG || nick.length > MAX_NICK) {
            this.showToast('1~200자 메시지를 입력하세요');
            return;
        }
        this.sending = true;
        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: POST_HEADERS,
                body: JSON.stringify({ nickname: nick, message: msg }),
            });
            if (!res.ok) throw new Error(`${res.status}`);
            this.lastSubmitTime = now;
            this.audio?.mgCoin(3);
            this.showToast('등록 완료!');
            this.message = '';
            this.destroyForm();
            this.phase = 'loading';
            await this.fetchEntries();
        } catch {
            this.showToast('전송 실패');
        } finally {
            this.sending = false;
        }
    }

    private showToast(text: string): void {
        this.toast = text;
        this.toastLife = 2.0;
    }

    private calcScroll(): void {
        const listH = this.H - 140;
        this.maxScroll = Math.max(0, this.entries.length * ENTRY_H - listH);
    }

    private createForm(): void {
        if (this.formWrap) return;

        const wrap = document.createElement('div');
        wrap.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:${Math.min(360, this.W - 40)}px;
      background:rgba(10,10,11,0.95); border:1px solid rgba(167,139,250,0.25);
      border-radius:8px; padding:20px; z-index:30;
      font-family:'JetBrains Mono',monospace;
      backdrop-filter:blur(12px);
    `;

        wrap.innerHTML = `
      <div style="font-size:10px;color:#a78bfa;letter-spacing:0.1em;margin-bottom:12px">◆ 방명록 작성</div>
      <input id="gb-nick" type="text" maxlength="${MAX_NICK}" placeholder="닉네임 (선택)"
        style="width:100%;background:#161618;border:1px solid #2a2a30;color:#e8e8ec;
        padding:10px 14px;border-radius:4px;font-family:inherit;font-size:12px;
        box-sizing:border-box;margin-bottom:8px;outline:none;" />
      <textarea id="gb-msg" maxlength="${MAX_MSG}" placeholder="메시지를 남겨주세요 (1~${MAX_MSG}자)"
        style="width:100%;height:80px;background:#161618;border:1px solid #2a2a30;
        color:#e8e8ec;padding:10px 14px;border-radius:4px;font-family:inherit;
        box-sizing:border-box;font-size:12px;resize:none;outline:none;margin-bottom:4px;"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span id="gb-count" style="font-size:10px;color:#5a5a66">0/${MAX_MSG}</span>
        <div style="display:flex;gap:6px;">
          <button id="gb-cancel" style="background:none;border:1px solid #333;color:#8a8a9a;
            padding:6px 14px;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer;">취소</button>
          <button id="gb-submit" style="background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.3);
            color:#a78bfa;padding:6px 14px;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer;">등록</button>
        </div>
      </div>
    `;

        this.cv.parentElement!.appendChild(wrap);
        this.formWrap = wrap;

        const nickEl = wrap.querySelector('#gb-nick') as HTMLInputElement;
        const msgEl = wrap.querySelector('#gb-msg') as HTMLTextAreaElement;
        const countEl = wrap.querySelector('#gb-count') as HTMLElement;

        nickEl.value = this.nickname;
        msgEl.value = '';
        this.message = '';

        msgEl.addEventListener('input', () => {
            this.message = msgEl.value;
            countEl.textContent = `${msgEl.value.length}/${MAX_MSG}`;
            this.spawnPixels();
        });
        nickEl.addEventListener('input', () => {
            this.nickname = nickEl.value;
            this.spawnPixels();
        });
        wrap.querySelector('#gb-cancel')!.addEventListener('click', () => {
            this.destroyForm();
            this.phase = 'browse';
        });
        wrap.querySelector('#gb-submit')!.addEventListener('click', () => this.submitEntry());

        // Prevent ESC from closing the entire minigame while typing
        nickEl.addEventListener('keydown', (e) => e.stopPropagation());
        msgEl.addEventListener('keydown', (e) => {
            e.stopPropagation();
            this.spawnPixels();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitEntry().then(_ => {});
            }
            this.spawnPixels();
        });

        setTimeout(() => nickEl.focus(), 50);
    }

    private spawnPixels(): void {
        if (!this.formWrap) return;
        this.audio?.mgKey();
        const rect = this.formWrap.getBoundingClientRect();
        const cvRect = this.cv.getBoundingClientRect();
        const fx = rect.left + Math.random() * rect.width - cvRect.left;
        const fy = rect.top - cvRect.top;
        for (let i = 0; i < 2; i++) {
            this.particles.push({
                x: fx + (Math.random() - 0.5) * 6,
                y: fy,
                vx: (Math.random() - 0.5) * 40,
                vy: -80 - Math.random() * 40,
                life: 0.7 + Math.random() * 0.3,
            });
        }
    }

    private destroyForm(): void {
        this.formWrap?.remove();
        this.formWrap = null;
    }

    stop(): void {
        this.destroyForm();
        super.stop();
    }

    protected updateGame(dt: number): void {
        if (this.toastLife > 0) this.toastLife -= dt;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 90 * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    protected renderGame(now: number): void {
        const { cx, W, H } = this;
        this.drawBg();
        this.drawGrid(0.012);

        this.drawHudTitle();
        cx.font = '400 9px "JetBrains Mono"';
        cx.fillStyle = '#5a5a66';
        cx.textAlign = 'left';
        cx.fillText(`${this.entries.length} messages`, 20, 46);

        if (this.phase === 'browse') {
            const bw = 80, bh = 28, bx = W - bw - 60, by = 22;
            cx.beginPath();
            cx.roundRect(bx, by, bw, bh, 4);
            cx.fillStyle = rgba('#a78bfa', 0.08);
            cx.fill();
            cx.strokeStyle = rgba('#a78bfa', 0.3);
            cx.lineWidth = 1;
            cx.stroke();
            cx.font = '500 10px "JetBrains Mono"';
            cx.fillStyle = '#a78bfa';
            cx.textAlign = 'center';
            cx.fillText('✎ 작성', bx + bw / 2, by + bh / 2 + 3);
        }

        this.drawCloseBtn();

        if (this.phase === 'loading') {
            cx.font = '400 12px "JetBrains Mono"';
            cx.fillStyle = rgba('#a78bfa', 0.5 + Math.sin(now * 4) * 0.3);
            cx.textAlign = 'center';
            cx.fillText('불러오는 중...', W / 2, H / 2);
            return;
        }

        const listTop = 64;
        const listH = H - listTop - 20;

        cx.save();
        cx.beginPath();
        cx.rect(0, listTop, W, listH);
        cx.clip();

        if (this.entries.length === 0) {
            cx.font = '400 11px "JetBrains Mono"';
            cx.fillStyle = '#5a5a66';
            cx.textAlign = 'center';
            cx.fillText('아직 메시지가 없습니다', W / 2, H / 2);
            cx.fillText('첫 번째 방명록을 남겨보세요!', W / 2, H / 2 + 18);
        }

        for (let i = 0; i < this.entries.length; i++) {
            const e = this.entries[i];
            const y = listTop + i * ENTRY_H - this.scroll;
            if (y + ENTRY_H < listTop || y > listTop + listH) continue;

            cx.fillStyle = i % 2 === 0 ? rgba('#a78bfa', 0.015) : 'transparent';
            cx.fillRect(16, y, W - 32, ENTRY_H - 2);

            cx.fillStyle = rgba('#a78bfa', 0.15);
            cx.fillRect(16, y + 4, 2, ENTRY_H - 10);

            cx.font = '600 10px "JetBrains Mono"';
            cx.fillStyle = '#a78bfa';
            cx.textAlign = 'left';
            cx.fillText(e.nickname, 28, y + 16);

            const date = new Date(e.created_at);
            const ts = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            cx.font = '400 9px "JetBrains Mono"';
            cx.fillStyle = '#3a3a44';
            cx.fillText(ts, 28 + cx.measureText(e.nickname).width + 8, y + 16);

            cx.font = '400 11px "JetBrains Mono"';
            cx.fillStyle = '#a8a8b3';
            const truncated = e.message.length > 60 ? e.message.slice(0, 60) + '...' : e.message;
            cx.fillText(truncated, 28, y + 34);
        }

        cx.restore();

        for (const p of this.particles) {
            cx.fillStyle = rgba('#a78bfa', Math.min(1, p.life * 2));
            cx.fillRect(Math.floor(p.x / 2) * 2, Math.floor(p.y / 2) * 2, 5, 5);
        }

        if (this.maxScroll > 0) {
            const barH = Math.max(20, listH * (listH / (this.entries.length * ENTRY_H)));
            const barY = listTop + (this.scroll / this.maxScroll) * (listH - barH);
            cx.fillStyle = rgba('#a78bfa', 0.15);
            cx.fillRect(W - 8, barY, 3, barH);
        }

        if (this.toastLife > 0) {
            cx.font = '500 11px "JetBrains Mono"';
            cx.fillStyle = rgba('#a78bfa', Math.min(1, this.toastLife) * 0.8);
            cx.textAlign = 'center';
            cx.fillText(this.toast, W / 2, H - 30);
        }
    }

    protected onClickAt(x: number, y: number): void {
        if (this.phase === 'browse') {
            const bw = 80, bh = 28, bx = this.W - bw - 60, by = 22;
            if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
                this.phase = 'write';
                this.createForm();
            }
        }
    }

    protected onResized(): void { this.calcScroll(); }
}

const origStart = GuestbookGame.prototype.start;
GuestbookGame.prototype.start = function (this: GuestbookGame) {
    origStart.call(this);
    const cv = (this as any).cv as HTMLCanvasElement;
    cv.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        (this as any).scroll = Math.max(0, Math.min((this as any).maxScroll, (this as any).scroll + e.deltaY * 0.5));
    }, { passive: false });
};

export function createGuestbookGame(container: HTMLElement, onExit: () => void, audio?: GameAudio) {
    const game = new GuestbookGame(container, onExit, audio);
    return { start: () => game.start(), stop: () => game.stop() };
}