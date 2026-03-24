import { boll, kdj, macd, ma, rsi, type Bar } from "./indicators";
import { parseNlByPlugins } from "./nlParserPlugins";
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
    case "macd_zone": {
      const { dif, dea } = macd(closes, 12, 26, 9);
      const a = dif[i];
      const b = dea[i];
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return c.zone === "above_zero" ? a > 0 && b > 0 : a < 0 && b < 0;
    }
    case "price_ma": {
      const m = ma(closes, c.period);
      const mv = m[i];
      if (Number.isNaN(mv)) return false;
      return c.op === "above" ? closes[i] > mv : closes[i] < mv;
    }
    case "rsi": {
      const r = rsi(closes, c.period);
      const v = r[i];
      if (Number.isNaN(v)) return false;
      return c.op === "gt" ? v > c.value : v < c.value;
    }
    case "boll_break": {
      const b = boll(closes, c.period, c.mult);
      if (c.direction === "up") return closes[i] > b.upper[i];
      return closes[i] < b.lower[i];
    }
    case "vol_ratio": {
      const vols = bars.map((x) => Number(x.volume ?? 0));
      const vma = ma(vols, c.period);
      if (Number.isNaN(vma[i]) || vma[i] <= 0) return false;
      return vols[i] / vma[i] >= c.minRatio;
    }
    case "kdj_j": {
      const { j } = kdj(bars, 9, 3, 3);
      const v = j[i];
      if (Number.isNaN(v)) return false;
      return c.op === "gt" ? v > c.value : v < c.value;
    }
    case "limit_up_within": {
      const lb = Math.max(1, Math.min(c.lookback, i + 1));
      const start = i - lb + 1;
      const th = c.thresholdPct ?? 9.8;
      for (let k = Math.max(1, start); k <= i; k += 1) {
        const prev = closes[k - 1];
        const cur = closes[k];
        if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(cur)) continue;
        const pct = ((cur - prev) / prev) * 100;
        if (pct >= th) return true;
      }
      return false;
    }
    case "ma_not_below": {
      const lb = Math.max(1, Math.min(c.lookback, i + 1));
      const start = i - lb + 1;
      const m = ma(closes, c.maPeriod);
      for (let k = start; k <= i; k += 1) {
        const base = c.useClose === false ? bars[k].low : closes[k];
        const mv = m[k];
        if (Number.isNaN(mv)) return false;
        if (base < mv) return false;
      }
      return true;
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

function parseNlToDsl(expr: string): StrategyDSL | undefined {
  return parseNlByPlugins(expr);
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
  if (doc.kind === "combo" && (doc.combo?.strategyIds?.length || doc.combo?.strategyRefs?.length)) {
    const refs =
      doc.combo.strategyRefs?.length
        ? doc.combo.strategyRefs
        : doc.combo.strategyIds.map((id, idx) => ({ id, weight: 1, priority: idx + 1 }));
    const withDoc = refs
      .map((r, idx) => ({ ref: r, idx, doc: resolve(r.id) }))
      .filter((x) => x.doc) as Array<{ ref: { id: string; weight?: number; priority?: number }; idx: number; doc: StrategyDoc }>;
    if (!withDoc.length) return { buy: false, sell: false };
    withDoc.sort((a, b) => (a.ref.priority ?? a.idx + 1) - (b.ref.priority ?? b.idx + 1));
    const results = withDoc.map((x) => ({
      ...evaluateStrategyDoc(x.doc, bars, i, resolve, depth + 1),
      weight: Number.isFinite(x.ref.weight) ? Number(x.ref.weight) : 1
    }));
    const mode = doc.combo.triggerMode ?? "logic";
    if (mode === "score") {
      const minScore = Number.isFinite(doc.combo.minScore) ? Number(doc.combo.minScore) : 1;
      const buyScore = results.reduce((s, r) => s + (r.buy ? r.weight : 0), 0);
      const sellScore = results.reduce((s, r) => s + (r.sell ? r.weight : 0), 0);
      return { buy: buyScore >= minScore, sell: sellScore >= minScore };
    }
    const logic = doc.combo.logic;
    return {
      buy: logic === "and" ? results.every((r) => r.buy) : results.some((r) => r.buy),
      sell: logic === "and" ? results.every((r) => r.sell) : results.some((r) => r.sell)
    };
  }
  if (doc.dsl) {
    return evaluateDSL(doc.dsl, bars, i);
  }
  // 白话文 / 同花顺 / 通达信指标口令解析
  const parsed = parseNlToDsl(doc.exprText ?? "");
  if (parsed) {
    return evaluateDSL(parsed, bars, i);
  }
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
