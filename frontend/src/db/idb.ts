import { openDB, type DBSchema } from "idb";
import type { StrategyDoc } from "../utils/strategyTypes";

export interface AlertRecord {
  id: string;
  kind: "price_above" | "price_below" | "pct_above" | "pct_below";
  symbol: string;
  value: number;
  enabled: boolean;
  createdAt: number;
}

interface QuantDB extends DBSchema {
  strategies: { key: string; value: StrategyDoc };
  signals: { key: string; value: SignalRecord; indexes: { "by-time": number; "by-symbol": string } };
  trades: { key: string; value: TradeRecord; indexes: { "by-time": number } };
  positions: { key: string; value: PositionRecord };
  syncSettings: { key: string; value: Record<string, unknown> };
  watchlist: { key: string; value: { symbol: string; name?: string; addedAt: number } };
  alerts: { key: string; value: AlertRecord };
}

export const dbPromise = openDB<QuantDB>("ai-quant-v1", 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore("strategies", { keyPath: "id" });
      const signals = db.createObjectStore("signals", { keyPath: "id" });
      signals.createIndex("by-time", "time");
      signals.createIndex("by-symbol", "symbol");
      const trades = db.createObjectStore("trades", { keyPath: "id" });
      trades.createIndex("by-time", "time");
      db.createObjectStore("positions", { keyPath: "symbol" });
      db.createObjectStore("syncSettings", { keyPath: "key" });
      db.createObjectStore("watchlist", { keyPath: "symbol" });
    }
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains("alerts")) {
        db.createObjectStore("alerts", { keyPath: "id" });
      }
    }
  }
});

export interface SignalRecord {
  id: string;
  time: number;
  symbol: string;
  name?: string;
  strategy: string;
  signalType: "buy" | "sell" | "alert";
  price: number;
  changePct?: number;
  note?: string;
}

export interface TradeRecord {
  id: string;
  time: number;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  amount: number;
  fee: number;
  strategy?: string;
  signalId?: string;
}

export interface PositionRecord {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  updatedAt: number;
}

