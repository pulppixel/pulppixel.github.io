// Collectible gem system
// - 12 hidden gems across the world
// - OctahedronGeometry with emissive glow
// - localStorage persistence
// - HUD counter
// - Collection: scale-down animation + sound + floating text
import * as THREE from 'three';
import { getGroundHeight } from '../core/data';
import type { GameAudio } from '../system/audio';

// =============================================
// Gem definitions
// =============================================

interface GemDef {
    x: number; z: number;
    name: string;
    color: number;
    yOff?: number; // 지면 위 추가 높이 (점프 필요한 위치)
}

const GEMS: GemDef[] = [
    // Spawn (쉬운 첫 발견)
    { x: 5, z: 4, name: '시작의 보석', color: 0x6ee7b7 },
    { x: -5, z: -3, name: '숨겨진 에메랄드', color: 0x67e8f9 },
    // Zone 0 Hub
    { x: -8, z: -22, name: '허브의 빛', color: 0xff6b9d },
    { x: 7, z: -13, name: '오래된 조각', color: 0xa78bfa },
    // 디딤돌 (플랫포밍 보상)
    { x: 17, z: -29, name: '디딤돌 보석', color: 0xfbbf24, yOff: 1.2 },
    { x: -17, z: -29, name: '절벽의 보석', color: 0xf5a8c0, yOff: 1.2 },
    // Zone 1 - Treasure Isle
    { x: 34, z: -44, name: '보물의 조각', color: 0x6ee7b7 },
    { x: 22, z: -36, name: '해적의 루비', color: 0xfbbf24 },
    // Zone 2 - The Nether
    { x: -34, z: -44, name: '네더의 수정', color: 0xa78bfa },
    { x: -22, z: -36, name: '마법의 조각', color: 0x67e8f9 },
    // Zone 3 - Overworld
    { x: -6, z: -62, name: '벚꽃 보석', color: 0xff6b9d },
    { x: 6, z: -55, name: '정원의 조각', color: 0xf5a8c0 },
];

// =============================================
// Persistence
// =============================================

const STORAGE_KEY = 'pp-gems';

function loadCollected(): Set<number> {
    try {
        const d = localStorage.getItem(STORAGE_KEY);
        return d ? new Set(JSON.parse(d)) : new Set();
    } catch { return new Set(); }
}

function saveCollected(s: Set<number>): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])); } catch {}
}

// =============================================
// Floating text (수집 시 이름 표시)
// =============================================

interface FloatText {
    el: HTMLDivElement;
    life: number;
}

function spawnFloatText(name: string, color: string): FloatText {
    const el = document.createElement('div');
    el.textContent = `◆ ${name}`;
    el.style.cssText = `
    position:fixed; left:50%; top:45%;
    transform:translateX(-50%);
    font-family:'JetBrains Mono',monospace;
    font-size:13px; color:${color};
    pointer-events:none; z-index:22;
    text-shadow:0 0 12px ${color}40;
    transition:opacity 0.5s, top 0.8s ease-out;
    opacity:1;
  `;
    document.body.appendChild(el);

    // 약간의 딜레이 후 위로 올라가며 fade
    requestAnimationFrame(() => {
        el.style.top = '38%';
        el.style.opacity = '0';
    });

    return { el, life: 1.2 };
}

// =============================================
// HUD Counter
// =============================================

function createHUD(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'gem-counter';
    el.style.cssText = `
    position:absolute; top:56px; right:50%;
    transform:translateX(50%);
    font-family:'JetBrains Mono',monospace;
    font-size:10px; color:#6ee7b7;
    letter-spacing:0.08em;
    background:rgba(10,10,11,0.65);
    border:1px solid rgba(110,231,183,0.15);
    border-radius:4px; padding:3px 10px;
    z-index:12; pointer-events:none;
    backdrop-filter:blur(4px);
    opacity:0; transition:opacity 0.5s;
  `;
    document.body.appendChild(el);

    // 약간 딜레이 후 fade in
    setTimeout(() => { el.style.opacity = '1'; }, 2000);
    return el;
}

// =============================================
// System
// =============================================

const COLLECT_DIST = 2.2;
const GEM_RADIUS = 0.18;

interface GemState {
    mesh: THREE.Mesh;
    glow: THREE.Mesh; // 바닥 글로우
    light: THREE.PointLight;
    baseY: number;
    collected: boolean;
    collectT: number; // 수집 애니메이션 타이머
}

export interface CollectibleSystem {
    update(dt: number, t: number, playerPos: THREE.Vector3): void;
    getCount(): { collected: number; total: number };
    reset(): void;
}

