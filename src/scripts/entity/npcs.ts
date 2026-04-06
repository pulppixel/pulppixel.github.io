// NPC dialogue system
// - Zone별 1체, 박스형 캐릭터
// - 플레이어 접근 시 말풍선 표시 (DOM → 3D 프로젝션)
// - 대사 자동 순환 (4초 간격)
// - 플레이어 방향으로 부드럽게 회전
import * as THREE from 'three';
import { getGroundHeight } from '../core/data';
import { stdMat, facePlane } from '../core/helpers';

// =============================================
// NPC Definitions
// =============================================

interface NPCDef {
    x: number; z: number;
    color: number;        // zone accent color
    bodyColor: number;    // body tint
    name: string;
    lines: string[];
}

const NPC_DEFS: NPCDef[] = [
    {
        x: 2, z: 3,
        color: 0x6ee7b7, bodyColor: 0xd8d0c0,
        name: '안내자',
        lines: [
            '환영해! 이 세계를 탐험해봐.',
            'WASD로 이동, Space로 점프!',
            '빛나는 큐브에 다가가면 프로젝트를 볼 수 있어.',
            '숨겨진 보석 ◆ 도 찾아봐!',
        ],
    },
    {
        x: -4, z: -15,
        color: 0xff6b9d, bodyColor: 0xe8c8c0,
        name: '오버월드 주민',
        lines: [
            '여기는 오버월드! 초기 프로젝트들이 있어.',
            'SPODY — XR 교육 콘텐츠를 만들었지.',
            'Math Master — 미로 알고리즘을 직접 구현했어.',
            '루비의 모험 — 졸업작품 우수상!',
        ],
    },
    {
        x: 32, z: -37,
        color: 0x6ee7b7, bodyColor: 0xc8d8c0,
        name: '보물섬 해적',
        lines: [
            '보물섬에 온 걸 환영해!',
            'STELSI Wallet — Flutter로 1인 개발, 양대 스토어 출시.',
            'Nomads Planet — K-메타버스 경진대회 장려상!',
            'Nine to Six — 텔레그램 WebGL 미니 게임.',
        ],
    },
    {
        x: -24, z: -37,
        color: 0xa78bfa, bodyColor: 0xc8c0d8,
        name: '네더 현자',
        lines: [
            '네더에 온 걸 환영해. 최신 프로젝트들이야.',
            'ETERNA — 3-Tier 아키텍처 직접 설계.',
            'REIW — 채팅 시스템 전면 재설계.',
            'IW Zombie — 5단계 게임 루프 전반 구현.',
        ],
    },
    {
        x: 3, z: -55,
        color: 0xfbbf24, bodyColor: 0xd8d0b0,
        name: '봉화대 수호자',
        lines: [
            '봉화대의 꼭대기에 온 걸 환영해!',
            'HAUL — Server-authoritative 멀티플레이어.',
            'Client-side prediction + Reconciliation 직접 구현 중.',
            '기획부터 서버까지 1인 풀스택!',
        ],
    },
];

// =============================================
// NPC Character Builder (simple voxel)
// =============================================

