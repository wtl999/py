import { runStrategyBacktest, type BacktestParams, type BacktestResult } from "../utils/backtest";
import type { Bar } from "../utils/indicators";
import type { StrategyDoc } from "../utils/strategyTypes";

type Req = {
  type: "run";
  bars: Bar[];
  params: BacktestParams;
  strategy: StrategyDoc;
  strategies: StrategyDoc[];
};

type Res =
  | { type: "done"; result: BacktestResult }
  | { type: "error"; message: string };

self.onmessage = (ev: MessageEvent<Req>) => {
  try {
    const payload = ev.data;
    if (payload.type !== "run") return;
    const map = new Map(payload.strategies.map((s) => [s.id, s] as const));
    const result = runStrategyBacktest(payload.bars, payload.params, payload.strategy, (id) => map.get(id));
    const out: Res = { type: "done", result };
    self.postMessage(out);
  } catch (e) {
    const out: Res = { type: "error", message: (e as Error).message || "worker error" };
    self.postMessage(out);
  }
};

