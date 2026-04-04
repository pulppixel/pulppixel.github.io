// Zone detail decorations: per-zone structures, water edge, bushes
// Purely visual (no collision changes). Add density and architectural interest.
import * as THREE from 'three';
import { PLATFORMS } from '../core/data';
import { stdBox, glowBox, stdMat, setPos } from '../core/helpers';

// --- Water edge: reef ring + foam strips around each platform ---

export function buildWaterEdge(scene: THREE.Scene): void {
    const foamMat = new THREE.MeshBasicMaterial({
        color: 0xc8f0f5, transparent: true, opacity: 0.18,
    });
    const reefMat = stdMat(0x6a9888, 0.7);
    const sandMat = stdMat(0xc8b898, 0.8);

    for (const p of PLATFORMS) {
        if (p.h <= 0) continue;
        const hw = p.w / 2, hd = p.d / 2;

        // Reef base (wider than platform, at water level)
        const reef = new THREE.Mesh(
            new THREE.BoxGeometry(p.w + 1.8, 0.12, p.d + 1.8),
            reefMat,
        );
        reef.position.set(p.x, 0.06, p.z);
        reef.receiveShadow = true;
        scene.add(reef);

        // Sandy transition ring (between reef and cliff)
        const sand = new THREE.Mesh(
            new THREE.BoxGeometry(p.w + 0.8, 0.08, p.d + 0.8),
            sandMat,
        );
        sand.position.set(p.x, 0.15, p.z);
        scene.add(sand);

        // Foam strips on 4 sides
        const foamData: [number, number, number, number, number, number][] = [
            [p.x, 0.09, p.z + hd + 1.1, p.w + 2.4, 0.03, 0.5],
            [p.x, 0.09, p.z - hd - 1.1, p.w + 2.4, 0.03, 0.5],
            [p.x + hw + 1.1, 0.09, p.z, 0.5, 0.03, p.d + 1.4],
            [p.x - hw - 1.1, 0.09, p.z, 0.5, 0.03, p.d + 1.4],
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
        // Bridges
        [11, -23], [-11, -23], [1, -33], [-1, -45],
        [17, -30], [-17, -30],
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