type MusicMood = 'normal' | 'boss';

const NOTE_FREQ: Record<string, number> = {
  G1: 49.0,
  A1: 55.0,
  Bb1: 58.27,
  D2: 73.42,
  Eb2: 77.78,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  D3: 146.83,
  F3: 174.61,
  Gb3: 185.0,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  Cs4: 277.18,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  Gb4: 369.99,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
};

interface BarData {
  bass: string;
  chord: string[];
  arp: string[];
}

const NORMAL_BARS: BarData[] = [
  { bass: 'D2', chord: ['F3', 'A3', 'C4', 'E4'], arp: ['A4', 'C5', 'F4', 'E4'] },
  { bass: 'G1', chord: ['Bb3', 'D4', 'F4', 'A4'], arp: ['D4', 'F4', 'Bb4', 'A4'] },
  { bass: 'Bb1', chord: ['D4', 'F4', 'A4', 'C5'], arp: ['F4', 'A4', 'C5', 'D5'] },
  { bass: 'A1', chord: ['G3', 'Cs4', 'E4', 'A4'], arp: ['E4', 'G4', 'Cs4', 'A4'] },
];

const BOSS_BARS: BarData[] = [
  { bass: 'D2', chord: ['F3', 'A3', 'Cs4', 'E4'], arp: ['A4', 'Cs4', 'F4', 'E4'] },
  { bass: 'Eb2', chord: ['Gb3', 'A3', 'C4', 'Eb2'], arp: ['Gb4', 'C4', 'A3', 'Gb4'] },
  { bass: 'Bb1', chord: ['D3', 'G3', 'E4', 'Bb3'], arp: ['G4', 'E4', 'Bb3', 'D4'] },
  { bass: 'A1', chord: ['Cs4', 'G4', 'Bb4', 'E4'], arp: ['Bb4', 'G4', 'Cs4', 'E4'] },
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  public musicEnabled = true;

  private musicMood: MusicMood = 'normal';
  private musicMasterGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private stepCount = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureMusicBus(ctx: AudioContext) {
    if (!this.musicMasterGain || !this.musicFilter) {
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = this.musicMood === 'boss' ? 680 : 1050;
      this.musicFilter.Q.value = this.musicMood === 'boss' ? 2.4 : 0.8;

      this.musicMasterGain = ctx.createGain();
      this.musicMasterGain.gain.value = this.muted || !this.musicEnabled ? 0 : 0.14;

      this.musicFilter.connect(this.musicMasterGain);
      this.musicMasterGain.connect(ctx.destination);
    }
  }

  public unlockAndStartMusic() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.ensureMusicBus(ctx);
    this.syncMusicGain();

    if (this.schedulerTimer === null) {
      this.nextStepTime = ctx.currentTime + 0.08;
      this.schedulerTimer = window.setInterval(() => this.scheduleMusicSteps(), 90);
    }
  }

  public setMusicMood(mood: MusicMood) {
    if (this.musicMood === mood) return;
    this.musicMood = mood;
    if (this.ctx && this.musicFilter) {
      const targetFreq = mood === 'boss' ? 680 : 1100;
      const targetQ = mood === 'boss' ? 2.6 : 0.8;
      this.musicFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.35);
      this.musicFilter.Q.setTargetAtTime(targetQ, this.ctx.currentTime, 0.35);
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.unlockAndStartMusic();
    }
    this.syncMusicGain();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.syncMusicGain();
  }

  private syncMusicGain() {
    if (!this.ctx || !this.musicMasterGain) return;
    const target = this.muted || !this.musicEnabled ? 0 : 0.14;
    this.musicMasterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  public disposeMusic() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleMusicSteps() {
    if (!this.ctx || !this.musicFilter || !this.musicEnabled || this.muted) {
      if (this.ctx) {
        this.nextStepTime = Math.max(this.nextStepTime, this.ctx.currentTime + 0.05);
      }
      return;
    }

    const ctx = this.ctx;
    if (ctx.state === 'suspended') return;

    // 8th-note grid in 3/4 waltz (6 eighth-notes per bar)
    const stepDuration = this.musicMood === 'boss' ? 0.24 : 0.275;
    while (this.nextStepTime < ctx.currentTime + 0.28) {
      this.triggerMusicStep(this.stepCount, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.stepCount += 1;
    }
  }

  private triggerMusicStep(step: number, time: number, stepDur: number) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    const isBoss = this.musicMood === 'boss';
    const bars = isBoss ? BOSS_BARS : NORMAL_BARS;
    const stepInBar = step % 6; // 0..5 (3/4 in eighth notes)
    const barIndex = Math.floor(step / 6) % bars.length;
    const bar = bars[barIndex];

    // Beat 1 (step 0): Bass + Warm Pad Chord
    if (stepInBar === 0) {
      const bassFreq = NOTE_FREQ[bar.bass] || 73.42;
      this.playTone(bassFreq, time, stepDur * 4.5, isBoss ? 'sawtooth' : 'triangle', isBoss ? 0.22 : 0.26);

      // Chord pad
      bar.chord.forEach((n) => {
        const freq = NOTE_FREQ[n];
        if (freq) {
          this.playTone(
            freq,
            time,
            stepDur * 5.4,
            isBoss ? 'sawtooth' : 'sine',
            isBoss ? 0.055 : 0.075,
            0.05
          );
        }
      });
    }

    // Extra bass pulse in boss mode on beat 2.5 (step 3)
    if (isBoss && stepInBar === 3) {
      const bassFreq = NOTE_FREQ[bar.bass] || 73.42;
      this.playTone(bassFreq * 1.5, time, stepDur * 1.8, 'triangle', 0.14, 0.01);
    }

    // Waltz arpeggio / bell notes on off-beats
    if (stepInBar === 2 || stepInBar === 4 || (isBoss && stepInBar === 5)) {
      const arpNote = bar.arp[(stepInBar + barIndex) % bar.arp.length];
      const freq = NOTE_FREQ[arpNote];
      if (freq) {
        this.playTone(
          freq,
          time,
          stepDur * (isBoss ? 1.2 : 1.9),
          isBoss ? 'triangle' : 'sine',
          isBoss ? 0.09 : 0.08,
          0.015
        );
      }
    }
  }

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    attack = 0.02
  ) {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private ensureSfxContext(): AudioContext | null {
    if (this.muted) return null;
    return this.ensureContext();
  }

  public playSelect(pitchOffset = 0) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420 + pitchOffset * 38, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.085);
  }

  public playDeselect() {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(210, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.075);
  }

  private static readonly COMBO_SCALE = [
    261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
  ];

  private getComboFreq(comboIndex: number): number {
    const clamped = Math.max(0, Math.min(comboIndex, SoundEngine.COMBO_SCALE.length - 1));
    return SoundEngine.COMBO_SCALE[clamped];
  }

  public playChipTick(stepIndex = 0) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = Math.min(1300, 480 + stepIndex * 55);
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.095);
  }

  public playJokerChips(comboIndex = 0) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const root = this.getComboFreq(comboIndex + 2);

    [root, root * 2].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(i === 0 ? 0.11 : 0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    });
  }

  public playJokerAddMult(comboIndex = 0) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const root = this.getComboFreq(comboIndex);

    // Tactile punch thump
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(210, now);
    kick.frequency.exponentialRampToValueAtTime(78, now + 0.055);
    kickGain.gain.setValueAtTime(0.14, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    kick.connect(kickGain);
    kickGain.connect(ctx.destination);
    kick.start(now);
    kick.stop(now + 0.07);

    // Rising fifth harmonic chime
    [root, root * 1.498].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(i === 0 ? 0.12 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  public playJokerXMult(comboIndex = 0, multiplier = 2) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const root = this.getComboFreq(comboIndex);
    const intensity = Math.min(1.4, 0.9 + multiplier * 0.12);

    // Sub-bass impact slam
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(46, now + 0.14);
    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.16);

    // Filtered power chord burst
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.22);
    filter.connect(ctx.destination);

    [root, root * 1.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.18);
      gain.gain.setValueAtTime((i === 0 ? 0.085 : 0.055) * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + 0.23);
    });

    // High octave sparkle ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(root * 2, now + 0.025);
    pingGain.gain.setValueAtTime(0.09, now + 0.025);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(now + 0.025);
    ping.stop(now + 0.25);
  }

  public playComboWin(comboCount = 1) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chordNotes =
      comboCount >= 3
        ? [523.25, 659.25, 783.99, 987.77, 1174.66]
        : comboCount === 2
        ? [523.25, 659.25, 783.99, 1046.5]
        : [523.25, 659.25, 783.99];

    chordNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === chordNotes.length - 1 ? 'sine' : 'triangle';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.095, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.29);
    });
  }

  public playMultSlam(stepIndex = 0) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const freq = Math.min(920, 260 + stepIndex * 45);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.145);
  }

  public playCoin() {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.08, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.16);
    });
  }

  public playClearFanfare() {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.09, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.26);
    });
  }
}

export const sound = new SoundEngine();
