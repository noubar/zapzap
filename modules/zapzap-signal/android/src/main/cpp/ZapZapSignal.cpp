#include <jni.h>
#include <oboe/Oboe.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <mutex>
#include <vector>

namespace {

uint16_t readU16(const uint8_t *data) {
  return static_cast<uint16_t>(data[0]) |
         (static_cast<uint16_t>(data[1]) << 8);
}

uint32_t readU32(const uint8_t *data) {
  return static_cast<uint32_t>(data[0]) |
         (static_cast<uint32_t>(data[1]) << 8) |
         (static_cast<uint32_t>(data[2]) << 16) |
         (static_cast<uint32_t>(data[3]) << 24);
}

class ZapAudioEngine final : public oboe::AudioStreamDataCallback,
                             public oboe::AudioStreamErrorCallback {
 public:
  bool prepare(const uint8_t *wavData, size_t wavSize) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    closeLocked();

    std::vector<float> decoded;
    int32_t sampleRate = 0;
    if (!decodePcm16Wav(wavData, wavSize, decoded, sampleRate)) return false;

    sourceSamples_ = std::move(decoded);
    sourceSampleRate_ = sampleRate;
    playbackSamples_.clear();
    playbackFrame_.store(kNotPlaying, std::memory_order_release);
    return true;
  }

  bool arm() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    if (sourceSamples_.empty()) return false;

    if (!stream_ || stream_->getState() == oboe::StreamState::Disconnected ||
        disconnected_.exchange(false, std::memory_order_acq_rel)) {
      closeLocked();
      if (!openLocked()) return false;
    }

