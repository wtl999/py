import { defineStore } from "pinia";
import { ref } from "vue";
export const useSettingsStore = defineStore("settings", () => {
    const muteSound = ref(false);
    const autoTrade = ref(false);
    const syncAt = ref("15:30");
    return { muteSound, autoTrade, syncAt };
});
