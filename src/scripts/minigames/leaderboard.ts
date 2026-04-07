// 미니게임 리더보드 - Supabase REST API
const SB_URL = 'https://fmizlkvnlantaopdwwrn.supabase.co';
const SB_KEY = 'sb_publishable_-XhnhEFgHoZvBD8jEl1hlQ_IXoDJHO1';
const API = `${SB_URL}/rest/v1/game_scores`;
const AUTH = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const COOLDOWN_MS = 5000;
const NICK_KEY = 'pulppixel-last-nickname';

let lastSubmit = 0;

export interface ScoreEntry {
    id: number;
    game_id: string;
    nickname: string;
    score: number;
    metadata: any;
    created_at: string;
}

export interface GameInfo {
    id: string;
    title: string;
    color: string;
    maxScore: number;
    formatExtra: (e: ScoreEntry) => string;
}

export const GAMES: Record<string, GameInfo> = {
    spody:     { id: 'spody',     title: 'SPODY',         color: '#6ee7b7', maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `×${e.metadata.combo}` : '' },
    ruby:      { id: 'ruby',      title: '루비의 모험',     color: '#ff6b9d', maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `×${e.metadata.combo}` : '' },
    maze:      { id: 'maze',      title: 'Math Master',   color: '#a78bfa', maxScore: 30000,  formatExtra: e => `${e.metadata?.gems ?? 0}◇ ${e.metadata?.time?.toFixed(1) ?? '?'}s` },
    nomads:    { id: 'nomads',    title: 'Nomads Planet', color: '#fbbf24', maxScore: 999999, formatExtra: e => e.metadata?.combo ? `×${e.metadata.combo}` : '' },
    haul:      { id: 'haul',      title: 'HAUL',          color: '#ff966b', maxScore: 99999,  formatExtra: e => `◆${e.metadata?.cores ?? 0}` },
    ninetosix: { id: 'ninetosix', title: 'Frenzy Circle', color: '#22d3ee', maxScore: 99999,  formatExtra: e => e.metadata?.combo ? `×${e.metadata.combo}` : '' },
};

export const GAME_ORDER = ['spody', 'ruby', 'maze', 'nomads', 'haul', 'ninetosix'];

export async function fetchTop10(gameId: string): Promise<ScoreEntry[]> {
    try {
        const res = await fetch(`${API}?game_id=eq.${gameId}&select=*&order=score.desc&limit=10`, { headers: AUTH });
        if (!res.ok) throw new Error(`${res.status}`);
        return await res.json();
    } catch {
        return [];
    }
}

export async function fetchAllTop10(): Promise<Record<string, ScoreEntry[]>> {
    const result: Record<string, ScoreEntry[]> = {};
    await Promise.all(GAME_ORDER.map(async id => { result[id] = await fetchTop10(id); }));
    return result;
}

export function willMakeTop10(top10: ScoreEntry[], score: number): boolean {
    if (score <= 0) return false;
    if (top10.length < 10) return true;
    return score > top10[top10.length - 1].score;
}

export interface SubmitResult { ok: boolean; newId?: number; error?: string; }

export async function submitScore(gameId: string, nickname: string, score: number, metadata: any = {}): Promise<SubmitResult> {
    const now = Date.now();
    if (now - lastSubmit < COOLDOWN_MS) {
        return { ok: false, error: `${Math.ceil((COOLDOWN_MS - (now - lastSubmit)) / 1000)}초 후 다시 시도` };
    }
    const game = GAMES[gameId];
    if (!game) return { ok: false, error: 'unknown game' };
    if (!Number.isFinite(score)) return { ok: false, error: 'invalid score' };
    if (score > game.maxScore) return { ok: false, error: 'score out of range' };
    const nick = (nickname.trim() || 'anonymous').slice(0, 20);
    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: { ...AUTH, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ game_id: gameId, nickname: nick, score, metadata }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const rows = await res.json();
        lastSubmit = now;
        saveNickname(nick);
        return { ok: true, newId: rows[0]?.id };
    } catch {
        return { ok: false, error: '전송 실패' };
    }
}

export function loadNickname(): string {
    try { return localStorage.getItem(NICK_KEY) || ''; } catch { return ''; }
}
export function saveNickname(nick: string): void {
    try { localStorage.setItem(NICK_KEY, nick); } catch { /* noop */ }
}