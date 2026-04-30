import { resample, float32ToInt16 } from '../utils/pcmMath';

export function encodePCM(float32Samples: Float32Array, inputSampleRate: number): ArrayBuffer {
  const resampled = resample(float32Samples, inputSampleRate);
  const int16 = float32ToInt16(resampled);
  return int16.buffer as ArrayBuffer;
}

export { resample, float32ToInt16 };
