<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">盘中实时监听</h2>
      <p class="aq-subtitle">WebSocket 行情 + 本地K线缓存 + 已启用策略引擎 + 价格预警</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
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
        <el-form-item>
          <el-switch v-model="useStrategies" active-text="启用策略信号" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="connect">连接</el-button>
          <el-button @click="disconnect">断开</el-button>
        </el-form-item>
      </el-form>
      <div class="status">连接状态：<b>{{ connected ? "已连接" : "未连接" }}</b> · 已缓存K线：{{ barCache.size }} 只</div>
      <div class="status">今日信号：{{ sigStats.total }}（买 {{ sigStats.buy }} / 卖 {{ sigStats.sell }} / 预警 {{ sigStats.alert }}）</div>
    </el-card>

    <el-card class="aq-card">
      <template #header>实时行情</template>
      <el-table :data="rows" size="small" max-height="380" stripe>
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
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { onBeforeUnmount, ref } from "vue";
import { getHistorical } from "../api/client";
import { executePaperTrade, getPaperFeeRate, listAlerts, listStrategyDocs, saveSignal, type AlertRecord, type SignalRecord } from "../db/idb";
import { useSettingsStore } from "../stores/settings";
import type { Bar } from "../utils/indicators";
import { evaluateStrategyDoc } from "../utils/strategyEngine";
import type { StrategyDoc } from "../utils/strategyTypes";

type QuoteRow = { code: string; name: string; price: number; changePct: number };

const settings = useSettingsStore();
const { autoTrade: storeAuto } = storeToRefs(settings);

const symbolsInput = ref("000001,600519");
const upThreshold = ref(2);
const downThreshold = ref(-2);
const autoTrade = storeAuto;
const useStrategies = ref(true);
const connected = ref(false);
const rows = ref<QuoteRow[]>([]);
let ws: WebSocket | null = null;
const signalCooldown = new Map<string, number>();

const barCache = new Map<string, Bar[]>();
let strategyDocs: StrategyDoc[] = [];
let alertRows: AlertRecord[] = [];
const sigStats = ref({ day: "", total: 0, buy: 0, sell: 0, alert: 0 });

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function resolveStrategy(id: string): StrategyDoc | undefined {
  return strategyDocs.find((s) => s.id === id);
}

function comboChildIds(doc: StrategyDoc): string[] {
  if (doc.kind !== "combo" || !doc.combo) return [];
  if (doc.combo.strategyRefs?.length) return doc.combo.strategyRefs.map((x) => x.id);
  return doc.combo.strategyIds ?? [];
}

function barsWithTick(base: Bar[], price: number): Bar[] {
  if (!base.length) return base;
  const last = base[base.length - 1];
  const next: Bar = {
    ...last,
    close: price,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price)
  };
  return [...base.slice(0, -1), next];
}

async function prefetchBars(symbols: Set<string>) {
  barCache.clear();
  for (const sym of symbols) {
    try {
      const raw = (await getHistorical({ symbol: sym, period: "daily" })) as Array<Record<string, unknown>>;
      const bars: Bar[] = raw.map((r) => ({
        date: String(r.date ?? ""),
        open: Number(r.open ?? 0),
        high: Number(r.high ?? 0),
        low: Number(r.low ?? 0),
        close: Number(r.close ?? 0),
        volume: Number(r.volume ?? 0)
      }));
      if (bars.length) barCache.set(sym, bars);
    } catch {
      /* skip */
    }
  }
}

async function onSignal(sig: Omit<SignalRecord, "id" | "time">) {
  const cooldownKey = `${sig.symbol}_${sig.signalType}_${sig.strategy}`;
  const now = Date.now();
  const last = signalCooldown.get(cooldownKey) ?? 0;
  if (now - last < 60_000) return;
  signalCooldown.set(cooldownKey, now);
  const ymd = todayYmd();
  if (sigStats.value.day !== ymd) sigStats.value = { day: ymd, total: 0, buy: 0, sell: 0, alert: 0 };
  sigStats.value.total += 1;
  if (sig.signalType === "buy") sigStats.value.buy += 1;
  else if (sig.signalType === "sell") sigStats.value.sell += 1;
  else sigStats.value.alert += 1;

  const saved = await saveSignal(sig);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("量化信号", { body: `${sig.symbol} ${sig.signalType} ${sig.note ?? ""}` });
  }
  if (!settings.muteSound) {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = sig.signalType === "buy" ? 880 : 440;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => o.stop(), 120);
    } catch {
      /* ignore */
    }
  }
  ElMessage.warning(`${sig.symbol} ${sig.signalType.toUpperCase()} · ${sig.strategy}`);
  if (autoTrade.value && (sig.signalType === "buy" || sig.signalType === "sell")) {
    try {
      const fee = await getPaperFeeRate();
      await executePaperTrade({
        symbol: sig.symbol,
        side: sig.signalType,
        price: sig.price,
        quantity: 100,
        strategy: sig.strategy,
        signalId: saved.id,
        feeRate: fee
      });
      ElMessage.success(`已自动${sig.signalType === "buy" ? "买入" : "卖出"}100股`);
    } catch (e) {
      ElMessage.error((e as Error).message);
    }
  }
}

