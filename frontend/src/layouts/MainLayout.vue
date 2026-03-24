<template>
  <el-container class="layout">
    <el-aside width="230px" class="side">
      <div class="brand">
        <div class="brand-title">AI 量化交易</div>
        <div class="brand-sub">Frontend First</div>
      </div>
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
    <el-main class="main">
      <div class="main-wrap">
        <router-view />
      </div>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { Bell, DataLine, Document, Odometer, Refresh, Setting, TrendCharts, Wallet } from "@element-plus/icons-vue";
</script>

<style scoped>
.layout {
  height: 100%;
  background: linear-gradient(160deg, #f8fbff 0%, #f5f7ff 45%, #f7fafd 100%);
}

.side {
  border-right: 1px solid #eef2ff;
  background: #ffffff;
}
.brand {
  padding: 18px 16px;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.brand-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.main {
  padding: 16px;
}

.main-wrap {
  min-height: calc(100% - 4px);
  background: #fff;
  border: 1px solid #eef2ff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.04);
}
</style>
