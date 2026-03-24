<template>
  <div class="backtest">
    <div class="head">
      <h2 class="aq-title">策略回测</h2>
      <p class="aq-subtitle">本地撮合 + 与实时监听同一套指标引擎；支持滑点、夏普近似、结果导出</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
        <el-form-item label="标的代码">
          <el-input v-model="symbol" style="width: 120px" />
        </el-form-item>
        <el-form-item label="策略">
          <el-select v-model="strategyId" filterable style="width: 200px">
            <el-option label="内置 MACD 金叉" value="__macd__" />
            <el-option v-for="s in strategyList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始资金">
          <el-input-number v-model="initCash" :min="10000" :step="10000" />
        </el-form-item>
        <el-form-item label="手续费率">
          <el-input-number v-model="feeRate" :precision="4" :step="0.0001" />
        </el-form-item>
        <el-form-item label="滑点">
          <el-input-number v-model="slippage" :precision="4" :step="0.0001" />
        </el-form-item>
        <el-form-item label="每手股数">
          <el-input-number v-model="lotSize" :min="1" :step="100" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="run">开始回测</el-button>
          <el-button :disabled="!result.trades.length" @click="exportCsv">导出 CSV</el-button>
          <el-button :disabled="!result.trades.length" @click="exportHtml">导出 HTML 报告</el-button>
          <el-button :disabled="!result.trades.length" @click="exportPdf">导出 PDF 报告</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="12" class="metric-row">
      <el-col :span="6">
        <el-card class="aq-card metric"><div class="k">总收益率</div><div class="v">{{ (result.totalReturn * 100).toFixed(2) }}%</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="aq-card metric"><div class="k">最大回撤</div><div class="v">{{ (result.maxDrawdown * 100).toFixed(2) }}%</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="aq-card metric"><div class="k">胜率</div><div class="v">{{ (result.winRate * 100).toFixed(2) }}%</div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="aq-card metric"><div class="k">夏普(近似)</div><div class="v">{{ result.sharpeApprox.toFixed(2) }}</div></el-card>
      </el-col>
    </el-row>

    <el-card class="aq-card chart-card">
      <template #header>权益曲线</template>
      <div ref="chartRef" class="chart" />
    </el-card>

    <el-card class="aq-card table-card">
      <template #header>交易明细（{{ result.trades.length }} 笔）</template>
      <el-table :data="result.trades" size="small" max-height="420" stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="side" label="方向" width="80" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="quantity" label="数量" width="90" />
        <el-table-column prop="fee" label="手续费" width="100" />
        <el-table-column prop="equityAfter" label="交易后权益" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import * as echarts from "echarts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { getHistorical } from "../api/client";
import { listStrategyDocs } from "../db/idb";
import { getBuiltinMacdStrategy, type BacktestResult } from "../utils/backtest";
import { downloadCsv } from "../utils/csv";
import type { Bar } from "../utils/indicators";
import type { StrategyDoc } from "../utils/strategyTypes";

const symbol = ref("600519");
const strategyId = ref("__macd__");
const strategyList = ref<StrategyDoc[]>([]);
const initCash = ref(1_000_000);
const feeRate = ref(0.0003);
const slippage = ref(0.0005);
const lotSize = ref(100);
const loading = ref(false);
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let worker: Worker | null = null;

const result = reactive<BacktestResult>({
  trades: [],
  equityCurve: [],
  totalReturn: 0,
  maxDrawdown: 0,
  winRate: 0,
  sharpeApprox: 0
});

function strategyMap(): Map<string, StrategyDoc> {
  const m = new Map<string, StrategyDoc>();
  for (const s of strategyList.value) m.set(s.id, s);
  return m;
}

function resolveStrategy(id: string): StrategyDoc | undefined {
  return strategyMap().get(id);
}

function pickStrategy(): StrategyDoc {
  if (strategyId.value === "__macd__") return getBuiltinMacdStrategy();
  return resolveStrategy(strategyId.value) ?? getBuiltinMacdStrategy();
}

