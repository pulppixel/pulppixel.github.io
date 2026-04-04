// Procedural sound system (Web Audio API only, no external files)

export interface GameAudio {
  init(): void;
  footstep(surface: 'grass' | 'stone' | 'wood', sprint: boolean): void;
  jump(): void;
  land(impact: number): void;
  splash(): void;
  zoneChime(colorHex: number): void;
  cubeTick(): void;
  mgEnter(): void;
  mgExit(): void;
  startAmbient(): void;
  update(dt: number): void;
  toggleMute(): boolean;
}

export function createAudio(): GameAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let noiseBuffer: AudioBuffer;
  let muted = false;
  let ready = false;

  let windNode: AudioBufferSourceNode | null = null;
  let windGain: GainNode | null = null;
  let birdTimer = 2 + Math.random() * 5;
  let footCd = 0;
  let tickCd = 0;

  function ensure(): boolean {
    if (muted) return false;
    if (!ctx) {
      try {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);

        const len = ctx.sampleRate * 2;
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        ready = true;
      } catch { return false; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ready;
  }

  // --- Synthesis helpers ---

  function noiseBurst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass'): void {
    if (!ensure()) return;
    const now = ctx!.currentTime;
    const src = ctx!.createBufferSource();
    src.buffer = noiseBuffer;
    const offset = Math.random() * (noiseBuffer.duration - dur - 0.1);

    const flt = ctx!.createBiquadFilter();
    flt.type = type; flt.frequency.value = freq; flt.Q.value = q;

    const g = ctx!.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(flt).connect(g).connect(master);
    src.start(now, offset, dur + 0.05);
  }

  function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', attack = 0.005, decay?: number): OscillatorNode | null {
    if (!ensure()) return null;
    const now = ctx!.currentTime;
    const osc = ctx!.createOscillator();
    osc.type = type; osc.frequency.value = freq;

    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.001, now + (decay || dur));

    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    return osc;
  }

  return {
    init() { ensure(); },

    footstep(surface, sprint) {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      if (now - footCd < (sprint ? 0.22 : 0.38)) return;
      footCd = now;
      const vol = sprint ? 0.12 : 0.06;
      const rnd = Math.random();

      switch (surface) {
        case 'grass': noiseBurst(600 + rnd * 500, 1.2, 0.055, vol, 'lowpass'); break;
        case 'stone':
          noiseBurst(1800 + rnd * 1000, 3, 0.035, vol * 1.3, 'bandpass');
          tone(180 + rnd * 60, 0.025, vol * 0.25, 'triangle');
          break;
        case 'wood':
          noiseBurst(1000 + rnd * 600, 2, 0.045, vol * 1.1, 'bandpass');
          tone(250 + rnd * 80, 0.035, vol * 0.3, 'square');
          break;
      }
    },

    jump() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g).connect(master);
      osc.start(now); osc.stop(now + 0.16);
      noiseBurst(2000, 0.8, 0.1, 0.04, 'highpass');
    },

    land(impact) {
      if (!ensure()) return;
      const vol = Math.min(0.25, 0.06 + impact * 0.03);
      tone(70 + impact * 12, 0.12, vol, 'sine', 0.002, 0.08);
      noiseBurst(350, 1.5, 0.07, vol * 0.5, 'lowpass');
    },

    splash() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const src = ctx!.createBufferSource();
      src.buffer = noiseBuffer;
      const flt = ctx!.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(3500, now);
      flt.frequency.exponentialRampToValueAtTime(180, now + 0.55);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      src.connect(flt).connect(g).connect(master);
      src.start(now); src.stop(now + 0.65);

      for (let i = 0; i < 3; i++) {
        const t = now + 0.08 + i * 0.1;
        const osc = ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500 + Math.random() * 500, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
        const bg = ctx!.createGain();
        bg.gain.setValueAtTime(0.05, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(bg).connect(master);
        osc.start(t); osc.stop(t + 0.18);
      }
    },

    zoneChime(colorHex) {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const seed = (colorHex >> 4) % 5;
      const base = 380 + seed * 50;
      const penta = [1, 1.125, 1.25, 1.5, 1.667];

      for (let i = 0; i < 3; i++) {
        const freq = base * penta[(seed + i) % 5];
        const t = now + i * 0.09;
        const osc = ctx!.createOscillator();
        osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx!.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(g).connect(master);
        osc.start(t); osc.stop(t + 0.6);
      }
    },

    cubeTick() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      if (now - tickCd < 0.5) return;
      tickCd = now;
      tone(1100, 0.07, 0.05, 'sine', 0.002, 0.05);
      tone(1650, 0.05, 0.02, 'sine', 0.003, 0.04);
    },

    mgEnter() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g).connect(master);
      osc.start(now); osc.stop(now + 0.5);
      noiseBurst(800, 1, 0.3, 0.05, 'lowpass');
    },

    mgExit() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.3);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(g).connect(master);
      osc.start(now); osc.stop(now + 0.4);
    },

    startAmbient() {
      if (!ensure() || windNode) return;
      windNode = ctx!.createBufferSource();
      windNode.buffer = noiseBuffer;
      windNode.loop = true;
      const flt = ctx!.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 350; flt.Q.value = 0.4;
      windGain = ctx!.createGain();
      windGain.gain.value = 0.035;
      windNode.connect(flt).connect(windGain).connect(master);
      windNode.start();
    },

    update(dt) {
      if (!ctx || !ready || muted) return;

      // Wind volume modulation
      if (windGain) {
        const t = ctx.currentTime;
        windGain.gain.value = 0.03 + Math.sin(t * 0.25) * 0.012 + Math.sin(t * 0.7) * 0.005;
      }

      // Procedural bird calls
      birdTimer -= dt;
      if (birdTimer <= 0) {
        birdTimer = 3.5 + Math.random() * 9;
        const now = ctx.currentTime;
        const noteCount = 2 + Math.floor(Math.random() * 3);
        const baseFreq = 2200 + Math.random() * 1800;
        const pan = (Math.random() - 0.5) * 1.6;

        for (let i = 0; i < noteCount; i++) {
          const t = now + i * (0.06 + Math.random() * 0.04);
          const f = baseFreq * (0.9 + Math.random() * 0.2);
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * (0.75 + Math.random() * 0.5), t + 0.06);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.012, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
          const p = ctx.createStereoPanner();
          p.pan.value = pan + (Math.random() - 0.5) * 0.3;
          osc.connect(g).connect(p).connect(master);
          osc.start(t); osc.stop(t + 0.09);
        }
      }
    },

    toggleMute(): boolean {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      if (muted && windNode) { windNode.stop(); windNode = null; windGain = null; }
      if (!muted) this.startAmbient();
      return muted;
    },
  };
}
