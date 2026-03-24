<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">智能选股</h2>
      <p class="aq-subtitle">前端拉取全市场列表与历史K线，按已保存策略在最后一根K线上判定（可限制扫描数量以保流畅）</p>
    </div>

    <el-card class="aq-card panel">
      <el-form inline>
        <el-form-item label="策略">
          <el-select v-model="strategyId" filterable style="width: 220px" placeholder="选择策略">
            <el-option v-for="s in strategies" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="最大扫描数">
          <el-input-number v-model="maxScan" :min="10" :max="500" :step="10" />
        </el-form-item>
        <el-form-item label="周期">
          <el-select v-model="period" style="width: 100px">
            <el-option label="日线" value="daily" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="run">开始选股</el-button>
        </el-form-item>
      </el-form>
      <el-progress v-if="loading" :percentage="progressPct" :stroke-width="8" style="margin-top: 8px" />
    </el-card>

    <el-card class="aq-card">
      <template #header>命中结果（{{ hits.length }}）</template>
      <el-table :data="hits" size="small" max-height="480" stripe>
        <el-table-column prop="symbol" label="代码" width="100" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="close" label="最新收盘" width="110" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button type="primary" text @click="addWl(row)">加自选</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { getHistorical, getStockList } from "../api/client";
import { addWatchlistItem, listStrategyDocs } from "../db/idb";
import type { Bar } from "../utils/indicators";
import { evaluateStrategyDoc } from "../utils/strategyEngine";
import type { StrategyDoc } from "../utils/strategyTypes";

const strategies = ref<StrategyDoc[]>([]);
const strategyId = ref("");
const maxScan = ref(120);
const period = ref("daily");
const loading = ref(false);
const progressPct = ref(0);
const hits = ref<Array<{ symbol: string; name: string; close: number }>>([]);

const strategyMap = computed(() => new Map(strategies.value.map((s) => [s.id, s])));

async function loadStrategies() {
  strategies.value = (await listStrategyDocs()).filter((s) => s.enabled);
  if (!strategyId.value && strategies.value.length) strategyId.value = strategies.value[0].id;
}

function resolve(id: string): StrategyDoc | undefined {
  return strategyMap.value.get(id);
}

async function run() {
  const st = resolve(strategyId.value);
  if (!st) {
    ElMessage.warning("请先在策略中心创建并启用策略");
    return;
  }
  loading.value = true;
  progressPct.value = 0;
  hits.value = [];
  try {
    const list = (await getStockList()) as Array<{ symbol: string; name: string }>;
    const slice = list.slice(0, maxScan.value);
    let done = 0;
    for (const item of slice) {
      try {
        const rows = (await getHistorical({ symbol: item.symbol, period: period.value })) as Array<Record<string, unknown>>;
        const bars: Bar[] = rows.map((r) => ({
          date: String(r.date ?? ""),
          open: Number(r.open ?? 0),
          high: Number(r.high ?? 0),
          low: Number(r.low ?? 0),
          close: Number(r.close ?? 0),
          volume: Number(r.volume ?? 0)
        }));
        if (bars.length < 40) {
          done += 1;
          progressPct.value = Math.round((done / slice.length) * 100);
          continue;
        }
        const i = bars.length - 1;
        const { buy } = evaluateStrategyDoc(st, bars, i, resolve);
        if (buy) {
          hits.value.push({ symbol: item.symbol, name: item.name ?? "", close: bars[i].close });
        }
      } catch {
        /* 单只失败跳过 */
      }
      done += 1;
      progressPct.value = Math.round((done / slice.length) * 100);
    }
    ElMessage.success(`扫描完成，命中 ${hits.value.length} 只`);
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}

async function addWl(row: { symbol: string; name: string }) {
  await addWatchlistItem(row.symbol, row.name);
  ElMessage.success(`${row.symbol} 已加入自选`);
}

onMounted(loadStrategies);
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  padding-bottom: 4px;
}
</style>
