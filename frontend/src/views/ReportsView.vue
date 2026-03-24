<template>
  <div class="page">
    <div>
      <h2 class="aq-title">报告与导出中心</h2>
      <p class="aq-subtitle">统一入口：跳转到各模块生成 CSV / HTML / PDF / 图片，数据均在本地浏览器</p>
    </div>

    <el-row :gutter="12">
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>绩效与图表</template>
          <el-space direction="vertical" alignment="start" :size="12">
            <el-button type="primary" @click="router.push('/')">数据看板（权益图可导出 PNG）</el-button>
            <el-button @click="router.push('/backtest')">策略回测（CSV / HTML / PDF）</el-button>
          </el-space>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>数据与校验</template>
          <el-space direction="vertical" alignment="start" :size="12">
            <el-button @click="router.push('/signals')">信号日志（导出 CSV）</el-button>
            <el-button @click="router.push('/paper')">模拟成交（导出 CSV）</el-button>
            <el-button @click="router.push('/indicator-lab')">指标快照与通达信对照校验</el-button>
            <el-button @click="router.push('/strategies')">策略备份（JSON 全量导出/导入）</el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>

    <el-alert type="info" :closable="false" title="说明：本页不存储文件，仅提供导航；导出文件由浏览器下载到本机。" />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
