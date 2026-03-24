<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">信号日志</h2>
      <p class="aq-subtitle">本地 IndexedDB 存储，可筛选、导出 CSV、关闭提示音</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
        <el-form-item label="代码筛选">
          <el-input v-model="symbolFilter" placeholder="如 600519" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="静音">
          <el-switch v-model="muteSound" active-text="关闭声音" />
        </el-form-item>
        <el-form-item>
          <el-button @click="load">刷新</el-button>
          <el-button type="primary" @click="exportCsv" :disabled="!filteredRows.length">导出 CSV</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="aq-card">
      <el-table :data="filteredRows" size="small" max-height="560" stripe>
        <el-table-column prop="time" label="时间" width="180">
          <template #default="{ row }">{{ fmtTime(row.time) }}</template>
        </el-table-column>
        <el-table-column prop="symbol" label="代码" width="100" />
        <el-table-column prop="name" label="名称" width="120" />
        <el-table-column prop="strategy" label="策略" width="140" />
        <el-table-column prop="signalType" label="信号" width="90" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="changePct" label="涨跌幅%" width="100" />
        <el-table-column prop="note" label="备注" min-width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";
import { listSignals, type SignalRecord } from "../db/idb";
import { useSettingsStore } from "../stores/settings";
import { downloadCsv } from "../utils/csv";

const { muteSound } = storeToRefs(useSettingsStore());

const rows = ref<SignalRecord[]>([]);
const symbolFilter = ref("");

const filteredRows = computed(() => {
  if (!symbolFilter.value.trim()) return rows.value;
  const key = symbolFilter.value.trim();
  return rows.value.filter((r) => r.symbol.includes(key));
});

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

async function load() {
  rows.value = await listSignals(800);
}

function exportCsv() {
  downloadCsv(
    `signals_${Date.now()}.csv`,
    ["time", "symbol", "name", "strategy", "signalType", "price", "changePct", "note"],
    filteredRows.value.map((r) => [
      new Date(r.time).toISOString(),
      r.symbol,
      r.name ?? "",
      r.strategy,
      r.signalType,
      r.price,
      r.changePct ?? "",
      r.note ?? ""
    ])
  );
  ElMessage.success("已导出");
}

onMounted(load);
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
