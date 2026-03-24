<template>
  <el-page-header content="数据同步中心" />
  <el-card style="margin-top:16px" class="sync-card">
    <el-form inline class="form-row">
      <el-form-item label="同步模式">
        <el-radio-group v-model="syncMode">
          <el-radio-button label="custom">自定义代码</el-radio-button>
          <el-radio-button label="all">全市场</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="股票代码" v-if="syncMode === 'custom'">
        <el-input v-model="symbols" placeholder="000001,600519" style="width:280px" />
      </el-form-item>
      <el-form-item label="增量天数">
        <el-input-number v-model="days" :min="1" :max="3650" />
      </el-form-item>
      <el-form-item label="周期">
        <el-select v-model="period" style="width:120px">
          <el-option label="日线" value="daily" />
          <el-option label="周线" value="weekly" />
          <el-option label="月线" value="monthly" />
        </el-select>
      </el-form-item>
      <el-button type="primary" @click="start">立即同步</el-button>
    </el-form>
    <el-progress :percentage="progress" :status="progress === 100 ? 'success' : undefined" style="margin-top:12px" />
    <div style="margin-top:8px">状态：{{ statusText }}</div>
    <el-alert
      style="margin-top:12px"
      type="info"
      :closable="false"
      title="全市场同步会自动拉取股票列表并逐只同步，首次耗时较长，建议先使用增量天数 120~365。"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref } from "vue";
import { getSyncStatus, postSync } from "../api/client";

const symbols = ref("000001,600519");
const days = ref(365);
const period = ref("daily");
const syncMode = ref<"custom" | "all">("custom");
const progress = ref(0);
const statusText = ref("未开始");
let timer: number | null = null;

async function start() {
  try {
    const payload: Record<string, unknown> = {
      incremental_days: days.value,
      period: period.value
    };
    if (syncMode.value === "all") {
      payload.all_listed = true;
    } else {
      const list = symbols.value.split(",").map((x) => x.trim()).filter(Boolean);
      if (!list.length) {
        ElMessage.warning("请输入至少一个股票代码");
        return;
      }
      payload.symbols = list;
    }
    const res = await postSync(payload);
    const taskId = res.task_id;
    statusText.value = `任务 ${taskId} 已提交`;
    progress.value = 0;

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
  } catch (e) {
    ElMessage.error((e as Error).message || "同步任务启动失败");
  }
}
</script>

<style scoped>
.sync-card {
  border-radius: 12px;
}
.form-row {
  row-gap: 6px;
}
</style>