function buildNPCMesh(def: NPCDef, baseY: number): THREE.Group {
    const g = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.44, 0.24),
        stdMat(def.bodyColor),
    );
    body.position.y = 0.52;
    body.castShadow = true;
    g.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.36, 0.34),
        stdMat(def.bodyColor),
    );
    head.position.y = 0.96;
    head.castShadow = true;
    g.add(head);

    // Hat / accent band (zone color)
    const hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.10, 0.38),
        new THREE.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.15,
            metalness: 0.1,
            roughness: 0.7,
        }),
    );
    hat.position.y = 1.18;
    g.add(hat);

    // Eyes
    const eyeL = facePlane(0.06, 0.07, 0x1a1520);
    eyeL.position.set(-0.08, 0.96, 0.175);
    g.add(eyeL);
    const eyeR = facePlane(0.06, 0.07, 0x1a1520);
    eyeR.position.set(0.08, 0.96, 0.175);
    g.add(eyeR);

    // Highlights
    const hlL = facePlane(0.025, 0.025, 0xffffff);
    hlL.position.set(-0.065, 0.98, 0.177);
    g.add(hlL);
    const hlR = facePlane(0.025, 0.025, 0xffffff);
    hlR.position.set(0.095, 0.98, 0.177);
    g.add(hlR);

    // Mouth
    const mouth = facePlane(0.06, 0.02, 0x2a2030);
    mouth.position.set(0, 0.86, 0.175);
    g.add(mouth);

    // Shadow
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 12),
        new THREE.MeshBasicMaterial({ color: 0x080810, transparent: true, opacity: 0.15 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    g.add(shadow);

    g.position.set(def.x, baseY, def.z);
    return g;
}

// =============================================
// Speech Bubble (DOM-based, 3D→screen projection)
// =============================================

function createBubble(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'npc-bubble';
    el.style.cssText = `
    position:absolute; pointer-events:none; z-index:14;
    background:rgba(10,10,11,0.88);
    border:1px solid rgba(110,231,183,0.25);
    border-radius:6px; padding:8px 14px;
    backdrop-filter:blur(8px);
    font-family:'JetBrains Mono',monospace;
    max-width:220px; text-align:center;
    opacity:0; transition:opacity 0.3s;
    transform:translateX(-50%);
  `;

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:9px;letter-spacing:0.08em;margin-bottom:4px;';
    el.appendChild(nameEl);

    const textEl = document.createElement('div');
    textEl.style.cssText = 'font-size:11px;color:#a8a8b3;line-height:1.6;';
    el.appendChild(textEl);

    // 삼각형 꼬리
    const tail = document.createElement('div');
    tail.style.cssText = `
    position:absolute; bottom:-6px; left:50%;
    transform:translateX(-50%);
    width:0; height:0;
    border-left:6px solid transparent;
    border-right:6px solid transparent;
    border-top:6px solid rgba(10,10,11,0.88);
  `;
    el.appendChild(tail);

    document.body.appendChild(el);
    return el;
}

// =============================================
// NPC State & System
// =============================================

const SHOW_DIST = 5.0;
const HIDE_DIST = 7.0;
const LINE_INTERVAL = 4.0; // 대사 순환 간격 (초)

interface NPCState {
    def: NPCDef;
    group: THREE.Group;
    bubble: HTMLDivElement;
    nameEl: HTMLElement;
    textEl: HTMLElement;
    active: boolean;
    alpha: number;     // bubble fade
    lineIdx: number;
    lineTimer: number;
    blinkTimer: number;
    eyeL: THREE.Mesh;
    eyeR: THREE.Mesh;
}

export interface NPCSystem {
    update(dt: number, t: number, playerPos: THREE.Vector3): void;
}

export function createNPCs(scene: THREE.Scene, camera: THREE.PerspectiveCamera): NPCSystem {
    const npcs: NPCState[] = [];
    const _worldPos = new THREE.Vector3();
    const _screenPos = new THREE.Vector3();

    for (const def of NPC_DEFS) {
        const groundH = getGroundHeight(def.x, def.z);
        const baseY = groundH < 0 ? 0.5 : groundH;

        const group = buildNPCMesh(def, baseY);
        scene.add(group);

        const bubble = createBubble();
        const nameEl = bubble.children[0] as HTMLElement;
        const textEl = bubble.children[1] as HTMLElement;

        // Zone color 적용
        const hex = '#' + def.color.toString(16).padStart(6, '0');
        nameEl.style.color = hex;
        nameEl.textContent = `◆ ${def.name}`;

        // Eye 참조 (blink 애니메이션용)
        const eyeL = group.children[3] as THREE.Mesh; // facePlane 순서
        const eyeR = group.children[4] as THREE.Mesh;

        npcs.push({
            def, group, bubble, nameEl, textEl,
            active: false, alpha: 0,
            lineIdx: 0, lineTimer: 0,
            blinkTimer: 2 + Math.random() * 3,
            eyeL, eyeR,
        });
    }

    return {
        update(dt, t, playerPos) {
            for (const npc of npcs) {
                const dx = playerPos.x - npc.group.position.x;
                const dz = playerPos.z - npc.group.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // 활성화 판정
                if (dist < SHOW_DIST) npc.active = true;
                if (dist > HIDE_DIST) npc.active = false;

                // Bubble fade
                const targetA = npc.active ? 1 : 0;
                npc.alpha += (targetA - npc.alpha) * Math.min(1, 5 * dt);

                // ── Idle 애니메이션 ──

                // Bob
                const bob = Math.sin(t * 1.8 + npc.def.x) * 0.04;
                npc.group.children[1].position.y = 0.96 + bob; // head
                npc.group.children[2].position.y = 1.18 + bob; // hat

                // Blink
                npc.blinkTimer -= dt;
                if (npc.blinkTimer <= 0) npc.blinkTimer = 2.5 + Math.random() * 4;
                const blink = npc.blinkTimer < 0.12;
                npc.eyeL.scale.y = blink ? 0.1 : 1;
                npc.eyeR.scale.y = blink ? 0.1 : 1;

                // ── 플레이어 방향 회전 ──
                if (dist < HIDE_DIST) {
                    const targetRot = Math.atan2(dx, dz);
                    let dRot = targetRot - npc.group.rotation.y;
                    while (dRot > Math.PI) dRot -= Math.PI * 2;
                    while (dRot < -Math.PI) dRot += Math.PI * 2;
                    npc.group.rotation.y += dRot * 3 * dt;
                }

                // ── 대사 순환 ──
                if (npc.active) {
                    npc.lineTimer += dt;
                    if (npc.lineTimer >= LINE_INTERVAL) {
                        npc.lineTimer = 0;
                        npc.lineIdx = (npc.lineIdx + 1) % npc.def.lines.length;
                    }
                    npc.textEl.textContent = npc.def.lines[npc.lineIdx];
                }

                // ── Bubble 위치 (3D → screen projection) ──
                if (npc.alpha > 0.01) {
                    npc.bubble.style.opacity = String(Math.min(1, npc.alpha));

                    // NPC 머리 위 위치
                    _worldPos.set(npc.group.position.x, npc.group.position.y + 1.6, npc.group.position.z);
                    _screenPos.copy(_worldPos).project(camera);

                    // 카메라 뒤에 있으면 숨김
                    if (_screenPos.z > 1) {
                        npc.bubble.style.opacity = '0';
                        continue;
                    }

                    const sx = (_screenPos.x * 0.5 + 0.5) * window.innerWidth;
                    const sy = (-_screenPos.y * 0.5 + 0.5) * window.innerHeight;

                    npc.bubble.style.left = sx + 'px';
                    npc.bubble.style.top = (sy - 20) + 'px';
                } else {
                    npc.bubble.style.opacity = '0';
                }
            }
        },
    };
}