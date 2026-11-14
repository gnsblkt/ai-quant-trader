export type PositionType = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "PARTIAL" | "CLOSED";

export interface TradeTarget {
  id: string;
  price: number;
  /** Percentage of the original position to close, not the remaining size. */
  sizePercentage: number;
  executed: boolean;
  executedAtTime: number | null;
}

export interface ActivePosition {
  id: string;
  symbol: string;
  type: PositionType;
  entryPrice: number;
  entryTime: number;
  initialSize: number;
  currentSize: number;
  stopLoss: number;
  targets: TradeTarget[];
  status: PositionStatus;
  /** Last candle timestamp processed; prevents accidental duplicate execution. */
  lastProcessedTime?: number;
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ExecutionReason = "STOP_LOSS" | "TAKE_PROFIT";

export interface TradeExecution {
  id: string;
  positionId: string;
  targetId?: string;
  symbol: string;
  type: PositionType;
  reason: ExecutionReason;
  executionPrice: number;
  size: number;
  sizePercentage: number;
  grossPnL: number;
  fees: number;
  netPnL: number;
  executedAtTime: number;
}

export interface EngineOptions {
  /** Fee rate per side, expressed as a decimal (e.g. 0.0004 = 4 bps). */
  feeRate?: number;
  /** Move the stop to entry after the first take-profit target fills. */
  moveStopToBreakEven?: boolean;
  /** Small tolerance used when comparing floating-point position sizes. */
  sizeEpsilon?: number;
}

export interface EngineTickResult {
  position: ActivePosition;
  executions: TradeExecution[];
  realizedPnL: number;
  statusChanged: boolean;
  duplicateCandle: boolean;
}
