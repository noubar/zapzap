import { Asset } from "expo-asset";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

type NativeSignalResult = {
  sound: boolean;
  haptic: boolean;
};

type NativeSignalModule = {
  prepare: (uri: string) => boolean;
  arm: () => boolean;
  emitSignal: (playSound: boolean, playHaptic: boolean) => NativeSignalResult;
  stop: () => void;
};

const nativeSignal =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NativeSignalModule>("ZapZapSignal")
    : null;

export async function prepareNativeGoSignal() {
  if (!nativeSignal) return false;

  try {
    const asset = Asset.fromModule(require("../assets/sounds/zt.wav"));
    await asset.downloadAsync();
    return nativeSignal.prepare(asset.localUri ?? asset.uri);
  } catch {
    return false;
  }
}

export function armNativeGoSignal() {
  try {
    return nativeSignal?.arm() ?? false;
  } catch {
    return false;
  }
}

export function emitNativeGoSignal(
  playSound: boolean,
  playHaptic: boolean,
): NativeSignalResult | null {
  if (!nativeSignal) return null;

  try {
    return nativeSignal.emitSignal(playSound, playHaptic);
  } catch {
    return null;
  }
}

export function stopNativeGoSignal() {
  try {
    nativeSignal?.stop();
  } catch {
    // Native feedback cleanup must never interrupt gameplay.
  }
}
