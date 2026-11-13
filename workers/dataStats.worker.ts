type StatsRequest = { values: number[]; bins: number };
type StatsResponse = {
  mean: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
  count: number;
  histogram: number[];
};

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<StatsRequest>) => void) | null;
  postMessage: (message: StatsResponse) => void;
};

scope.onmessage = (event) => {
  const values = event.data.values.filter(Number.isFinite);
  const bins = Math.max(1, Math.min(100, Math.floor(event.data.bins || 18)));
  if (values.length === 0) {
    scope.postMessage({
      mean: 0, standardDeviation: 0, minimum: 0, maximum: 0, count: 0,
      histogram: Array.from({ length: bins }, () => 0),
    });
    return;
  }

  let sum = 0;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    sum += value;
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  const mean = sum / values.length;
  let squaredError = 0;
  for (const value of values) squaredError += (value - mean) ** 2;

  const histogram = Array.from({ length: bins }, () => 0);
  const span = maximum - minimum || 1;
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor(((value - minimum) / span) * bins));
    histogram[index] += 1;
  }

  scope.postMessage({
    mean,
    standardDeviation: Math.sqrt(squaredError / values.length),
    minimum,
    maximum,
    count: values.length,
    histogram,
  });
};
