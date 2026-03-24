<template>
  <el-page-header content="模拟交易账户" />
  <el-row :gutter="12" style="margin-top: 12px">
    <el-col :span="8"><el-card>初始资金：{{ account.initCash.toFixed(2) }}</el-card></el-col>
    <el-col :span="8"><el-card>可用资金：{{ account.cash.toFixed(2) }}</el-card></el-col>
    <el-col :span="8"><el-card>持仓市值：{{ marketValue.toFixed(2) }}</el-card></el-col>
  </el-row>

  <el-card style="margin-top: 12px">
    <template #header>当前持仓</template>
    <el-table :data="positions" size="small" max-height="320">
      <el-table-column prop="symbol" label="代码" width="120" />
      <el-table-column prop="quantity" label="数量" width="120" />
      <el-table-column prop="avgCost" label="成本" width="120" />
      <el-table-column prop="marketPrice" label="现价" width="120" />
      <el-table-column label="浮盈亏">
        <template #default="{ row }">
          {{ ((row.marketPrice - row.avgCost) * row.quantity).toFixed(2) }}
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-card style="margin-top: 12px">
    <template #header>交易记录</template>
    <el-table :data="trades" size="small" max-height="360">
      <el-table-column prop="time" label="时间" width="180">
        <template #default="{ row }">{{ fmtTime(row.time) }}</template>
      </el-table-column>
      <el-table-column prop="symbol" label="代码" width="100" />
      <el-table-column prop="side" label="方向" width="80" />
      <el-table-column prop="price" label="价格" width="100" />
      <el-table-column prop="quantity" label="数量" width="90" />
      <el-table-column prop="amount" label="成交额" width="120" />
      <el-table-column prop="fee" label="手续费" width="100" />
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getPaperAccount, listPositions, listTrades, type PaperAccount, type PositionRecord, type TradeRecord } from "../db/idb";

const account = ref<PaperAccount>({ cash: 0, initCash: 0, updatedAt: 0 });
const positions = ref<PositionRecord[]>([]);
const trades = ref<TradeRecord[]>([]);

const marketValue = computed(() => positions.value.reduce((s, p) => s + p.marketPrice * p.quantity, 0));

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

async function load() {
  account.value = await getPaperAccount();
  positions.value = await listPositions();
  trades.value = await listTrades();
}

onMounted(load);
</script>
