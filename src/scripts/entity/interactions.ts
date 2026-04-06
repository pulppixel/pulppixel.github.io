// NPC animal interaction: emoji bubbles that track actual animal positions
// Finds animal groups in scene by scale (0.4=rabbit, 0.3=bird)
import * as THREE from 'three';

export interface AnimalInteraction {
  update(dt: number, t: number, playerPos: THREE.Vector3): void;
}

interface TrackedAnimal {
  group: THREE.Group;
  sprite: THREE.Sprite;
  type: 'rabbit' | 'bird';
  state: 'hidden' | 'appearing' | 'visible' | 'fading';
  alpha: number;
  lastEmoji: string;
  bobPhase: number;
}

// --- Emoji sprite factory ---

const EMOJI_CACHE = new Map<string, THREE.Texture>();

function getEmojiTexture(emoji: string): THREE.Texture {
  if (EMOJI_CACHE.has(emoji)) return EMOJI_CACHE.get(emoji)!;

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // 작은 말풍선
  ctx.fillStyle = 'rgba(10,10,11,0.8)';
  ctx.beginPath();
  ctx.roundRect(12, 8, 104, 88, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,231,183,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 꼬리
  ctx.fillStyle = 'rgba(10,10,11,0.8)';
  ctx.beginPath();
  ctx.moveTo(52, 96); ctx.lineTo(64, 116); ctx.lineTo(76, 96);
  ctx.fill();

  // 이모지
  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 54);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  EMOJI_CACHE.set(emoji, tex);
  return tex;
}

function createBubbleSprite(): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: getEmojiTexture('💤'),
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.55, 0.55, 1);
  sprite.visible = false;
  return sprite;
}

// --- Emoji selection ---

function getRabbitEmoji(dist: number, t: number): string {
  if (dist < 2.5) return '💨';
  if (dist < 5) return '❗';
  const idle = ['💤', '🌿', '🍀', '✨'];
  return idle[Math.floor(t * 0.3) % idle.length];
}

function getBirdEmoji(t: number): string {
  const emojis = ['♪', '♫', '🎵', '☀️'];
  return emojis[Math.floor(t * 0.2) % emojis.length];
}

// --- Factory ---

export function createAnimalInteraction(scene: THREE.Scene): AnimalInteraction {
  const tracked: TrackedAnimal[] = [];
  const SHOW_DIST = 6.0;
  const HIDE_DIST = 8.0;
  const FADE_SPD = 3.0;

  // 씬 스캔으로 동물 그룹 찾기 (animals.ts에서 생성된 그룹의 scale로 식별)
  // rabbit: scale 0.4, children > 5  /  bird: scale 0.3, children 4~7
  setTimeout(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Group) || obj.parent !== scene) return;

      // 토끼: scale=0.4
      if (Math.abs(obj.scale.x - 0.4) < 0.01 && obj.children.length > 5) {
        const sprite = createBubbleSprite();
        scene.add(sprite);
        tracked.push({
          group: obj, sprite, type: 'rabbit',
          state: 'hidden', alpha: 0,
          lastEmoji: '', bobPhase: Math.random() * Math.PI * 2,
        });
      }

      // 새: scale=0.3
      if (Math.abs(obj.scale.x - 0.3) < 0.01 && obj.children.length >= 4 && obj.children.length <= 7) {
        const sprite = createBubbleSprite();
        scene.add(sprite);
        tracked.push({
          group: obj, sprite, type: 'bird',
          state: 'hidden', alpha: 0,
          lastEmoji: '', bobPhase: Math.random() * Math.PI * 2,
        });
      }
    });
  }, 200);

  const _worldPos = new THREE.Vector3();

  return {
    update(dt, t, playerPos) {
      for (const a of tracked) {
        // 동물 실제 월드 위치
        a.group.getWorldPosition(_worldPos);
        const dx = playerPos.x - _worldPos.x;
        const dz = playerPos.z - _worldPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // State
        if (dist < SHOW_DIST && a.state === 'hidden') a.state = 'appearing';
        else if (dist > HIDE_DIST && (a.state === 'visible' || a.state === 'appearing')) a.state = 'fading';

        switch (a.state) {
          case 'appearing':
            a.alpha = Math.min(1, a.alpha + FADE_SPD * dt);
            if (a.alpha >= 1) { a.alpha = 1; a.state = 'visible'; }
            break;
          case 'fading':
            a.alpha = Math.max(0, a.alpha - FADE_SPD * dt);
            if (a.alpha <= 0) { a.alpha = 0; a.state = 'hidden'; }
            break;
        }

        // 이모지 선택
        const emoji = a.type === 'rabbit' ? getRabbitEmoji(dist, t) : getBirdEmoji(t);

        if (emoji !== a.lastEmoji) {
          (a.sprite.material as THREE.SpriteMaterial).map = getEmojiTexture(emoji);
          (a.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
          a.lastEmoji = emoji;
        }

        // 스프라이트 위치 = 동물 머리 바로 위
        const yOff = a.type === 'bird' ? 1.2 : 0.9;
        a.sprite.position.set(
          _worldPos.x,
          _worldPos.y + yOff + Math.sin(t * 2 + a.bobPhase) * 0.06,
          _worldPos.z,
        );

        a.sprite.visible = a.alpha > 0.01;
        (a.sprite.material as THREE.SpriteMaterial).opacity = a.alpha * 0.9;

        const s = a.state === 'appearing' ? 0.35 + a.alpha * 0.2 : 0.55;
        a.sprite.scale.set(s, s, 1);
      }
    },
  };
}
