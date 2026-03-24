<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">模拟交易</h2>
      <p class="aq-subtitle">本地撮合、手续费可配、支持重置与导出成交 CSV</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
        <el-form-item label="佣金费率">
          <el-input-number v-model="feeRate" :precision="4" :step="0.0001" :min="0" :max="0.01" @change="saveFee" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" @click="resetAccount">重置账户（清仓+资金回初始）</el-button>
        </el-form-item>
        <el-form-item>
          <el-button @click="exportTrades">导出成交 CSV</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="12">
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">初始资金</div><div class="v">{{ account.initCash.toFixed(2) }}</div></el-card></el-col>
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">可用资金</div><div class="v">{{ account.cash.toFixed(2) }}</div></el-card></el-col>
      <el-col :span="8"><el-card class="aq-card metric"><div class="k">持仓市值</div><div class="v">{{ marketValue.toFixed(2) }}</div></el-card></el-col>
    </el-row>

    <el-card class="aq-card mt">
      <template #header>当前持仓</template>
      <el-table :data="positions" size="small" max-height="320" stripe>
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

    <el-card class="aq-card mt">
      <template #header>交易记录</template>
      <el-table :data="trades" size="small" max-height="360" stripe>
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
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, ref } from "vue";
import {
  getPaperAccount,
  getPaperFeeRate,
  listPositions,
  listTrades,
  resetPaperToInit,
  setSetting,
  type PaperAccount,
  type PositionRecord,
  type TradeRecord
} from "../db/idb";
import { downloadCsv } from "../utils/csv";

const account = ref<PaperAccount>({ cash: 0, initCash: 0, updatedAt: 0 });
const positions = ref<PositionRecord[]>([]);
const trades = ref<TradeRecord[]>([]);
const feeRate = ref(0.0003);

const marketValue = computed(() => positions.value.reduce((s, p) => s + p.marketPrice * p.quantity, 0));

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

async function load() {
  account.value = await getPaperAccount();
  positions.value = await listPositions();
  trades.value = await listTrades();
  feeRate.value = await getPaperFeeRate();
}

async function saveFee() {
  await setSetting("paperSettings", { feeRate: feeRate.value });
  ElMessage.success("费率已保存，后续下单生效");
}

async function resetAccount() {
  await ElMessageBox.confirm("将清空持仓并把可用资金恢复为初始资金，成交历史保留。确定？", "重置账户", { type: "warning" });
  await resetPaperToInit();
  await load();
  ElMessage.success("已重置");
}

function exportTrades() {
  downloadCsv(
    `trades_${Date.now()}.csv`,
    ["time", "symbol", "side", "price", "quantity", "amount", "fee", "strategy"],
    trades.value.map((t) => [
      new Date(t.time).toISOString(),
      t.symbol,
      t.side,
      t.price,
      t.quantity,
      t.amount,
      t.fee,
      t.strategy ?? ""
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
.metric .k {
  font-size: 13px;
  color: #64748b;
}
.metric .v {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}
.mt {
  margin-top: 4px;
}
</style>
