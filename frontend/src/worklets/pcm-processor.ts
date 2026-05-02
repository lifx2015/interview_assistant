import { resample, float32ToInt16 } from '../utils/pcmMath';

class PCMProcessor extends AudioWorkletProcessor {
  _logged = false;

  process(inputs: Float32Array[]): boolean {
    if (!this._logged) {
      console.log(`[PCMProcessor] sampleRate=${sampleRate}, target=16000`);
      this._logged = true;
    }

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const resampled = resample(channelData, sampleRate);
    const int16 = float32ToInt16(resampled);

    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
