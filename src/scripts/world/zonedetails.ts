// Zone detail decorations: per-zone structures, water edge, bushes
// + Zone boundary system: edge glow, corner beacons, ground patterns, entrance gates
// Purely visual (no collision changes). Add density and architectural interest.
import * as THREE from 'three';
import { PLATFORMS } from '../core/data';
import { stdBox, glowBox, stdMat, setPos } from '../core/helpers';

// --- Water edge: reef ring + foam strips around each platform ---

export function buildWaterEdge(scene: THREE.Scene): void {
    const foamMat = new THREE.MeshBasicMaterial({
        color: 0xc8f0f5, transparent: true, opacity: 0.18,
    });

    for (const p of PLATFORMS) {
        if (p.h <= 0) continue;
        if (p.w < 10) continue;
        const hw = p.w / 2, hd = p.d / 2;

        // Foam strips on 4 sides
        const foamData: [number, number, number, number, number, number][] = [
            [p.x, 0.2, p.z + hd + 1.1, p.w + 2.4, 0.03, 0.5],
            [p.x, 0.2, p.z - hd - 1.1, p.w + 2.4, 0.03, 0.5],
            [p.x + hw + 1.1, 0.2, p.z, 0.5, 0.03, p.d + 1.4],
            [p.x - hw - 1.1, 0.2, p.z, 0.5, 0.03, p.d + 1.4],
        ];
        for (const [fx, fy, fz, fw, fh, fd] of foamData) {
            const foam = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), foamMat);
            foam.position.set(fx, fy, fz);
            scene.add(foam);
        }
    }
}

// --- Small bushes (low vegetation for density) ---

export function buildBushes(scene: THREE.Scene): void {
    const bushGeo = new THREE.BoxGeometry(0.7, 0.45, 0.7);
    const bushSmGeo = new THREE.BoxGeometry(0.5, 0.35, 0.5);
    const colors = [0x4a9a4a, 0x3a8a3a, 0x5aaa5a, 0x408840];

    // Positions on platforms (margin 2+ from edges, avoid zone centers)
    const spots: [number, number][] = [
        // Spawn
        [-5, -2], [4, 4], [6, -4],
        // Zone 0 - Nether
        [-7, -13], [8, -22], [-3, -24], [7, -12],
        // Zone 1 - Treasure
        [21, -35], [35, -42], [25, -45], [33, -35],
        // Zone 2 - Beacon
        [-35, -35], [-21, -42], [-33, -45], [-23, -35],
        // Zone 3 - Overworld
        [-7, -53], [7, -63], [-6, -60], [8, -54],
    ];

    spots.forEach(([sx, sz], i) => {
        let h = -1;
        for (const p of PLATFORMS) {
            if (sx >= p.x - p.w / 2 && sx <= p.x + p.w / 2 &&
                sz >= p.z - p.d / 2 && sz <= p.z + p.d / 2) {
                if (p.h > h) h = p.h;
            }
        }
        if (h < 0) return;

        const col = colors[i % colors.length];
        const geo = i % 3 === 0 ? bushGeo : bushSmGeo;
        const bush = new THREE.Mesh(geo, stdMat(col));
        bush.position.set(sx, h + (geo === bushGeo ? 0.225 : 0.175), sz);
        bush.castShadow = true;
        scene.add(bush);

        // Accent leaf block on some bushes
        if (i % 4 === 0) {
            const top = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.25, 0.4),
                stdMat(colors[(i + 1) % colors.length]),
            );
            top.position.set(sx + 0.15, h + 0.5, sz + 0.1);
            scene.add(top);
        }
    });
}

// --- Zone-specific decorative structures ---

export function buildZoneDecor(scene: THREE.Scene): void {
    buildNetherDecor(scene);
    buildTreasureDecor(scene);
    buildBeaconDecor(scene);
    buildOverworldDecor(scene);
    buildSpawnDecor(scene);
}

// Helper: simple stone wall segment
function stoneWall(
    scene: THREE.Scene, x: number, y: number, z: number,
    w: number, h: number, d: number, color = 0x7a7568,
): void {
    const wall = stdBox(w, h, d, color);
    wall.position.set(x, y + h / 2, z);
    wall.castShadow = true;
    scene.add(wall);
}

// Helper: stone pillar
function stonePillar(
    scene: THREE.Scene, x: number, baseY: number, z: number,
    h: number, color = 0x8a8080,
): void {
    const pillar = stdBox(0.35, h, 0.35, color);
    pillar.position.set(x, baseY + h / 2, z);
    pillar.castShadow = true;
    scene.add(pillar);

    // Cap
    const cap = stdBox(0.45, 0.1, 0.45, color);
    cap.position.set(x, baseY + h + 0.05, z);
    scene.add(cap);
}

// Helper: wooden beam
function woodBeam(
    scene: THREE.Scene, x: number, y: number, z: number,
    w: number, h: number, d: number,
): void {
    const beam = stdBox(w, h, d, 0x8a6540);
    beam.position.set(x, y, z);
    beam.castShadow = true;
    scene.add(beam);
}

// --- Spawn (0, 0, h=0.5) - Welcome area ---

function buildSpawnDecor(scene: THREE.Scene): void {
    const h = 0.5;

    // Welcome signpost
    woodBeam(scene, 0, h + 0.6, 5, 0.12, 1.2, 0.12);
    const sign = stdBox(1.4, 0.5, 0.08, 0xb09868);
    sign.position.set(0, h + 1.35, 5.05);
    scene.add(sign);

    // Ground path (stone strip from spawn toward zone 0)
    for (let i = 0; i < 4; i++) {
        const pathStone = stdBox(1.2, 0.04, 0.8, 0xb0a898);
        pathStone.position.set(0 + (i % 2) * 0.3, h + 0.02, 2 - i * 2.5);
        scene.add(pathStone);
    }
}