export interface PaperAccount {
  cash: number;
  initCash: number;
  updatedAt: number;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getSetting<T extends Record<string, unknown>>(key: string): Promise<T | undefined> {
  const db = await dbPromise;
  const row = await db.get("syncSettings", key);
  return row as T | undefined;
}

export async function setSetting(key: string, value: Record<string, unknown>): Promise<void> {
  const db = await dbPromise;
  await db.put("syncSettings", { key, ...value });
}

export async function getPaperFeeRate(): Promise<number> {
  const row = await getSetting<{ feeRate?: number }>("paperSettings");
  const n = row?.feeRate;
  return typeof n === "number" && n >= 0 ? n : 0.0003;
}

export async function saveSignal(input: Omit<SignalRecord, "id" | "time">): Promise<SignalRecord> {
  const db = await dbPromise;
  const row: SignalRecord = { id: uid("sig"), time: Date.now(), ...input };
  await db.put("signals", row);
  return row;
}

export async function listSignals(limit = 200): Promise<SignalRecord[]> {
  const db = await dbPromise;
  const rows = await db.getAll("signals");
  return rows.sort((a, b) => b.time - a.time).slice(0, limit);
}

export async function getPaperAccount(): Promise<PaperAccount> {
  const db = await dbPromise;
  const row = (await db.get("syncSettings", "paperAccount")) as (PaperAccount & { key?: string }) | undefined;
  if (row && typeof row.cash === "number") {
    const { key: _k, ...acc } = row;
    return acc as PaperAccount;
  }
  const init: PaperAccount = { cash: 1_000_000, initCash: 1_000_000, updatedAt: Date.now() };
  await db.put("syncSettings", { key: "paperAccount", ...init });
  return init;
}

export async function savePaperAccount(next: PaperAccount): Promise<void> {
  const db = await dbPromise;
  await db.put("syncSettings", { key: "paperAccount", ...next });
}

export async function executePaperTrade(input: {
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  strategy?: string;
  signalId?: string;
  feeRate?: number;
}): Promise<{ trade: TradeRecord; account: PaperAccount; position?: PositionRecord }> {
  const db = await dbPromise;
  const feeRate = input.feeRate ?? (await getPaperFeeRate());
  const amount = input.price * input.quantity;
  const fee = amount * feeRate;
  const now = Date.now();

  const account = await getPaperAccount();
  const oldPos = await db.get("positions", input.symbol);
  let nextPos: PositionRecord | undefined = oldPos;

  if (input.side === "buy") {
    if (account.cash < amount + fee) {
      throw new Error("可用资金不足");
    }
    const oldQty = oldPos?.quantity ?? 0;
    const oldCost = oldPos?.avgCost ?? 0;
    const nextQty = oldQty + input.quantity;
    const nextAvg = nextQty > 0 ? (oldQty * oldCost + amount) / nextQty : 0;
    nextPos = {
      symbol: input.symbol,
      quantity: nextQty,
      avgCost: nextAvg,
      marketPrice: input.price,
      updatedAt: now
    };
    account.cash = account.cash - amount - fee;
  } else {
    const oldQty = oldPos?.quantity ?? 0;
    if (oldQty < input.quantity) {
      throw new Error("持仓不足");
    }
    const remain = oldQty - input.quantity;
    if (remain === 0) {
      nextPos = undefined;
      await db.delete("positions", input.symbol);
    } else {
      nextPos = {
        symbol: input.symbol,
        quantity: remain,
        avgCost: oldPos?.avgCost ?? input.price,
        marketPrice: input.price,
        updatedAt: now
      };
    }
    account.cash = account.cash + amount - fee;
  }
  account.updatedAt = now;

  if (nextPos) {
    await db.put("positions", nextPos);
  }
  await savePaperAccount(account);

  const trade: TradeRecord = {
    id: uid("trd"),
    time: now,
    symbol: input.symbol,
    side: input.side,
    price: input.price,
    quantity: input.quantity,
    amount,
    fee,
    strategy: input.strategy,
    signalId: input.signalId
  };
  await db.put("trades", trade);

  return { trade, account, position: nextPos };
}

export async function listTrades(limit = 300): Promise<TradeRecord[]> {
  const db = await dbPromise;
  const rows = await db.getAll("trades");
  return rows.sort((a, b) => b.time - a.time).slice(0, limit);
}

export async function listPositions(): Promise<PositionRecord[]> {
  const db = await dbPromise;
  const rows = await db.getAll("positions");
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** —— 策略 —— */
export async function saveStrategyDoc(doc: StrategyDoc): Promise<void> {
  const db = await dbPromise;
  await db.put("strategies", { ...doc, updatedAt: Date.now() });
}

export async function getStrategyDoc(id: string): Promise<StrategyDoc | undefined> {
  const db = await dbPromise;
  return db.get("strategies", id);
}

export async function listStrategyDocs(): Promise<StrategyDoc[]> {
  const db = await dbPromise;
  const rows = await db.getAll("strategies");
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteStrategyDoc(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("strategies", id);
}

/** —— 预警 —— */
export async function saveAlert(row: AlertRecord): Promise<void> {
  const db = await dbPromise;
  await db.put("alerts", row);
}

export async function listAlerts(): Promise<AlertRecord[]> {
  const db = await dbPromise;
  return db.getAll("alerts");
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("alerts", id);
}

/** —— 自选 —— */
export async function addWatchlistItem(symbol: string, name?: string): Promise<void> {
  const db = await dbPromise;
  await db.put("watchlist", { symbol: symbol.padStart(6, "0"), name, addedAt: Date.now() });
}

export async function listWatchlist(): Promise<Array<{ symbol: string; name?: string; addedAt: number }>> {
  const db = await dbPromise;
  return db.getAll("watchlist");
}

export async function removeWatchlistItem(symbol: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("watchlist", symbol.padStart(6, "0"));
}

export async function clearAllPositions(): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction("positions", "readwrite");
  await tx.objectStore("positions").clear();
  await tx.done;
}

/** 恢复可用资金为初始资金并清空持仓（保留成交历史） */
export async function resetPaperToInit(): Promise<void> {
  const acc = await getPaperAccount();
  await savePaperAccount({ ...acc, cash: acc.initCash, updatedAt: Date.now() });
  await clearAllPositions();
}

/** —— 全量备份 —— */
export interface BackupPayload {
  version: number;
  exportedAt: number;
  strategies: StrategyDoc[];
  signals: SignalRecord[];
  trades: TradeRecord[];
  positions: PositionRecord[];
  alerts: AlertRecord[];
  watchlist: Array<{ symbol: string; name?: string; addedAt: number }>;
  syncSettings: Record<string, unknown>[];
}

export async function exportFullBackup(): Promise<string> {
  const db = await dbPromise;
  const syncKeys = await db.getAllKeys("syncSettings");
  const syncSettings: Record<string, unknown>[] = [];
  for (const k of syncKeys) {
    const row = await db.get("syncSettings", k as string);
    if (row) syncSettings.push(row as Record<string, unknown>);
  }
  const payload: BackupPayload = {
    version: 2,
    exportedAt: Date.now(),
    strategies: await db.getAll("strategies"),
    signals: await db.getAll("signals"),
    trades: await db.getAll("trades"),
    positions: await db.getAll("positions"),
    alerts: await db.getAll("alerts"),
    watchlist: await db.getAll("watchlist"),
    syncSettings
  };
  return JSON.stringify(payload, null, 2);
}

export async function importFullBackup(json: string, mode: "merge" | "replace"): Promise<void> {
  const data = JSON.parse(json) as BackupPayload;
  const db = await dbPromise;
  const tx = db.transaction(
    ["strategies", "signals", "trades", "positions", "alerts", "watchlist", "syncSettings"],
    "readwrite"
  );

  if (mode === "replace") {
    await Promise.all([
      tx.objectStore("strategies").clear(),
      tx.objectStore("signals").clear(),
      tx.objectStore("trades").clear(),
      tx.objectStore("positions").clear(),
      tx.objectStore("alerts").clear(),
      tx.objectStore("watchlist").clear(),
      tx.objectStore("syncSettings").clear()
    ]);
  }

  for (const s of data.strategies ?? []) await tx.objectStore("strategies").put(s);
  for (const s of data.signals ?? []) await tx.objectStore("signals").put(s);
  for (const s of data.trades ?? []) await tx.objectStore("trades").put(s);
  for (const s of data.positions ?? []) await tx.objectStore("positions").put(s);
  for (const s of data.alerts ?? []) await tx.objectStore("alerts").put(s);
  for (const s of data.watchlist ?? []) await tx.objectStore("watchlist").put(s);
  for (const s of data.syncSettings ?? []) {
    const key = (s as { key?: string }).key;
    if (key) await tx.objectStore("syncSettings").put(s);
  }
  await tx.done;
}
