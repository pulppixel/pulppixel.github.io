// ─── 공용 헬퍼 함수 ───
import * as THREE from 'three';

/** Emissive 박스 메시 생성 */
export function mk(
  w: number, h: number, d: number,
  c: number, e: number, ei: number,
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, metalness: 0.75, roughness: 0.25 }),
  );
  m.castShadow = true;
  return m;
}

/** 메시에 와이어프레임 엣지 추가 */
export function ae(m: THREE.Mesh, c: number): void {
  m.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(m.geometry),
    new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.35 }),
  ));
}

/** 와이어프레임 전용 메시 */
export function mkWire(geo: THREE.BufferGeometry, color: number, opacity = 0.4): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

/** 글로우(Emissive) 메시 */
export function mkGlow(geo: THREE.BufferGeometry, color: number, ei = 0.8): THREE.Mesh {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x080810, emissive: color, emissiveIntensity: ei,
    metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.85,
  }));
}

/** 캔버스 텍스트 스프라이트 (회사 라벨 등) */
export function makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256; canvas.height = 64;
  ctx.font = '600 28px JetBrains Mono, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}