// --- Nether (0, -18, h=1.0) - Mystical ruins ---

function buildNetherDecor(scene: THREE.Scene): void {
    const cx = 0, cz = -18, h = 1.0;
    const PURPLE_DK = 0x504068, PURPLE_LT = 0x706088;

    // Ruined wall segments at the back (behind monument)
    stoneWall(scene, cx - 6, h, cz - 5.5, 3.0, 1.2, 0.4, PURPLE_DK);
    stoneWall(scene, cx - 6, h, cz - 5.5, 2.0, 1.8, 0.35, PURPLE_LT);  // taller portion
    stoneWall(scene, cx + 6, h, cz - 5.5, 2.5, 1.0, 0.4, PURPLE_DK);

    // Broken pillars
    stonePillar(scene, cx - 8, h, cz - 3, 1.8, PURPLE_DK);
    stonePillar(scene, cx + 8, h, cz - 3, 1.2, PURPLE_DK);  // shorter = broken

    // Ground rune pattern (flat glowing strips)
    const runeMat = new THREE.MeshStandardMaterial({
        color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.15,
        metalness: 0.1, roughness: 0.8, transparent: true, opacity: 0.4,
    });
    const runeGeo = new THREE.BoxGeometry(4.0, 0.02, 0.12);
    for (let i = 0; i < 3; i++) {
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.position.set(cx, h + 0.01, cz - 1 + i * 2);
        rune.rotation.y = i * 0.4;
        scene.add(rune);
    }

    // Crystal cluster on ground
    const crystalColors = [0x8a6aaa, 0x9a7aba, 0x7a5a9a];
    const crystalSpots: [number, number, number, number][] = [
        [cx - 7, cz + 3, 0.4, 0.6],
        [cx + 7, cz + 2, 0.3, 0.5],
        [cx - 4, cz + 5, 0.25, 0.4],
    ];
    for (const [gx, gz, w, gh] of crystalSpots) {
        const crystal = glowBox(w, gh, w, crystalColors[0], 0.25);
        crystal.position.set(gx, h + gh / 2, gz);
        crystal.rotation.y = Math.PI / 4;
        scene.add(crystal);
    }

    // Raised stone platform (subtle, 0.15 height)
    const altar = stdBox(3.0, 0.15, 3.0, PURPLE_LT);
    altar.position.set(cx, h + 0.075, cz + 1);
    scene.add(altar);

    // ===== Phase 2: Ruined Obelisk Tower =====
    // 비대칭 탑 — 한쪽이 부서진 형태로 멀리서 실루엣 인식 가능
    const OB = 0x887880, OB_ACC = 0x9a7888;

    // Main obelisk (tapered 3-segment, ~6 units tall)
    scene.add(setPos(stdBox(1.2, 0.3, 1.2, 0x7a7068), cx - 3, h + 0.15, cz + 3.5));
    const ob1 = stdBox(1.0, 2.5, 1.0, OB); ob1.position.set(cx - 3, h + 1.55, cz + 3.5); ob1.castShadow = true; scene.add(ob1);
    const ob2 = stdBox(0.8, 2.0, 0.8, OB_ACC); ob2.position.set(cx - 3, h + 3.8, cz + 3.5); ob2.castShadow = true; scene.add(ob2);
    const ob3 = stdBox(0.6, 1.2, 0.6, OB); ob3.position.set(cx - 3, h + 5.4, cz + 3.5); ob3.castShadow = true; scene.add(ob3);
    // Pink crystal cap
    const obGem = glowBox(0.45, 0.6, 0.45, 0xff6b9d, 0.45);
    obGem.position.set(cx - 3, h + 6.3, cz + 3.5); obGem.rotation.y = Math.PI / 4; scene.add(obGem);
    scene.add(setPos(new THREE.PointLight(0xff6b9d, 0.6, 12), cx - 3, h + 6.8, cz + 3.5));

    // Broken obelisk (shorter, tilted top — 부서진 짝)
    const obB1 = stdBox(0.9, 3.0, 0.9, OB); obB1.position.set(cx + 4, h + 1.5, cz + 3); obB1.castShadow = true; scene.add(obB1);
    const obB2 = stdBox(0.6, 0.8, 0.6, OB_ACC); obB2.position.set(cx + 4, h + 3.4, cz + 3); obB2.rotation.z = 0.15; scene.add(obB2);

    // Fallen column fragment on ground
    const fallen = stdBox(2.0, 0.45, 0.45, OB);
    fallen.position.set(cx + 6, h + 0.22, cz + 1); fallen.rotation.y = 0.3; scene.add(fallen);
    const fallenEnd = stdBox(0.5, 0.5, 0.5, OB_ACC);
    fallenEnd.position.set(cx + 7.1, h + 0.25, cz + 1.2); fallenEnd.rotation.y = 0.6; scene.add(fallenEnd);

    // Accent vine strips on main obelisk
    const vineMat = stdMat(0x4a8a4a);
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 1.02), vineMat), cx - 3.52, h + 2.5, cz + 3.5));
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.8, 0.08), vineMat), cx - 3, h + 1.4, cz + 4.02));
}

// --- Treasure Isle (28, -40, h=2.5) - Tropical dock ---

