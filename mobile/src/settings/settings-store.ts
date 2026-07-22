import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wms.settings';

interface Settings {
  sound: boolean;
  haptic: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: (patch: Partial<Pick<Settings, 'sound' | 'haptic'>>) => Promise<void>;
}

export const useSettings = create<Settings>((set, get) => ({
  sound: true,
  haptic: true,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw) as { sound?: boolean; haptic?: boolean };
        set({ sound: v.sound ?? true, haptic: v.haptic ?? true });
      }
    } catch {
      // ignore
    }
    set({ hydrated: true });
  },
  set: async (patch) => {
    set(patch);
    const { sound, haptic } = get();
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ sound, haptic }));
    } catch {
      // ignore
    }
  },
}));

// Tiện ích rung tôn trọng cài đặt (gọi từ bất kỳ đâu)
export function buzz(ms = 60) {
  if (useSettings.getState().haptic) {
    // import động để tránh require vòng
    const { Vibration } = require('react-native');
    Vibration.vibrate(ms);
  }
}
