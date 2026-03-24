<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">信号日志</h2>
      <p class="aq-subtitle">本地 IndexedDB；大表虚拟滚动；可筛选、导出 CSV、关闭提示音</p>
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

    <el-card class="aq-card table-card">
      <template #header>记录列表（{{ filteredRows.length }} 条）</template>
      <div class="v2-wrap">
        <el-auto-resizer>
          <template #default="{ height, width }">
            <el-table-v2
              v-if="width > 0 && height > 0"
              :columns="signalColumns"
              :data="filteredRows"
              :width="width"
              :height="height"
              :row-height="38"
              row-key="id"
              fixed
            />
          </template>
        </el-auto-resizer>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, h, onMounted, ref } from "vue";
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

const signalColumns = computed(() => [
  {
    key: "time",
    dataKey: "time",
    title: "时间",
    width: 176,
    cellRenderer: ({ cellData }: { cellData: number }) => h("span", fmtTime(cellData))
  },
  { key: "symbol", dataKey: "symbol", title: "代码", width: 92 },
  { key: "name", dataKey: "name", title: "名称", width: 112 },
  { key: "strategy", dataKey: "strategy", title: "策略", width: 128 },
  { key: "signalType", dataKey: "signalType", title: "信号", width: 80 },
  { key: "price", dataKey: "price", title: "价格", width: 88 },
  {
    key: "changePct",
    dataKey: "changePct",
    title: "涨跌%",
    width: 88,
    cellRenderer: ({ cellData }: { cellData: number | undefined }) => h("span", cellData == null ? "" : String(cellData))
  },
  { key: "note", dataKey: "note", title: "备注", width: 220 }
]);

async function load() {
  rows.value = await listSignals(5000);
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
.table-card .v2-wrap {
  height: 520px;
  width: 100%;
}
</style>