function buildTreasureDecor(scene: THREE.Scene): void {
    const cx = 28, cz = -40, h = 2.5;

    // Wooden dock structure (at the front edge)
    const dockY = h + 0.02;
    const dockZ = cz + 6;
    for (let i = 0; i < 3; i++) {
        woodBeam(scene, cx - 2 + i * 2, dockY + 0.06, dockZ, 1.6, 0.1, 3.0);
    }
    // Dock support posts
    woodBeam(scene, cx - 2, h - 0.3, dockZ + 1.2, 0.15, 0.8, 0.15);
    woodBeam(scene, cx + 2, h - 0.3, dockZ + 1.2, 0.15, 0.8, 0.15);

    // Cargo crates
    const crateCol = 0x9a7a50;
    const crate1 = stdBox(0.8, 0.8, 0.8, crateCol);
    crate1.position.set(cx - 5, h + 0.4, cz + 4);
    scene.add(crate1);
    const crate2 = stdBox(0.6, 0.6, 0.6, crateCol);
    crate2.position.set(cx - 4.5, h + 0.3, cz + 4.6);
    crate2.rotation.y = 0.3;
    scene.add(crate2);
    const crate3 = stdBox(0.5, 0.5, 0.5, crateCol);
    crate3.position.set(cx - 5.2, h + 0.85, cz + 4.1);
    scene.add(crate3);

    // Barrel
    const barrel = stdBox(0.55, 0.7, 0.55, 0x7a5a3a);
    barrel.position.set(cx + 5, h + 0.35, cz + 4);
    scene.add(barrel);
    const barrelRing = stdBox(0.6, 0.06, 0.6, 0x606060);
    barrelRing.position.set(cx + 5, h + 0.55, cz + 4);
    scene.add(barrelRing);

    // Sand patches near edges
    const sandMat = stdMat(0xd8c898);
    const sandGeo = new THREE.BoxGeometry(3.0, 0.03, 2.0);
    const sandSpots: [number, number][] = [
        [cx + 6, cz + 5], [cx - 6, cz + 5], [cx + 7, cz - 5],
    ];
    for (const [sx, sz] of sandSpots) {
        const sand = new THREE.Mesh(sandGeo, sandMat);
        sand.position.set(sx, h + 0.015, sz);
        scene.add(sand);
    }

    // Rope coil (small cylinder-ish)
    const rope = stdBox(0.4, 0.15, 0.4, 0xa09060);
    rope.position.set(cx - 3, h + 0.075, cz + 5.5);
    scene.add(rope);

    // Anchor decoration
    const anchor = stdBox(0.12, 0.8, 0.12, 0x505058);
    anchor.position.set(cx + 3, h + 0.4, cz + 5.5);
    scene.add(anchor);
    const anchorBar = stdBox(0.5, 0.08, 0.08, 0x505058);
    anchorBar.position.set(cx + 3, h + 0.75, cz + 5.5);
    scene.add(anchorBar);

    // ===== Phase 2: Lighthouse Tower =====
    // ~8 units tall — 멀리서도 바로 보이는 실루엣
    const LH_S = 0x9a8a78, LH_W = 0x8a6540;

    // Foundation
    scene.add(setPos(stdBox(1.8, 0.4, 1.8, LH_S), cx + 6, h + 0.2, cz - 4));
    // Tower body — 3 tapered segments
    const t1 = stdBox(1.4, 2.5, 1.4, LH_S); t1.position.set(cx + 6, h + 1.65, cz - 4); t1.castShadow = true; scene.add(t1);
    // Window slits
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x6ee7b7, emissive: 0x6ee7b7, emissiveIntensity: 0.15, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.4 });
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 1.42), slitMat), cx + 6, h + 2.0, cz - 4));
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.5, 0.12), slitMat), cx + 6, h + 2.0, cz - 4));
    // Middle segment
    const t2 = stdBox(1.1, 2.0, 1.1, LH_S); t2.position.set(cx + 6, h + 3.9, cz - 4); t2.castShadow = true; scene.add(t2);
    // Balcony rail
    scene.add(setPos(stdBox(1.5, 0.08, 1.5, LH_W), cx + 6, h + 4.94, cz - 4));
    // 4 rail posts
    for (const [rx, rz] of [[0.65, 0.65], [-0.65, 0.65], [0.65, -0.65], [-0.65, -0.65]] as [number, number][]) {
        scene.add(setPos(stdBox(0.08, 0.4, 0.08, LH_W), cx + 6 + rx, h + 5.14, cz - 4 + rz));
    }
    // Top cabin
    const t3 = stdBox(0.8, 1.2, 0.8, LH_W); t3.position.set(cx + 6, h + 5.94, cz - 4); t3.castShadow = true; scene.add(t3);
    // Lantern room (glowing)
    const lhLantern = glowBox(0.6, 0.7, 0.6, 0x6ee7b7, 0.5);
    lhLantern.position.set(cx + 6, h + 6.9, cz - 4); scene.add(lhLantern);
    // Roof + spire
    scene.add(setPos(stdBox(1.0, 0.12, 1.0, LH_W), cx + 6, h + 7.31, cz - 4));
    const spire = stdBox(0.12, 0.7, 0.12, LH_W); spire.position.set(cx + 6, h + 7.72, cz - 4); spire.castShadow = true; scene.add(spire);
    // Beacon light
    scene.add(setPos(new THREE.PointLight(0x6ee7b7, 0.8, 16), cx + 6, h + 7.5, cz - 4));

    // Scattered gold coins on ground (treasure feel)
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xf5c870, emissive: 0xf5c870, emissiveIntensity: 0.12, metalness: 0.4, roughness: 0.5 });
    const coinGeo = new THREE.BoxGeometry(0.22, 0.04, 0.22);
    for (const [gx, gz] of [[-3, -2], [4, 1], [-5, -5], [2, -3], [6, 2], [-2, 3]] as [number, number][]) {
        scene.add(setPos(new THREE.Mesh(coinGeo, coinMat), cx + gx, h + 0.02, cz + gz));
    }

    // Rope-wrapped bollard
    const bollard = stdBox(0.2, 0.7, 0.2, LH_W);
    bollard.position.set(cx - 6, h + 0.35, cz + 5); bollard.castShadow = true; scene.add(bollard);
    scene.add(setPos(stdBox(0.28, 0.06, 0.28, 0xa09060), cx - 6, h + 0.55, cz + 5));
    scene.add(setPos(stdBox(0.28, 0.06, 0.28, 0xa09060), cx - 6, h + 0.42, cz + 5));
}

