// NPC dialogue system v2
// - 4-state FSM: idle -> wander -> alert -> talk
// - 다리 + walk animation
// - 말풍선: JS 수동 보간 (CSS transition 제거 -> 떨림 방지)
// - 3D -> screen projection with hysteresis
import * as THREE from 'three';
import {getGroundHeight} from '../core/data';
import {facePlane, stdMat} from '../core/helpers';

// NPC Definitions

interface NPCDef {
    x: number; z: number;
    color: number;
    bodyColor: number;
    name: string;
    lines: string[];
    wanderRadius?: number;
}

const NPC_DEFS: NPCDef[] = [
    {
        x: 1, z: -3,
        color: 0x6ee7b7, bodyColor: 0xd8d0c0,
        name: '안내자',
        lines: [
            '환영해! 이 세계를 탐험해봐.',
            'WASD로 이동, Space로 점프!',
            '빛나는 큐브에 다가가면 프로젝트를 볼 수 있어.',
            '숨겨진 보석 ◆ 도 찾아봐!',
        ],
        wanderRadius: 3,
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

// FSM Constants

const ALERT_DIST = 6.0;   // 플레이어 인지 -> alert
const TALK_DIST = 4.0;    // 대화 시작 -> talk
const RETURN_DIST = 8.0;  // 관심 해제
const WANDER_SPD = 1.2;   // 걷기 속도
const DEFAULT_WANDER_R = 2.5;

type NPCState = 'idle' | 'wander' | 'alert' | 'talk';

// NPC Character Mesh

interface NPCParts {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Group; // head + hat + eyes 묶음
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    eyeL: THREE.Mesh;
    eyeR: THREE.Mesh;
}

function buildNPCMesh(def: NPCDef, baseY: number): NPCParts {
    const g = new THREE.Group();
    g.position.set(def.x, baseY, def.z);

    // Legs (pivot at top)
    const legGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
    const legMat = stdMat(def.bodyColor);
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.08, 0.22, 0);
    legL.geometry.translate(0, -0.11, 0); // pivot top
    legL.castShadow = true;
    g.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.08, 0.22, 0);
    legR.geometry.translate(0, -0.11, 0);
    legR.castShadow = true;
    g.add(legR);

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.34, 0.24),
        stdMat(def.bodyColor),
    );
    body.position.y = 0.50;
    body.castShadow = true;
    g.add(body);

    // Head group (머리 bob 시 eyes/hat 같이 움직이게)
    const headGrp = new THREE.Group();
    headGrp.position.y = 0.88;
    g.add(headGrp);

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.36, 0.34),
        stdMat(def.bodyColor),
    );
    head.castShadow = true;
    headGrp.add(head);

    // Hat
    const hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.10, 0.38),
        new THREE.MeshStandardMaterial({
            color: def.color, emissive: def.color,
            emissiveIntensity: 0.15, metalness: 0.1, roughness: 0.7,
        }),
    );
    hat.position.y = 0.23;
    headGrp.add(hat);

    // Eyes
    const eyeL = facePlane(0.06, 0.07, 0x1a1520);
    eyeL.position.set(-0.08, 0.0, 0.175);
    headGrp.add(eyeL);
    const eyeR = facePlane(0.06, 0.07, 0x1a1520);
    eyeR.position.set(0.08, 0.0, 0.175);
    headGrp.add(eyeR);

    // Highlights
    const hlL = facePlane(0.025, 0.025, 0xffffff);
    hlL.position.set(-0.065, 0.02, 0.177);
    headGrp.add(hlL);
    const hlR = facePlane(0.025, 0.025, 0xffffff);
    hlR.position.set(0.095, 0.02, 0.177);
    headGrp.add(hlR);

    // Mouth
    const mouth = facePlane(0.06, 0.02, 0x2a2030);
    mouth.position.set(0, -0.10, 0.175);
    headGrp.add(mouth);

    // Shadow
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 12),
        new THREE.MeshBasicMaterial({ color: 0x080810, transparent: true, opacity: 0.15 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    g.add(shadow);

    return { group: g, body, head: headGrp, legL, legR, eyeL, eyeR };
}

// Speech Bubble (DOM)

function createBubble(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
    position:absolute; pointer-events:none; z-index:14;
    background:rgba(10,10,11,0.88);
    border:1px solid rgba(110,231,183,0.25);
    border-radius:6px; padding:8px 14px;
    backdrop-filter:blur(8px);
    font-family:'JetBrains Mono',monospace;
    max-width:220px; text-align:center;
    opacity:0;
    transform:translate(-50%,-100%);
    will-change:transform,opacity;
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

// NPC State

interface NPCInstance {
    def: NPCDef;
    parts: NPCParts;
    bubble: HTMLDivElement;
    nameEl: HTMLElement;
    textEl: HTMLElement;

    // FSM
    state: NPCState;
    stateTimer: number;

    // Position
    homeX: number; homeZ: number; baseY: number;
    targetX: number; targetZ: number;
    dir: number; // Y rotation (facing direction)

    // Bubble smoothing
    bubbleAlpha: number;
    bubbleSX: number; bubbleSY: number; // smooth screen position
    bubbleVisible: boolean; // hysteresis flag

    // Animation
    lineIdx: number;
    lineTimer: number;
    blinkTimer: number;
    walkPhase: number;
}

// System

export interface NPCSystem {
    update(dt: number, t: number, playerPos: THREE.Vector3): void;
}

const LINE_INTERVAL = 4.0;

export function createNPCs(scene: THREE.Scene, camera: THREE.PerspectiveCamera): NPCSystem {
    const npcs: NPCInstance[] = [];
    const _worldPos = new THREE.Vector3();
    const _screenPos = new THREE.Vector3();

    for (const def of NPC_DEFS) {
        const groundH = getGroundHeight(def.x, def.z);
        const baseY = groundH < 0 ? 0.5 : groundH;

        const parts = buildNPCMesh(def, baseY);
        scene.add(parts.group);

        const bubble = createBubble();
        const nameEl = bubble.children[0] as HTMLElement;
        const textEl = bubble.children[1] as HTMLElement;

        nameEl.style.color = '#' + def.color.toString(16).padStart(6, '0');
        nameEl.textContent = `◆ ${def.name}`;

        npcs.push({
            def, parts, bubble, nameEl, textEl,
            state: 'idle',
            stateTimer: 2 + Math.random() * 3,
            homeX: def.x, homeZ: def.z, baseY,
            targetX: def.x, targetZ: def.z,
            dir: Math.random() * Math.PI * 2,
            bubbleAlpha: 0,
            bubbleSX: 0, bubbleSY: 0,
            bubbleVisible: false,
            lineIdx: 0, lineTimer: 0,
            blinkTimer: 2 + Math.random() * 3,
            walkPhase: 0,
        });
    }

    // ── Wander target 선택 ──
    function pickWanderTarget(npc: NPCInstance): void {
        const r = npc.def.wanderRadius ?? DEFAULT_WANDER_R;
        const angle = Math.random() * Math.PI * 2;
        const dist = 1 + Math.random() * (r - 1);
        const tx = npc.homeX + Math.cos(angle) * dist;
        const tz = npc.homeZ + Math.sin(angle) * dist;
        // 플랫폼 위인지 확인
        if (getGroundHeight(tx, tz) >= 0) {
            npc.targetX = tx;
            npc.targetZ = tz;
        } else {
            npc.targetX = npc.homeX;
            npc.targetZ = npc.homeZ;
        }
    }

    return {
        update(dt, t, playerPos) {
            for (const npc of npcs) {
                const g = npc.parts.group;
                const dx = playerPos.x - g.position.x;
                const dz = playerPos.z - g.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // FSM Transitions

                npc.stateTimer -= dt;

                switch (npc.state) {
                    case 'idle':
                        if (dist < ALERT_DIST) {
                            npc.state = 'alert';
                            npc.stateTimer = 0.5; // 잠시 멈칫
                        } else if (npc.stateTimer <= 0) {
                            npc.state = 'wander';
                            npc.stateTimer = 2 + Math.random() * 3;
                            pickWanderTarget(npc);
                        }
                        break;

                    case 'wander': {
                        const tdx = npc.targetX - g.position.x;
                        const tdz = npc.targetZ - g.position.z;
                        const tDist = Math.sqrt(tdx * tdx + tdz * tdz);

                        if (dist < ALERT_DIST) {
                            npc.state = 'alert';
                            npc.stateTimer = 0.5;
                        } else if (tDist < 0.3 || npc.stateTimer <= 0) {
                            npc.state = 'idle';
                            npc.stateTimer = 2 + Math.random() * 4;
                        } else {
                            // 이동
                            const moveDir = Math.atan2(tdz, tdx);
                            g.position.x += Math.cos(moveDir) * WANDER_SPD * dt;
                            g.position.z += Math.sin(moveDir) * WANDER_SPD * dt;
                            npc.dir = moveDir;
                            npc.walkPhase += dt;
                        }
                        break;
                    }

                    case 'alert':
                        if (dist < TALK_DIST) {
                            npc.state = 'talk';
                            npc.lineTimer = 0;
                        } else if (dist > RETURN_DIST) {
                            npc.state = 'idle';
                            npc.stateTimer = 1 + Math.random() * 2;
                        }
                        // 플레이어 방향으로 회전 (alert에서 바로 시작)
                        npc.dir = Math.atan2(dz, dx);
                        break;

                    case 'talk':
                        if (dist > TALK_DIST && dist < RETURN_DIST) {
                            npc.state = 'alert';
                            npc.stateTimer = 1;
                        } else if (dist > RETURN_DIST) {
                            npc.state = 'idle';
                            npc.stateTimer = 1 + Math.random() * 2;
                        }
                        // 플레이어 방향 추적
                        npc.dir = Math.atan2(dz, dx);
                        break;
                }

                // Rotation (smooth)

                const targetRot = -npc.dir + Math.PI / 2;
                let dRot = targetRot - g.rotation.y;
                while (dRot > Math.PI) dRot -= Math.PI * 2;
                while (dRot < -Math.PI) dRot += Math.PI * 2;
                const rotSpeed = npc.state === 'alert' || npc.state === 'talk' ? 5 : 3;
                g.rotation.y += dRot * rotSpeed * dt;

                // Animation

                const isWalking = npc.state === 'wander';

                // Leg swing (걸을 때만)
                const legSwing = isWalking ? Math.sin(npc.walkPhase * 8) * 0.5 : 0;
                npc.parts.legL.rotation.x = legSwing;
                npc.parts.legR.rotation.x = -legSwing;

                // Body bob
                const bob = isWalking
                    ? Math.abs(Math.sin(npc.walkPhase * 8)) * 0.04
                    : Math.sin(t * 1.8 + npc.def.x) * 0.025;
                npc.parts.body.position.y = 0.50 + bob;
                npc.parts.head.position.y = 0.88 + bob;

                // alert 상태: 살짝 고개 기울임 (?)
                if (npc.state === 'alert') {
                    npc.parts.head.rotation.z = Math.sin(t * 4) * 0.08;
                } else {
                    npc.parts.head.rotation.z *= 0.9; // 부드럽게 복귀
                }

                // Blink
                npc.blinkTimer -= dt;
                if (npc.blinkTimer <= 0) npc.blinkTimer = 2.5 + Math.random() * 4;
                const blink = npc.blinkTimer < 0.12;
                npc.parts.eyeL.scale.y = blink ? 0.1 : 1;
                npc.parts.eyeR.scale.y = blink ? 0.1 : 1;

                // Walk phase reset when not walking
                if (!isWalking) npc.walkPhase = 0;

                // Dialogue (talk 상태에서만)

                if (npc.state === 'talk') {
                    npc.lineTimer += dt;
                    if (npc.lineTimer >= LINE_INTERVAL) {
                        npc.lineTimer = 0;
                        npc.lineIdx = (npc.lineIdx + 1) % npc.def.lines.length;
                    }
                    npc.textEl.textContent = npc.def.lines[npc.lineIdx];
                }

                // Bubble positioning (JS 보간, CSS transition 없음)

                const shouldShow = npc.state === 'talk';

                // Alpha 보간 (CSS transition 대신)
                const targetAlpha = shouldShow ? 1 : 0;
                npc.bubbleAlpha += (targetAlpha - npc.bubbleAlpha) * Math.min(1, 6 * dt);

                if (npc.bubbleAlpha > 0.01) {
                    // 3D -> screen projection
                    _worldPos.set(g.position.x, g.position.y + 1.55, g.position.z);
                    _screenPos.copy(_worldPos).project(camera);

                    // Hysteresis: 카메라 뒤로 가도 즉시 숨기지 않음
                    if (_screenPos.z > 1) {
                        if (npc.bubbleVisible) {
                            // 이미 보이고 있었으면 서서히 fade (즉시 X)
                            npc.bubbleAlpha *= 0.85;
                        }
                    } else {
                        npc.bubbleVisible = true;
                        const sx = (_screenPos.x * 0.5 + 0.5) * window.innerWidth;
                        const sy = (-_screenPos.y * 0.5 + 0.5) * window.innerHeight;

                        if (!npc.bubbleVisible) {
                            npc.bubbleSX = sx;
                            npc.bubbleSY = sy;
                        }
                        npc.bubbleVisible = true;

                        // Position 보간 (부드러운 추적)
                        npc.bubbleSX += (sx - npc.bubbleSX) * Math.min(1, 10 * dt);
                        npc.bubbleSY += (sy - npc.bubbleSY) * Math.min(1, 10 * dt);
                    }

                    // 화면 밖 클램프
                    npc.bubbleSX = Math.max(60, Math.min(window.innerWidth - 60, npc.bubbleSX));
                    npc.bubbleSY = Math.max(40, Math.min(window.innerHeight - 40, npc.bubbleSY));

                    // DOM 적용 (transform으로 GPU compositing)
                    npc.bubble.style.left = '0';
                    npc.bubble.style.top = '0';
                    npc.bubble.style.transform = `translate3d(${npc.bubbleSX}px, ${npc.bubbleSY - 20}px, 0) translate(-50%, -100%)`;
                    npc.bubble.style.opacity = String(Math.min(1, npc.bubbleAlpha));
                } else {
                    npc.bubble.style.opacity = '0';
                    npc.bubbleVisible = false;
                }
            }
        },
    };
}