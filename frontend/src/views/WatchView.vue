<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">盘中实时监听</h2>
      <p class="aq-subtitle">WebSocket 行情 + 本地K线缓存 + 已启用策略引擎 + 价格预警</p>
    </div>

    <el-card class="aq-card panel">
      <el-form :inline="true">
        <el-form-item label="监听标的">
          <el-select-v2
            v-model="selectedSymbols"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择监听股票"
            :options="stockSelectOptions"
            style="width: 420px"
          />
        </el-form-item>
        <el-form-item>
          <el-button size="small" @click="selectAllSymbols">全选</el-button>
          <el-button size="small" @click="clearSymbols">清空</el-button>
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
        <el-form-item label="监听策略">
          <el-select
            v-model="monitoredStrategyIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            clearable
            placeholder="为空=监听全部已启用策略"
            style="width: 320px"
          >
            <el-option v-for="s in strategyDocsRef" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="connect">连接</el-button>
          <el-button @click="disconnect">断开</el-button>
          <el-button @click="openStrategyCenter">策略维护</el-button>
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

    <el-card class="aq-card">
      <template #header>今日策略触发排行榜（Top 10）</template>
      <el-table :data="strategyTop" size="small" max-height="260" stripe>
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="strategy" label="策略" min-width="180" />
        <el-table-column prop="count" label="触发次数" width="120" />
      </el-table>
    </el-card>

    <el-dialog v-model="strategyDlgVisible" title="监听策略维护" width="760px" destroy-on-close>
      <el-space style="margin-bottom: 10px">
        <el-button type="primary" @click="openStrategyEditor()">新建监听策略</el-button>
        <el-button @click="reloadStrategies">刷新列表</el-button>
      </el-space>
      <el-table :data="strategyDocsRef" size="small" max-height="320" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="kind" label="类型" width="90" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="toggleStrategy(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button type="primary" text @click="openStrategyEditor(row)">编辑</el-button>
            <el-button type="danger" text @click="removeStrategy(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="editorVisible" :title="editorId ? '编辑监听策略' : '新建监听策略'" width="640px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="editorName" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editorKind" style="width: 100%">
            <el-option label="白话文" value="nl" />
            <el-option label="指标" value="indicator" />
          </el-select>
        </el-form-item>
        <el-form-item :label="editorKind === 'nl' ? '白话文策略' : '备注（可选）'">
          <el-input v-model="editorExpr" type="textarea" :rows="2" placeholder="例如：5天内有涨停 且 放量1.5倍" />
        </el-form-item>
        <el-form-item v-if="editorKind === 'indicator'" label="条件模板">
          <el-select v-model="indicatorPreset" style="width: 100%" @change="applyIndicatorPreset">
            <el-option label="MACD 金叉" value="macd_golden" />
            <el-option label="MACD 死叉" value="macd_death" />
            <el-option label="收盘站上 MA20" value="price_above_ma20" />
            <el-option label="RSI14 小于 30" value="rsi14_lt_30" />
            <el-option label="放量 1.5 倍" value="vol_ratio_1_5" />
            <el-option label="5天内有涨停" value="limit_up_5" />
            <el-option label="近20日不破 MA5" value="ma5_not_below_20" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editorKind === 'indicator'" label="参数（可选）">
          <el-input v-model="presetParam" placeholder="例如 MA 天数=30 或 放量倍数=2.0；不填用默认" />
        </el-form-item>
        <el-form-item v-if="editorKind === 'indicator'">
          <el-switch v-model="showAdvancedDsl" active-text="高级模式：编辑 DSL JSON" />
        </el-form-item>
        <el-form-item v-if="editorKind === 'indicator' && showAdvancedDsl" label="DSL（JSON）">
          <el-input v-model="editorDslJson" type="textarea" :rows="10" />
        </el-form-item>
        <el-alert
          v-if="editorKind === 'indicator'"
          type="info"
          :closable="false"
          title="推荐直接选模板即可，无需手写 JSON；只有高级场景才打开 DSL。"
        />
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStrategyEditor">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { getHistorical, getStockList } from "../api/client";
import {
  deleteStrategyDoc,
  executePaperTrade,
  getPaperFeeRate,
  listAlerts,
  listSignals,
  listStrategyDocs,
  saveSignal,
  saveStrategyDoc,
  type AlertRecord,
  type SignalRecord
} from "../db/idb";
import { useSettingsStore } from "../stores/settings";
import type { Bar } from "../utils/indicators";
import { evaluateStrategyDoc } from "../utils/strategyEngine";
import { STRATEGY_SCHEMA_VERSION, type StrategyDoc, type StrategyDSL } from "../utils/strategyTypes";

