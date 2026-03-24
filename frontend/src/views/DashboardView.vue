<template>
  <div class="dash">
    <div class="head">
      <h2 class="aq-title">数据看板</h2>
      <p class="aq-subtitle">基于本地模拟账户、成交与信号聚合（可导出图表为图片）</p>
    </div>

    <el-row :gutter="12">
      <el-col :span="6"><el-card class="aq-card metric"><div class="k">账户权益</div><div class="v">{{ equity.toFixed(2) }}</div></el-card></el-col>
      <el-col :span="6"><el-card class="aq-card metric"><div class="k">累计收益</div><div class="v" :class="profit >= 0 ? 'up' : 'down'">{{ profit.toFixed(2) }}</div></el-card></el-col>
      <el-col :span="6"><el-card class="aq-card metric"><div class="k">收益率</div><div class="v" :class="profitRate >= 0 ? 'up' : 'down'">{{ (profitRate * 100).toFixed(2) }}%</div></el-card></el-col>
      <el-col :span="6"><el-card class="aq-card metric"><div class="k">胜率(估)</div><div class="v">{{ (winRate * 100).toFixed(2) }}%</div></el-card></el-col>
    </el-row>

    <el-row :gutter="12" class="row2">
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">交易次数</div><div class="v">{{ trades.length }}</div></el-card></el-col>
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">信号数</div><div class="v">{{ signals.length }}</div></el-card></el-col>
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">持仓数</div><div class="v">{{ positions.length }}</div></el-card></el-col>
    </el-row>

    <el-row :gutter="12" class="charts">
      <el-col :span="12">
        <el-card class="aq-card chart-wrap">
          <template #header>
            <span>权益曲线</span>
            <el-button class="fr" text type="primary" @click="saveImg('eq')">导出图</el-button>
          </template>
          <div ref="eqRef" class="chart" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="aq-card chart-wrap">
          <template #header>
            <span>持仓市值占比</span>
            <el-button class="fr" text type="primary" @click="saveImg('pie')">导出图</el-button>
          </template>
          <div ref="pieRef" class="chart" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="charts">
      <el-col :span="12">
        <el-card class="aq-card chart-wrap">
          <template #header>
            <span>日收益分布 (%)</span>
            <el-button class="fr" text type="primary" @click="saveImg('hist')">导出图</el-button>
          </template>
          <div ref="histRef" class="chart" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="aq-card chart-wrap">
          <template #header>
            <span>月度收益热力 (%)</span>
            <el-button class="fr" text type="primary" @click="saveImg('heat')">导出图</el-button>
          </template>
          <div ref="heatRef" class="chart" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>最近交易</template>
          <el-table :data="trades.slice(0, 8)" size="small" max-height="260" stripe>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.time) }}</template>
            </el-table-column>
            <el-table-column prop="symbol" label="代码" width="90" />
            <el-table-column prop="side" label="方向" width="70" />
            <el-table-column prop="price" label="价格" width="90" />
            <el-table-column prop="quantity" label="数量" width="90" />
            <el-table-column prop="amount" label="成交额" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>最近信号</template>
          <el-table :data="signals.slice(0, 8)" size="small" max-height="260" stripe>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ fmtTime(row.time) }}</template>
            </el-table-column>
            <el-table-column prop="symbol" label="代码" width="90" />
            <el-table-column prop="strategy" label="策略" width="130" />
            <el-table-column prop="signalType" label="信号" width="80" />
            <el-table-column prop="price" label="价格" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { getPaperAccount, listPositions, listSignals, listTrades, type PaperAccount, type PositionRecord, type SignalRecord, type TradeRecord } from "../db/idb";
import { buildEquitySeries, dailyReturnHistogram, monthlyReturnMap } from "../utils/equity";

const account = ref<PaperAccount>({ cash: 0, initCash: 0, updatedAt: 0 });
const positions = ref<PositionRecord[]>([]);
const trades = ref<TradeRecord[]>([]);
const signals = ref<SignalRecord[]>([]);

const eqRef = ref<HTMLDivElement | null>(null);
const pieRef = ref<HTMLDivElement | null>(null);
const histRef = ref<HTMLDivElement | null>(null);
const heatRef = ref<HTMLDivElement | null>(null);
let charts: echarts.ECharts[] = [];

const marketValue = computed(() => positions.value.reduce((sum, p) => sum + p.marketPrice * p.quantity, 0));
const equity = computed(() => account.value.cash + marketValue.value);
const profit = computed(() => equity.value - account.value.initCash);
const profitRate = computed(() => (account.value.initCash > 0 ? profit.value / account.value.initCash : 0));

