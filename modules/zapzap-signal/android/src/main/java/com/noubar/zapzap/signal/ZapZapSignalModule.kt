package com.noubar.zapzap.signal

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.annotation.Keep
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

@Keep
class ZapZapSignalModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ZapZapSignal")

    Function("prepare") { uri: String ->
      prepare(uri)
    }

    Function("arm") {
      nativeArm()
    }

    Function("emitSignal") { playSound: Boolean, playHaptic: Boolean ->
      val didPlaySound = if (playSound) nativeTrigger() else false
      val didPlayHaptic = if (playHaptic) vibrateHeavy() else false
      mapOf(
        "sound" to didPlaySound,
        "haptic" to didPlayHaptic,
      )
    }

    Function("stop") {
      nativeStop()
    }

    OnDestroy {
      nativeRelease()
    }
  }

  private fun prepare(uriString: String): Boolean {
    return try {
      nativePrepare(readAssetBytes(uriString))
    } catch (_: Exception) {
      false
    }
  }

  private fun readAssetBytes(uriString: String): ByteArray {
    val uri = Uri.parse(uriString)

    if (uri.scheme == null) {
      return File(uriString).readBytes()
    }

    if (uri.scheme == "file" && !uri.path.orEmpty().startsWith("/android_res/")) {
      return File(uri.path ?: error("Missing audio file path")).readBytes()
    }

    if (uri.scheme == "file" && uri.path.orEmpty().startsWith("/android_res/")) {
      val pathParts = uri.pathSegments
      if (pathParts.size >= 3) {
        val resourceType = pathParts[pathParts.size - 2]
        val resourceName = pathParts.last().substringBeforeLast('.')
        val resourceId = context.resources.getIdentifier(
          resourceName,
          resourceType,
          context.packageName,
        )
        if (resourceId != 0) {
          return context.resources.openRawResource(resourceId).use { it.readBytes() }
        }
      }
      error("Unable to resolve embedded zap sound")
    }

    return context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
      ?: error("Unable to open zap sound")
  }

  private fun vibrateHeavy(): Boolean {
    return try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager)
          .defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }

      if (!vibrator.hasVibrator()) return false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(
          VibrationEffect.createWaveform(
            longArrayOf(0, 60),
            intArrayOf(0, 70),
            -1,
          ),
        )
      } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(longArrayOf(0, 61), -1)
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private external fun nativePrepare(wavBytes: ByteArray): Boolean
  private external fun nativeArm(): Boolean
  private external fun nativeTrigger(): Boolean
  private external fun nativeStop()
  private external fun nativeRelease()

  private companion object {
    init {
      System.loadLibrary("zapzap_signal")
    }
  }
}