type QuoteRow = { code: string; name: string; price: number; changePct: number };

const settings = useSettingsStore();
const { autoTrade: storeAuto } = storeToRefs(settings);

const selectedSymbols = ref<string[]>(["000001", "600519"]);
const stockOptions = ref<Array<{ value: string; label: string; name: string }>>([]);
const stockSelectOptions = computed(() => stockOptions.value);
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
const strategyDocsRef = ref<StrategyDoc[]>([]);
let alertRows: AlertRecord[] = [];
const sigStats = ref({ day: "", total: 0, buy: 0, sell: 0, alert: 0 });
const monitoredStrategyIds = ref<string[]>([]);
const strategyHitCounter = ref<Record<string, number>>({});
const strategyTop = computed(() =>
  Object.entries(strategyHitCounter.value)
    .map(([strategy, count]) => ({ strategy, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
);

const strategyDlgVisible = ref(false);
const editorVisible = ref(false);
const editorId = ref<string | null>(null);
const editorName = ref("");
const editorKind = ref<"nl" | "indicator">("nl");
const editorExpr = ref("");
const editorDslJson = ref("");
const indicatorPreset = ref("macd_golden");
const presetParam = ref("");
const showAdvancedDsl = ref(false);

function uid(): string {
  return `stg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultDsl(): StrategyDSL {
  return {
    version: STRATEGY_SCHEMA_VERSION,
    logic: "and",
    conditions: [{ type: "macd_cross", direction: "golden" }],
    exit: { logic: "and", conditions: [{ type: "macd_cross", direction: "death" }] }
  };
}

async function reloadStrategies() {
  strategyDocs = await listStrategyDocs();
  strategyDocsRef.value = strategyDocs.slice();
}

async function loadStockOptions() {
  try {
    const rows = (await getStockList()) as Array<{ symbol: string; name: string }>;
    stockOptions.value = rows
      .map((r) => {
        const symbol = String(r.symbol).padStart(6, "0");
        const name = String(r.name ?? "");
        return { value: symbol, label: `${name || "未知名称"} (${symbol})`, name };
      })
      .filter((r) => /^\d{6}$/.test(r.value));
  } catch {
    stockOptions.value = [];
  }
}

function selectAllSymbols() {
  if (!stockOptions.value.length) {
    ElMessage.warning("股票列表尚未加载完成");
    return;
  }
  selectedSymbols.value = stockOptions.value.map((s) => s.value);
}

function clearSymbols() {
  selectedSymbols.value = [];
}

function openStrategyCenter() {
  strategyDlgVisible.value = true;
  void reloadStrategies();
}

function openStrategyEditor(row?: StrategyDoc) {
  editorId.value = row?.id ?? null;
  editorName.value = row?.name ?? "新监听策略";
  editorKind.value = (row?.kind === "indicator" ? "indicator" : "nl");
  editorExpr.value = row?.exprText ?? "";
  editorDslJson.value = row?.dsl ? JSON.stringify(row.dsl, null, 2) : JSON.stringify(defaultDsl(), null, 2);
  showAdvancedDsl.value = false;
  indicatorPreset.value = "macd_golden";
  presetParam.value = "";
  editorVisible.value = true;
}

function applyIndicatorPreset() {
  const p = indicatorPreset.value;
  const param = presetParam.value.trim();
  if (p === "macd_golden") {
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "macd_cross", direction: "golden" }] }, null, 2);
    return;
  }
  if (p === "macd_death") {
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "macd_cross", direction: "death" }] }, null, 2);
    return;
  }
  if (p === "price_above_ma20") {
    const n = Number(param) || 20;
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "price_ma", period: n, op: "above" }] }, null, 2);
    return;
  }
  if (p === "rsi14_lt_30") {
    const v = Number(param) || 30;
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "rsi", period: 14, op: "lt", value: v }] }, null, 2);
    return;
  }
  if (p === "vol_ratio_1_5") {
    const r = Number(param) || 1.5;
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "vol_ratio", period: 5, minRatio: r }] }, null, 2);
    return;
  }
  if (p === "limit_up_5") {
    const d = Number(param) || 5;
    editorDslJson.value = JSON.stringify({ version: 1, logic: "and", conditions: [{ type: "limit_up_within", lookback: d, thresholdPct: 9.8 }] }, null, 2);
    return;
  }
  if (p === "ma5_not_below_20") {
    const d = Number(param) || 20;
    editorDslJson.value = JSON.stringify(
      { version: 1, logic: "and", conditions: [{ type: "ma_not_below", maPeriod: 5, lookback: d, useClose: true }] },
      null,
      2
    );
  }
}

async function saveStrategyEditor() {
  let dsl: StrategyDSL | undefined = undefined;
  if (editorKind.value === "indicator") {
    if (!showAdvancedDsl.value) applyIndicatorPreset();
    try {
      dsl = JSON.parse(editorDslJson.value) as StrategyDSL;
    } catch {
      ElMessage.error("DSL JSON 格式错误");
      return;
    }
  }
  if (!editorName.value.trim()) {
    ElMessage.warning("请填写策略名称");
    return;
  }
  if (editorKind.value === "nl" && !editorExpr.value.trim()) {
    ElMessage.warning("请填写白话文策略");
    return;
  }
  const now = Date.now();
  const old = editorId.value ? strategyDocsRef.value.find((x) => x.id === editorId.value) : undefined;
  const doc: StrategyDoc = {
    id: editorId.value ?? uid(),
    name: editorName.value.trim(),
    kind: editorKind.value,
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl,
    exprText: editorExpr.value.trim() || undefined,
    createdAt: old?.createdAt ?? now,
    updatedAt: now
  };
  await saveStrategyDoc(doc);
  editorVisible.value = false;
  await reloadStrategies();
  ElMessage.success("策略已保存");
}

async function toggleStrategy(row: StrategyDoc) {
  await saveStrategyDoc({ ...row, updatedAt: Date.now() });
}

async function removeStrategy(id: string) {
  await ElMessageBox.confirm("确定删除该策略？", "确认", { type: "warning" });
  await deleteStrategyDoc(id);
  monitoredStrategyIds.value = monitoredStrategyIds.value.filter((x) => x !== id);
  await reloadStrategies();
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tsToYmd(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function initSigStatsFromLocal(): Promise<void> {
  try {
    const rows = await listSignals(5000);
    const ymd = todayYmd();
    const today = rows.filter((r) => tsToYmd(r.time) === ymd);
    sigStats.value = {
      day: ymd,
      total: today.length,
      buy: today.filter((s) => s.signalType === "buy").length,
      sell: today.filter((s) => s.signalType === "sell").length,
      alert: today.filter((s) => s.signalType === "alert").length
    };
    strategyHitCounter.value = today.reduce((acc, s) => {
      acc[s.strategy] = (acc[s.strategy] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  } catch {
    // ignore
  }
}

function getSymbols(): Set<string> {
  return new Set(selectedSymbols.value.map((s) => s.padStart(6, "0")));
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
  if (sigStats.value.day !== ymd) {
    sigStats.value = { day: ymd, total: 0, buy: 0, sell: 0, alert: 0 };
    strategyHitCounter.value = {};
  }
  sigStats.value.total += 1;
  if (sig.signalType === "buy") sigStats.value.buy += 1;
  else if (sig.signalType === "sell") sigStats.value.sell += 1;
  else sigStats.value.alert += 1;
  strategyHitCounter.value = {
    ...strategyHitCounter.value,
    [sig.strategy]: (strategyHitCounter.value[sig.strategy] ?? 0) + 1
  };

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
  const selected = monitoredStrategyIds.value.length
    ? enabled.filter((s) => monitoredStrategyIds.value.includes(s.id))
    : enabled;
  if (!selected.length) return;
  const evalMap = new Map<string, { buy: boolean; sell: boolean }>();
  for (const doc of selected) evalMap.set(doc.id, evaluateStrategyDoc(doc, bars, i, resolveStrategy));

  const comboBuyCovered = new Set<string>();
  const comboSellCovered = new Set<string>();
  for (const doc of selected) {
    if (doc.kind !== "combo") continue;
    const r = evalMap.get(doc.id);
    if (!r) continue;
    const children = comboChildIds(doc);
    if (r.buy) children.forEach((id) => comboBuyCovered.add(id));
    if (r.sell) children.forEach((id) => comboSellCovered.add(id));
  }

  for (const doc of selected) {
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
  await reloadStrategies();
  if (!stockOptions.value.length) await loadStockOptions();
  alertRows = await listAlerts();
  const symbols = getSymbols();
  if (!symbols.size) {
    ElMessage.warning("请先选择至少一只监听股票");
    return;
  }
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

onMounted(() => {
  void initSigStatsFromLocal();
  void loadStockOptions();
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
