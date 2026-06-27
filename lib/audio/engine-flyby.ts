/**
 * Moteur F1 entièrement synthétisé (Web Audio API) — fly-by stéréo gauche→droite
 * porté du prototype `docs/design/boxbox-splash.html` : régime moteur (saws
 * empilés + sub) avec glissando Doppler, throb d'amplitude, et whoosh d'air
 * (bruit band-passé), le tout enveloppé en cloche et synchronisé sur la voiture.
 *
 * Aucune ressource externe : tout est généré à la volée, donc rien à précharger.
 */

/** Fréquences moteur (Hz) : pic à l'approche (`HIGH`), grave en s'éloignant (`LOW`). */
const ENGINE_FREQUENCY_HIGH = 540
const ENGINE_FREQUENCY_LOW = 235
/** Léger sur-régime à mi-parcours (la voiture « arrive ») avant la chute Doppler. */
const APPROACH_PITCH_FACTOR = 1.06

/** Voix empilées qui composent le timbre moteur. */
const ENGINE_VOICES: ReadonlyArray<{
  type: OscillatorType
  frequencyMultiplier: number
  detune: number
}> = [
  { type: 'sawtooth', frequencyMultiplier: 1, detune: 0 },
  { type: 'sawtooth', frequencyMultiplier: 1, detune: 9 },
  { type: 'square', frequencyMultiplier: 0.5, detune: -4 },
]

/** Throb d'amplitude (Hz) : flutter qui monte puis redescend avec le passage. */
const THROB_FREQUENCY_START = 16
const THROB_FREQUENCY_PEAK = 34
const THROB_FREQUENCY_END = 13
const THROB_DEPTH = 0.32

/** Whoosh d'air : balayage du band-pass (Hz) qui s'ouvre au passage. */
const WHOOSH_FREQUENCY_START = 800
const WHOOSH_FREQUENCY_PEAK = 2300
const WHOOSH_FREQUENCY_END = 450
const WHOOSH_Q = 0.7
const WHOOSH_PEAK_GAIN = 0.28

/** Enveloppe maître (cloche) et coupe-haut global. */
const MASTER_PEAK_GAIN = 0.55
const LOWPASS_FREQUENCY = 3600
/** Gain « moteur » sous l'enveloppe maître. */
const ENGINE_BUS_GAIN = 0.6
/** Niveau quasi-nul utilisé pour les rampes exponentielles (0 interdit). */
const NEAR_SILENCE = 0.0001
/** Panning stéréo : extrêmes gauche/droite. */
const PAN_LEFT = -0.95
const PAN_RIGHT = 0.95

let audioContext: AudioContext | null = null

/**
 * Crée (paresseusement) et réveille l'AudioContext partagé. Renvoie `null` si
 * Web Audio est indisponible. À appeler de préférence depuis un geste utilisateur
 * pour débloquer l'audio ; hors geste, le contexte reste « suspended » et la
 * lecture sera silencieuse (volontairement non bloquant).
 */
export function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

/**
 * Joue le fly-by, programmé `delaySeconds` après maintenant et étalé sur
 * `durationSeconds` pour coller à la traversée de la voiture.
 */
export function playEngineFlyby(delaySeconds: number, durationSeconds: number): void {
  const context = ensureAudioContext()
  if (!context) return

  const startTime = context.currentTime + delaySeconds
  const midTime = startTime + durationSeconds * 0.5
  const endTime = startTime + durationSeconds

  // Balayage stéréo partagé (gauche → droite).
  const panner = context.createStereoPanner()
  panner.pan.setValueAtTime(PAN_LEFT, startTime)
  panner.pan.linearRampToValueAtTime(PAN_RIGHT, endTime)
  panner.connect(context.destination)

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = LOWPASS_FREQUENCY
  lowpass.connect(panner)

  // Enveloppe maître en cloche.
  const master = context.createGain()
  master.gain.setValueAtTime(NEAR_SILENCE, startTime)
  master.gain.exponentialRampToValueAtTime(MASTER_PEAK_GAIN, midTime)
  master.gain.exponentialRampToValueAtTime(NEAR_SILENCE, endTime)
  master.connect(lowpass)

  // Bus moteur : voix empilées + sub, avec glissando Doppler.
  const engineBus = context.createGain()
  engineBus.gain.value = ENGINE_BUS_GAIN
  engineBus.connect(master)

  const oscillators = ENGINE_VOICES.map((voice) => {
    const oscillator = context.createOscillator()
    oscillator.type = voice.type
    oscillator.detune.value = voice.detune
    oscillator.frequency.setValueAtTime(ENGINE_FREQUENCY_HIGH * voice.frequencyMultiplier, startTime)
    oscillator.frequency.linearRampToValueAtTime(
      ENGINE_FREQUENCY_HIGH * APPROACH_PITCH_FACTOR * voice.frequencyMultiplier,
      midTime,
    )
    oscillator.frequency.exponentialRampToValueAtTime(
      ENGINE_FREQUENCY_LOW * voice.frequencyMultiplier,
      endTime,
    )
    oscillator.connect(engineBus)
    return oscillator
  })

  // Throb moteur : flutter d'amplitude qui monte puis redescend.
  const throb = context.createOscillator()
  throb.type = 'sawtooth'
  throb.frequency.setValueAtTime(THROB_FREQUENCY_START, startTime)
  throb.frequency.linearRampToValueAtTime(THROB_FREQUENCY_PEAK, midTime)
  throb.frequency.linearRampToValueAtTime(THROB_FREQUENCY_END, endTime)
  const throbGain = context.createGain()
  throbGain.gain.value = THROB_DEPTH
  throb.connect(throbGain)
  throbGain.connect(engineBus.gain)

  // Whoosh d'air : bruit band-passé qui s'ouvre au passage.
  const noiseLength = Math.floor(context.sampleRate * (durationSeconds + 0.2))
  const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseLength; i++) {
    noiseData[i] = Math.random() * 2 - 1
  }
  const noise = context.createBufferSource()
  noise.buffer = noiseBuffer
  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.Q.value = WHOOSH_Q
  bandpass.frequency.setValueAtTime(WHOOSH_FREQUENCY_START, startTime)
  bandpass.frequency.linearRampToValueAtTime(WHOOSH_FREQUENCY_PEAK, midTime)
  bandpass.frequency.exponentialRampToValueAtTime(WHOOSH_FREQUENCY_END, endTime)
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(NEAR_SILENCE, startTime)
  noiseGain.gain.exponentialRampToValueAtTime(WHOOSH_PEAK_GAIN, midTime)
  noiseGain.gain.exponentialRampToValueAtTime(NEAR_SILENCE, endTime)
  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(panner)

  const stopTime = endTime + 0.05
  oscillators.forEach((oscillator) => {
    oscillator.start(startTime)
    oscillator.stop(stopTime)
  })
  throb.start(startTime)
  throb.stop(stopTime)
  noise.start(startTime)
  noise.stop(stopTime)
}
