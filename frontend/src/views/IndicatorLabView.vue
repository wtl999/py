<template>
  <div class="page">
    <div>
      <h2 class="aq-title">指标校验实验室</h2>
      <p class="aq-subtitle">用于对照通达信/同花顺口径，先提供可复现样本与快照导出</p>
    </div>
    <el-card class="aq-card">
      <el-form inline>
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
          <el-button type="primary" :loading="loading" @click="run">计算并校验</el-button>
          <el-button :disabled="!rows.length" @click="exportCsv">导出快照CSV</el-button>
        </el-form-item>
      </el-form>
      <el-alert
        :closable="false"
        type="info"
        title="建议把同时间段同参数的通达信/同花顺指标值贴入对照表，当前页面用于统一计算口径与快照导出。"
      />
    </el-card>

    <el-card class="aq-card">
      <template #header>对照校验（粘贴通达信/同花顺数据）</template>
      <el-form label-position="top">
        <el-form-item label="格式：date,ma5,ma20,dif,dea,macd,rsi14,k,d,j（CSV每行一条）">
          <el-input v-model="benchmarkText" type="textarea" :rows="6" placeholder="2024-12-02,1720.11,1691.20,12.3,10.5,3.6,56.2,61.1,58.0,67.2" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :disabled="!rows.length || !benchmarkText.trim()" @click="compareBenchmark">计算误差</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="compareRows" size="small" max-height="240" stripe v-if="compareRows.length">
        <el-table-column prop="date" label="日期" width="110" />
        <el-table-column prop="metric" label="指标" width="100" />
        <el-table-column prop="expected" label="对照值" width="100" />
        <el-table-column prop="actual" label="本地值" width="100" />
        <el-table-column prop="diff" label="绝对误差" width="100" />
        <el-table-column prop="ok" label="是否通过">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.ok ? "通过" : "偏差" }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="aq-card">
      <template #header>指标快照（最近30行）</template>
      <el-table :data="rows" size="small" max-height="560" stripe>
        <el-table-column prop="date" label="日期" width="110" />
        <el-table-column prop="close" label="收盘" width="100" />
        <el-table-column prop="ma5" label="MA5" width="90" />
        <el-table-column prop="ma20" label="MA20" width="90" />
        <el-table-column prop="dif" label="DIF" width="90" />
        <el-table-column prop="dea" label="DEA" width="90" />
        <el-table-column prop="macd" label="MACD" width="90" />
        <el-table-column prop="rsi14" label="RSI14" width="90" />
        <el-table-column prop="k" label="K" width="80" />
        <el-table-column prop="d" label="D" width="80" />
        <el-table-column prop="j" label="J" width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref } from "vue";
import { getHistorical } from "../api/client";
import { downloadCsv } from "../utils/csv";
import { kdj, ma, macd, rsi, type Bar } from "../utils/indicators";

const symbol = ref("600519");
const period = ref("daily");
const loading = ref(false);
const rows = ref<Array<Record<string, string | number>>>([]);
const benchmarkText = ref("");
const compareRows = ref<Array<{ date: string; metric: string; expected: number; actual: number; diff: number; ok: boolean }>>([]);

async function run() {
  loading.value = true;
  try {
    const data = (await getHistorical({ symbol: symbol.value, period: period.value })) as Array<Record<string, unknown>>;
    const bars: Bar[] = data.map((r) => ({
      date: String(r.date ?? ""),
      open: Number(r.open ?? 0),
      high: Number(r.high ?? 0),
      low: Number(r.low ?? 0),
      close: Number(r.close ?? 0),
      volume: Number(r.volume ?? 0)
    }));
    const closes = bars.map((b) => b.close);
    const ma5 = ma(closes, 5);
    const ma20 = ma(closes, 20);
    const m = macd(closes, 12, 26, 9);
    const r14 = rsi(closes, 14);
    const kdjRes = kdj(bars, 9, 3, 3);
    rows.value = bars
      .map((b, i) => ({
        date: b.date,
        close: b.close,
        ma5: ma5[i],
        ma20: ma20[i],
        dif: m.dif[i],
        dea: m.dea[i],
        macd: m.macd[i],
        rsi14: r14[i],
        k: kdjRes.k[i],
        d: kdjRes.d[i],
        j: kdjRes.j[i]
      }))
      .slice(-30);
    ElMessage.success("已完成指标快照计算");
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  downloadCsv(
    `indicator_snapshot_${symbol.value}_${Date.now()}.csv`,
    ["date", "close", "ma5", "ma20", "dif", "dea", "macd", "rsi14", "k", "d", "j"],
    rows.value.map((r) => [r.date, r.close, r.ma5, r.ma20, r.dif, r.dea, r.macd, r.rsi14, r.k, r.d, r.j])
  );
  ElMessage.success("已导出快照CSV");
}

function compareBenchmark() {
  const map = new Map(rows.value.map((r) => [String(r.date), r]));
  const out: Array<{ date: string; metric: string; expected: number; actual: number; diff: number; ok: boolean }> = [];
  const metrics = ["ma5", "ma20", "dif", "dea", "macd", "rsi14", "k", "d", "j"] as const;
  const lines = benchmarkText.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const cols = line.split(",").map((s) => s.trim());
    if (cols.length < 10) continue;
    const date = cols[0];
    const row = map.get(date);
    if (!row) continue;
    metrics.forEach((m, idx) => {
      const expected = Number(cols[idx + 1]);
      const actual = Number(row[m] ?? NaN);
      if (!Number.isFinite(expected) || !Number.isFinite(actual)) return;
      const diff = Math.abs(expected - actual);
      out.push({ date, metric: m, expected, actual, diff, ok: diff <= 0.02 });
    });
  }
  compareRows.value = out.sort((a, b) => b.diff - a.diff);
  const fail = compareRows.value.filter((r) => !r.ok).length;
  ElMessage[fail ? "warning" : "success"](fail ? `校验完成：${fail} 项偏差超阈值` : "校验通过：全部在阈值内");
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

