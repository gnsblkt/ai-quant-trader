import type {
  ActivePosition,
  EngineOptions,
  EngineTickResult,
  MarketCandle,
  TradeExecution,
  TradeTarget,
} from "../../types/trading";

const DEFAULT_EPSILON = 1e-10;

function assertFinitePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a finite positive number.`);
}

function validate(position: ActivePosition, candle: MarketCandle, options: EngineOptions) {
  assertFinitePositive(position.entryPrice, "Entry price");
  assertFinitePositive(position.initialSize, "Initial size");
  assertFinitePositive(position.currentSize, "Current size");
  assertFinitePositive(position.stopLoss, "Stop loss");
  if (!position.id || !position.symbol) throw new Error("Position id and symbol are required.");
  if (!Number.isFinite(position.entryTime) || !Number.isFinite(candle.time)) throw new Error("Candle and entry timestamps must be finite.");
  if (![candle.open, candle.high, candle.low, candle.close].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Candle OHLC values must be finite and positive.");
  }
  if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close)) {
    throw new Error("Candle OHLC values are inconsistent.");
  }
  const feeRate = options.feeRate ?? 0;
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 0.1) throw new Error("Fee rate must be between 0 and 10%.");
  if (position.currentSize - position.initialSize > DEFAULT_EPSILON) throw new Error("Current size cannot exceed initial size.");

  const ids = new Set<string>();
  let allocation = 0;
  for (const target of position.targets) {
    if (!target.id || ids.has(target.id)) throw new Error("Target ids must be unique and non-empty.");
    ids.add(target.id);
    assertFinitePositive(target.price, `Target ${target.id} price`);
    if (!Number.isFinite(target.sizePercentage) || target.sizePercentage <= 0 || target.sizePercentage > 100) {
      throw new Error(`Target ${target.id} size percentage must be between 0 and 100.`);
    }
    if (!target.executed) allocation += target.sizePercentage;
    const favorable = position.type === "LONG" ? target.price > position.entryPrice : target.price < position.entryPrice;
    if (!favorable) throw new Error(`Target ${target.id} must be beyond entry in the favorable direction.`);
  }
  if (allocation > 100 + DEFAULT_EPSILON) throw new Error("Unexecuted target allocations cannot exceed 100% of the initial position.");

  const validStop = position.type === "LONG" ? position.stopLoss < position.entryPrice : position.stopLoss > position.entryPrice;
  if (position.status !== "CLOSED" && !validStop) {
    // Break-even stops are valid after a target has been executed.
    const hasExecutedTarget = position.targets.some((target) => target.executed);
    if (!hasExecutedTarget || position.stopLoss !== position.entryPrice) {
      throw new Error("Stop loss must be on the protective side of entry.");
    }
  }
}

function crossedStop(position: ActivePosition, candle: MarketCandle) {
  return position.type === "LONG" ? candle.low <= position.stopLoss : candle.high >= position.stopLoss;
}

function stopFill(position: ActivePosition, candle: MarketCandle) {
  if (position.type === "LONG") return candle.open < position.stopLoss ? candle.open : position.stopLoss;
  return candle.open > position.stopLoss ? candle.open : position.stopLoss;
}

function targetCrossed(position: ActivePosition, target: TradeTarget, candle: MarketCandle) {
  return position.type === "LONG" ? candle.high >= target.price : candle.low <= target.price;
}

function targetFill(position: ActivePosition, target: TradeTarget, candle: MarketCandle) {
  if (position.type === "LONG") return candle.open > target.price ? candle.open : target.price;
  return candle.open < target.price ? candle.open : target.price;
}

function execution(
  position: ActivePosition,
  candle: MarketCandle,
  reason: TradeExecution["reason"],
  price: number,
  size: number,
  feeRate: number,
  targetId?: string,
): TradeExecution {
  const direction = position.type === "LONG" ? 1 : -1;
  const grossPnL = (price - position.entryPrice) * direction * size;
  // Entry and exit fees are both allocated to each closed slice.
  const fees = (position.entryPrice + price) * size * feeRate;
  return {
    id: `${position.id}:${targetId ?? "stop"}:${candle.time}`,
    positionId: position.id,
    ...(targetId ? { targetId } : {}),
    symbol: position.symbol,
    type: position.type,
    reason,
    executionPrice: price,
    size,
    sizePercentage: (size / position.initialSize) * 100,
    grossPnL,
    fees,
    netPnL: grossPnL - fees,
    executedAtTime: candle.time,
  };
}

/**
 * Deterministic OHLC simulator. If a candle crosses both stop and targets,
 * stop-loss wins because the intrabar price path is unknown.
 */
export function engineTick(
  inputPosition: ActivePosition,
  candle: MarketCandle,
  options: EngineOptions = {},
): EngineTickResult {
  validate(inputPosition, candle, options);
  const position: ActivePosition = {
    ...inputPosition,
    targets: inputPosition.targets.map((target) => ({ ...target })),
  };
  const epsilon = options.sizeEpsilon ?? DEFAULT_EPSILON;
  if (!Number.isFinite(epsilon) || epsilon <= 0) throw new Error("sizeEpsilon must be positive.");
  if (position.status === "CLOSED" || candle.time <= position.entryTime) {
    return { position, executions: [], realizedPnL: 0, statusChanged: false, duplicateCandle: false };
  }
  if (position.lastProcessedTime !== undefined && candle.time <= position.lastProcessedTime) {
    return { position, executions: [], realizedPnL: 0, statusChanged: false, duplicateCandle: true };
  }

  const initialStatus = position.status;
  const feeRate = options.feeRate ?? 0;
  const executions: TradeExecution[] = [];

  if (crossedStop(position, candle)) {
    executions.push(execution(position, candle, "STOP_LOSS", stopFill(position, candle), position.currentSize, feeRate));
    position.currentSize = 0;
    position.status = "CLOSED";
    position.lastProcessedTime = candle.time;
    return {
      position,
      executions,
      realizedPnL: executions.reduce((sum, item) => sum + item.netPnL, 0),
      statusChanged: initialStatus !== position.status,
      duplicateCandle: false,
    };
  }

  const orderedTargets = position.targets
    .filter((target) => !target.executed && targetCrossed(position, target, candle))
    .sort((a, b) => (position.type === "LONG" ? a.price - b.price : b.price - a.price));

  for (const target of orderedTargets) {
    if (position.currentSize <= epsilon) break;
    const requestedSize = (position.initialSize * target.sizePercentage) / 100;
    const size = Math.min(requestedSize, position.currentSize);
    if (size <= epsilon) {
      target.executed = true;
      target.executedAtTime = candle.time;
      continue;
    }
    executions.push(execution(position, candle, "TAKE_PROFIT", targetFill(position, target, candle), size, feeRate, target.id));
    position.currentSize = Math.max(0, position.currentSize - size);
    target.executed = true;
    target.executedAtTime = candle.time;

    if (options.moveStopToBreakEven && position.stopLoss !== position.entryPrice) {
      position.stopLoss = position.entryPrice;
    }
  }

  if (position.currentSize <= epsilon) {
    position.currentSize = 0;
    position.status = "CLOSED";
  } else if (position.currentSize < position.initialSize - epsilon) {
    position.status = "PARTIAL";
  } else {
    position.status = "OPEN";
  }
  position.lastProcessedTime = candle.time;

  return {
    position,
    executions,
    realizedPnL: executions.reduce((sum, item) => sum + item.netPnL, 0),
    statusChanged: initialStatus !== position.status,
    duplicateCandle: false,
  };
}
