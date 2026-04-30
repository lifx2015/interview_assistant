import { resample, float32ToInt16 } from '../utils/pcmMath';

class PCMProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[]): boolean {
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
