// Shared mesh/material utilities
import * as THREE from 'three';

// --- Position ---

export function setPos<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// --- Materials ---

export function stdMat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness });
}

// --- Mesh Factories ---

/** Standard colored box with shadow. Used for terrain, fences, decorations. */
export function stdBox(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Accent box with emissive glow. Used for gems, crystals, special items. */
export function glowBox(w: number, h: number, d: number, color: number, ei = 0.3): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: ei,
      metalness: 0.2, roughness: 0.5,
      transparent: true, opacity: 0.9,
    }),
  );
}

/** Double-sided plane for eyes, blush, symbols. */
export function facePlane(w: number, h: number, color: number, opacity = 1): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide,
      transparent: opacity < 1, opacity,
    }),
  );
}

// --- Wireframe ---

export function addEdges(mesh: THREE.Mesh, color: number, opacity = 0.2): void {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  ));
}

export function wireOnly(geo: THREE.BufferGeometry, color: number, opacity = 0.3): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

// --- Text ---

export function textSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 64;

  ctx.font = '600 22px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, 256, 32);

  // Subtle shadow for readability
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.fillText(text, 257, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set(5.5, 0.7, 1);
  return sprite;
}
