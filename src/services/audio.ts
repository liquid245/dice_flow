import { config } from '../config';

type SampleName = keyof typeof config.assets.sounds;

export type SoundName = SampleName | 'select' | 'thump';

let ctx: AudioContext | null = null;
const buffers = new Map<SampleName, AudioBuffer>();
const activeSources = new Set<AudioBufferSourceNode>();
let preloadStarted = false;
let unlocked = false;

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function ensureRunning(): Promise<void> {
  const c = context();
  if (c.state === 'running') return;
  await Promise.race([
    c.resume().catch(() => {}),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    }),
  ]);
}

async function loadSample(name: SampleName): Promise<AudioBuffer | null> {
  const existing = buffers.get(name);
  if (existing) return existing;
  try {
    const response = await fetch(config.assets.sounds[name]);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context().decodeAudioData(arrayBuffer);
    if (audioBuffer) buffers.set(name, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

export function preloadSounds(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  for (const name of Object.keys(config.assets.sounds) as SampleName[]) {
    void loadSample(name);
  }
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const unlock = () => {
    const c = context();
    if (c.state === 'running') return;
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    c.resume().catch(() => {});
  };
  const opts: AddEventListenerOptions = { passive: true };
  const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'] as const;
  for (const event of events) window.addEventListener(event, unlock, opts);
}

function playBuffer(buffer: AudioBuffer): void {
  void (async () => {
    await ensureRunning();
    const c = context();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start();
    activeSources.add(source);
    source.onended = () => activeSources.delete(source);
  })();
}

function synthClick(): void {
  void (async () => {
    await ensureRunning();
    const c = context();
    const length = Math.max(1, Math.floor(c.sampleRate * 0.006));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = 0.5;
    source.connect(gain).connect(c.destination);
    source.start();
    activeSources.add(source);
    source.onended = () => activeSources.delete(source);
  })();
}

function synthThump(): void {
  const t = config.vibration.thump;
  if (!t.enabled) return;
  void (async () => {
    await ensureRunning();
    const c = context();
    const now = c.currentTime;
    const duration = t.duration / 1000;

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.frequencyEnd), now + duration);

    const gain = c.createGain();
    gain.gain.setValueAtTime(t.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);

    if (t.click) {
      const length = Math.floor(c.sampleRate * 0.004);
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = c.createBufferSource();
      source.buffer = buffer;
      const clickGain = c.createGain();
      clickGain.gain.value = t.gain * 0.6;
      source.connect(clickGain).connect(c.destination);
      source.start(now);
    }
  })();
}

export function play(name: SoundName): void {
  if (name === 'thump') {
    synthThump();
    return;
  }
  if (name === 'select') {
    synthClick();
    return;
  }
  const buffer = buffers.get(name);
  if (!buffer) {
    void loadSample(name).then((b) => {
      if (b) play(name);
    });
    return;
  }
  playBuffer(buffer);
}