const winRate = computed(() => {
  if (!trades.value.length) return 0;
  const sellTrades = trades.value.filter((t) => t.side === "sell");
  if (!sellTrades.length) return 0;
  let win = 0;
  for (const t of sellTrades) {
    const pos = positions.value.find((p) => p.symbol === t.symbol);
    const cost = pos?.avgCost ?? t.price;
    if (t.price > cost) win += 1;
  }
  return win / sellTrades.length;
});

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function disposeCharts() {
  charts.forEach((c) => c.dispose());
  charts = [];
}

function renderAll() {
  disposeCharts();
  const sortedTrades = [...trades.value].sort((a, b) => a.time - b.time);
  const eqPoints = buildEquitySeries(sortedTrades, account.value.initCash);

  if (eqRef.value) {
    const c = echarts.init(eqRef.value);
    charts.push(c);
    c.setOption({
      grid: { left: 40, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: eqPoints.map((p) => p.label), boundaryGap: false },
      yAxis: { type: "value", scale: true, splitLine: { lineStyle: { type: "dashed", opacity: 0.35 } } },
      series: [{ type: "line", data: eqPoints.map((p) => p.equity), smooth: true, showSymbol: false, areaStyle: { opacity: 0.06 }, lineStyle: { width: 2, color: "#4b7bff" } }]
    });
  }

  if (pieRef.value) {
    const c = echarts.init(pieRef.value);
    charts.push(c);
    const data = positions.value.map((p) => ({ name: p.symbol, value: Math.round(p.marketPrice * p.quantity * 100) / 100 }));
    if (!data.length) data.push({ name: "现金", value: Math.round(account.value.cash * 100) / 100 });
    c.setOption({
      tooltip: { trigger: "item" },
      series: [{ type: "pie", radius: ["42%", "68%"], data, label: { color: "#334155" } }]
    });
  }

  if (histRef.value) {
    const c = echarts.init(histRef.value);
    charts.push(c);
    const hist = dailyReturnHistogram(eqPoints);
    const buckets = new Map<string, number>();
    for (const h of hist) {
      const b = Math.round(h / 0.5) * 0.5;
      const key = `${b.toFixed(1)}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const cats = [...buckets.keys()].sort((a, b) => Number(a) - Number(b));
    c.setOption({
      grid: { left: 40, right: 16, top: 16, bottom: 40 },
      xAxis: { type: "category", data: cats, name: "日涨跌%" },
      yAxis: { type: "value", name: "频次" },
      series: [{ type: "bar", data: cats.map((k) => buckets.get(k) ?? 0), itemStyle: { color: "#6366f1", borderRadius: [4, 4, 0, 0] } }]
    });
  }

  if (heatRef.value) {
    const c = echarts.init(heatRef.value);
    charts.push(c);
    const mmap = monthlyReturnMap(eqPoints);
    const months = Object.keys(mmap).sort();
    const vals = months.map((m) => mmap[m]);
    c.setOption({
      grid: { left: 48, right: 16, top: 16, bottom: 48 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: months, axisLabel: { rotate: 30 } },
      yAxis: { type: "value", name: "月度涨跌%" },
      series: [
        {
          type: "bar",
          data: vals.map((v) => ({
            value: v,
            itemStyle: { color: v >= 0 ? "#22c55e" : "#ef4444", borderRadius: [4, 4, 0, 0] }
          })),
          label: { show: true, position: "top" }
        }
      ]
    });
  }
}

function saveImg(which: "eq" | "pie" | "hist" | "heat") {
  const map = { eq: 0, pie: 1, hist: 2, heat: 3 };
  const c = charts[map[which]];
  if (!c) return;
  const url = c.getDataURL({ type: "png", pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard_${which}_${Date.now()}.png`;
  a.click();
}

async function load() {
  account.value = await getPaperAccount();
  positions.value = await listPositions();
  trades.value = await listTrades(500);
  signals.value = await listSignals(300);
  await nextTick();
  renderAll();
}

onMounted(() => {
  load();
  window.addEventListener("resize", () => charts.forEach((c) => c.resize()));
});

onBeforeUnmount(() => {
  disposeCharts();
});
</script>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row2 {
  margin-top: 0;
}
.charts {
  margin-top: 0;
}
.metric .k {
  color: #64748b;
  font-size: 13px;
}
.metric .v {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}
.up {
  color: #16a34a !important;
}
.down {
  color: #dc2626 !important;
}
.chart-wrap .chart {
  height: 280px;
  width: 100%;
}
.fr {
  float: right;
}
</style>
