// ─── 공용 헬퍼 함수 (밝은 복셀 월드) ───
import * as THREE from 'three';

/** Natural material box — visible color, minimal emissive */
export function mk(
    w: number, h: number, d: number,
    c: number, _e?: number, _ei?: number,
): THREE.Mesh {
  const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.75 }),
  );
  m.castShadow = true;
  return m;
}

/** Add wireframe edges */
export function ae(m: THREE.Mesh, c: number): void {
  m.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(m.geometry),
      new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.2 }),
  ));
}

/** Wireframe-only mesh */
export function mkWire(geo: THREE.BufferGeometry, color: number, opacity = 0.3): THREE.LineSegments {
  return new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

/** Accent/glow mesh — subtle emissive for special items */
export function mkGlow(geo: THREE.BufferGeometry, color: number, ei = 0.3): THREE.Mesh {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: ei,
    metalness: 0.15, roughness: 0.5,
    transparent: true, opacity: 0.9,
  }));
}

/** Canvas text sprite */
export function makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 512; canvas.height = 64;
  ctx.font = '600 22px JetBrains Mono, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, 256, 32);
  // Subtle shadow for readability against bright sky
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.fillText(text, 257, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(5.5, 0.7, 1);
  return sprite;
}