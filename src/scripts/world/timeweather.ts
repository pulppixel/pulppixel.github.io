// Time-of-day + weather: real-time clock auto mode + manual override + rain/snow particles
import * as THREE from 'three';

export type TimeName = 'auto' | 'dawn' | 'day' | 'sunset' | 'night';
export type WeatherName = 'clear' | 'rain' | 'snow';

export interface EnvironmentRefs {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  skyUniforms: Record<string, { value: any }>;
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  starMaterial: THREE.PointsMaterial;
  water: THREE.Mesh;
}

export interface TimeWeather {
  update(dt: number): void;
  setTime(name: TimeName): void;
  setWeather(name: WeatherName): void;
  getTime(): TimeName;
  getWeather(): WeatherName;
  getTimeLabel(): string;
}

// --- Preset type ---

type C3 = [number, number, number];

interface P {
  skyTop: C3; skyMid: C3; skyBot: C3; bg: C3;
  sunCol: C3; sunI: number; sunPos: C3;
  ambCol: C3; ambI: number;
  hemiSky: C3; hemiGnd: C3; hemiI: number;
  fillCol: C3; fillI: number;
  fogCol: C3; fogD: number;
  starOp: number; exposure: number;
  waterDeep: C3; waterShallow: C3;
}

// --- Presets ---

const DAWN: P = {
  skyTop: [0.18, 0.10, 0.28], skyMid: [0.85, 0.55, 0.35], skyBot: [0.95, 0.78, 0.55], bg: [0.92, 0.72, 0.50],
  sunCol: [1.0, 0.75, 0.45], sunI: 1.0, sunPos: [20, 6, 10],
  ambCol: [0.45, 0.35, 0.50], ambI: 0.6, hemiSky: [0.60, 0.45, 0.55], hemiGnd: [0.30, 0.25, 0.15], hemiI: 0.4,
  fillCol: [0.50, 0.35, 0.55], fillI: 0.3, fogCol: [0.55, 0.40, 0.45], fogD: 0.012,
  starOp: 0.05, exposure: 1.2, waterDeep: [0.12, 0.35, 0.40], waterShallow: [0.45, 0.55, 0.50],
};
const DAY: P = {
  skyTop: [0.25, 0.56, 0.88], skyMid: [0.44, 0.72, 0.94], skyBot: [0.78, 0.91, 0.98], bg: [0.78, 0.91, 0.98],
  sunCol: [1.0, 0.96, 0.88], sunI: 1.8, sunPos: [15, 25, 10],
  ambCol: [0.53, 0.60, 0.73], ambI: 1.2, hemiSky: [0.53, 0.73, 1.0], hemiGnd: [0.27, 0.40, 0.20], hemiI: 0.7,
  fillCol: [0.60, 0.67, 0.80], fillI: 0.4, fogCol: [0.72, 0.85, 0.94], fogD: 0.008,
  starOp: 0.0, exposure: 1.4, waterDeep: [0.10, 0.47, 0.53], waterShallow: [0.35, 0.85, 0.91],
};
const SUNSET: P = {
  skyTop: [0.10, 0.06, 0.25], skyMid: [0.75, 0.30, 0.18], skyBot: [0.95, 0.62, 0.30], bg: [0.90, 0.55, 0.28],
  sunCol: [1.0, 0.50, 0.20], sunI: 1.3, sunPos: [-15, 5, -8],
  ambCol: [0.50, 0.30, 0.28], ambI: 0.7, hemiSky: [0.65, 0.35, 0.30], hemiGnd: [0.20, 0.15, 0.10], hemiI: 0.4,
  fillCol: [0.60, 0.30, 0.25], fillI: 0.25, fogCol: [0.50, 0.30, 0.25], fogD: 0.011,
  starOp: 0.08, exposure: 1.3, waterDeep: [0.15, 0.20, 0.35], waterShallow: [0.55, 0.40, 0.35],
};
const NIGHT: P = {
  skyTop: [0.04, 0.04, 0.12], skyMid: [0.08, 0.08, 0.18], skyBot: [0.12, 0.12, 0.24], bg: [0.08, 0.08, 0.15],
  sunCol: [0.45, 0.50, 0.70], sunI: 0.5, sunPos: [-10, 20, -15],
  ambCol: [0.18, 0.20, 0.35], ambI: 0.55, hemiSky: [0.15, 0.18, 0.35], hemiGnd: [0.08, 0.08, 0.12], hemiI: 0.35,
  fillCol: [0.20, 0.22, 0.38], fillI: 0.25, fogCol: [0.10, 0.10, 0.18], fogD: 0.012,
  starOp: 0.6, exposure: 1.0, waterDeep: [0.06, 0.10, 0.22], waterShallow: [0.14, 0.24, 0.35],
};

