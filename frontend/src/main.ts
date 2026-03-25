import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles/theme.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import App from "./App.vue";
import router from "./router";
import { seedIndexedDbIfNeeded } from "./db/seedIndexedDb";

const app = createApp(App);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}
app.use(createPinia());
app.use(router);
app.use(ElementPlus);

(async () => {
  try {
    await seedIndexedDbIfNeeded();
  } catch (e) {
    // Demo 数据填充失败不应阻断应用启动
    // eslint-disable-next-line no-console
    console.warn("[seedIndexedDbIfNeeded] failed:", e);
  }
  app.mount("#app");
})();
