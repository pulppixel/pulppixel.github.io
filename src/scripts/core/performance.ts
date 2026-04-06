// GPU detection + FPS auto-downgrade → 3-tier quality system

export type PerfTier = 'high' | 'medium' | 'low';

export interface PerfConfig {
    tier: PerfTier;
    isMobile: boolean;
    bloom: boolean;
    shadows: boolean;
    shadowMapSize: number;
    pointLights: boolean;
    particleMul: number;
    oceanSegments: number;
    phase2Decor: boolean;
    maxPixelRatio: number;
    edgeWireframes: boolean;
    throttleSkip: number;
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

export const perf: PerfConfig = {
    tier: 'medium',
    isMobile: false,
    ...TIER_PRESETS.medium,
};

function applyTier(tier: PerfTier): void {
    perf.tier = tier;
    Object.assign(perf, TIER_PRESETS[tier]);
}

function detectGPU(gl: WebGLRenderingContext): string {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase() : '';
}

function estimateTier(gpu: string, isMobile: boolean): PerfTier {
    if (isMobile) return 'low';
    if (!gpu) {
        if (navigator.userAgent.includes('Intel Mac OS X')) return 'low';
        const cores = navigator.hardwareConcurrency || 4;
        const mem = (navigator as any).deviceMemory || 4;
        if (cores <= 2 || mem <= 2) return 'low';
        return 'medium';
    }
    if (gpu.includes('intel')) return gpu.includes('arc') ? 'medium' : 'low';
    if (gpu.includes('mali') || gpu.includes('adreno') || gpu.includes('powervr')) return 'low';
    if (gpu.includes('apple')) return /m[1-9]/.test(gpu) ? 'high' : 'medium';
    if (gpu.includes('nvidia') || gpu.includes('geforce') || gpu.includes('rtx') || gpu.includes('gtx')) return 'high';
    if (gpu.includes('radeon') || gpu.includes('amd')) return 'high';
    return 'medium';
}

/** Call after renderer creation. Detects GPU and sets tier. */
export function initPerf(gl: WebGLRenderingContext): void {
    perf.isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

    const param = new URLSearchParams(location.search).get('perf');
    if (param === 'low' || param === 'medium' || param === 'high') {
        applyTier(param);
        return;
    }

    const stored = sessionStorage.getItem('perf-tier') as PerfTier | null;
    if (stored && TIER_PRESETS[stored]) {
        applyTier(stored);
        return;
    }

    const gpu = detectGPU(gl);
    const tier = estimateTier(gpu, perf.isMobile);
    applyTier(tier);
    console.log(`[perf] GPU="${gpu || 'unknown'}" → tier=${tier}`);
}

/**
 * Monitors FPS for first 6 seconds. Downgrades tier if avg < 22fps.
 * Stores result in sessionStorage for next load.
 */
export function startFpsMonitor(onDowngrade: (newTier: PerfTier) => void): void {
    if (perf.tier === 'low') return;

    let frames = 0;
    let startTime = performance.now();
    const samples: number[] = [];

    const interval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed < 0.5) return;
        samples.push(frames / elapsed);
        frames = 0;
        startTime = performance.now();

        if (samples.length >= 3) {
            clearInterval(interval);
            cancelAnimationFrame(rafId);
            const avg = samples.reduce((a, b) => a + b) / samples.length;
            if (avg < 22) {
                const next: PerfTier = perf.tier === 'high' ? 'medium' : 'low';
                applyTier(next);
                sessionStorage.setItem('perf-tier', next);
                onDowngrade(next);
            }
        }
    }, 2000);

    let rafId: number;
    const tick = () => { frames++; rafId = requestAnimationFrame(tick); };
    rafId = requestAnimationFrame(tick);

    setTimeout(() => { clearInterval(interval); cancelAnimationFrame(rafId); }, 12000);
}