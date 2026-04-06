// Performance tier system: GPU detection + FPS auto-downgrade
// Replaces isMobile boolean with 3-tier quality system

export type PerfTier = 'high' | 'medium' | 'low';

export interface PerfConfig {
    tier: PerfTier;
    isMobile: boolean;
    bloom: boolean;
    shadows: boolean;
    shadowMapSize: number;
    pointLights: boolean;
    particleMul: number;      // 0.0 ~ 1.0
    oceanSegments: number;
    phase2Decor: boolean;
    maxPixelRatio: number;
    edgeWireframes: boolean;
    throttleSkip: number;     // wind/season frame skip (1=every frame, 3=every 3rd)
}

const TIER_PRESETS: Record<PerfTier, Omit<PerfConfig, 'tier' | 'isMobile'>> = {
    high: {
        bloom: true, shadows: true, shadowMapSize: 1024,
        pointLights: true, particleMul: 1.0, oceanSegments: 80,
        phase2Decor: true, maxPixelRatio: 2, edgeWireframes: true, throttleSkip: 1,
    },
    medium: {
        bloom: false, shadows: true, shadowMapSize: 512,
        pointLights: true, particleMul: 0.5, oceanSegments: 48,
        phase2Decor: true, maxPixelRatio: 1.5, edgeWireframes: true, throttleSkip: 2,
    },
    low: {
        bloom: false, shadows: false, shadowMapSize: 0,
        pointLights: false, particleMul: 0.25, oceanSegments: 24,
        phase2Decor: false, maxPixelRatio: 1, edgeWireframes: false, throttleSkip: 4,
    },
};

// --- Singleton ---

export const perf: PerfConfig = {
    tier: 'medium',
    isMobile: false,
    ...TIER_PRESETS.medium,
};

function applyTier(tier: PerfTier): void {
    perf.tier = tier;
    Object.assign(perf, TIER_PRESETS[tier]);
}

// --- GPU Detection ---

function detectGPU(gl: WebGLRenderingContext): string {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    return (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
}

function estimateTier(gpu: string, isMobile: boolean): PerfTier {
    if (isMobile) return 'low';

    if (gpu) {
        // Intel integrated — 거의 전부 low
        if (gpu.includes('intel')) {
            // Intel Arc(discrete) 만 medium
            if (gpu.includes('arc')) return 'medium';
            return 'low';
        }
        // Mobile GPU
        if (gpu.includes('mali') || gpu.includes('adreno') || gpu.includes('powervr')) return 'low';
        // Apple Silicon
        if (gpu.includes('apple')) {
            if (/m[1-9]/.test(gpu)) return 'high';
            return 'medium';
        }
        // NVIDIA / AMD discrete
        if (gpu.includes('nvidia') || gpu.includes('geforce') || gpu.includes('rtx') || gpu.includes('gtx')) return 'high';
        if (gpu.includes('radeon') || gpu.includes('amd')) return 'high';
    }

    // Safari가 WEBGL_debug_renderer_info를 차단하면 gpu가 빈 문자열.
    // UA로 Intel Mac 판별 (2019 이하 MacBook 등)
    if (!gpu) {
        const ua = navigator.userAgent;
        if (ua.includes('Intel Mac OS X')) return 'low';
    }

    // Fallback: CPU/메모리 heuristic
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as any).deviceMemory || 4;
    if (cores <= 2 || mem <= 2) return 'low';
    if (cores <= 4 || mem <= 4) return 'medium';
    return 'medium'; // safe default
}

// --- Public API ---

/** renderer 생성 직후 호출. GPU를 분석해 tier를 결정한다. */
export function initPerf(gl: WebGLRenderingContext): void {
    perf.isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

    // 1) URL override (?perf=low)
    const param = new URLSearchParams(location.search).get('perf');
    if (param === 'low' || param === 'medium' || param === 'high') {
        applyTier(param);
        console.log(`[perf] URL override → ${param}`);
        return;
    }

    // 2) sessionStorage (이전 FPS 감지 결과)
    const stored = sessionStorage.getItem('perf-tier') as PerfTier | null;
    if (stored && TIER_PRESETS[stored]) {
        applyTier(stored);
        console.log(`[perf] Cached tier → ${stored}`);
        return;
    }

    // 3) GPU 기반 추정
    const gpu = detectGPU(gl);
    const tier = estimateTier(gpu, perf.isMobile);
    applyTier(tier);
    console.log(`[perf] GPU="${gpu || 'unknown'}" → tier=${tier}`);
}

/**
 * FPS 모니터. 처음 6초간 측정 후 평균 < 22fps 이면 한 단계 다운그레이드.
 * 다운그레이드 시 sessionStorage에 저장 → 다음 로드부터 적용.
 * onDowngrade 콜백으로 런타임 토글 가능한 항목(bloom, shadow, pixelRatio) 즉시 반영.
 */
export function startFpsMonitor(onDowngrade: (newTier: PerfTier) => void): void {
    if (perf.tier === 'low') return; // 이미 최저

    let frames = 0;
    let startTime = performance.now();
    const samples: number[] = [];

    const measure = () => { frames++; };

    const interval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 0.5) return; // 최소 0.5초 대기
        const fps = frames / elapsed;
        samples.push(fps);
        frames = 0;
        startTime = performance.now();

        if (samples.length >= 3) {
            clearInterval(interval);
            cancelAnimationFrame(rafId);

            const avg = samples.reduce((a, b) => a + b) / samples.length;
            console.log(`[perf] FPS avg=${avg.toFixed(1)} over ${samples.length} samples`);

            if (avg < 22) {
                const next: PerfTier = perf.tier === 'high' ? 'medium' : 'low';
                applyTier(next);
                sessionStorage.setItem('perf-tier', next);
                console.log(`[perf] Auto-downgrade → ${next} (avg ${avg.toFixed(1)} fps)`);
                onDowngrade(next);
            }
        }
    }, 2000);

    let rafId: number;
    const tick = () => { measure(); rafId = requestAnimationFrame(tick); };
    rafId = requestAnimationFrame(tick);

    // 안전장치: 12초 후 무조건 정리
    setTimeout(() => { clearInterval(interval); cancelAnimationFrame(rafId); }, 12000);
}