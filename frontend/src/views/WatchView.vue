<template>
  <el-page-header content="盘中实时监听（信号+模拟下单）" />
  <el-card style="margin-top: 12px">
    <el-form inline>
      <el-form-item label="监听代码">
        <el-input v-model="symbolsInput" placeholder="000001,600519" style="width: 260px" />
      </el-form-item>
      <el-form-item label="涨幅触发(%)">
        <el-input-number v-model="upThreshold" :step="0.1" />
      </el-form-item>
      <el-form-item label="跌幅触发(%)">
        <el-input-number v-model="downThreshold" :step="0.1" />
      </el-form-item>
      <el-form-item>
        <el-switch v-model="autoTrade" active-text="自动模拟下单" />
      </el-form-item>
      <el-button type="primary" @click="connect">连接</el-button>
      <el-button @click="disconnect">断开</el-button>
    </el-form>
    <div style="margin-top: 10px">连接状态：{{ connected ? "已连接" : "未连接" }}</div>
  </el-card>

  <el-card style="margin-top: 12px">
    <template #header>实时行情</template>
    <el-table :data="rows" size="small" max-height="360">
      <el-table-column prop="code" label="代码" width="100" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="price" label="最新价" width="110" />
      <el-table-column prop="changePct" label="涨跌幅%" width="110" />
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button type="success" size="small" @click="manualTrade(row, 'buy')">买入100</el-button>
          <el-button type="danger" size="small" @click="manualTrade(row, 'sell')">卖出100</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onBeforeUnmount, ref } from "vue";
import { executePaperTrade, saveSignal, type SignalRecord } from "../db/idb";

type QuoteRow = {
  code: string;
  name: string;
  price: number;
  changePct: number;
};

const symbolsInput = ref("000001,600519");
const upThreshold = ref(2);
const downThreshold = ref(-2);
const autoTrade = ref(false);
const connected = ref(false);
const rows = ref<QuoteRow[]>([]);
let ws: WebSocket | null = null;
const signalCooldown = new Map<string, number>();

function getSymbols(): Set<string> {
  return new Set(
    symbolsInput.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.padStart(6, "0"))
  );
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function onSignal(sig: Omit<SignalRecord, "id" | "time">) {
  const cooldownKey = `${sig.symbol}_${sig.signalType}`;
  const now = Date.now();
  const last = signalCooldown.get(cooldownKey) ?? 0;
  if (now - last < 60_000) {
    return;
  }
  signalCooldown.set(cooldownKey, now);

  const saved = await saveSignal(sig);
  ElMessage.warning(`${sig.symbol} ${sig.signalType.toUpperCase()} 信号`);
  if (autoTrade.value && (sig.signalType === "buy" || sig.signalType === "sell")) {
    try {
      await executePaperTrade({
        symbol: sig.symbol,
        side: sig.signalType,
        price: sig.price,
        quantity: 100,
        strategy: sig.strategy,
        signalId: saved.id
      });
      ElMessage.success(`${sig.symbol} 已自动${sig.signalType === "buy" ? "买入" : "卖出"}100股`);
    } catch (e) {
      ElMessage.error((e as Error).message);
    }
  }
}

function parseRows(dataRows: unknown[], symbols: Set<string>): QuoteRow[] {
  const parsed: QuoteRow[] = [];
  for (const item of dataRows) {
    const row = item as Record<string, unknown>;
    const code = String(row["代码"] ?? row["code"] ?? "").padStart(6, "0");
    if (!code || !symbols.has(code)) continue;
    parsed.push({
      code,
      name: String(row["名称"] ?? row["name"] ?? ""),
      price: safeNumber(row["最新价"] ?? row["price"]),
      changePct: safeNumber(row["涨跌幅"] ?? row["changePct"])
    });
  }
  return parsed;
}

async function evaluateSignals(list: QuoteRow[]) {
  for (const q of list) {
    if (q.changePct >= upThreshold.value) {
      await onSignal({
        symbol: q.code,
        name: q.name,
        strategy: "pct_breakout",
        signalType: "buy",
        price: q.price,
        changePct: q.changePct,
        note: `涨幅达到 ${q.changePct.toFixed(2)}%`
      });
    } else if (q.changePct <= downThreshold.value) {
      await onSignal({
        symbol: q.code,
        name: q.name,
        strategy: "pct_breakout",
        signalType: "sell",
        price: q.price,
        changePct: q.changePct,
        note: `跌幅达到 ${q.changePct.toFixed(2)}%`
      });
    }
  }
}

function connect() {
  if (ws) ws.close();
  const symbols = getSymbols();
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/realtime`);
  ws.onopen = () => {
    connected.value = true;
    ElMessage.success("实时连接已建立");
  };
  ws.onclose = () => {
    connected.value = false;
  };
  ws.onerror = () => {
    ElMessage.error("实时连接异常");
  };
  ws.onmessage = async (evt) => {
    try {
      const payload = JSON.parse(String(evt.data)) as { rows?: unknown[] };
      const nextRows = parseRows(payload.rows ?? [], symbols);
      rows.value = nextRows;
      await evaluateSignals(nextRows);
    } catch {
      // ignore malformed message
    }
  };
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected.value = false;
}

async function manualTrade(row: QuoteRow, side: "buy" | "sell") {
  try {
    await executePaperTrade({
      symbol: row.code,
      side,
      price: row.price,
      quantity: 100,
      strategy: "manual_watch"
    });
    ElMessage.success(`${row.code} ${side === "buy" ? "买入" : "卖出"}成功`);
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

onBeforeUnmount(() => {
  disconnect();
});
</script>
