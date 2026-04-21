const TARGET_SAMPLE_RATE = 16000;

export function resample(float32Array: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_SAMPLE_RATE) return float32Array;
  const ratio = fromRate / TARGET_SAMPLE_RATE;
  const newLength = Math.round(float32Array.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, float32Array.length - 1);
    const frac = srcIndex - lower;
    result[i] = float32Array[lower] * (1 - frac) + float32Array[upper] * frac;
  }
  return result;
}

export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function encodePCM(float32Samples: Float32Array, inputSampleRate: number): ArrayBuffer {
  const resampled = resample(float32Samples, inputSampleRate);
  const int16 = float32ToInt16(resampled);
  return int16.buffer as ArrayBuffer;
}
