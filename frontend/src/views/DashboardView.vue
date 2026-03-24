<template>
  <el-page-header content="老板看板（本地交易数据实时聚合）" />
  <el-row :gutter="12" style="margin-top: 16px">
    <el-col :span="6"><el-card class="metric-card"><div class="k">账户权益</div><div class="v">{{ equity.toFixed(2) }}</div></el-card></el-col>
    <el-col :span="6"><el-card class="metric-card"><div class="k">累计收益</div><div class="v" :class="profit >= 0 ? 'up' : 'down'">{{ profit.toFixed(2) }}</div></el-card></el-col>
    <el-col :span="6"><el-card class="metric-card"><div class="k">收益率</div><div class="v" :class="profitRate >= 0 ? 'up' : 'down'">{{ (profitRate * 100).toFixed(2) }}%</div></el-card></el-col>
    <el-col :span="6"><el-card class="metric-card"><div class="k">胜率</div><div class="v">{{ (winRate * 100).toFixed(2) }}%</div></el-card></el-col>
  </el-row>

  <el-row :gutter="12" style="margin-top: 12px">
    <el-col :span="8"><el-card class="metric-card"><div class="k">总交易次数</div><div class="v">{{ trades.length }}</div></el-card></el-col>
    <el-col :span="8"><el-card class="metric-card"><div class="k">信号数</div><div class="v">{{ signals.length }}</div></el-card></el-col>
    <el-col :span="8"><el-card class="metric-card"><div class="k">持仓数</div><div class="v">{{ positions.length }}</div></el-card></el-col>
  </el-row>

  <el-row :gutter="12" style="margin-top: 12px">
    <el-col :span="12">
      <el-card>
        <template #header>最近交易</template>
        <el-table :data="trades.slice(0, 8)" size="small" max-height="280">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.time) }}</template>
          </el-table-column>
          <el-table-column prop="symbol" label="代码" width="90" />
          <el-table-column prop="side" label="方向" width="70" />
          <el-table-column prop="price" label="价格" width="90" />
          <el-table-column prop="quantity" label="数量" width="90" />
          <el-table-column prop="amount" label="成交额" />
        </el-table>
      </el-card>
    </el-col>
    <el-col :span="12">
      <el-card>
        <template #header>最近信号</template>
        <el-table :data="signals.slice(0, 8)" size="small" max-height="280">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.time) }}</template>
          </el-table-column>
          <el-table-column prop="symbol" label="代码" width="90" />
          <el-table-column prop="strategy" label="策略" width="130" />
          <el-table-column prop="signalType" label="信号" width="80" />
          <el-table-column prop="price" label="价格" />
        </el-table>
      </el-card>
    </el-col>
  </el-row>

  <el-alert
    style="margin-top: 12px"
    type="success"
    title="看板已接入本地模拟盘与信号数据，后续可无缝叠加净值曲线、收益分布、热力图"
    :closable="false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getPaperAccount, listPositions, listSignals, listTrades, type PaperAccount, type PositionRecord, type SignalRecord, type TradeRecord } from "../db/idb";

const account = ref<PaperAccount>({ cash: 0, initCash: 0, updatedAt: 0 });
const positions = ref<PositionRecord[]>([]);
const trades = ref<TradeRecord[]>([]);
const signals = ref<SignalRecord[]>([]);

const marketValue = computed(() => positions.value.reduce((sum, p) => sum + p.marketPrice * p.quantity, 0));
const equity = computed(() => account.value.cash + marketValue.value);
const profit = computed(() => equity.value - account.value.initCash);
const profitRate = computed(() => (account.value.initCash > 0 ? profit.value / account.value.initCash : 0));

const winRate = computed(() => {
  if (!trades.value.length) return 0;
  const sellTrades = trades.value.filter((t) => t.side === "sell");
  if (!sellTrades.length) return 0;
  let win = 0;
  for (const t of sellTrades) {
    const pos = positions.value.find((p) => p.symbol === t.symbol);
    const cost = pos?.avgCost ?? t.price;
    if (t.price > cost) win += 1;
  }
  return win / sellTrades.length;
});

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

async function load() {
  account.value = await getPaperAccount();
  positions.value = await listPositions();
  trades.value = await listTrades(200);
  signals.value = await listSignals(200);
}

onMounted(load);
</script>

<style scoped>
.metric-card .k {
  color: #64748b;
  font-size: 13px;
}
.metric-card .v {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}
.up {
  color: #16a34a !important;
}
.down {
  color: #dc2626 !important;
}
</style>
