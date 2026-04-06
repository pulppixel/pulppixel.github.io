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
    accessory?: 'guide' | 'straw' | 'pirate' | 'sage' | 'crown';
}

const NPC_DEFS: NPCDef[] = [
    {
        x: 1, z: -3,
        color: 0x6ee7b7, bodyColor: 0xd8d0c0,
        name: '안내자',
        accessory: 'guide',
        lines: [
            '반갑다, 여행자! 여기가 pulppixel의 세계야.',
            'WASD로 이동, Space로 점프. 간단하지?',
            '빛나는 큐브에 다가가서 E를 눌러봐!',
            '12개의 숨겨진 보석 ◆ 을 모두 찾을 수 있을까?',
        ],
        wanderRadius: 3,
    },
    {
        x: -6, z: -13,
        color: 0xff6b9d, bodyColor: 0xe8c8c0,
        name: '오버월드 주민',
        accessory: 'straw',
        lines: [
            '여긴 오버월드. 모든 건 여기서 시작됐지.',
            'SPODY... Kinect로 바닥을 터치스크린으로 만들었어.',
            'Math Master는 미로를 직접 생성하는 알고리즘이야. 한번 도전해봐!',
            '루비의 모험으로 졸업전시 우수상. 71개 스크립트, 혼자 다 짰어.',
        ],
    },
    {
        x: 32, z: -37,
        color: 0x6ee7b7, bodyColor: 0xc8d8c0,
        name: '보물섬 해적',
        accessory: 'pirate',
        lines: [
            '요호! 보물섬에 온 걸 환영하네!',
            'STELSI Wallet... Unity를 버리고 Flutter로 갈아탔지. 혼자서.',
            'Nomads Planet은 Dedicated Server까지 직접 구축했어. 장려상 수상!',
            'Nine to Six? 회전하는 원에서 살아남아봐. 여기서 플레이 가능해!',
        ],
    },
    {
        x: -24, z: -37,
        color: 0xa78bfa, bodyColor: 0xc8c0d8,
        name: '네더 현자',
        accessory: 'sage',
        lines: [
            '네더의 기운을 느끼는가... 여기엔 최신작들이 있다.',
            'ETERNA... 디스코드 같은 커뮤니티를 Unity 위에 올렸지.',
            'REIW에서 채팅을 개선했고, 그 경험이 ETERNA의 토대가 됐어.',
            'IW Zombie는 첫 실전이었지. 5단계 루프를 처음부터 끝까지.',
            '방명록도 남겨봐. ETERNA 큐브에서 가능해.',
        ],
    },
    {
        x: 3, z: -55,
        color: 0xfbbf24, bodyColor: 0xd8d0b0,
        name: '봉화대 수호자',
        accessory: 'crown',
        lines: [
            '정상에 올라왔구나! 여기까지 온 사람은 드물어.',
            'HAUL... 서버가 모든 걸 결정하는 구조야. 클라이언트는 예측만 해.',
            'Godot 서버와 클라이언트가 같은 물리 엔진을 쓰는 게 핵심이지.',
            '기획, 서버, 클라이언트, DB 전부 혼자. 이게 풀스택 게임 개발이야.',
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

    // Accessory
    const accMat = new THREE.MeshStandardMaterial({
        color: def.color, emissive: def.color,
        emissiveIntensity: 0.15, metalness: 0.1, roughness: 0.7,
    });

    switch (def.accessory) {
        case 'guide': {
            // 기본 모자 + 머리 위 회전 ◆ 큐브
            const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.38), accMat);
            hat.position.y = 0.23;
            headGrp.add(hat);
            const gem = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.12, 0.12),
                new THREE.MeshStandardMaterial({
                    color: 0x7dd3fc, emissive: 0x7dd3fc, emissiveIntensity: 0.6,
                    metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.85,
                }),
            );
            gem.position.y = 0.42;
            gem.rotation.y = Math.PI / 4;
            gem.rotation.x = Math.PI / 4;
            gem.name = 'guide-gem'; // update에서 회전용
            headGrp.add(gem);
            break;
        }
        case 'straw': {
            // 넓은 챙 밀짚모자
            const brim = new THREE.Mesh(
                new THREE.CylinderGeometry(0.32, 0.34, 0.04, 8),
                accMat,
            );
            brim.position.y = 0.20;
            headGrp.add(brim);
            const top = new THREE.Mesh(
                new THREE.CylinderGeometry(0.14, 0.18, 0.12, 8),
                accMat,
            );
            top.position.y = 0.28;
            headGrp.add(top);
            break;
        }
        case 'pirate': {
            // 빨간 두건 (납작, 뒤로 삐침)
            const bandana = new THREE.Mesh(
                new THREE.BoxGeometry(0.42, 0.06, 0.40),
                new THREE.MeshStandardMaterial({
                    color: 0xe53e3e, emissive: 0xe53e3e,
                    emissiveIntensity: 0.1, metalness: 0.1, roughness: 0.8,
                }),
            );
            bandana.position.set(0, 0.20, -0.02);
            headGrp.add(bandana);
            // 뒤로 늘어지는 천
            const tail = new THREE.Mesh(
                new THREE.BoxGeometry(0.20, 0.14, 0.04),
                bandana.material,
            );
            tail.position.set(0, 0.14, -0.20);
            tail.rotation.x = 0.3;
            headGrp.add(tail);
            // 안대 (왼쪽 눈 위)
            const patchMat = new THREE.MeshBasicMaterial({
                color: 0x1a1a1a, side: THREE.DoubleSide,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            });
            const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.09), patchMat);
            patch.position.set(-0.08, 0.0, 0.18);
            headGrp.add(patch);
            // 안대 끈
            const strap = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.02), patchMat);
            strap.position.set(0, 0.03, 0.179);
            headGrp.add(strap);
            break;
        }
        case 'sage': {
            // 뾰족 후드
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(0.22, 0.28, 4),
                accMat,
            );
            hood.position.y = 0.32;
            hood.rotation.y = Math.PI / 4;
            headGrp.add(hood);
            // 후드 뒷면 (늘어진 천)
            const cape = new THREE.Mesh(
                new THREE.BoxGeometry(0.30, 0.24, 0.04),
                accMat,
            );
            cape.position.set(0, 0.06, -0.18);
            headGrp.add(cape);
            // 지팡이 (body에 붙임, headGrp 아님)
            const staff = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.025, 0.9, 6),
                stdMat(0x8b7355),
            );
            staff.position.set(0.28, 0.45, 0);
            staff.rotation.z = -0.15;
            g.add(staff);
            // 지팡이 끝 보석
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 6),
                new THREE.MeshStandardMaterial({
                    color: def.color, emissive: def.color,
                    emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.3,
                }),
            );
            orb.position.set(0.24, 0.92, 0);
            orb.name = 'sage-orb';
            g.add(orb);
            break;
        }
        case 'crown': {
            // 왕관 베이스
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(0.40, 0.06, 0.36),
                accMat,
            );
            base.position.y = 0.21;
            headGrp.add(base);
            // 왕관 뾰족이 3개
            for (let i = -1; i <= 1; i++) {
                const spike = new THREE.Mesh(
                    new THREE.ConeGeometry(0.04, 0.12, 4),
                    accMat,
                );
                spike.position.set(i * 0.12, 0.30, 0);
                headGrp.add(spike);
            }
            break;
        }
        default: {
            // fallback: 기존 모자
            const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.38), accMat);
            hat.position.y = 0.23;
            headGrp.add(hat);
        }
    }

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

    // --- Wander target 선택 ---
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

                // Accessory animation
                if (npc.def.accessory === 'guide') {
                    const gem = npc.parts.head.getObjectByName('guide-gem');
                    if (gem) {
                        gem.rotation.y += dt * 2;
                        gem.position.y = 0.42 + Math.sin(t * 3) * 0.03;
                    }
                }
                if (npc.def.accessory === 'sage') {
                    const orb = npc.parts.group.getObjectByName('sage-orb') as THREE.Mesh;
                    if (orb) (orb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(t * 2.5) * 0.3;
                }

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