<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">K 线分析</h2>
      <p class="aq-subtitle">ECharts 专业蜡烛图 + MA5 / MA10 / 成交量</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
        <el-form-item label="代码">
          <el-input v-model="symbol" style="width: 120px" />
        </el-form-item>
        <el-form-item label="周期">
          <el-select v-model="period" style="width: 120px">
            <el-option label="日线" value="daily" />
            <el-option label="周线" value="weekly" />
            <el-option label="月线" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="load">加载</el-button>
          <el-button @click="saveImg">导出图片</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="aq-card">
      <div ref="chartRef" class="chart" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { getHistorical } from "../api/client";
import { ma } from "../utils/indicators";

const symbol = ref("600519");
const period = ref("daily");
const loading = ref(false);
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

async function load() {
  loading.value = true;
  try {
    const rows = (await getHistorical({ symbol: symbol.value, period: period.value })) as Array<Record<string, unknown>>;
    const dates = rows.map((r) => String(r.date ?? ""));
    const ohlc = rows.map((r) => [Number(r.open), Number(r.close), Number(r.low), Number(r.high)]);
    const vol = rows.map((r) => Number(r.volume ?? 0));
    const closes = rows.map((r) => Number(r.close ?? 0));
    const m5 = ma(closes, 5);
    const m10 = ma(closes, 10);

    if (!chartRef.value) return;
    if (!chart) chart = echarts.init(chartRef.value);
    chart.setOption({
      animation: true,
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: 56, right: 48, top: 24, height: "56%" },
        { left: 56, right: 48, top: "72%", height: "18%" }
      ],
      xAxis: [
        { type: "category", data: dates, boundaryGap: true, axisLine: { onZero: false }, splitLine: { show: false }, min: "dataMin", max: "dataMax" },
        { type: "category", gridIndex: 1, data: dates, boundaryGap: true, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false } }
      ],
      yAxis: [
        { scale: true, splitLine: { lineStyle: { type: "dashed", opacity: 0.35 } } },
        { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } }
      ],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 70, end: 100 }, { show: true, xAxisIndex: [0, 1], type: "slider", bottom: 8, start: 70, end: 100 }],
      tooltip: { trigger: "axis" },
      series: [
        { type: "candlestick", name: "K线", data: ohlc, itemStyle: { color: "#ef4444", color0: "#22c55e", borderColor: "#ef4444", borderColor0: "#22c55e" } },
        { type: "line", name: "MA5", data: m5, smooth: true, showSymbol: false, lineStyle: { width: 1.2, color: "#f59e0b" } },
        { type: "line", name: "MA10", data: m10, smooth: true, showSymbol: false, lineStyle: { width: 1.2, color: "#3b82f6" } },
        { type: "bar", name: "成交量", xAxisIndex: 1, yAxisIndex: 1, data: vol, itemStyle: { color: "#94a3b8", opacity: 0.85 } }
      ]
    });
    ElMessage.success(`已加载 ${symbol.value} ${rows.length} 根K线`);
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}

function saveImg() {
  if (!chart) return;
  const url = chart.getDataURL({ type: "png", pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `kline_${symbol.value}_${Date.now()}.png`;
  a.click();
}

onMounted(() => {
  load();
  window.addEventListener("resize", () => chart?.resize());
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chart {
  height: 520px;
  width: 100%;
}
</style>