// --- Beacon Peak (-28, -40, h=2.0) - Highland lookout ---

function buildBeaconDecor(scene: THREE.Scene): void {
    const cx = -28, cz = -40, h = 2.0;
    const AMBER = 0xa09060, STONE_A = 0x908070;

    // Stone stairway (3 steps at the back, visual only)
    for (let i = 0; i < 3; i++) {
        const step = stdBox(2.5 - i * 0.4, 0.12, 0.8, STONE_A);
        step.position.set(cx, h + 0.06 + i * 0.12, cz - 4.5 - i * 0.8);
        scene.add(step);
    }

    // Stone cairns (stacked rocks)
    const cairnSpots: [number, number][] = [
        [cx - 7, cz + 4], [cx + 7, cz - 5],
    ];
    for (const [sx, sz] of cairnSpots) {
        const sizes = [0.5, 0.38, 0.25];
        let y = h;
        for (const s of sizes) {
            const rock = stdBox(s, s * 0.55, s, STONE_A);
            rock.position.set(sx + (s - 0.5) * 0.1, y + s * 0.275, sz);
            rock.rotation.y = s * 3.7;
            scene.add(rock);
            y += s * 0.55;
        }
    }

    // Lookout railing (at the front edge)
    const railColor = 0x8a6540;
    stonePillar(scene, cx - 4, h, cz + 5.5, 1.0, STONE_A);
    stonePillar(scene, cx + 4, h, cz + 5.5, 1.0, STONE_A);
    const topRail = stdBox(8.5, 0.1, 0.12, railColor);
    topRail.position.set(cx, h + 1.05, cz + 5.5);
    scene.add(topRail);

    // Torch brackets (on pillars)
    const torchSpots: [number, number][] = [
        [cx - 4, cz + 5.5], [cx + 4, cz + 5.5],
    ];
    for (const [tx, tz] of torchSpots) {
        const bracket = stdBox(0.08, 0.35, 0.08, railColor);
        bracket.position.set(tx, h + 1.3, tz + 0.15);
        scene.add(bracket);
        const flame = glowBox(0.15, 0.2, 0.15, 0xf0a030, 0.6);
        flame.position.set(tx, h + 1.55, tz + 0.15);
        scene.add(flame);
    }

    // Raised stone platform (subtle altar)
    const base = stdBox(2.5, 0.1, 2.5, AMBER);
    base.position.set(cx, h + 0.05, cz - 2);
    scene.add(base);

    // Rocky outcroppings at edges
    const rockSpots: [number, number, number][] = [
        [cx - 8, cz - 6, 0.7], [cx + 8, cz - 6, 0.5],
        [cx - 8, cz + 3, 0.4],
    ];
    for (const [rx, rz, s] of rockSpots) {
        const rock = stdBox(s, s * 0.8, s * 0.9, STONE_A);
        rock.position.set(rx, h + s * 0.4, rz);
        rock.rotation.y = rx * 0.5;
        scene.add(rock);
    }

    // ===== Phase 2: Crystal Spire =====
    // ~7.5 units tall — 보라빛 크리스탈 타워 + 부유 파편
    const OBSIDIAN = 0x2a2838, CRYS = 0xa78bfa;

    // Dark stone base
    scene.add(setPos(stdBox(1.6, 0.5, 1.6, OBSIDIAN), cx + 5, h + 0.25, cz - 4));
    scene.add(setPos(stdBox(1.3, 0.2, 1.3, 0x3a3048), cx + 5, h + 0.6, cz - 4));
    // Spire body — dark stone fading to crystal
    const sp1 = stdBox(1.0, 3.0, 1.0, 0x3a3048); sp1.position.set(cx + 5, h + 2.1, cz - 4); sp1.castShadow = true; scene.add(sp1);
    // Crystal mid-section
    const sp2 = glowBox(0.75, 2.5, 0.75, 0x7858c8, 0.2);
    sp2.position.set(cx + 5, h + 4.85, cz - 4); sp2.castShadow = true; scene.add(sp2);
    // Crystal tip
    const sp3 = glowBox(0.45, 1.5, 0.45, CRYS, 0.45);
    sp3.position.set(cx + 5, h + 6.85, cz - 4); sp3.rotation.y = Math.PI / 4; scene.add(sp3);
    // Peak gem
    const spGem = glowBox(0.3, 0.4, 0.3, CRYS, 0.7);
    spGem.position.set(cx + 5, h + 7.8, cz - 4); spGem.rotation.y = Math.PI / 4; scene.add(spGem);
    // Spire light (bright, long range — 멀리서도 보라빛 확인)
    scene.add(setPos(new THREE.PointLight(CRYS, 0.8, 16), cx + 5, h + 8.2, cz - 4));

    // Floating crystal fragments (서로 다른 높이에 부유)
    const fragMat = new THREE.MeshStandardMaterial({
        color: CRYS, emissive: CRYS, emissiveIntensity: 0.35,
        metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.8,
    });
    const fragGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const fragLgGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
    const frags: [number, number, number, boolean][] = [
        [cx + 3.5, h + 4.5, cz - 3, false],
        [cx + 6.5, h + 3.8, cz - 5, false],
        [cx + 4.2, h + 5.8, cz - 5.5, true],
        [cx + 6.0, h + 6.2, cz - 3.2, false],
        [cx + 5.5, h + 7.0, cz - 2.5, true],
    ];
    for (const [fx, fy, fz, large] of frags) {
        const f = new THREE.Mesh(large ? fragLgGeo : fragGeo, fragMat);
        f.position.set(fx, fy, fz);
        f.rotation.set(fx * 0.7, fy * 0.3, fz * 0.5);
        scene.add(f);
    }

    // Dark floor tiles (obsidian feel — 존 바닥 차별화)
    const darkTileMat = new THREE.MeshStandardMaterial({
        color: CRYS, emissive: CRYS, emissiveIntensity: 0.04,
        metalness: 0.2, roughness: 0.7, transparent: true, opacity: 0.1,
    });
    const darkTileGeo = new THREE.BoxGeometry(2.0, 0.02, 2.0);
    for (const [tx, tz] of [[-4, -2], [4, 2], [-5, 3], [3, -5], [0, 4]] as [number, number][]) {
        scene.add(setPos(new THREE.Mesh(darkTileGeo, darkTileMat), cx + tx, h + 0.012, cz + tz));
    }

    // Rune circle on ground (around spire base)
    const runeCircleMat = new THREE.MeshStandardMaterial({
        color: CRYS, emissive: CRYS, emissiveIntensity: 0.15,
        metalness: 0.1, roughness: 0.8, transparent: true, opacity: 0.3,
    });
    const runeRing = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 2.4, 6),
        new THREE.MeshBasicMaterial({ color: CRYS, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
    );
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.set(cx + 5, h + 0.02, cz - 4);
    scene.add(runeRing);

    // Pointed arch fragments (ominous entrance feel)
    const archMat = stdMat(0x3a3048);
    const archL = stdBox(0.3, 2.5, 0.3, 0x3a3048);
    archL.position.set(cx + 3, h + 1.25, cz - 1); archL.castShadow = true; scene.add(archL);
    const archR = stdBox(0.3, 2.0, 0.3, 0x3a3048);
    archR.position.set(cx + 7, h + 1.0, cz - 1); archR.castShadow = true; scene.add(archR);
    // Tilted crossbar (broken arch)
    const archBar = stdBox(4.2, 0.2, 0.25, 0x3a3048);
    archBar.position.set(cx + 5, h + 2.6, cz - 1); archBar.rotation.z = -0.08; scene.add(archBar);
}

