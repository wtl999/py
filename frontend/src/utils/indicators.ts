export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MACDResult {
  dif: number[];
  dea: number[];
  macd: number[];
}

export interface KDJResult {
  k: number[];
  d: number[];
  j: number[];
  rsv: number[];
}

export interface BOLLResult {
  mid: number[];
  upper: number[];
  lower: number[];
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function ma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = round2(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (!values.length) return out;
  const a = 2 / (period + 1);
  out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    out[i] = round2(a * values[i] + (1 - a) * out[i - 1]);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): MACDResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const dif = values.map((_, i) => round2(fastEma[i] - slowEma[i]));
  const dea = ema(dif, signal);
  const macdVals = dif.map((d, i) => round2((d - dea[i]) * 2));
  return { dif, dea, macd: macdVals };
}

// TongDaXin/THS style SMA: Y = (M*X + (N-M)*Y') / N
export function smaCN(values: number[], n: number, m: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (!values.length) return out;
  out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    out[i] = round2((m * values[i] + (n - m) * out[i - 1]) / n);
  }
  return out;
}

export function kdj(bars: Bar[], n = 9, kPeriod = 3, dPeriod = 3): KDJResult {
  const rsv = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i += 1) {
    const start = Math.max(0, i - n + 1);
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = start; j <= i; j += 1) {
      hh = Math.max(hh, bars[j].high);
      ll = Math.min(ll, bars[j].low);
    }
    const den = hh - ll;
    rsv[i] = round2(den === 0 ? 50 : ((bars[i].close - ll) / den) * 100);
  }
  const k = smaCN(rsv, kPeriod, 1);
  const d = smaCN(k, dPeriod, 1);
  const j = k.map((kv, i) => round2(3 * kv - 2 * d[i]));
  return { k, d, j, rsv };
}

export function rsi(values: number[], period = 14): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length < 2) return out;
  const gains = new Array(values.length).fill(0);
  const losses = new Array(values.length).fill(0);
  for (let i = 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    gains[i] = Math.max(diff, 0);
    losses[i] = Math.max(-diff, 0);
  }
  const avgGain = smaCN(gains, period, 1);
  const avgLoss = smaCN(losses, period, 1);
  for (let i = 0; i < values.length; i += 1) {
    if (Number.isNaN(avgGain[i]) || Number.isNaN(avgLoss[i])) continue;
    if (avgLoss[i] === 0) {
      out[i] = 100;
    } else {
      const rs = avgGain[i] / avgLoss[i];
      out[i] = round2(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function std(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i += 1) {
    const start = i - period + 1;
    const win = values.slice(start, i + 1);
    const mean = win.reduce((s, v) => s + v, 0) / period;
    const variance = win.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    out[i] = round2(Math.sqrt(variance));
  }
  return out;
}

export function boll(values: number[], period = 20, mult = 2): BOLLResult {
  const mid = ma(values, period);
  const stdev = std(values, period);
  const upper = values.map((_, i) => round2((mid[i] ?? NaN) + mult * (stdev[i] ?? NaN)));
  const lower = values.map((_, i) => round2((mid[i] ?? NaN) - mult * (stdev[i] ?? NaN)));
  return { mid, upper, lower };
}

export function atr(bars: Bar[], period = 14): number[] {
  const tr = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i += 1) {
    if (i === 0) {
      tr[i] = bars[i].high - bars[i].low;
    } else {
      const h = bars[i].high;
      const l = bars[i].low;
      const pc = bars[i - 1].close;
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
  }
  return smaCN(tr.map(round2), period, 1).map(round2);
}
