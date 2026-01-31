let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number,
  volume: number = 0.12,
) {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = frequency

  gain.gain.setValueAtTime(0, now + startOffset)
  gain.gain.linearRampToValueAtTime(volume, now + startOffset + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now + startOffset)
  osc.stop(now + startOffset + duration + 0.01)
}

/** Soft two-note ascending chime for task completion (~300ms) */
export function playCompleteSound(enabled: boolean): void {
  if (!enabled) return
  const ctx = getAudioContext()
  // C5 → E5, gentle sine chime
  playTone(ctx, 523.25, 0, 0.28, 0.1)
  playTone(ctx, 659.25, 0.08, 0.28, 0.1)
}

/** Three-note ascending chime for sprint completion (~500ms) */
export function playSprintCompleteSound(enabled: boolean): void {
  if (!enabled) return
  const ctx = getAudioContext()
  // C5 → E5 → G5, slightly richer
  playTone(ctx, 523.25, 0, 0.35, 0.1)
  playTone(ctx, 659.25, 0.12, 0.35, 0.1)
  playTone(ctx, 783.99, 0.24, 0.4, 0.12)
}
