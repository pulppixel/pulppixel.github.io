// Procedural sound system (Web Audio API only, no external files)
// + Minigame sounds

export interface GameAudio {
  init(): void;
  footstep(surface: 'grass' | 'stone' | 'wood', sprint: boolean): void;
  jump(): void;
  land(impact: number): void;
  mgGem(count: number): void;
  splash(): void;
  zoneChime(colorHex: number): void;
  cubeTick(): void;
  mgEnter(): void;
  mgExit(): void;
  startAmbient(): void;
  update(dt: number): void;
  toggleMute(): boolean;
  // --- BGM ---
  setBGMMood(timeLabel: string): void;
  // --- Minigame sounds ---
  mgCoin(pitch?: number): void;
  mgHit(): void;
  mgHurt(): void;
  mgCombo(level: number): void;
  mgWaveClear(): void;
  mgShoot(): void;
  mgExplosion(): void;
  mgPickup(): void;
  mgFail(): void;
  mgTick(): void;
  mgDrift(): void;
  mgNearMiss(): void;
  mgLoot(): void;
  mgExtract(): void;
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

  // --- BGM system ---
  interface BGMPreset {
    notes: number[];    // MIDI note pool
    tempo: number;      // seconds between events
    noteLen: number;    // note duration
    vol: number;        // volume
    type: OscillatorType;
    restChance: number; // probability of silence
    chordChance: number;// probability of 2-note chord
    delayMix: number;   // echo amount (0-1)
  }

  const BGM_PRESETS: Record<string, BGMPreset> = {
    dawn:   { notes: [60,62,64,67,69,72,74], tempo: 2.2, noteLen: 1.8, vol: 0.018, type: 'sine',     restChance: 0.35, chordChance: 0.2, delayMix: 0.4 },
    day:    { notes: [67,69,71,74,76,79,81], tempo: 1.6, noteLen: 1.2, vol: 0.015, type: 'triangle', restChance: 0.25, chordChance: 0.3, delayMix: 0.3 },
    sunset: { notes: [65,67,69,72,74,77,72], tempo: 2.0, noteLen: 1.6, vol: 0.018, type: 'sine',     restChance: 0.30, chordChance: 0.25, delayMix: 0.5 },
    night:  { notes: [57,60,62,64,67,69,72], tempo: 3.0, noteLen: 2.4, vol: 0.014, type: 'sine',     restChance: 0.45, chordChance: 0.15, delayMix: 0.6 },
  };

  let bgmPreset: BGMPreset = BGM_PRESETS.day;
  let bgmTimer = 1.0;
  let bgmGain: GainNode | null = null;
  let bgmLastNote = -1;
  let bgmActive = false;

  function midiToHz(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }

