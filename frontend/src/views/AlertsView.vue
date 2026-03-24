<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">预警中心</h2>
      <p class="aq-subtitle">价格与涨跌幅预警，触发后写入信号日志并支持浏览器通知</p>
    </div>

    <el-card class="aq-card">
      <template #header>新建预警</template>
      <el-form :inline="true">
        <el-form-item label="股票">
          <el-select-v2
            v-model="form.symbol"
            filterable
            clearable
            placeholder="请选择股票"
            :options="stockSelectOptions"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.kind" style="width: 160px">
            <el-option label="价格突破（≥）" value="price_above" />
            <el-option label="价格跌破（≤）" value="price_below" />
            <el-option label="涨幅≥%" value="pct_above" />
            <el-option label="跌幅≤%" value="pct_below" />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值">
          <el-input-number v-model="form.value" :step="0.01" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="add">添加</el-button>
          <el-button @click="requestNotify">请求通知权限</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="aq-card mt">
      <template #header>预警列表</template>
      <el-table :data="rows" size="small" stripe>
        <el-table-column prop="symbol" label="代码" width="100" />
        <el-table-column prop="kind" label="类型" width="140" />
        <el-table-column prop="value" label="阈值" width="100" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="persist(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="danger" text @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { getStockList } from "../api/client";
import { deleteAlert, listAlerts, saveAlert, type AlertRecord } from "../db/idb";

const rows = ref<AlertRecord[]>([]);
const stockOptions = ref<Array<{ value: string; label: string; name: string }>>([]);
const stockSelectOptions = computed(() => stockOptions.value);
const form = reactive({
  symbol: "",
  kind: "price_above" as AlertRecord["kind"],
  value: 0
});

function uid(): string {
  return `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function load() {
  rows.value = await listAlerts();
}

async function loadStockOptions() {
  try {
    const list = (await getStockList()) as Array<{ symbol: string; name: string }>;
    stockOptions.value = list
      .map((r) => {
        const symbol = String(r.symbol).padStart(6, "0");
        const name = String(r.name ?? "");
        return { value: symbol, label: `${name || "未知名称"} (${symbol})`, name };
      })
      .filter((r) => /^\d{6}$/.test(r.value));
  } catch {
    stockOptions.value = [];
  }
}

async function add() {
  if (!form.symbol.trim()) {
    ElMessage.warning("请输入代码");
    return;
  }
  const row: AlertRecord = {
    id: uid(),
    kind: form.kind,
    symbol: form.symbol.trim().padStart(6, "0"),
    value: form.value,
    enabled: true,
    createdAt: Date.now()
  };
  await saveAlert(row);
  await load();
  ElMessage.success("已添加");
}

async function persist(row: AlertRecord) {
  await saveAlert(row);
}

async function remove(id: string) {
  await deleteAlert(id);
  await load();
}

function requestNotify() {
  if (typeof Notification === "undefined") {
    ElMessage.warning("当前环境不支持通知");
    return;
  }
  Notification.requestPermission().then((p) => {
    ElMessage[p === "granted" ? "success" : "info"](`通知权限：${p}`);
  });
}

onMounted(load);
onMounted(loadStockOptions);
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mt {
  margin-top: 4px;
}
</style>