async function run() {
  loading.value = true;
  try {
    const rows = (await getHistorical({ symbol: symbol.value, period: "daily" })) as Array<Record<string, unknown>>;
    const bars: Bar[] = rows.map((r) => ({
      date: String(r.date ?? ""),
      open: Number(r.open ?? 0),
      high: Number(r.high ?? 0),
      low: Number(r.low ?? 0),
      close: Number(r.close ?? 0),
      volume: Number(r.volume ?? 0)
    }));
    if (bars.length < 60) {
      ElMessage.warning("数据太少，至少需要约 60 根K线");
      return;
    }
    const st = pickStrategy();
    const next = await runInWorker(bars, st);
    Object.assign(result, next);
    ElMessage.success(`回测完成：${symbol.value}，${next.trades.length} 笔交易`);
    await nextTick();
    renderChart();
  } catch (e) {
    ElMessage.error(`回测失败：${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

function runInWorker(bars: Bar[], strategy: StrategyDoc): Promise<BacktestResult> {
  if (!worker) {
    // @ts-ignore Vetur in some environments mis-detects import.meta in SFC
    worker = new Worker(new URL("../workers/backtestWorker.ts", import.meta.url), { type: "module" });
  }
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("worker init failed"));
      return;
    }
    const onMessage = (ev: MessageEvent<{ type: "done" | "error"; result?: BacktestResult; message?: string }>) => {
      if (ev.data.type === "done" && ev.data.result) {
        worker?.removeEventListener("message", onMessage);
        resolve(ev.data.result);
      } else if (ev.data.type === "error") {
        worker?.removeEventListener("message", onMessage);
        reject(new Error(ev.data.message || "回测 worker 执行失败"));
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      type: "run",
      bars,
      params: { initCash: initCash.value, feeRate: feeRate.value, lotSize: lotSize.value, slippage: slippage.value },
      strategy,
      strategies: strategyList.value
    });
  });
}

function renderChart() {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);
  chart.setOption({
    grid: { left: 48, right: 24, top: 24, bottom: 40 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: result.equityCurve.map((p) => p.date), boundaryGap: false },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { type: "dashed", opacity: 0.4 } } },
    series: [
      {
        type: "line",
        data: result.equityCurve.map((p) => p.equity),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#4b7bff" },
        areaStyle: { color: "rgba(75,123,255,0.08)" }
      }
    ]
  });
}

function exportCsv() {
  downloadCsv(
    `backtest_${symbol.value}_${Date.now()}.csv`,
    ["date", "side", "price", "quantity", "fee", "equityAfter"],
    result.trades.map((t) => [t.date, t.side, t.price, t.quantity, t.fee, t.equityAfter])
  );
  ElMessage.success("已导出");
}

function exportHtml() {
  const rows = result.trades
    .map(
      (t) =>
        `<tr><td>${t.date}</td><td>${t.side}</td><td>${t.price}</td><td>${t.quantity}</td><td>${t.fee}</td><td>${t.equityAfter}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>回测 ${symbol.value}</title>
<style>body{font-family:system-ui;margin:24px;}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}</style></head><body>
<h1>回测报告 · ${symbol.value}</h1>
<p>总收益 ${(result.totalReturn * 100).toFixed(2)}% · 最大回撤 ${(result.maxDrawdown * 100).toFixed(2)}% · 胜率 ${(result.winRate * 100).toFixed(2)}% · 夏普(近似) ${result.sharpeApprox}</p>
<table><thead><tr><th>日期</th><th>方向</th><th>价格</th><th>数量</th><th>手续费</th><th>权益</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backtest_${symbol.value}_${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  ElMessage.success("HTML 已导出");
}

function exportPdf() {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(`Backtest Report: ${symbol.value}`, 40, 44);
  doc.setFontSize(11);
  doc.text(
    `Return ${(result.totalReturn * 100).toFixed(2)}% | MaxDD ${(result.maxDrawdown * 100).toFixed(2)}% | Win ${(result.winRate * 100).toFixed(2)}% | Sharpe ${result.sharpeApprox.toFixed(2)}`,
    40,
    66
  );
  autoTable(doc, {
    startY: 84,
    head: [["Date", "Side", "Price", "Qty", "Fee", "Equity"]],
    body: result.trades.map((t) => [t.date, t.side, String(t.price), String(t.quantity), String(t.fee), String(t.equityAfter)]),
    styles: { fontSize: 8, cellPadding: 3 }
  });
  doc.save(`backtest_${symbol.value}_${Date.now()}.pdf`);
  ElMessage.success("PDF 已导出");
}

watch(
  () => result.equityCurve,
  () => nextTick(() => renderChart()),
  { deep: true }
);

onMounted(async () => {
  strategyList.value = await listStrategyDocs();
  window.addEventListener("resize", () => chart?.resize());
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
  worker?.terminate();
  worker = null;
});
</script>

<style scoped>
.backtest {
  display: grid;
  gap: 12px;
}
.metric-row {
  margin-top: 2px;
}
.metric .k {
  font-size: 13px;
  color: #63769a;
}
.metric .v {
  margin-top: 10px;
  font-size: 22px;
  font-weight: 700;
  color: #1a2a4e;
}
.chart-card .chart {
  height: 320px;
  width: 100%;
}
.table-card {
  margin-top: 4px;
}
</style>