export function createCollectibles(
    scene: THREE.Scene,
    audio: GameAudio | null,
    isMobile: boolean,
): CollectibleSystem {
    const collectedSet = loadCollected();
    const states: GemState[] = [];
    const floatTexts: FloatText[] = [];
    const hudEl = createHUD();

    // 공유 geometry
    const gemGeo = new THREE.OctahedronGeometry(GEM_RADIUS, 0);

    function updateHUD(): void {
        const c = states.filter(s => s.collected).length;
        hudEl.textContent = `◆ ${c} / ${GEMS.length}`;
        if (c === GEMS.length) {
            hudEl.style.color = '#fbbf24';
            hudEl.style.borderColor = 'rgba(251,191,36,0.3)';
            hudEl.textContent = `★ ${c} / ${GEMS.length} COMPLETE`;
        }
    }

    // Gem 생성
    GEMS.forEach((def, i) => {
        const groundH = getGroundHeight(def.x, def.z);
        const baseY = (groundH < 0 ? 0.5 : groundH) + 0.6 + (def.yOff || 0);
        const isCollected = collectedSet.has(i);

        // Gem mesh
        const mat = new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.4,
            metalness: 0.4,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85,
        });
        const mesh = new THREE.Mesh(gemGeo, mat);
        mesh.position.set(def.x, baseY, def.z);
        mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4);
        mesh.castShadow = true;
        mesh.visible = !isCollected;
        scene.add(mesh);

        // 바닥 글로우 링
        const glow = new THREE.Mesh(
            new THREE.RingGeometry(0.25, 0.4, 16),
            new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
            }),
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(def.x, (groundH < 0 ? 0.5 : groundH) + 0.02 + (def.yOff || 0), def.z);
        glow.visible = !isCollected;
        scene.add(glow);

        // 포인트 라이트 (작은 빛)
        const light = new THREE.PointLight(def.color, 0.3, 3);
        light.position.set(def.x, baseY + 0.3, def.z);
        light.visible = !isCollected;
        scene.add(light);

        states.push({
            mesh, glow, light, baseY,
            collected: isCollected,
            collectT: isCollected ? 999 : 0,
        });
    });

    updateHUD();

    return {
        update(dt, t, playerPos) {
            // Float text cleanup
            let fi = floatTexts.length;
            while (fi-- > 0) {
                floatTexts[fi].life -= dt;
                if (floatTexts[fi].life <= 0) {
                    floatTexts[fi].el.remove();
                    floatTexts.splice(fi, 1);
                }
            }

            for (let i = 0; i < states.length; i++) {
                const s = states[i];

                // 수집 애니메이션 (축소 → 소멸)
                if (s.collected && s.collectT < 0.4) {
                    s.collectT += dt;
                    const p = Math.min(1, s.collectT / 0.35);
                    const scale = Math.max(0, 1 - p * p); // ease-in 축소
                    s.mesh.scale.setScalar(scale);
                    s.glow.scale.setScalar(scale);
                    s.light.intensity = 0.3 * scale;
                    if (p >= 1) {
                        s.mesh.visible = false;
                        s.glow.visible = false;
                        s.light.visible = false;
                    }
                    continue;
                }
                if (s.collected) continue;

                // Idle 애니메이션: 회전 + bob + glow pulse
                s.mesh.rotation.y = t * 1.5 + i * 0.8;
                s.mesh.position.y = s.baseY + Math.sin(t * 2 + i * 1.2) * 0.12;

                const pulse = 0.3 + Math.sin(t * 3 + i) * 0.15;
                (s.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
                s.light.intensity = 0.2 + Math.sin(t * 3 + i) * 0.1;

                // Glow ring pulse
                (s.glow.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 2.5 + i) * 0.05;
                s.glow.rotation.z = t * 0.3;

                // 수집 판정
                const dx = playerPos.x - s.mesh.position.x;
                const dy = playerPos.y - s.mesh.position.y;
                const dz = playerPos.z - s.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < COLLECT_DIST) {
                    s.collected = true;
                    s.collectT = 0;
                    collectedSet.add(i);
                    saveCollected(collectedSet);
                    updateHUD();

                    // Sound
                    audio?.mgCoin(collectedSet.size);

                    // Float text
                    const hex = '#' + GEMS[i].color.toString(16).padStart(6, '0');
                    floatTexts.push(spawnFloatText(GEMS[i].name, hex));
                }
            }
        },

        getCount() {
            return {
                collected: states.filter(s => s.collected).length,
                total: GEMS.length,
            };
        },

        reset() {
            collectedSet.clear();
            saveCollected(collectedSet);
            for (const s of states) {
                s.collected = false;
                s.collectT = 0;
                s.mesh.visible = true;
                s.mesh.scale.setScalar(1);
                s.glow.visible = true;
                s.glow.scale.setScalar(1);
                s.light.visible = true;
            }
            updateHUD();
        },
    };
}