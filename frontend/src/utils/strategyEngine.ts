import { kdj, macd, ma, rsi, type Bar } from "./indicators";
import type { Condition, LogicOp, StrategyDSL, StrategyDoc } from "./strategyTypes";

function evalLogic(op: LogicOp, results: boolean[]): boolean {
  if (!results.length) return false;
  return op === "and" ? results.every(Boolean) : results.some(Boolean);
}

function macdCrossAt(dif: number[], dea: number[], i: number, golden: boolean): boolean {
  if (i < 1) return false;
  const a = dif[i - 1];
  const b = dea[i - 1];
  const c = dif[i];
  const d = dea[i];
  if ([a, b, c, d].some((x) => Number.isNaN(x))) return false;
  return golden ? a <= b && c > d : a >= b && c < d;
}

function maCrossAt(closes: number[], fast: number, slow: number, i: number, golden: boolean): boolean {
  if (i < 1) return false;
  const f = ma(closes, fast);
  const s = ma(closes, slow);
  const a = f[i - 1];
  const b = s[i - 1];
  const c = f[i];
  const d = s[i];
  if ([a, b, c, d].some((x) => Number.isNaN(x))) return false;
  return golden ? a <= b && c > d : a >= b && c < d;
}

function evalCondition(bars: Bar[], i: number, c: Condition, closes: number[]): boolean {
  switch (c.type) {
    case "macd_cross": {
      const { dif, dea } = macd(closes, 12, 26, 9);
      return macdCrossAt(dif, dea, i, c.direction === "golden");
    }
    case "ma_cross": {
      const golden = c.direction !== "death";
      return maCrossAt(closes, c.fast, c.slow, i, golden);
    }
    case "rsi": {
      const r = rsi(closes, c.period);
      const v = r[i];
      if (Number.isNaN(v)) return false;
      return c.op === "gt" ? v > c.value : v < c.value;
    }
    case "kdj_j": {
      const { j } = kdj(bars, 9, 3, 3);
      const v = j[i];
      if (Number.isNaN(v)) return false;
      return c.op === "gt" ? v > c.value : v < c.value;
    }
    case "pattern": {
      const lb = Math.min(c.lookback, i + 1);
      const start = i - lb + 1;
      if (start < 0) return false;
      if (c.id === "three_white_soldiers") {
        if (i < 2) return false;
        const b0 = bars[i - 2];
        const b1 = bars[i - 1];
        const b2 = bars[i];
        const up =
          b0.close > b0.open && b1.close > b1.open && b2.close > b2.open &&
          b1.close > b0.close && b2.close > b1.close;
        return up;
      }
      if (c.id === "long_lower_shadow") {
        const b = bars[i];
        const body = Math.abs(b.close - b.open);
        const lower = Math.min(b.open, b.close) - b.low;
        const range = b.high - b.low;
        if (range <= 0) return false;
        return lower >= range * 0.6 && body <= range * 0.25;
      }
      return false;
    }
    default:
      return false;
  }
}

export function evaluateDSL(dsl: StrategyDSL, bars: Bar[], i: number): { buy: boolean; sell: boolean } {
  const closes = bars.map((b) => b.close);
  const buy = evalLogic(
    dsl.logic,
    dsl.conditions.map((c) => evalCondition(bars, i, c, closes))
  );
  let sell = false;
  if (dsl.exit?.conditions?.length) {
    sell = evalLogic(
      dsl.exit.logic,
      dsl.exit.conditions.map((c) => evalCondition(bars, i, c, closes))
    );
  }
  return { buy, sell };
}

export function evaluateStrategyDoc(
  doc: StrategyDoc,
  bars: Bar[],
  i: number,
  resolve: (id: string) => StrategyDoc | undefined,
  depth = 0
): { buy: boolean; sell: boolean } {
  if (depth > 10) return { buy: false, sell: false };
  if (!doc.enabled) return { buy: false, sell: false };
  if (doc.kind === "combo" && doc.combo?.strategyIds?.length) {
    const children = doc.combo.strategyIds.map((id) => resolve(id)).filter(Boolean) as StrategyDoc[];
    if (!children.length) return { buy: false, sell: false };
    const results = children.map((c) => evaluateStrategyDoc(c, bars, i, resolve, depth + 1));
    const logic = doc.combo.logic;
    const buy = logic === "and" ? results.every((r) => r.buy) : results.some((r) => r.buy);
    const sell = logic === "and" ? results.every((r) => r.sell) : results.some((r) => r.sell);
    return { buy, sell };
  }
  if (doc.dsl) {
    return evaluateDSL(doc.dsl, bars, i);
  }
  // 白话文极简规则匹配
  const t = (doc.exprText ?? "").toLowerCase();
  if (t.includes("macd") && t.includes("金叉")) {
    const { dif, dea } = macd(bars.map((b) => b.close), 12, 26, 9);
    return { buy: macdCrossAt(dif, dea, i, true), sell: macdCrossAt(dif, dea, i, false) };
  }
  if (t.includes("rsi") && t.includes("超卖")) {
    const r = rsi(bars.map((b) => b.close), 14);
    const v = r[i];
    return { buy: !Number.isNaN(v) && v < 30, sell: !Number.isNaN(v) && v > 70 };
  }
  return { buy: false, sell: false };
}