  function bgmPlayNote(preset: BGMPreset): void {
    if (!ctx || !bgmGain) return;
    const now = ctx.currentTime;

    // Pick a note different from last
    let idx = Math.floor(Math.random() * preset.notes.length);
    if (idx === bgmLastNote && preset.notes.length > 1) idx = (idx + 1) % preset.notes.length;
    bgmLastNote = idx;

    const freq = midiToHz(preset.notes[idx]);
    const dur = preset.noteLen + (Math.random() - 0.5) * 0.4;
    const vol = preset.vol * (0.7 + Math.random() * 0.3);

    // Main note
    const osc = ctx.createOscillator();
    osc.type = preset.type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.08);
    g.gain.setValueAtTime(vol * 0.8, now + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(bgmGain);
    osc.start(now); osc.stop(now + dur + 0.01);

    // Delayed echo (fake reverb)
    if (preset.delayMix > 0) {
      const dOsc = ctx.createOscillator();
      dOsc.type = preset.type;
      dOsc.frequency.value = freq;
      const dG = ctx.createGain();
      const dT = now + 0.25 + Math.random() * 0.15;
      dG.gain.setValueAtTime(0, dT);
      dG.gain.linearRampToValueAtTime(vol * preset.delayMix * 0.5, dT + 0.06);
      dG.gain.exponentialRampToValueAtTime(0.0001, dT + dur * 0.7);
      dOsc.connect(dG).connect(bgmGain);
      dOsc.start(dT); dOsc.stop(dT + dur * 0.7 + 0.01);
    }

    // Chord (harmony note - perfect 5th or octave)
    if (Math.random() < preset.chordChance) {
      const intervals = [7, 12, 5]; // 5th, octave, 4th
      const interval = intervals[Math.floor(Math.random() * intervals.length)];
      const hFreq = midiToHz(preset.notes[idx] + interval);
      const hOsc = ctx.createOscillator();
      hOsc.type = 'sine';
      hOsc.frequency.value = hFreq;
      const hG = ctx.createGain();
      const hDelay = 0.05 + Math.random() * 0.1;
      hG.gain.setValueAtTime(0, now + hDelay);
      hG.gain.linearRampToValueAtTime(vol * 0.4, now + hDelay + 0.06);
      hG.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.6);
      hOsc.connect(hG).connect(bgmGain);
      hOsc.start(now + hDelay); hOsc.stop(now + dur * 0.6 + 0.01);
    }
  }

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
    osc.start(now); osc.stop(now + dur + 0.01);
    return osc;
  }

  // Schedule a tone at a future time (for chords/arpeggios)
  function toneAt(freq: number, dur: number, vol: number, delay: number, type: OscillatorType = 'sine'): void {
    if (!ensure()) return;
    const now = ctx!.currentTime + delay;
    const osc = ctx!.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(master);
    osc.start(now); osc.stop(now + dur + 0.01);
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
        case 'stone': noiseBurst(1800 + rnd * 1000, 3, 0.035, vol * 1.3, 'bandpass'); tone(180 + rnd * 60, 0.025, vol * 0.25, 'triangle'); break;
        case 'wood': noiseBurst(1000 + rnd * 600, 2, 0.045, vol * 1.1, 'bandpass'); tone(250 + rnd * 80, 0.035, vol * 0.3, 'square'); break;
      }
    },

    jump() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + 0.16);
      noiseBurst(2000, 0.8, 0.1, 0.04, 'highpass');
    },

    land(impact) {
      if (!ensure()) return;
      const vol = Math.min(0.25, 0.06 + impact * 0.03);
      tone(70 + impact * 12, 0.12, vol, 'sine', 0.002, 0.08);
      noiseBurst(350, 1.5, 0.07, vol * 0.5, 'lowpass');
    },

    mgGem(count: number) {
      if (!ensure()) return;
      const base = 660 + Math.min(count, 12) * 40;
      const penta = [1, 1.25, 1.5, 1.875, 2.0];
      for (let i = 0; i < 4; i++) {
        toneAt(base * penta[i % 5], 0.3, 0.07, i * 0.06, 'sine');
        toneAt(base * penta[i % 5] * 0.5, 0.35, 0.025, i * 0.06, 'triangle');
      }
      // shimmer tail
      toneAt(base * 2.5, 0.5, 0.03, 0.25, 'sine');
      noiseBurst(4000, 0.8, 0.08, 0.02, 'highpass');
    },

    splash() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const src = ctx!.createBufferSource(); src.buffer = noiseBuffer;
      const flt = ctx!.createBiquadFilter(); flt.type = 'lowpass';
      flt.frequency.setValueAtTime(3500, now); flt.frequency.exponentialRampToValueAtTime(180, now + 0.55);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      src.connect(flt).connect(g).connect(master); src.start(now); src.stop(now + 0.65);
      for (let i = 0; i < 3; i++) {
        const t = now + 0.08 + i * 0.1;
        const osc = ctx!.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(500 + Math.random() * 500, t); osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
        const bg = ctx!.createGain(); bg.gain.setValueAtTime(0.05, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(bg).connect(master); osc.start(t); osc.stop(t + 0.18);
      }
    },

    zoneChime(colorHex) {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const seed = (colorHex >> 4) % 5;
      const base = 380 + seed * 50;
      const penta = [1, 1.125, 1.25, 1.5, 1.667];
      for (let i = 0; i < 3; i++) {
        const freq = base * penta[(seed + i) % 5]; const t = now + i * 0.09;
        const osc = ctx!.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx!.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(g).connect(master); osc.start(t); osc.stop(t + 0.6);
      }
    },

    cubeTick() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      if (now - tickCd < 0.5) return; tickCd = now;
      tone(1100, 0.07, 0.05, 'sine', 0.002, 0.05);
      tone(1650, 0.05, 0.02, 'sine', 0.003, 0.04);
    },

    mgEnter() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now); osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + 0.5);
      noiseBurst(800, 1, 0.3, 0.05, 'lowpass');
    },

    mgExit() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(550, now + 0.3);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + 0.4);
    },

    startAmbient() {
      if (!ensure() || windNode) return;
      windNode = ctx!.createBufferSource(); windNode.buffer = noiseBuffer; windNode.loop = true;
      const flt = ctx!.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 350; flt.Q.value = 0.4;
      windGain = ctx!.createGain(); windGain.gain.value = 0.035;
      windNode.connect(flt).connect(windGain).connect(master); windNode.start();
      // Start BGM
      if (!bgmGain) {
        bgmGain = ctx!.createGain();
        bgmGain.gain.value = 1.0;
        bgmGain.connect(master);
      }
      bgmActive = true;
    },

    update(dt) {
      if (!ctx || !ready || muted) return;
      if (windGain) { const t = ctx.currentTime; windGain.gain.value = 0.03 + Math.sin(t * 0.25) * 0.012 + Math.sin(t * 0.7) * 0.005; }

      // BGM scheduling
      if (bgmActive) {
        bgmTimer -= dt;
        if (bgmTimer <= 0) {
          const jitter = (Math.random() - 0.5) * bgmPreset.tempo * 0.3;
          bgmTimer = bgmPreset.tempo + jitter;
          if (Math.random() > bgmPreset.restChance) {
            bgmPlayNote(bgmPreset);
          }
        }
      }

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
          const osc = ctx.createOscillator(); osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * (0.75 + Math.random() * 0.5), t + 0.06);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.012, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
          const p = ctx.createStereoPanner(); p.pan.value = pan + (Math.random() - 0.5) * 0.3;
          osc.connect(g).connect(p).connect(master); osc.start(t); osc.stop(t + 0.09);
        }
      }
    },

    toggleMute(): boolean {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      if (muted && windNode) { windNode.stop(); windNode = null; windGain = null; }
      if (muted) { bgmActive = false; }
      if (!muted) this.startAmbient();
      return muted;
    },

    setBGMMood(timeLabel: string) {
      const p = BGM_PRESETS[timeLabel];
      if (p) bgmPreset = p;
    },

    // =============================================
    // MINIGAME SOUNDS
    // =============================================

    /** 코인/아이템 획득. pitch로 콤보 시 음정 상승 가능 */
    mgCoin(pitch = 0) {
      if (!ensure()) return;
      const base = 880 + pitch * 80;
      tone(base, 0.1, 0.08, 'sine', 0.003, 0.08);
      toneAt(base * 1.5, 0.08, 0.05, 0.04, 'sine');
    },

    /** 적 타격 */
    mgHit() {
      if (!ensure()) return;
      noiseBurst(1200, 2, 0.04, 0.12, 'bandpass');
      tone(200, 0.06, 0.08, 'square', 0.002, 0.04);
    },

    /** 플레이어 피격 */
    mgHurt() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + 0.22);
      noiseBurst(500, 1.5, 0.08, 0.06, 'lowpass');
    },

    /** 콤보 사운드. level이 높을수록 화려하게 */
    mgCombo(level) {
      if (!ensure()) return;
      const base = 600 + Math.min(level, 8) * 60;
      const penta = [1, 1.25, 1.5, 1.875, 2.0];
      const count = Math.min(level, 4);
      for (let i = 0; i < count; i++) {
        toneAt(base * penta[i % penta.length], 0.12, 0.05, i * 0.04, 'sine');
      }
    },

    /** 웨이브/스테이지 클리어 */
    mgWaveClear() {
      if (!ensure()) return;
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((f, i) => {
        toneAt(f, 0.25, 0.07, i * 0.08, 'sine');
        toneAt(f * 0.5, 0.3, 0.03, i * 0.08, 'triangle');
      });
    },

    /** 투사체 발사 */
    mgShoot() {
      if (!ensure()) return;
      const now = ctx!.currentTime;
      const osc = ctx!.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
      const g = ctx!.createGain(); g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g).connect(master); osc.start(now); osc.stop(now + 0.1);
    },

    /** 폭발/스플래시 */
    mgExplosion() {
      if (!ensure()) return;
      noiseBurst(200, 0.8, 0.2, 0.15, 'lowpass');
      tone(80, 0.15, 0.1, 'sine', 0.002, 0.1);
      noiseBurst(800, 1.5, 0.1, 0.06, 'bandpass');
    },

    /** 아이템 픽업 (부스트, 쉴드 등) */
    mgPickup() {
      if (!ensure()) return;
      toneAt(800, 0.1, 0.07, 0, 'sine');
      toneAt(1200, 0.1, 0.06, 0.05, 'sine');
      toneAt(1600, 0.08, 0.04, 0.1, 'sine');
    },

    /** 실패/사망 */
    mgFail() {
      if (!ensure()) return;
      const notes = [400, 350, 280, 200];
      notes.forEach((f, i) => { toneAt(f, 0.2, 0.06, i * 0.12, 'triangle'); });
      noiseBurst(300, 1, 0.4, 0.04, 'lowpass');
    },

    /** UI 틱 (타이머, 카운트다운 등) */
    mgTick() {
      if (!ensure()) return;
      tone(1000, 0.03, 0.04, 'sine', 0.001, 0.02);
    },

    /** 드리프트 지속음 */
    mgDrift() {
      if (!ensure()) return;
      noiseBurst(400, 2, 0.06, 0.04, 'bandpass');
    },

    /** 니어미스 */
    mgNearMiss() {
      if (!ensure()) return;
      toneAt(1400, 0.06, 0.06, 0, 'sine');
      toneAt(1800, 0.04, 0.04, 0.03, 'sine');
    },

    /** 루팅 완료 */
    mgLoot() {
      if (!ensure()) return;
      const notes = [660, 880, 1100];
      notes.forEach((f, i) => { toneAt(f, 0.1, 0.06, i * 0.06, 'sine'); });
      noiseBurst(2000, 1, 0.05, 0.03, 'highpass');
    },

    /** 탈출 성공 */
    mgExtract() {
      if (!ensure()) return;
      const notes = [440, 554, 659, 880, 1047];
      notes.forEach((f, i) => {
        toneAt(f, 0.3, 0.06, i * 0.07, 'sine');
        toneAt(f * 0.5, 0.35, 0.025, i * 0.07, 'triangle');
      });
      noiseBurst(3000, 0.5, 0.15, 0.03, 'highpass');
    },
  };
}