    playbackFrame_.store(kNotPlaying, std::memory_order_release);
    const auto state = stream_->getState();
    if (state == oboe::StreamState::Started ||
        state == oboe::StreamState::Starting) {
      return true;
    }
    return stream_->requestStart() == oboe::Result::OK;
  }

  bool trigger() {
    const auto stream = stream_;
    if (!stream || playbackSamples_.empty()) return false;
    const auto state = stream->getState();
    if (state != oboe::StreamState::Started &&
        state != oboe::StreamState::Starting) {
      return false;
    }
    playbackFrame_.store(0, std::memory_order_release);
    return true;
  }

  void stop() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    closeLocked();
  }

  void release() {
    std::lock_guard<std::mutex> lock(controlMutex_);
    closeLocked();
    sourceSamples_.clear();
    playbackSamples_.clear();
    sourceSampleRate_ = 0;
  }

  oboe::DataCallbackResult onAudioReady(
      oboe::AudioStream *audioStream,
      void *audioData,
      int32_t numFrames) override {
    auto *output = static_cast<float *>(audioData);
    const int32_t channelCount = audioStream->getChannelCount();
    std::fill(output, output + numFrames * channelCount, 0.0f);

    int64_t frame = playbackFrame_.load(std::memory_order_acquire);
    if (frame == kNotPlaying) return oboe::DataCallbackResult::Continue;

    for (int32_t outputFrame = 0; outputFrame < numFrames; ++outputFrame) {
      if (frame >= static_cast<int64_t>(playbackSamples_.size())) {
        frame = kNotPlaying;
        break;
      }
      const float sample = playbackSamples_[static_cast<size_t>(frame++)];
      for (int32_t channel = 0; channel < channelCount; ++channel) {
        output[outputFrame * channelCount + channel] = sample;
      }
    }

    playbackFrame_.store(frame, std::memory_order_release);
    return oboe::DataCallbackResult::Continue;
  }

  void onErrorAfterClose(oboe::AudioStream *, oboe::Result) override {
    disconnected_.store(true, std::memory_order_release);
  }

 private:
  static constexpr int64_t kNotPlaying = -1;

  bool openLocked() {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setUsage(oboe::Usage::Game)
        ->setContentType(oboe::ContentType::Sonification)
        ->setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(oboe::ChannelCount::Stereo)
        ->setDataCallback(this)
        ->setErrorCallback(this);

    auto result = builder.openStream(stream_);
    if (result != oboe::Result::OK) {
      builder.setSharingMode(oboe::SharingMode::Shared);
      result = builder.openStream(stream_);
    }
    if (result != oboe::Result::OK || !stream_) {
      stream_.reset();
      return false;
    }

    const int32_t framesPerBurst = stream_->getFramesPerBurst();
    if (framesPerBurst > 0) {
      stream_->setBufferSizeInFrames(framesPerBurst * 2);
    }
    resampleForStream(stream_->getSampleRate());
    return !playbackSamples_.empty();
  }

  void closeLocked() {
    playbackFrame_.store(kNotPlaying, std::memory_order_release);
    if (stream_) {
      stream_->requestStop();
      stream_->close();
      stream_.reset();
    }
  }

  void resampleForStream(int32_t outputSampleRate) {
    if (sourceSamples_.empty() || sourceSampleRate_ <= 0 ||
        outputSampleRate <= 0) {
      playbackSamples_.clear();
      return;
    }

    if (sourceSampleRate_ == outputSampleRate) {
      playbackSamples_ = sourceSamples_;
      return;
    }

    const double ratio = static_cast<double>(outputSampleRate) /
                         static_cast<double>(sourceSampleRate_);
    const size_t outputFrames = static_cast<size_t>(
        std::ceil(static_cast<double>(sourceSamples_.size()) * ratio));
    playbackSamples_.resize(outputFrames);

    for (size_t outputFrame = 0; outputFrame < outputFrames; ++outputFrame) {
      const double sourcePosition = static_cast<double>(outputFrame) / ratio;
      const size_t left = static_cast<size_t>(sourcePosition);
      const size_t right = std::min(left + 1, sourceSamples_.size() - 1);
      const float fraction = static_cast<float>(sourcePosition - left);
      playbackSamples_[outputFrame] =
          sourceSamples_[left] * (1.0f - fraction) +
          sourceSamples_[right] * fraction;
    }
  }

  static bool decodePcm16Wav(
      const uint8_t *data,
      size_t size,
      std::vector<float> &samples,
      int32_t &sampleRate) {
    if (!data || size < 44 || std::memcmp(data, "RIFF", 4) != 0 ||
        std::memcmp(data + 8, "WAVE", 4) != 0) {
      return false;
    }

    uint16_t audioFormat = 0;
    uint16_t channelCount = 0;
    uint16_t bitsPerSample = 0;
    const uint8_t *pcmData = nullptr;
    size_t pcmSize = 0;

    size_t offset = 12;
    while (offset + 8 <= size) {
      const uint8_t *chunk = data + offset;
      const uint32_t chunkSize = readU32(chunk + 4);
      const size_t contentOffset = offset + 8;
      if (contentOffset + chunkSize > size) return false;

      if (std::memcmp(chunk, "fmt ", 4) == 0 && chunkSize >= 16) {
        audioFormat = readU16(data + contentOffset);
        channelCount = readU16(data + contentOffset + 2);
        sampleRate = static_cast<int32_t>(readU32(data + contentOffset + 4));
        bitsPerSample = readU16(data + contentOffset + 14);
      } else if (std::memcmp(chunk, "data", 4) == 0) {
        pcmData = data + contentOffset;
        pcmSize = chunkSize;
      }

      offset = contentOffset + chunkSize + (chunkSize & 1U);
    }

    if (audioFormat != 1 || channelCount == 0 || bitsPerSample != 16 ||
        sampleRate <= 0 || !pcmData || pcmSize < channelCount * 2U) {
      return false;
    }

    const size_t frameCount = pcmSize / (channelCount * 2U);
    samples.resize(frameCount);
    for (size_t frame = 0; frame < frameCount; ++frame) {
      float mixed = 0.0f;
      for (uint16_t channel = 0; channel < channelCount; ++channel) {
        const size_t sampleOffset = (frame * channelCount + channel) * 2U;
        const auto value = static_cast<int16_t>(readU16(pcmData + sampleOffset));
        mixed += static_cast<float>(value) / 32768.0f;
      }
      samples[frame] = mixed / static_cast<float>(channelCount);
    }
    return true;
  }

  std::mutex controlMutex_;
  std::shared_ptr<oboe::AudioStream> stream_;
  std::vector<float> sourceSamples_;
  std::vector<float> playbackSamples_;
  int32_t sourceSampleRate_ = 0;
  std::atomic<int64_t> playbackFrame_{kNotPlaying};
  std::atomic<bool> disconnected_{false};
};

ZapAudioEngine engine;

}  // namespace

extern "C" JNIEXPORT jboolean JNICALL
Java_com_noubar_zapzap_signal_ZapZapSignalModule_nativePrepare(
    JNIEnv *env, jobject, jbyteArray wavBytes) {
  if (!wavBytes) return JNI_FALSE;
  const jsize size = env->GetArrayLength(wavBytes);
  jbyte *bytes = env->GetByteArrayElements(wavBytes, nullptr);
  if (!bytes) return JNI_FALSE;
  const bool prepared = engine.prepare(
      reinterpret_cast<const uint8_t *>(bytes), static_cast<size_t>(size));
  env->ReleaseByteArrayElements(wavBytes, bytes, JNI_ABORT);
  return prepared ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_noubar_zapzap_signal_ZapZapSignalModule_nativeArm(JNIEnv *, jobject) {
  return engine.arm() ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_noubar_zapzap_signal_ZapZapSignalModule_nativeTrigger(
    JNIEnv *, jobject) {
  return engine.trigger() ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_noubar_zapzap_signal_ZapZapSignalModule_nativeStop(JNIEnv *, jobject) {
  engine.stop();
}

extern "C" JNIEXPORT void JNICALL
Java_com_noubar_zapzap_signal_ZapZapSignalModule_nativeRelease(
    JNIEnv *, jobject) {
  engine.release();
}
