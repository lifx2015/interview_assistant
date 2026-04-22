import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult

from backend.config import settings


class _ASRCallback(RecognitionCallback):
    def __init__(self, on_partial, on_sentence, on_error):
        self.on_partial = on_partial
        self.on_sentence = on_sentence
        self.on_error = on_error

    def on_open(self):
        pass

    def on_close(self):
        pass

    def on_event(self, result: RecognitionResult):
        sentence = result.get_sentence()
        if sentence and isinstance(sentence, dict) and sentence.get('text'):
            end_time = sentence.get('end_time')
            text = sentence['text']
            index = sentence.get('index', 0)
            if end_time is not None:
                # Sentence complete
                self.on_sentence(text, index)
            else:
                # Partial result
                self.on_partial(text, index)
        elif sentence and hasattr(sentence, 'text') and sentence.text:
            # Fallback for object-style sentence
            end_time = getattr(result.get_sentence(), 'end_time', None)
            text = sentence.text
            index = getattr(sentence, 'index', 0)
            if end_time is not None:
                self.on_sentence(text, index)
            else:
                self.on_partial(text, index)

    def on_complete(self):
        pass

    def on_error(self, result):
        self.on_error(str(result))


class ASRService:
    def __init__(self):
        dashscope.api_key = settings.dashscope_api_key
        self._recognition: Recognition | None = None
        self._callback: _ASRCallback | None = None

    def start(self, on_partial, on_sentence, on_error):
        self._callback = _ASRCallback(on_partial, on_sentence, on_error)
        self._recognition = Recognition(
            model=settings.asr_model,
            format="pcm",
            sample_rate=16000,
            callback=self._callback,
        )
        self._recognition.start()

    def send_audio(self, audio_data: bytes):
        if self._recognition:
            self._recognition.send_audio_frame(audio_data)

    def send_audio_data(self, audio_data: bytes):
        """Alias for send_audio for backward compatibility"""
        self.send_audio(audio_data)

    def stop(self):
        if self._recognition:
            self._recognition.stop()
            self._recognition = None
