<template>
  <el-page-header content="信号日志" />
  <el-card style="margin-top: 12px">
    <el-form inline>
      <el-form-item label="代码筛选">
        <el-input v-model="symbolFilter" placeholder="如 600519" clearable />
      </el-form-item>
      <el-button @click="load">刷新</el-button>
    </el-form>
    <el-table :data="filteredRows" size="small" max-height="520">
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listSignals, type SignalRecord } from "../db/idb";

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
  rows.value = await listSignals(500);
}

onMounted(load);
</script>