async function checkAlerts(q: QuoteRow) {
  for (const a of alertRows) {
    if (!a.enabled || a.symbol.padStart(6, "0") !== q.code) continue;
    let hit = false;
    let note = "";
    if (a.kind === "price_above" && q.price >= a.value) {
      hit = true;
      note = `价格 ≥ ${a.value}`;
    }
    if (a.kind === "price_below" && q.price <= a.value) {
      hit = true;
      note = `价格 ≤ ${a.value}`;
    }
    if (a.kind === "pct_above" && q.changePct >= a.value) {
      hit = true;
      note = `涨幅 ≥ ${a.value}%`;
    }
    if (a.kind === "pct_below" && q.changePct <= a.value) {
      hit = true;
      note = `跌幅 ≤ ${a.value}%`;
    }
    if (hit) {
      await onSignal({
        symbol: q.code,
        name: q.name,
        strategy: `alert_${a.kind}`,
        signalType: "alert",
        price: q.price,
        changePct: q.changePct,
        note
      });
    }
  }
}

async function evalStrategiesForQuote(q: QuoteRow) {
  if (!useStrategies.value) return;
  const base = barCache.get(q.code);
  if (!base || base.length < 30) return;
  const bars = barsWithTick(base, q.price);
  const i = bars.length - 1;
  const enabled = strategyDocs.filter((s) => s.enabled);
  const evalMap = new Map<string, { buy: boolean; sell: boolean }>();
  for (const doc of enabled) evalMap.set(doc.id, evaluateStrategyDoc(doc, bars, i, resolveStrategy));

  const comboBuyCovered = new Set<string>();
  const comboSellCovered = new Set<string>();
  for (const doc of enabled) {
    if (doc.kind !== "combo") continue;
    const r = evalMap.get(doc.id);
    if (!r) continue;
    const children = comboChildIds(doc);
    if (r.buy) children.forEach((id) => comboBuyCovered.add(id));
    if (r.sell) children.forEach((id) => comboSellCovered.add(id));
  }

  for (const doc of enabled) {
    const r = evalMap.get(doc.id);
    if (!r) continue;
    if (r.buy) {
      if (!(doc.kind !== "combo" && comboBuyCovered.has(doc.id))) {
        await onSignal({
          symbol: q.code,
          name: q.name,
          strategy: doc.name,
          signalType: "buy",
          price: q.price,
          changePct: q.changePct,
          note: doc.kind === "combo" ? "组合买入信号（已去重子策略）" : "策略买入信号"
        });
      }
    }
    if (r.sell) {
      if (!(doc.kind !== "combo" && comboSellCovered.has(doc.id))) {
        await onSignal({
          symbol: q.code,
          name: q.name,
          strategy: doc.name,
          signalType: "sell",
          price: q.price,
          changePct: q.changePct,
          note: doc.kind === "combo" ? "组合卖出信号（已去重子策略）" : "策略卖出信号"
        });
      }
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

async function evaluatePctSignals(list: QuoteRow[]) {
  for (const q of list) {
    await checkAlerts(q);
    await evalStrategiesForQuote(q);
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

async function connect() {
  strategyDocs = await listStrategyDocs();
  alertRows = await listAlerts();
  const symbols = getSymbols();
  await prefetchBars(symbols);
  if (ws) ws.close();
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
      await evaluatePctSignals(nextRows);
    } catch {
      /* ignore */
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
    const fee = await getPaperFeeRate();
    await executePaperTrade({
      symbol: row.code,
      side,
      price: row.price,
      quantity: 100,
      strategy: "manual_watch",
      feeRate: fee
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

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status {
  font-size: 13px;
  color: #64748b;
}
</style>
