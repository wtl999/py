/** 策略 DSL 与文档类型（前台唯一真相源） */

export const STRATEGY_SCHEMA_VERSION = 1 as const;

export type StrategyKind = "indicator" | "pattern" | "nl" | "combo";

export type LogicOp = "and" | "or";

export type Condition =
  | { type: "macd_cross"; direction: "golden" | "death" }
  | { type: "ma_cross"; fast: number; slow: number; direction?: "golden" | "death" }
  | { type: "rsi"; period: number; op: "gt" | "lt"; value: number }
  | { type: "kdj_j"; op: "gt" | "lt"; value: number }
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
  /** 组合：子策略 id 列表 */
  combo?: { logic: LogicOp; strategyIds: string[] };
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
  }
];
