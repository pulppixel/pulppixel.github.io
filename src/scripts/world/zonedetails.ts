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