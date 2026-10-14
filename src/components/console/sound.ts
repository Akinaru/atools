// Tiny UI sounds generated with Web Audio (no asset files).
let context: AudioContext | null = null;

const TONES = {
  move: { from: 880, to: 990, duration: 0.05, volume: 0.025 },
  select: { from: 660, to: 1320, duration: 0.12, volume: 0.04 },
  back: { from: 700, to: 420, duration: 0.1, volume: 0.035 },
  tab: { from: 520, to: 780, duration: 0.07, volume: 0.03 },
};

export function playSound(kind: keyof typeof TONES) {
  try {
    context ??= new AudioContext();
    const tone = TONES[kind];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.duration);
  } catch {
    // Audio unavailable (autoplay policy, old browser): stay silent.
  }
}

/** True when a key event comes from a text field, where arrows/letters must keep their normal meaning. */
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return !!target?.closest("input, textarea, select, [contenteditable=true]") || !!document.querySelector("dialog[open]");
}