const PRESET_MAP: Record<string, P> = { dawn: DAWN, day: DAY, sunset: SUNSET, night: NIGHT };

// --- Interpolation ---

function lC3(a: C3, b: C3, t: number): C3 { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function lN(a: number, b: number, t: number): number { return a + (b - a) * t; }
function smoothstep(t: number): number { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

function blendP(a: P, b: P, t: number): P {
  return {
    skyTop: lC3(a.skyTop, b.skyTop, t), skyMid: lC3(a.skyMid, b.skyMid, t),
    skyBot: lC3(a.skyBot, b.skyBot, t), bg: lC3(a.bg, b.bg, t),
    sunCol: lC3(a.sunCol, b.sunCol, t), sunI: lN(a.sunI, b.sunI, t), sunPos: lC3(a.sunPos, b.sunPos, t) as C3,
    ambCol: lC3(a.ambCol, b.ambCol, t), ambI: lN(a.ambI, b.ambI, t),
    hemiSky: lC3(a.hemiSky, b.hemiSky, t), hemiGnd: lC3(a.hemiGnd, b.hemiGnd, t), hemiI: lN(a.hemiI, b.hemiI, t),
    fillCol: lC3(a.fillCol, b.fillCol, t), fillI: lN(a.fillI, b.fillI, t),
    fogCol: lC3(a.fogCol, b.fogCol, t), fogD: lN(a.fogD, b.fogD, t),
    starOp: lN(a.starOp, b.starOp, t), exposure: lN(a.exposure, b.exposure, t),
    waterDeep: lC3(a.waterDeep, b.waterDeep, t), waterShallow: lC3(a.waterShallow, b.waterShallow, t),
  };
}

function getAutoBlend(hour: number): { a: P; b: P; t: number } {
  if (hour < 4)  return { a: NIGHT, b: NIGHT, t: 0 };
  if (hour < 6)  return { a: NIGHT, b: DAWN, t: smoothstep((hour - 4) / 2) };
  if (hour < 8)  return { a: DAWN, b: DAY, t: smoothstep((hour - 6) / 2) };
  if (hour < 16) return { a: DAY, b: DAY, t: 0 };
  if (hour < 18) return { a: DAY, b: SUNSET, t: smoothstep((hour - 16) / 2) };
  if (hour < 20) return { a: SUNSET, b: NIGHT, t: smoothstep((hour - 18) / 2) };
  return { a: NIGHT, b: NIGHT, t: 0 };
}

function getAutoTimeLabel(hour: number): string {
  if (hour >= 4 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 16) return 'day';
  if (hour >= 16 && hour < 20) return 'sunset';
  return 'night';
}

// --- Weather modifier ---

function applyWeather(p: P, weather: WeatherName): P {
  if (weather === 'clear') return p;
  const out = { ...p };
  if (weather === 'rain') {
    out.skyTop = lC3(p.skyTop, [0.06,0.06,0.08], 0.5);
    out.skyMid = lC3(p.skyMid, [0.15,0.15,0.18], 0.45);
    out.skyBot = lC3(p.skyBot, [0.22,0.22,0.25], 0.4);
    out.bg = lC3(p.bg, [0.18,0.18,0.20], 0.4);
    out.sunI = p.sunI * 0.25; out.ambI = p.ambI * 0.65; out.hemiI = p.hemiI * 0.5; out.fillI = p.fillI * 0.4;
    out.fogCol = lC3(p.fogCol, [0.15,0.15,0.18], 0.5); out.fogD = p.fogD * 1.8;
    out.exposure = p.exposure * 0.75;
    out.waterDeep = lC3(p.waterDeep, [0.05,0.08,0.12], 0.4);
    out.waterShallow = lC3(p.waterShallow, [0.12,0.18,0.22], 0.4);
  } else {
    out.skyTop = lC3(p.skyTop, [0.35,0.38,0.42], 0.35);
    out.skyMid = lC3(p.skyMid, [0.50,0.52,0.55], 0.3);
    out.skyBot = lC3(p.skyBot, [0.65,0.68,0.72], 0.3);
    out.bg = lC3(p.bg, [0.55,0.58,0.62], 0.3);
    out.sunI = p.sunI * 0.55;
    out.ambCol = lC3(p.ambCol, [0.55,0.58,0.65], 0.35); out.ambI = p.ambI * 0.85; out.hemiI = p.hemiI * 0.7;
    out.fogCol = lC3(p.fogCol, [0.55,0.58,0.62], 0.45); out.fogD = p.fogD * 1.4;
    out.exposure = p.exposure * 0.9;
  }
  return out;
}

function setC(c: THREE.Color, v: C3): void { c.setRGB(v[0], v[1], v[2]); }

// --- Rain/Snow particle systems ---

function createRainSystem(scene: THREE.Scene, count: number) {
  const SPREAD = 80, HEIGHT = 30;
  const pos = new Float32Array(count * 6);
  const vel = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = (Math.random()-0.5)*SPREAD, y = Math.random()*HEIGHT, z = -29+(Math.random()-0.5)*SPREAD;
    const len = 0.3 + Math.random()*0.4;
    pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z;
    pos[i*6+3]=x-0.05; pos[i*6+4]=y-len; pos[i*6+5]=z;
    vel[i] = 18 + Math.random()*10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const group = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.35, depthWrite: false }));
  group.visible = false; group.frustumCulled = false; scene.add(group);
  return {
    group, pos, vel,
    update(dt: number) {
      for (let i = 0; i < count; i++) {
        const drop = vel[i]*dt; pos[i*6+1]-=drop; pos[i*6+4]-=drop;
        if (pos[i*6+4] < -2) {
          const x=(Math.random()-0.5)*SPREAD, z=-29+(Math.random()-0.5)*SPREAD, y=HEIGHT+Math.random()*5, len=0.3+Math.random()*0.4;
          pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z; pos[i*6+3]=x-0.05; pos[i*6+4]=y-len; pos[i*6+5]=z;
          vel[i]=18+Math.random()*10;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function createSnowSystem(scene: THREE.Scene, count: number) {
  const SPREAD = 80, HEIGHT = 25;
  const pos = new Float32Array(count*3);
  const drift = new Float32Array(count*2);
  for (let i = 0; i < count; i++) {
    pos[i*3]=(Math.random()-0.5)*SPREAD; pos[i*3+1]=Math.random()*HEIGHT; pos[i*3+2]=-29+(Math.random()-0.5)*SPREAD;
    drift[i*2]=(Math.random()-0.5)*2; drift[i*2+1]=(Math.random()-0.5)*2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const group = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeef0f8, size: 0.12, transparent: true, opacity: 0.7, sizeAttenuation: true, depthWrite: false }));
  group.visible = false; group.frustumCulled = false; scene.add(group);
  return {
    group, pos, drift,
    update(dt: number, t: number) {
      for (let i = 0; i < count; i++) {
        pos[i*3]+=(drift[i*2]+Math.sin(t*0.8+i)*0.8)*dt;
        pos[i*3+1]-=(1.5+Math.sin(i*0.3)*0.5)*dt;
        pos[i*3+2]+=(drift[i*2+1]+Math.cos(t*0.6+i*0.5)*0.5)*dt;
        if (pos[i*3+1] < -1) { pos[i*3]=(Math.random()-0.5)*SPREAD; pos[i*3+1]=HEIGHT+Math.random()*3; pos[i*3+2]=-29+(Math.random()-0.5)*SPREAD; }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// --- Factory ---

export function createTimeWeather(refs: EnvironmentRefs, isMobile: boolean): TimeWeather {
  let timeMode: TimeName = 'auto';
  let weather: WeatherName = 'clear';
  let transitionSpeed = 0;
  let elapsed = 0;

  const rain = createRainSystem(refs.scene, isMobile ? 150 : 350);
  const snow = createSnowSystem(refs.scene, isMobile ? 100 : 250);
  let lightningTimer = 10 + Math.random() * 15;
  let lightningFlash = 0;

  // Init from current time
  const initHour = new Date().getHours() + new Date().getMinutes() / 60;
  const initBlend = getAutoBlend(initHour);
  let currentP = applyWeather(blendP(initBlend.a, initBlend.b, initBlend.t), weather);
  let targetP = currentP;
  applyPreset(currentP);

  function computeTarget(): P {
    let base: P;
    if (timeMode === 'auto') {
      const hour = new Date().getHours() + new Date().getMinutes() / 60;
      const blend = getAutoBlend(hour);
      base = blendP(blend.a, blend.b, blend.t);
    } else {
      base = PRESET_MAP[timeMode];
    }
    return applyWeather(base, weather);
  }

  function applyPreset(p: P): void {
    setC(refs.skyUniforms.topColor.value, p.skyTop);
    setC(refs.skyUniforms.midColor.value, p.skyMid);
    setC(refs.skyUniforms.bottomColor.value, p.skyBot);
    if (refs.scene.background instanceof THREE.Color) setC(refs.scene.background, p.bg);
    setC(refs.sunLight.color, p.sunCol); refs.sunLight.intensity = p.sunI;
    refs.sunLight.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    setC(refs.ambientLight.color, p.ambCol); refs.ambientLight.intensity = p.ambI;
    setC(refs.hemiLight.color, p.hemiSky); setC(refs.hemiLight.groundColor, p.hemiGnd); refs.hemiLight.intensity = p.hemiI;
    setC(refs.fillLight.color, p.fillCol); refs.fillLight.intensity = p.fillI;
    const fog = refs.scene.fog as THREE.FogExp2;
    if (fog) { setC(fog.color, p.fogCol); fog.density = p.fogD; }
    refs.starMaterial.opacity = p.starOp;
    refs.renderer.toneMappingExposure = p.exposure;
    const wMat = refs.water.material as THREE.ShaderMaterial;
    if (wMat.uniforms) { setC(wMat.uniforms.uDeep.value, p.waterDeep); setC(wMat.uniforms.uShallow.value, p.waterShallow); }
  }

  return {
    update(dt) {
      elapsed += dt;
      if (timeMode === 'auto') targetP = computeTarget();
      currentP = blendP(currentP, targetP, Math.min(1, (transitionSpeed > 0 ? transitionSpeed : 3.0) * dt));
      applyPreset(currentP);

      rain.group.visible = weather === 'rain';
      snow.group.visible = weather === 'snow';

      if (weather === 'rain') {
        rain.update(dt);
        lightningTimer -= dt;
        if (lightningTimer <= 0) { lightningTimer = 8 + Math.random() * 18; if (Math.random() < 0.6) lightningFlash = 0.15; }
        if (lightningFlash > 0) {
          lightningFlash -= dt;
          const flash = lightningFlash / 0.15;
          refs.ambientLight.intensity = currentP.ambI + flash * 2.5;
          refs.scene.background = new THREE.Color().setRGB(currentP.bg[0]+flash*0.4, currentP.bg[1]+flash*0.4, currentP.bg[2]+flash*0.45);
        }
        (rain.group.material as THREE.LineBasicMaterial).opacity = 0.3 + Math.sin(elapsed * 0.5) * 0.08;
      }
      if (weather === 'snow') snow.update(dt, elapsed);
    },
    setTime(name) {
      timeMode = name;
      targetP = name !== 'auto' ? applyWeather(PRESET_MAP[name], weather) : computeTarget();
      transitionSpeed = 2.0;
    },
    setWeather(name) {
      weather = name; targetP = computeTarget(); transitionSpeed = 2.5;
      rain.group.visible = name === 'rain'; snow.group.visible = name === 'snow';
    },
    getTime() { return timeMode; },
    getWeather() { return weather; },
    getTimeLabel(): string {
      if (timeMode !== 'auto') return timeMode;
      return getAutoTimeLabel(new Date().getHours() + new Date().getMinutes() / 60);
    },
  };
}
