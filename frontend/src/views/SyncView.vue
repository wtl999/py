<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">数据同步中心</h2>
      <p class="aq-subtitle">手动 / 全市场 / 定时增量 — 任务进度由后端推送，前台轮询展示</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true" class="form-row">
        <el-form-item label="同步模式">
          <el-radio-group v-model="syncMode">
            <el-radio-button label="custom">自定义代码</el-radio-button>
            <el-radio-button label="all">全市场</el-radio-button>
            <el-radio-button label="watch">自选池</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="syncMode === 'custom'" label="股票代码">
          <el-input v-model="symbols" placeholder="000001,600519" style="width: 280px" />
        </el-form-item>
        <el-form-item label="增量天数">
          <el-input-number v-model="days" :min="1" :max="3650" />
        </el-form-item>
        <el-form-item label="周期">
          <el-select v-model="period" style="width: 120px">
            <el-option label="日线" value="daily" />
            <el-option label="周线" value="weekly" />
            <el-option label="月线" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="start">立即同步</el-button>
        </el-form-item>
      </el-form>
      <el-progress :percentage="progress" :status="progress === 100 ? 'success' : undefined" :stroke-width="10" />
      <div class="status">{{ statusText }}</div>
      <el-alert class="mt" type="info" :closable="false" title="全市场首次同步耗时较长；自选模式读取本地 IndexedDB 自选列表。" />
    </el-card>

    <el-card class="aq-card">
      <template #header>定时同步</template>
      <el-form :inline="true">
        <el-form-item label="开启">
          <el-switch v-model="schedEnabled" @change="saveSched" />
        </el-form-item>
        <el-form-item label="每日时间">
          <el-time-select
            v-model="schedTime"
            start="09:00"
            step="00:30"
            end="23:30"
            placeholder="选择时间"
            @change="saveSched"
          />
        </el-form-item>
        <el-form-item label="定时模式">
          <el-radio-group v-model="schedMode" @change="saveSched">
            <el-radio-button label="custom">自定义</el-radio-button>
            <el-radio-button label="all">全市场</el-radio-button>
            <el-radio-button label="watch">自选池</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="定时增量天数">
          <el-input-number v-model="schedDays" :min="1" :max="3650" @change="saveSched" />
        </el-form-item>
        <el-form-item label="说明">
          <span class="hint">浏览器需保持打开；到点按定时模式与定时增量天数提交任务。</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { getSyncStatus, postSync } from "../api/client";
import { getSetting, listWatchlist, setSetting } from "../db/idb";

const symbols = ref("000001,600519");
const days = ref(365);
const period = ref("daily");
const syncMode = ref<"custom" | "all" | "watch">("custom");
const progress = ref(0);
const statusText = ref("未开始");
let timer: number | null = null;

const schedEnabled = ref(false);
const schedTime = ref("15:30");
const schedMode = ref<"custom" | "all" | "watch">("all");
const schedDays = ref(365);
let schedTimer: number | null = null;
let lastSchedDay = "";

async function loadSched() {
  const row = await getSetting<{ enabled?: boolean; hhmm?: string; lastYmd?: string; mode?: "custom" | "all" | "watch"; days?: number }>("syncSchedule");
  if (row) {
    schedEnabled.value = !!row.enabled;
    if (row.hhmm) schedTime.value = row.hhmm;
    if (row.mode) schedMode.value = row.mode;
    if (typeof row.days === "number" && row.days > 0) schedDays.value = row.days;
    lastSchedDay = row.lastYmd ?? "";
  }
}

async function saveSched() {
  await setSetting("syncSchedule", {
    enabled: schedEnabled.value,
    hhmm: schedTime.value,
    mode: schedMode.value,
    days: schedDays.value,
    lastYmd: lastSchedDay
  });
  ElMessage.success("定时设置已保存");
}

async function buildPayload(mode = syncMode.value, incrDays = days.value): Promise<Record<string, unknown> | null> {
  const payload: Record<string, unknown> = {
    incremental_days: incrDays,
    period: period.value
  };
  if (mode === "all") {
    payload.all_listed = true;
  } else if (mode === "watch") {
    const wl = await listWatchlist();
    const list = wl.map((w) => w.symbol);
    if (!list.length) {
      ElMessage.warning("自选为空，请先在选股结果中加自选");
      return null;
    }
    payload.symbols = list;
  } else {
    const list = symbols.value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!list.length) {
      ElMessage.warning("请输入至少一个股票代码");
      return null;
    }
    payload.symbols = list;
  }
  return payload;
}

async function start() {
  const payload = await buildPayload();
  if (!payload) return;
  try {
    const res = (await postSync(payload)) as { task_id?: string };
    const taskId = res.task_id;
    if (!taskId) {
      ElMessage.error("未返回任务 ID");
      return;
    }
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

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function tickSched() {
  if (!schedEnabled.value) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const cur = `${hh}:${mm}`;
  const ymd = todayYmd();
  if (cur === schedTime.value && lastSchedDay !== ymd) {
    lastSchedDay = ymd;
    await setSetting("syncSchedule", {
      enabled: schedEnabled.value,
      hhmm: schedTime.value,
      mode: schedMode.value,
      days: schedDays.value,
      lastYmd: lastSchedDay
    });
    const payload = await buildPayload(schedMode.value, schedDays.value);
    if (!payload) return;
    try {
      const res = (await postSync(payload)) as { task_id?: string };
      const taskId = res.task_id;
      if (!taskId) return;
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
    } catch {
      /* ignore in scheduler */
    }
    ElMessage.success("定时同步已触发");
  }
}

onMounted(() => {
  loadSched();
  schedTimer = window.setInterval(tickSched, 15_000);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  if (schedTimer) window.clearInterval(schedTimer);
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-row {
  row-gap: 8px;
}
.status {
  margin-top: 10px;
  font-size: 13px;
  color: #64748b;
}
.mt {
  margin-top: 12px;
}
.hint {
  color: #64748b;
  font-size: 13px;
}
</style>
