import type { Bar } from "./indicators";
import { evaluateStrategyDoc } from "./strategyEngine";
import type { StrategyDoc } from "./strategyTypes";

export interface BacktestParams {
  initCash: number;
  feeRate: number;
  lotSize: number;
  /** 滑点比例，如 0.001 表示 0.1% */
  slippage: number;
  positionMode?: "fixed_qty" | "fixed_ratio" | "kelly";
  fixedQty?: number;
  fixedRatio?: number;
  kellyWinRate?: number;
  kellyWinLossRatio?: number;
}

export interface BacktestTrade {
  date: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  fee: number;
  equityAfter: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: Array<{ date: string; equity: number }>;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeApprox: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function calcTargetQty(cash: number, p: number, feeRate: number, lotSize: number, params: BacktestParams): number {
  const mode = params.positionMode ?? "fixed_qty";
  let budget = cash;
  if (mode === "fixed_ratio") {
    const ratio = clamp(params.fixedRatio ?? 0.5, 0.01, 1);
    budget = cash * ratio;
  } else if (mode === "kelly") {
    const w = clamp(params.kellyWinRate ?? 0.55, 0.01, 0.99);
    const b = clamp(params.kellyWinLossRatio ?? 1.2, 0.1, 10);
    const f = clamp(w - (1 - w) / b, 0.05, 1);
    budget = cash * f;
  } else {
    const qty = Math.max(0, Math.floor((params.fixedQty ?? lotSize) / lotSize) * lotSize);
    const cost = qty * p * (1 + feeRate);
    if (qty > 0 && cost <= cash) return qty;
    budget = cash;
  }
  const canBuy = Math.floor(budget / (p * (1 + feeRate)));
  return Math.max(0, Math.floor(canBuy / lotSize) * lotSize);
}

export function getBuiltinMacdStrategy(): StrategyDoc {
  return {
    id: "__macd_builtin__",
    name: "MACD 金叉",
    kind: "indicator",
    enabled: true,
    schemaVersion: 1,
    createdAt: 0,
    updatedAt: 0,
    dsl: {
      version: 1,
      logic: "and",
      conditions: [{ type: "macd_cross", direction: "golden" }],
      exit: { logic: "and", conditions: [{ type: "macd_cross", direction: "death" }] }
    }
  };
}

/** 通用回测：按策略文档在收盘 bar 上判定，次日逻辑简化为当日 bar 收盘执行 */
export function runStrategyBacktest(
  bars: Bar[],
  params: BacktestParams,
  strategy: StrategyDoc,
  resolveStrategy: (id: string) => StrategyDoc | undefined
): BacktestResult {
  if (!bars.length) {
    return { trades: [], equityCurve: [], totalReturn: 0, maxDrawdown: 0, winRate: 0, sharpeApprox: 0 };
  }

  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ date: string; equity: number }> = [];
  let cash = params.initCash;
  let qty = 0;
  let buyCost = 0;
  let peak = params.initCash;
  let maxDrawdown = 0;
  let wins = 0;
  let closed = 0;
  const dailyReturns: number[] = [];

  const slipBuy = 1 + params.slippage;
  const slipSell = 1 - params.slippage;

  for (let i = 1; i < bars.length; i += 1) {
    const rawP = bars[i].close;
    const { buy, sell } = evaluateStrategyDoc(strategy, bars, i, resolveStrategy);

    if (buy && qty === 0) {
      const p = round2(rawP * slipBuy);
      const buyQty = calcTargetQty(cash, p, params.feeRate, params.lotSize, params);
      if (buyQty > 0) {
        const amount = buyQty * p;
        const fee = amount * params.feeRate;
        cash -= amount + fee;
        qty = buyQty;
        buyCost = p;
        trades.push({
          date: bars[i].date,
          side: "buy",
          price: p,
          quantity: buyQty,
          fee: round2(fee),
          equityAfter: round2(cash + qty * rawP)
        });
      }
    } else if (sell && qty > 0) {
      const p = round2(rawP * slipSell);
      const amount = qty * p;
      const fee = amount * params.feeRate;
      cash += amount - fee;
      if (p > buyCost) wins += 1;
      closed += 1;
      trades.push({
        date: bars[i].date,
        side: "sell",
        price: p,
        quantity: qty,
        fee: round2(fee),
        equityAfter: round2(cash)
      });
      qty = 0;
      buyCost = 0;
    }

    const equity = cash + qty * rawP;
    if (equityCurve.length) {
      const prev = equityCurve[equityCurve.length - 1].equity;
      if (prev > 0) dailyReturns.push((equity - prev) / prev);
    }
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    equityCurve.push({ date: bars[i].date, equity: round2(equity) });
  }

  const lastEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : params.initCash;
  const mean = dailyReturns.length ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const var_ =
    dailyReturns.length > 1
      ? dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1)
      : 0;
  const std = Math.sqrt(var_) || 1e-8;
  const sharpeApprox = round2((mean / std) * Math.sqrt(252));

  return {
    trades,
    equityCurve,
    totalReturn: round2((lastEquity - params.initCash) / params.initCash),
    maxDrawdown: round2(maxDrawdown),
    winRate: closed ? round2(wins / closed) : 0,
    sharpeApprox
  };
}

/** 兼容旧入口：纯 MACD 金叉回测 */
export function runMacdCrossBacktest(bars: Bar[], params: Omit<BacktestParams, "slippage"> & { slippage?: number }): BacktestResult {
  const full: BacktestParams = {
    ...params,
    slippage: params.slippage ?? 0
  };
  const doc = getBuiltinMacdStrategy();
  return runStrategyBacktest(bars, full, doc, () => undefined);
}
