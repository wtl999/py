/** 策略 DSL 与文档类型（前台唯一真相源） */

export const STRATEGY_SCHEMA_VERSION = 1 as const;

export type StrategyKind = "indicator" | "pattern" | "nl" | "combo";

export type LogicOp = "and" | "or";

export type Condition =
  | { type: "macd_cross"; direction: "golden" | "death" }
  | { type: "macd_zone"; zone: "above_zero" | "below_zero" }
  | { type: "ma_cross"; fast: number; slow: number; direction?: "golden" | "death" }
  | { type: "price_ma"; period: number; op: "above" | "below" }
  | { type: "rsi"; period: number; op: "gt" | "lt"; value: number }
  | { type: "kdj_j"; op: "gt" | "lt"; value: number }
  | { type: "boll_break"; period: number; mult: number; direction: "up" | "down" }
  | { type: "vol_ratio"; period: number; minRatio: number }
  | { type: "limit_up_within"; lookback: number; thresholdPct?: number }
  | { type: "ma_not_below"; maPeriod: number; lookback: number; useClose?: boolean }
  | { type: "pattern"; id: "three_white_soldiers" | "long_lower_shadow"; lookback: number };

export interface StrategyDSL {
  version: typeof STRATEGY_SCHEMA_VERSION;
  logic: LogicOp;
  conditions: Condition[];
  /** 卖出侧（可选）：满足任一即视为卖出信号 */
  exit?: { logic: LogicOp; conditions: Condition[] };
}

export interface StrategyDoc {
  id: string;
  name: string;
  kind: StrategyKind;
  enabled: boolean;
  schemaVersion: number;
  dsl?: StrategyDSL;
  /** 组合：支持基础与/或、加权打分与优先级 */
  combo?: {
    logic: LogicOp;
    strategyIds?: string[];
    strategyRefs?: Array<{ id: string; weight?: number; priority?: number }>;
    triggerMode?: "logic" | "score";
    minScore?: number;
  };
  /** 白话文/备注 */
  exprText?: string;
  createdAt: number;
  updatedAt: number;
}

export const TEMPLATE_STRATEGIES: Omit<StrategyDoc, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "MACD 金叉",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [{ type: "macd_cross", direction: "golden" }],
      exit: { logic: "and", conditions: [{ type: "macd_cross", direction: "death" }] }
    }
  },
  {
    name: "双均线金叉",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [{ type: "ma_cross", fast: 5, slow: 20 }],
      exit: { logic: "and", conditions: [{ type: "ma_cross", fast: 5, slow: 20, direction: "death" }] }
    }
  },
  {
    name: "5天内有涨停",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [{ type: "limit_up_within", lookback: 5, thresholdPct: 9.8 }]
    }
  },
  {
    name: "近20日不破MA5",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [{ type: "ma_not_below", maPeriod: 5, lookback: 20, useClose: true }]
    }
  },
  {
    name: "RSI 超卖反弹",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [
        { type: "rsi", period: 14, op: "lt", value: 30 },
        { type: "macd_cross", direction: "golden" }
      ],
      exit: { logic: "or", conditions: [{ type: "rsi", period: 14, op: "gt", value: 70 }] }
    }
  },
  {
    name: "收盘站上MA20且MACD零轴上方",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [
        { type: "price_ma", period: 20, op: "above" },
        { type: "macd_zone", zone: "above_zero" }
      ]
    }
  },
  {
    name: "放量突破BOLL上轨",
    kind: "indicator",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl: {
      version: STRATEGY_SCHEMA_VERSION,
      logic: "and",
      conditions: [
        { type: "vol_ratio", period: 5, minRatio: 1.5 },
        { type: "boll_break", period: 20, mult: 2, direction: "up" }
      ]
    }
  }
];
