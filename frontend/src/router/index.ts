import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../layouts/MainLayout.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", name: "dashboard", component: () => import("../views/DashboardView.vue") },
        { path: "strategies", name: "strategies", component: () => import("../views/StrategiesView.vue") },
        { path: "screener", name: "screener", component: () => import("../views/ScreenerView.vue") },
        { path: "watch", name: "watch", component: () => import("../views/WatchView.vue") },
        { path: "sync", name: "sync", component: () => import("../views/SyncView.vue") },
        { path: "backtest", name: "backtest", component: () => import("../views/BacktestView.vue") },
        { path: "paper", name: "paper", component: () => import("../views/PaperView.vue") },
        { path: "signals", name: "signals", component: () => import("../views/SignalsView.vue") },
        { path: "alerts", name: "alerts", component: () => import("../views/AlertsView.vue") },
        { path: "chart", name: "chart", component: () => import("../views/ChartView.vue") },
        { path: "indicator-lab", name: "indicator-lab", component: () => import("../views/IndicatorLabView.vue") },
        { path: "reports", name: "reports", component: () => import("../views/ReportsView.vue") }
      ]
    }
  ]
});

export default router;
