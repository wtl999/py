import { defineStore } from "pinia";
import { ref, watch } from "vue";

function readBool(key: string, def = false): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return def;
  }
}

function writeBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const muteSound = ref(readBool("aq_mute"));
  const autoTrade = ref(readBool("aq_autotrade"));
  const syncAt = ref(localStorage.getItem("aq_sync_at") ?? "15:30");

  watch(muteSound, (v) => writeBool("aq_mute", v));
  watch(autoTrade, (v) => writeBool("aq_autotrade", v));
  watch(syncAt, (v) => {
    try {
      localStorage.setItem("aq_sync_at", v);
    } catch {
      /* ignore */
    }
  });

  return { muteSound, autoTrade, syncAt };
});