// --- Overworld (0, -58, h=3.2) - Sacred garden ---

function buildOverworldDecor(scene: THREE.Scene): void {
    const cx = 0, cz = -58, h = 3.2;
    const GARDEN_STONE = 0xa09898;

    // Wooden arch / torii-style gate (front entrance)
    const gateX = cx, gateZ = cz + 5.5;
    woodBeam(scene, gateX - 1.5, h + 1.0, gateZ, 0.18, 2.0, 0.18);
    woodBeam(scene, gateX + 1.5, h + 1.0, gateZ, 0.18, 2.0, 0.18);
    woodBeam(scene, gateX, h + 2.1, gateZ, 3.5, 0.15, 0.2);  // top beam
    woodBeam(scene, gateX, h + 1.7, gateZ, 3.0, 0.08, 0.15); // lower beam

    // Stone garden (arranged rocks in circle)
    const gardenR = 2.0;
    const gardenCenter: [number, number] = [cx + 5, cz + 2];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const s = 0.25 + (i % 3) * 0.1;
        const rock = stdBox(s, s * 0.6, s, GARDEN_STONE);
        rock.position.set(
            gardenCenter[0] + Math.cos(a) * gardenR,
            h + s * 0.3,
            gardenCenter[1] + Math.sin(a) * gardenR,
        );
        rock.rotation.y = a;
        scene.add(rock);
    }
    // Sand circle in garden center
    const gardenSand = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.02, 3.5),
        stdMat(0xd0c8b8),
    );
    gardenSand.position.set(gardenCenter[0], h + 0.01, gardenCenter[1]);
    scene.add(gardenSand);

    // Wooden bench
    const benchX = cx - 5, benchZ = cz + 3;
    woodBeam(scene, benchX, h + 0.25, benchZ, 1.4, 0.08, 0.4);  // seat
    woodBeam(scene, benchX - 0.55, h + 0.12, benchZ, 0.1, 0.25, 0.1);  // leg L
    woodBeam(scene, benchX + 0.55, h + 0.12, benchZ, 0.1, 0.25, 0.1);  // leg R

    // Petal scatter on ground (flat pink boxes)
    const petalMat = new THREE.MeshStandardMaterial({
        color: 0xf5a8c0, emissive: 0xf5a8c0, emissiveIntensity: 0.05,
        metalness: 0.05, roughness: 0.9, transparent: true, opacity: 0.5,
    });
    const petalGeo = new THREE.BoxGeometry(0.12, 0.01, 0.08);
    const seed = (a: number, b: number) => {
        const n = Math.sin(a * 12.9 + b * 78.2) * 43758.5;
        return n - Math.floor(n);
    };
    for (let i = 0; i < 15; i++) {
        const px = cx + (seed(i * 3.1, i * 7.3) - 0.5) * 14;
        const pz = cz + (seed(i * 5.7, i * 2.1) - 0.5) * 10;
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.position.set(px, h + 0.005, pz);
        petal.rotation.y = seed(px, pz) * Math.PI;
        scene.add(petal);
    }

    // Stone path from gate toward tree
    for (let i = 0; i < 5; i++) {
        const pathStone = stdBox(0.8, 0.03, 0.6, GARDEN_STONE);
        pathStone.position.set(
            cx + (i % 2) * 0.2,
            h + 0.015,
            cz + 4 - i * 1.8,
        );
        scene.add(pathStone);
    }

    // Low stone wall (partial, at the back)
    stoneWall(scene, cx - 5, h, cz - 5.5, 4.0, 0.6, 0.35, GARDEN_STONE);
    stoneWall(scene, cx + 5, h, cz - 5.5, 4.0, 0.6, 0.35, GARDEN_STONE);

    // ===== Phase 2: Grand Lantern Stands + Zen Elements =====
    const LW = 0x7a5a38, GLOW = 0xfbbf24;

    // Grand lantern post (right side, tall)
    const lp1 = stdBox(0.2, 5.0, 0.2, LW); lp1.position.set(cx + 5, h + 2.5, cz - 2); lp1.castShadow = true; scene.add(lp1);
    scene.add(setPos(stdBox(1.5, 0.12, 0.12, LW), cx + 5.5, h + 5.2, cz - 2));
    scene.add(setPos(stdBox(0.06, 0.5, 0.06, 0x606060), cx + 6.2, h + 4.95, cz - 2));
    const lan1 = glowBox(0.38, 0.48, 0.38, GLOW, 0.5);
    lan1.position.set(cx + 6.2, h + 4.5, cz - 2); scene.add(lan1);
    scene.add(setPos(new THREE.PointLight(GLOW, 0.5, 8), cx + 6.2, h + 4.7, cz - 2));

    // Second lantern post (left side, slightly shorter)
    const lp2 = stdBox(0.18, 4.0, 0.18, LW); lp2.position.set(cx - 5, h + 2.0, cz - 4); lp2.castShadow = true; scene.add(lp2);
    scene.add(setPos(stdBox(1.3, 0.1, 0.1, LW), cx - 5.4, h + 4.15, cz - 4));
    scene.add(setPos(stdBox(0.05, 0.45, 0.05, 0x606060), cx - 6.0, h + 3.9, cz - 4));
    const lan2 = glowBox(0.32, 0.42, 0.32, GLOW, 0.45);
    lan2.position.set(cx - 6.0, h + 3.5, cz - 4); scene.add(lan2);
    scene.add(setPos(new THREE.PointLight(GLOW, 0.4, 6), cx - 6.0, h + 3.7, cz - 4));

    // Third lantern (center-back, near the sacred tree)
    const lp3 = stdBox(0.16, 3.5, 0.16, LW); lp3.position.set(cx + 2, h + 1.75, cz - 6); lp3.castShadow = true; scene.add(lp3);
    scene.add(setPos(stdBox(0.9, 0.08, 0.08, LW), cx + 2.3, h + 3.6, cz - 6));
    scene.add(setPos(stdBox(0.05, 0.35, 0.05, 0x606060), cx + 2.7, h + 3.35, cz - 6));
    const lan3 = glowBox(0.28, 0.35, 0.28, GLOW, 0.4);
    lan3.position.set(cx + 2.7, h + 3.0, cz - 6); scene.add(lan3);
    scene.add(setPos(new THREE.PointLight(GLOW, 0.35, 5), cx + 2.7, h + 3.2, cz - 6));

    // Stone water basin (tsukubai — 젠 가든 핵심 요소)
    const basin = stdBox(0.8, 0.45, 0.8, GARDEN_STONE);
    basin.position.set(cx - 6, h + 0.22, cz + 1); scene.add(basin);
    // Hollowed water surface
    const basinWater = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.04, 0.5),
        new THREE.MeshStandardMaterial({
            color: 0x4090c0, emissive: 0x4090c0, emissiveIntensity: 0.1,
            metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.6,
        }),
    );
    basinWater.position.set(cx - 6, h + 0.46, cz + 1); scene.add(basinWater);
    // Bamboo spout
    scene.add(setPos(stdBox(0.06, 0.5, 0.06, 0x6a8a4a), cx - 6.5, h + 0.55, cz + 1));
    scene.add(setPos(stdBox(0.5, 0.06, 0.06, 0x6a8a4a), cx - 6.3, h + 0.8, cz + 1));

    // High cherry blossom clusters (sacred tree 캐노피 확장)
    const blossomMat = stdMat(0xf5a8c0);
    const blossomDkMat = stdMat(0xe888a0);
    const blossomGeo = new THREE.BoxGeometry(0.9, 0.65, 0.9);
    const blossomSmGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
    const blossomSpots: [number, number, number, boolean][] = [
        [cx - 2.5, h + 5.8, cz - 3.0, true],
        [cx + 2.0, h + 6.0, cz - 5.0, false],
        [cx - 1.0, h + 6.5, cz - 5.8, true],
        [cx + 2.5, h + 5.2, cz - 3.5, false],
        [cx - 3.0, h + 5.0, cz - 5.0, false],
        [cx + 1.0, h + 6.8, cz - 4.5, true],
    ];
    for (const [bx, by, bz, large] of blossomSpots) {
        const b = new THREE.Mesh(large ? blossomGeo : blossomSmGeo, large ? blossomMat : blossomDkMat);
        b.position.set(bx, by, bz); b.castShadow = true; scene.add(b);
    }

    // Zen raked gravel lines (parallel grooves — 존 바닥 차별화)
    const gravelMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.03,
        metalness: 0.05, roughness: 0.9, transparent: true, opacity: 0.08,
    });
    const gravelGeo = new THREE.BoxGeometry(8.0, 0.015, 0.08);
    for (let gi = -3; gi <= 3; gi++) {
        scene.add(setPos(new THREE.Mesh(gravelGeo, gravelMat), cx - 2, h + 0.01, cz + gi * 0.8));
    }
}

