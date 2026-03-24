<template>
  <el-container class="layout">
    <el-aside width="220px">
      <div class="brand">AI 量化交易</div>
      <el-menu router :default-active="$route.path">
        <el-menu-item index="/"><el-icon><Odometer /></el-icon>数据看板</el-menu-item>
        <el-menu-item index="/strategies"><el-icon><Setting /></el-icon>策略管理</el-menu-item>
        <el-menu-item index="/watch"><el-icon><Bell /></el-icon>实时监听</el-menu-item>
        <el-menu-item index="/sync"><el-icon><Refresh /></el-icon>数据同步</el-menu-item>
        <el-menu-item index="/backtest"><el-icon><TrendCharts /></el-icon>策略回测</el-menu-item>
        <el-menu-item index="/paper"><el-icon><Wallet /></el-icon>模拟交易</el-menu-item>
        <el-menu-item index="/signals"><el-icon><Document /></el-icon>信号日志</el-menu-item>
        <el-menu-item index="/chart"><el-icon><DataLine /></el-icon>K线分析</el-menu-item>
      </el-menu>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { Bell, DataLine, Document, Odometer, Refresh, Setting, TrendCharts, Wallet } from "@element-plus/icons-vue";
</script>

<style scoped>
.layout {
  height: 100%;
}
.brand {
  padding: 16px;
  font-size: 16px;
  font-weight: 700;
}
</style>
