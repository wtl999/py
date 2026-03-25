import { dbPromise, type SignalRecord, type TradeRecord, type PositionRecord } from "./idb";
import { STRATEGY_SCHEMA_VERSION, TEMPLATE_STRATEGIES, type StrategyDoc } from "../utils/strategyTypes";

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 首次运行补齐 demo 数据：确保看板/策略/信号/成交/持仓/预警/自选至少有内容。
 * 规则：只在对应 store 为空时写入，尽量不覆盖用户已有数据。
 */
export async function seedIndexedDbIfNeeded(): Promise<void> {
  const db = await dbPromise;

  const strategyKeys = await db.getAllKeys("strategies");
  const signalKeys = await db.getAllKeys("signals");
  const tradeKeys = await db.getAllKeys("trades");
  const positionKeys = await db.getAllKeys("positions");
  const alertKeys = await db.getAllKeys("alerts");
  const watchlistKeys = await db.getAllKeys("watchlist");
  const syncKeys = await db.getAllKeys("syncSettings");

  const needStrategies = strategyKeys.length === 0;
  const needSignals = signalKeys.length === 0;
  const needTrades = tradeKeys.length === 0;
  const needPositions = positionKeys.length === 0;
  const needAlerts = alertKeys.length === 0;
  const needWatchlist = watchlistKeys.length === 0;

  // 只有当纸面交易相关 store 都为空时才补齐 paper 数据
  const needPaperDemo = needTrades && needPositions && needSignals;
  const needPaperSettings = needPaperDemo && syncKeys.length === 0;

  if (!needStrategies && !needPaperDemo && !needAlerts && !needWatchlist) return;

  const now = Date.now();
  const feeRate = 0.0003;

  const seedSymbol = "600519";
  const otherSymbol = "000001";
  const seedStrategyName = TEMPLATE_STRATEGIES[0]?.name ?? "MACD 金叉";

  let paperAccount: { cash: number; initCash: number; updatedAt: number } | null = null;
  let trades: TradeRecord[] = [];
  let positions: PositionRecord[] = [];
  let signals: SignalRecord[] = [];

  if (needPaperDemo) {
    const initCash = 1_000_000;
    let cash = initCash;
    let posQty = 0;
    let posAvgCost = 0;
    const lastPrice = 14.0;

    // 尽量保证最后一笔落在“今天”，以便 WatchView 的“今日信号”非空
    const t1 = now - 1000 * 60 * 60 * 24 * 8;
    const t2 = now - 1000 * 60 * 60 * 24 * 6;
    const t3 = now - 1000 * 60 * 60 * 24 * 4;
    const t4 = now - 1000 * 60 * 60 * 24 * 2;
    // 保证最后一笔落在“今天”，避免凌晨附近启动导致今日统计为空
    const t5 = now;

    const tradeDefs: Array<{ side: "buy" | "sell"; price: number; quantity: number; time: number; strategy: string }> = [
      { side: "buy", price: 10.0, quantity: 500, time: t1, strategy: seedStrategyName },
      { side: "buy", price: 11.0, quantity: 500, time: t2, strategy: seedStrategyName },
      { side: "sell", price: 12.0, quantity: 600, time: t3, strategy: seedStrategyName },
      { side: "buy", price: 13.0, quantity: 200, time: t4, strategy: seedStrategyName },
      { side: "sell", price: lastPrice, quantity: 300, time: t5, strategy: seedStrategyName }
    ];

    const lastTradeTime = tradeDefs[tradeDefs.length - 1]?.time ?? now;

    for (const d of tradeDefs) {
      const amount = d.price * d.quantity;
      const fee = amount * feeRate;

      if (d.side === "buy") {
        cash -= amount + fee;
        const nextQty = posQty + d.quantity;
        posAvgCost = nextQty > 0 ? (posQty * posAvgCost + amount) / nextQty : 0;
        posQty = nextQty;
      } else {
        cash += amount - fee;
        posQty -= d.quantity;
        if (posQty <= 0) {
          posQty = 0;
          posAvgCost = 0;
        }
      }

      const trd: TradeRecord = {
        id: uid("trd"),
        time: d.time,
        symbol: seedSymbol,
        side: d.side,
        price: d.price,
        quantity: d.quantity,
        amount,
        fee,
        strategy: d.strategy
      };
      trades.push(trd);

      const sig: SignalRecord = {
        id: uid("sig"),
        time: d.time,
        symbol: seedSymbol,
        name: "demo",
        strategy: d.strategy,
        signalType: d.side,
        price: d.price,
        changePct: round2(((d.price - 10.0) / 10.0) * 100),
        note: "seed demo"
      };
      signals.push(sig);
    }

    paperAccount = { cash, initCash, updatedAt: lastTradeTime };
    if (posQty > 0) {
      positions = [
        {
          symbol: seedSymbol,
          quantity: posQty,
          avgCost: posAvgCost,
          marketPrice: lastPrice,
          updatedAt: lastTradeTime
        }
      ];
    }
  }

  const txStores: Array<"strategies" | "signals" | "trades" | "positions" | "alerts" | "watchlist" | "syncSettings"> = [];
  if (needStrategies) txStores.push("strategies");
  if (needPaperDemo) txStores.push("trades", "positions", "signals", "syncSettings");
  if (needAlerts) txStores.push("alerts");
  if (needWatchlist) txStores.push("watchlist");
  if (!txStores.length) return;

  const tx = db.transaction(txStores, "readwrite");

  if (needStrategies) {
    const base = Date.now();
    TEMPLATE_STRATEGIES.forEach((tpl, idx) => {
      const doc: StrategyDoc = {
        ...(tpl as any),
        id: uid(`stg_${idx}`),
        createdAt: base - (TEMPLATE_STRATEGIES.length - idx) * 60_000,
        updatedAt: base - (TEMPLATE_STRATEGIES.length - idx) * 30_000,
        schemaVersion: STRATEGY_SCHEMA_VERSION
      };
      tx.objectStore("strategies").put(doc);
    });
  }

  if (needWatchlist) {
    tx.objectStore("watchlist").put({ symbol: seedSymbol, addedAt: now - 1000 * 60 * 30, name: "demo" });
    tx.objectStore("watchlist").put({ symbol: otherSymbol, addedAt: now - 1000 * 60 * 20, name: "demo" });
  }

  if (needAlerts) {
    const y = now - 1000 * 60 * 60 * 24;
    tx.objectStore("alerts").put({ id: uid("alt"), kind: "pct_above", symbol: seedSymbol, value: 2.0, enabled: true, createdAt: y });
    tx.objectStore("alerts").put({ id: uid("alt"), kind: "pct_below", symbol: seedSymbol, value: -2.0, enabled: true, createdAt: y });
  }

  if (needPaperDemo && paperAccount) {
    if (needPaperSettings) {
      tx.objectStore("syncSettings").put({ key: "paperSettings", feeRate });
    }
    tx.objectStore("syncSettings").put({ key: "paperAccount", ...paperAccount });

    positions.forEach((p) => tx.objectStore("positions").put(p));
    trades.forEach((t) => tx.objectStore("trades").put(t));
    signals.forEach((s) => tx.objectStore("signals").put(s));
  }

  await tx.done;
}

