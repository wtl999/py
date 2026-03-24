<template>
  <el-page-header content="数据同步" />
  <el-card style="margin-top:16px">
    <el-form inline>
      <el-form-item label="股票代码">
        <el-input v-model="symbols" placeholder="000001,600519" style="width:260px" />
      </el-form-item>
      <el-form-item label="增量天数">
        <el-input-number v-model="days" :min="1" :max="3650" />
      </el-form-item>
      <el-button type="primary" @click="start">立即同步</el-button>
    </el-form>
    <el-progress :percentage="progress" style="margin-top:12px" />
    <div style="margin-top:8px">状态：{{ statusText }}</div>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getSyncStatus, postSync } from "../api/client";

const symbols = ref("000001,600519");
const days = ref(365);
const progress = ref(0);
const statusText = ref("未开始");
let timer: number | null = null;

async function start() {
  const list = symbols.value.split(",").map((x) => x.trim()).filter(Boolean);
  const res = await postSync({ symbols: list, incremental_days: days.value, period: "daily" });
  const taskId = res.task_id;
  statusText.value = `任务 ${taskId} 已提交`;
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(async () => {
    const s = await getSyncStatus(taskId);
    const total = s.total || 0;
    const done = s.done || 0;
    progress.value = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    statusText.value = `${s.status} | ${done}/${total} | 失败 ${s.failed}`;
    if (["done", "done_with_errors", "unknown"].includes(s.status)) {
      if (timer) window.clearInterval(timer);
      timer = null;
    }
  }, 1500);
}
</script>
