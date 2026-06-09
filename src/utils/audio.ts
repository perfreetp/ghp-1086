let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, enabled = true) {
  if (!enabled) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export const SFX = {
  click: (enabled = true) => playTone(800, 0.08, 'square', 0.15, enabled),
  countdown: (enabled = true) => playTone(600, 0.15, 'sine', 0.25, enabled),
  go: (enabled = true) => {
    playTone(880, 0.1, 'square', 0.2, enabled);
    setTimeout(() => playTone(1320, 0.3, 'square', 0.3, enabled), 100);
  },
  correct: (enabled = true) => {
    playTone(523, 0.1, 'sine', 0.3, enabled);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.3, enabled), 100);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.3, enabled), 200);
  },
  wrong: (enabled = true) => {
    playTone(200, 0.2, 'sawtooth', 0.2, enabled);
    setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.2, enabled), 100);
  },
  buzz: (enabled = true) => playTone(1000, 0.06, 'square', 0.35, enabled),
  miss: (enabled = true) => playTone(180, 0.1, 'triangle', 0.15, enabled),
  victory: (enabled = true) => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sine', 0.3, enabled), i * 150);
    });
  },
  draw: (enabled = true) => {
    playTone(400, 0.1, 'triangle', 0.2, enabled);
    setTimeout(() => playTone(600, 0.2, 'triangle', 0.2, enabled), 100);
  },
  pop: (enabled = true) => playTone(1200, 0.05, 'sine', 0.15, enabled),
};