// =============================================
// ZONE BOUNDARY SYSTEM (Phase 1)
// Edge glow, corner beacons, ground patterns, entrance gates
// =============================================

export function buildZoneBoundaries(scene: THREE.Scene): void {
    interface ZDef {
        x: number; z: number; w: number; d: number; h: number;
        color: number;
        gateEdge: 'n' | 's' | 'e' | 'w';
        gateOff: number; // offset along the gate edge
    }

    const ZONES: ZDef[] = [
        // Overworld hub — from spawn (south)
        { x: 0, z: -18, w: 18, d: 14, h: 1.0, color: 0xff6b9d, gateEdge: 's', gateOff: 0 },
        // Treasure Isle — stepping stones arrive at south edge near x=22
        { x: 28, z: -40, w: 18, d: 14, h: 2.5, color: 0x6ee7b7, gateEdge: 's', gateOff: -6 },
        // The Nether — stepping stones arrive at south edge near x=-22
        { x: -28, z: -40, w: 18, d: 14, h: 2.0, color: 0xa78bfa, gateEdge: 's', gateOff: 6 },
        // Beacon Peak — from center path (south)
        { x: 0, z: -58, w: 18, d: 14, h: 3.2, color: 0xfbbf24, gateEdge: 's', gateOff: 0 },
    ];

    // Shared geometries
    const pillarBaseGeo = new THREE.BoxGeometry(0.5, 0.15, 0.5);
    const pillarBodyGeo = new THREE.BoxGeometry(0.28, 1.6, 0.28);
    const pillarCapGeo = new THREE.BoxGeometry(0.4, 0.12, 0.4);
    const beaconGemGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const cornerTileGeo = new THREE.BoxGeometry(0.6, 0.03, 0.6);
    const gatePillarGeo = new THREE.BoxGeometry(0.4, 3.2, 0.4);
    const gateAccentGeo = new THREE.BoxGeometry(0.42, 0.08, 0.42);
    const gateGemGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);

    // Shared materials (zone-independent)
    const stoneMat = stdMat(0x706868);
    const stoneCapMat = stdMat(0x808078);
    const gateStoneMat = stdMat(0x605858);

    for (const z of ZONES) {
        const hw = z.w / 2, hd = z.d / 2;

        // Per-zone emissive materials
        const borderMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.2,
            metalness: 0.15, roughness: 0.6, transparent: true, opacity: 0.5,
        });
        const innerMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.08,
            metalness: 0.1, roughness: 0.8, transparent: true, opacity: 0.25,
        });
        const gemMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.5,
            metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.9,
        });
        const gateAccentMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.25,
            metalness: 0.2, roughness: 0.5,
        });
        const centerMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.12,
            metalness: 0.15, roughness: 0.7, transparent: true, opacity: 0.3,
        });

        // ========================================
        // 1. EDGE GLOW BORDER
        // Raised emissive strips framing the zone — 가장 체감 큰 요소
        // ========================================
        const ey = z.h + 0.04;
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(z.w + 0.2, 0.07, 0.16), borderMat), z.x, ey, z.z - hd + 0.1));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(z.w + 0.2, 0.07, 0.16), borderMat), z.x, ey, z.z + hd - 0.1));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, z.d + 0.2), borderMat), z.x - hw + 0.1, ey, z.z));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, z.d + 0.2), borderMat), z.x + hw - 0.1, ey, z.z));

        // ========================================
        // 2. GROUND PATTERN
        // Inner frame + cross + center medallion
        // ========================================
        const inset = 2.5;
        const iW = z.w - inset * 2, iD = z.d - inset * 2;
        const fy = z.h + 0.015;

        // Inner rectangular frame
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(iW, 0.025, 0.1), innerMat), z.x, fy, z.z - hd + inset));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(iW, 0.025, 0.1), innerMat), z.x, fy, z.z + hd - inset));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, iD), innerMat), z.x - hw + inset, fy, z.z));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, iD), innerMat), z.x + hw - inset, fy, z.z));

        // Cross lines through center
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(iW * 0.7, 0.02, 0.06), innerMat), z.x, fy - 0.002, z.z));
        scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, iD * 0.7), innerMat), z.x, fy - 0.002, z.z));

        // Diagonal lines (X pattern)
        const diagLen = Math.min(iW, iD) * 0.4;
        for (const ry of [Math.PI / 4, -Math.PI / 4]) {
            const diag = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.02, 0.05), innerMat);
            diag.position.set(z.x, fy - 0.003, z.z);
            diag.rotation.y = ry;
            scene.add(diag);
        }

        // Inner frame corner accent tiles
        for (const [cx, cz] of [
            [z.x - hw + inset, z.z - hd + inset],
            [z.x + hw - inset, z.z - hd + inset],
            [z.x - hw + inset, z.z + hd - inset],
            [z.x + hw - inset, z.z + hd - inset],
        ] as [number, number][]) {
            const tile = new THREE.Mesh(cornerTileGeo, innerMat);
            tile.position.set(cx, z.h + 0.018, cz);
            tile.rotation.y = Math.PI / 4;
            scene.add(tile);
        }

        // Center medallion (large rotated diamond)
        const med = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 2.2), centerMat);
        med.position.set(z.x, z.h + 0.02, z.z);
        med.rotation.y = Math.PI / 4;
        scene.add(med);

        // Inner diamond (brighter)
        const innerDiamond = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.035, 1.1), borderMat);
        innerDiamond.position.set(z.x, z.h + 0.025, z.z);
        innerDiamond.rotation.y = Math.PI / 4;
        scene.add(innerDiamond);

        // Zone-specific ground accent dots (4 cardinal directions from center)
        const dotDist = 3.5;
        const dotMat = new THREE.MeshStandardMaterial({
            color: z.color, emissive: z.color, emissiveIntensity: 0.15,
            metalness: 0.1, roughness: 0.7, transparent: true, opacity: 0.35,
        });
        const dotGeo = new THREE.BoxGeometry(0.35, 0.025, 0.35);
        for (const [dx, dz] of [[dotDist, 0], [-dotDist, 0], [0, dotDist], [0, -dotDist]] as [number, number][]) {
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(z.x + dx, z.h + 0.016, z.z + dz);
            dot.rotation.y = Math.PI / 4;
            scene.add(dot);
        }

        // ========================================
        // 3. CORNER BEACONS
        // Stone pillar + emissive gem + point light
        // ========================================
        const cInset = 1.3;
        const beaconCorners: [number, number][] = [
            [z.x - hw + cInset, z.z - hd + cInset],
            [z.x + hw - cInset, z.z - hd + cInset],
            [z.x - hw + cInset, z.z + hd - cInset],
            [z.x + hw - cInset, z.z + hd - cInset],
        ];

        for (const [cx, cz] of beaconCorners) {
            // Base
            scene.add(setPos(new THREE.Mesh(pillarBaseGeo, stoneCapMat), cx, z.h + 0.075, cz));
            // Pillar body
            const body = new THREE.Mesh(pillarBodyGeo, stoneMat);
            body.position.set(cx, z.h + 0.95, cz);
            body.castShadow = true;
            scene.add(body);
            // Cap
            scene.add(setPos(new THREE.Mesh(pillarCapGeo, stoneCapMat), cx, z.h + 1.82, cz));
            // Glowing gem
            const gem = new THREE.Mesh(beaconGemGeo, gemMat);
            gem.position.set(cx, z.h + 2.02, cz);
            gem.rotation.y = Math.PI / 4;
            scene.add(gem);
            // Point light
            const light = new THREE.PointLight(z.color, 0.3, 5);
            light.position.set(cx, z.h + 2.3, cz);
            scene.add(light);
        }

        // ========================================
        // 4. ENTRANCE GATE
        // Pillar pair + cross beam + accent bands + top gem
        // 플랫폼 가장자리 바로 바깥에 배치 (fence gap 위치)
        // ========================================
        const spacing = 1.5;
        let gx: number, gz: number;

        switch (z.gateEdge) {
            case 's': gx = z.x + z.gateOff; gz = z.z + hd + 0.35; break;
            case 'n': gx = z.x + z.gateOff; gz = z.z - hd - 0.35; break;
            case 'e': gx = z.x + hw + 0.35; gz = z.z + z.gateOff; break;
            case 'w': gx = z.x - hw - 0.35; gz = z.z + z.gateOff; break;
        }

        const isVerticalGate = z.gateEdge === 'e' || z.gateEdge === 'w';

        if (isVerticalGate) {
            // Pillars along z-axis
            for (const pz of [gz - spacing, gz + spacing]) {
                const p = new THREE.Mesh(gatePillarGeo, gateStoneMat);
                p.position.set(gx, z.h + 1.6, pz);
                p.castShadow = true;
                scene.add(p);
                scene.add(setPos(new THREE.Mesh(gateAccentGeo, gateAccentMat), gx, z.h + 0.5, pz));
                scene.add(setPos(new THREE.Mesh(gateAccentGeo, gateAccentMat), gx, z.h + 2.7, pz));
            }
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, spacing * 2 + 0.5), gateStoneMat);
            beam.position.set(gx, z.h + 3.3, gz);
            scene.add(beam);
        } else {
            // Pillars along x-axis
            for (const px of [gx - spacing, gx + spacing]) {
                const p = new THREE.Mesh(gatePillarGeo, gateStoneMat);
                p.position.set(px, z.h + 1.6, gz);
                p.castShadow = true;
                scene.add(p);
                scene.add(setPos(new THREE.Mesh(gateAccentGeo, gateAccentMat), px, z.h + 0.5, gz));
                scene.add(setPos(new THREE.Mesh(gateAccentGeo, gateAccentMat), px, z.h + 2.7, gz));
            }
            const beam = new THREE.Mesh(new THREE.BoxGeometry(spacing * 2 + 0.5, 0.2, 0.28), gateStoneMat);
            beam.position.set(gx, z.h + 3.3, gz);
            scene.add(beam);
        }

        // Gate top gem + light
        const topGem = new THREE.Mesh(gateGemGeo, gemMat);
        topGem.position.set(gx, z.h + 3.6, gz);
        topGem.rotation.y = Math.PI / 4;
        scene.add(topGem);

        const gateLight = new THREE.PointLight(z.color, 0.5, 7);
        gateLight.position.set(gx, z.h + 3.8, gz);
        scene.add(gateLight);

        // Gate base step (시각적 안내 — "여기로 들어오세요")
        const stepW = isVerticalGate ? 0.6 : spacing * 2 + 0.8;
        const stepD = isVerticalGate ? spacing * 2 + 0.8 : 0.6;
        const gateStep = new THREE.Mesh(
            new THREE.BoxGeometry(stepW, 0.05, stepD),
            borderMat,
        );
        gateStep.position.set(gx, z.h + 0.03, gz);
        scene.add(gateStep);
    }

    // ========================================
    // SPAWN BOUNDARY (simpler — edge glow only)
    // ========================================
    const spawnBorderMat = new THREE.MeshStandardMaterial({
        color: 0x6ee7b7, emissive: 0x6ee7b7, emissiveIntensity: 0.08,
        metalness: 0.1, roughness: 0.7, transparent: true, opacity: 0.25,
    });
    const sp = { x: 0, z: 0, w: 14, d: 12, h: 0.5 };
    const shw = sp.w / 2, shd = sp.d / 2;
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(sp.w, 0.05, 0.1), spawnBorderMat), sp.x, sp.h + 0.03, sp.z - shd + 0.08));
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(sp.w, 0.05, 0.1), spawnBorderMat), sp.x, sp.h + 0.03, sp.z + shd - 0.08));
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, sp.d), spawnBorderMat), sp.x - shw + 0.08, sp.h + 0.03, sp.z));
    scene.add(setPos(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, sp.d), spawnBorderMat), sp.x + shw - 0.08, sp.h + 0.03, sp.z));
}