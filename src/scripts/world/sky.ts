// Sky dome (gradient shader) + Minecraft-style block clouds
import * as THREE from 'three';

export function buildSkyDome(scene: THREE.Scene): Record<string, { value: any }> {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4090e0) },
      midColor: { value: new THREE.Color(0x70b8f0) },
      bottomColor: { value: new THREE.Color(0xc8e8fa) },
    },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor, midColor, bottomColor;
      varying float vY;
      void main() {
        float t = clamp(vY, 0.0, 1.0);
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t));
        col = mix(col, topColor, smoothstep(0.3, 1.0, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  sky.renderOrder = -1;
  scene.add(sky);
  return mat.uniforms;
}

export function buildClouds(scene: THREE.Scene): THREE.Group[] {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0, roughness: 1, transparent: true, opacity: 0.85,
  });
  const clouds: THREE.Group[] = [];

  const defs: [number, number, number, number][] = [
    [-25, 18, -15, 1.2], [20, 20, -35, 1.0], [-10, 22, -55, 0.9],
    [35, 19, -20, 1.1], [-35, 21, -45, 0.8], [15, 23, -60, 1.0],
    [40, 17, -50, 0.7], [-20, 24, -30, 1.3],
  ];

  // Block offsets for fluffy cloud shape
  const blocks: [number, number, number, number, number, number][] = [
    [3, 0.8, 2, 0, 0, 0],
    [2, 0.6, 1.5, -1.8, 0.1, 0.3],
    [2.2, 0.7, 1.8, 1.5, -0.05, -0.2],
    [1.5, 0.5, 1.2, 0.2, 0.4, 0.5],
  ];

  for (const [cx, cy, cz, s] of defs) {
    const g = new THREE.Group();
    for (const [bw, bh, bd, bx, by, bz] of blocks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      m.position.set(bx, by, bz);
      g.add(m);
    }
    g.position.set(cx, cy, cz);
    g.scale.setScalar(s);
    scene.add(g);
    clouds.push(g);
  }

  return clouds;
}
