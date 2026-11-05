export type DpStep = {
  note: string;
  line: number;
  table: (number | null)[][];
  cell: number[];
  deps: number[][];
  path: number[][];
  answer?: string;
  extra?: string;
};
const clone = (a: (number | null)[][]) => a.map((row) => [...row]);

export function matrixChain(p: number[]) {
  const n = p.length - 1;
  const table = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : null)),
  ) as (number | null)[][];
  const split = Array.from({ length: n }, () => Array(n).fill(-1) as number[]);
  const steps: DpStep[] = [];
  const take = (
    note: string,
    line: number,
    cell: number[],
    deps: number[][] = [],
  ) => steps.push({ note, line, cell, deps, path: [], table: clone(table) });
  take('单个矩阵无需相乘：主对角线为 0。按区间长度从小到大填表。', 0, []);
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i + len <= n; i++) {
      const j = i + len - 1;
      for (let k = i; k < j; k++) {
        const left = table[i][k]!,
          right = table[k + 1][j]!,
          join = p[i] * p[k + 1] * p[j + 1];
        const cost = left + right + join;
        if (table[i][j] === null || cost < table[i][j]!) {
          table[i][j] = cost;
          split[i][j] = k;
        }
        take(
          `区间 A${i + 1}…A${j + 1}，试 k=${k + 1}：${left} + ${right} + ${join} = ${cost}；当前最少 ${table[i][j]}。`,
          3,
          [i, j],
          [
            [i, k],
            [k + 1, j],
          ],
        );
      }
    }
  }
  function expression(i: number, j: number): string {
    if (i === j) return `A${i + 1}`;
    const k = split[i][j];
    return `(${expression(i, k)} × ${expression(k + 1, j)})`;
  }
  const answer = expression(0, n - 1);
  steps.push({
    note: `最少 ${table[0][n - 1]} 次标量乘法。按记录的 k 回溯括号。`,
    line: 4,
    table: clone(table),
    cell: [0, n - 1],
    deps: [],
    path: [],
    answer,
  });
  return { steps, cost: table[0][n - 1]!, split, answer };
}

export function lcsTrace(x: string, y: string) {
  const table = Array.from(
    { length: x.length + 1 },
    () => Array(y.length + 1).fill(0) as number[],
  );
  const visible: (number | null)[][] = table.map((r, i) =>
    r.map((_, j) => (i === 0 || j === 0 ? 0 : null)),
  );
  const steps: DpStep[] = [
    {
      note: '空前缀与任何序列的 LCS 长度都是 0。',
      line: 0,
      table: clone(visible),
      cell: [],
      deps: [],
      path: [],
    },
  ];
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const equal = x[i - 1] === y[j - 1];
      table[i][j] = equal
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1]);
      visible[i][j] = table[i][j];
      steps.push({
        note: equal
          ? `${x[i - 1]} = ${y[j - 1]}，取左上角 + 1 = ${table[i][j]}。`
          : `${x[i - 1]} ≠ ${y[j - 1]}，取上方与左方较大值 ${table[i][j]}。`,
        line: equal ? 2 : 3,
        table: clone(visible),
        cell: [i, j],
        deps: equal
          ? [[i - 1, j - 1]]
          : [
              [i - 1, j],
              [i, j - 1],
            ],
        path: [],
      });
    }
  }
  let i = x.length,
    j = y.length,
    answer = '';
  const path: number[][] = [];
  while (i > 0 && j > 0) {
    path.push([i, j]);
    let note: string;
    if (x[i - 1] === y[j - 1]) {
      answer = x[i - 1] + answer;
      note = `收下 ${x[i - 1]}，向左上回溯。`;
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      note = '上方不小于左方，向上回溯。';
      i--;
    } else {
      note = '左方更大，向左回溯。';
      j--;
    }
    steps.push({
      note,
      line: 4,
      table: clone(visible),
      cell: [i, j],
      deps: [],
      path: [...path],
      answer,
    });
  }
  steps.push({
    note: `长度 ${table[x.length][y.length]}，一条 LCS 为 ${answer || '空序列'}。`,
    line: 4,
    table: clone(visible),
    cell: [],
    deps: [],
    path,
    answer: answer || '空序列',
  });
  return { steps, length: table[x.length][y.length], answer };
}

export function subarrayTrace(
  a: number[],
  product: boolean,
  allowEmpty = true,
) {
  const rows: number[][] = [];
  const steps: {
    note: string;
    line: number;
    rows: number[][];
    index: number;
    active: number[];
    best: number;
  }[] = [];
  let high = a[0],
    low = a[0],
    highStart = 0,
    lowStart = 0;
  let best = product || !allowEmpty ? a[0] : Math.max(0, a[0]);
  let bestRange = best === 0 && allowEmpty && !product ? [] : [0];
  for (let i = 0; i < a.length; i++) {
    if (i > 0) {
      if (product) {
        const candidates = [
          { v: a[i], start: i },
          { v: high * a[i], start: highStart },
          { v: low * a[i], start: lowStart },
        ];
        const max = candidates.reduce((x, y) => (x.v >= y.v ? x : y)),
          min = candidates.reduce((x, y) => (x.v <= y.v ? x : y));
        high = max.v;
        highStart = max.start;
        low = min.v;
        lowStart = min.start;
      } else {
        if (high > 0) high += a[i];
        else {
          high = a[i];
          highStart = i;
        }
        low = high;
      }
      if (high > best) {
        best = high;
        bestRange = Array.from(
          { length: i - highStart + 1 },
          (_, j) => highStart + j,
        );
      }
    }
    rows.push(product ? [i, a[i], high, low, best] : [i, a[i], high, best]);
    steps.push({
      note: product
        ? `以 ${i} 结尾：最大乘积 ${high}，最小乘积 ${low}；全局最大 ${best}。`
        : `以 ${i} 结尾的非空最大和 ${high}；全局最大 ${best}${bestRange.length ? '' : '，取空段'}。`,
      line: i === 0 ? 0 : product ? 2 : 1,
      rows: rows.map((r) => [...r]),
      index: i,
      active: [...bestRange],
      best,
    });
  }
  return steps;
}

export function knapsack(
  weights: number[],
  values: number[],
  capacity: number,
) {
  const n = weights.length,
    dp = Array.from(
      { length: n + 1 },
      () => Array(capacity + 1).fill(0) as number[],
    );
  const visible: (number | null)[][] = dp.map((r, i) =>
    r.map((_, c) => (i === 0 || c === 0 ? 0 : null)),
  );
  const steps: DpStep[] = [
    {
      note: '第 i 行只使用前 i 件物品；第 0 行和容量 0 都为 0。',
      line: 0,
      table: clone(visible),
      cell: [],
      deps: [],
      path: [],
    },
  ];
  for (let i = 1; i <= n; i++)
    for (let c = 1; c <= capacity; c++) {
      const no = dp[i - 1][c],
        fits = weights[i - 1] <= c;
      const yes = fits
        ? dp[i - 1][c - weights[i - 1]] + values[i - 1]
        : -Infinity;
      dp[i][c] = Math.max(no, yes);
      visible[i][c] = dp[i][c];
      steps.push({
        note: fits
          ? `物品 ${i}：不选=${no}，选=${yes}，取 ${dp[i][c]}。两种转移都读上一行。`
          : `物品 ${i} 重 ${weights[i - 1]}，放不进容量 ${c}，继承 ${no}。`,
        line: fits ? 3 : 2,
        table: clone(visible),
        cell: [i, c],
        deps: fits
          ? [
              [i - 1, c],
              [i - 1, c - weights[i - 1]],
            ]
          : [[i - 1, c]],
        path: [],
      });
    }
  const chosen: number[] = [],
    path: number[][] = [];
  let c = capacity;
  for (let i = n; i >= 1; i--) {
    path.push([i, c]);
    const take = dp[i][c] !== dp[i - 1][c];
    if (take) {
      chosen.push(i);
      c -= weights[i - 1];
    }
    steps.push({
      note: `${take ? '选' : '不选'}物品 ${i}，向上一行回溯，剩余容量 ${c}。`,
      line: 4,
      table: clone(visible),
      cell: [i - 1, c],
      deps: [],
      path: [...path],
      answer: [...chosen].reverse().join('、') || '暂未选物品',
    });
  }
  steps.push({
    note: `最优价值 ${dp[n][capacity]}，选择物品 ${chosen.reverse().join('、') || '无'}。`,
    line: 4,
    table: clone(visible),
    cell: [],
    deps: [],
    path,
    answer: chosen.join('、') || '不选物品',
  });
  return { steps, value: dp[n][capacity], chosen, dp };
}

export function compression(pixels: number[], maxLength = 255) {
  const n = pixels.length,
    dp = Array(n + 1).fill(Infinity) as number[],
    previous = Array(n + 1).fill(0) as number[];
  const rows: (number | null)[][] = [
    Array(n + 1).fill(null),
    Array(n + 1).fill(null),
  ];
  dp[0] = 0;
  rows[0][0] = 0;
  const steps: DpStep[] = [
    {
      note: '空前缀需要 0 位；每段额外存储 11 位头信息。',
      line: 0,
      table: clone(rows),
      cell: [],
      deps: [],
      path: [],
    },
  ];
  for (let i = 1; i <= n; i++) {
    let bits = 1;
    for (let len = 1; len <= Math.min(i, maxLength); len++) {
      bits = Math.max(
        bits,
        Math.max(1, Math.ceil(Math.log2(pixels[i - len] + 1))),
      );
      const cost = dp[i - len] + len * bits + 11;
      if (cost < dp[i]) {
        dp[i] = cost;
        previous[i] = len;
      }
      rows[0][i] = dp[i];
      rows[1][i] = previous[i];
      steps.push({
        note: `前 ${i} 个像素，末段长度 ${len}、位宽 ${bits}：${dp[i - len]} + ${len}×${bits} + 11 = ${cost}；当前最少 ${dp[i]} 位。`,
        line: 3,
        table: clone(rows),
        cell: [0, i],
        deps: [[0, i - len]],
        path: Array.from({ length: len }, (_, j) => [1, i - j]),
      });
    }
  }
  const segments: number[][] = [];
  for (let i = n; i > 0; i -= previous[i])
    segments.unshift(pixels.slice(i - previous[i], i));
  steps.push({
    note: `最少 ${dp[n]} 位（含每段头信息）。回溯末段长度得到分段。`,
    line: 4,
    table: clone(rows),
    cell: [0, n],
    deps: [],
    path: [],
    answer: segments.map((s) => `[${s.join(', ')}]`).join(' | '),
  });
  return { steps, bits: dp[n], segments };
}

export function polygonGame(numbers: number[], ops: string[], cut: number) {
  const n = numbers.length,
    v = Array.from({ length: n }, (_, i) => numbers[(cut + i) % n]);
  // ops[i] connects vertex i to vertex (i+1)%n. cut means delete the edge before vertex cut.
  const operators = Array.from({ length: n - 1 }, (_, i) => ops[(cut + i) % n]);
  const lo = Array.from({ length: n }, () => Array(n).fill(0) as number[]),
    hi = lo.map((r) => [...r]);
  const loExpr = Array.from({ length: n }, () => Array(n).fill('') as string[]),
    hiExpr = loExpr.map((r) => [...r]);
  const visible: (number | null)[][] = lo.map((r) => r.map(() => null));
  const steps: DpStep[] = [];
  for (let i = 0; i < n; i++) {
    lo[i][i] = hi[i][i] = v[i];
    loExpr[i][i] = hiExpr[i][i] = String(v[i]);
    visible[i][i] = v[i];
  }
  steps.push({
    note: '删除指定边后得到一条链，枚举每个区间最后使用的运算符。',
    line: 0,
    table: clone(visible),
    cell: [],
    deps: [],
    path: [],
  });
  for (let len = 2; len <= n; len++)
    for (let i = 0; i + len <= n; i++) {
      const j = i + len - 1;
      lo[i][j] = Infinity;
      hi[i][j] = -Infinity;
      for (let k = i; k < j; k++) {
        const candidates: { value: number; expression: string }[] = [];
        for (const [lv, le] of [
          [lo[i][k], loExpr[i][k]],
          [hi[i][k], hiExpr[i][k]],
        ] as [number, string][]) {
          for (const [rv, re] of [
            [lo[k + 1][j], loExpr[k + 1][j]],
            [hi[k + 1][j], hiExpr[k + 1][j]],
          ] as [number, string][]) {
            candidates.push({
              value: operators[k] === '+' ? lv + rv : lv * rv,
              expression: `(${le} ${operators[k] === '+' ? '+' : '×'} ${re})`,
            });
          }
        }
        for (const candidate of candidates) {
          if (candidate.value < lo[i][j]) {
            lo[i][j] = candidate.value;
            loExpr[i][j] = candidate.expression;
          }
          if (candidate.value > hi[i][j]) {
            hi[i][j] = candidate.value;
            hiExpr[i][j] = candidate.expression;
          }
        }
        visible[i][j] = hi[i][j];
        steps.push({
          note: `区间 [${i},${j}] 在 ${k} 处分开，用 ${operators[k]} 合并。候选值 ${candidates.map((c) => c.value).join('、')}；当前最小 ${lo[i][j]}，最大 ${hi[i][j]}。`,
          line: operators[k] === '+' ? 2 : 3,
          table: clone(visible),
          cell: [i, j],
          deps: [
            [i, k],
            [k + 1, j],
          ],
          path: [],
          extra: `min[${i},${j}] = ${lo[i][j]}`,
        });
      }
    }
  steps.push({
    note: `这一断口的最高得分 ${hi[0][n - 1]}。还要比较其他断口，才能得到整个环的最优值。`,
    line: 4,
    table: clone(visible),
    cell: [0, n - 1],
    deps: [],
    path: [],
    answer: hiExpr[0][n - 1],
  });
  return {
    steps,
    min: lo[0][n - 1],
    max: hi[0][n - 1],
    expression: hiExpr[0][n - 1],
    chain: v,
    operators,
  };
}

export type Job = { id: string; a: number; b: number };
export function schedule(jobs: Job[]) {
  let endA = 0,
    endB = 0;
  const result = jobs.map((job) => {
    const startA = endA;
    endA += job.a;
    const startB = Math.max(endA, endB);
    endB = startB + job.b;
    return { ...job, startA, endA, startB, endB };
  });
  return { jobs: result, time: endB };
}
export function johnson(jobs: Job[]) {
  const first = jobs.filter((j) => j.a <= j.b).sort((x, y) => x.a - y.a);
  const last = jobs.filter((j) => j.a > j.b).sort((x, y) => y.b - x.b);
  return [...first, ...last];
}

export function optimalBST(p: number[], q: number[]) {
  const n = p.length,
    e = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0) as number[]);
  const weight = e.map((r) => [...r]),
    roots = e.map((r) => r.map(() => -1));
  const seen = e.map((row, i) => row.map((_, j) => i === j));
  // Half-open intervals [i,j): empty subtrees are e[i][i] = q[i].
  for (let i = 0; i <= n; i++) e[i][i] = weight[i][i] = q[i];
  const steps: DpStep[] = [];
  const snapshot = () =>
    e.map((row, i) =>
      row.map((v, j) => (j < i || !seen[i][j] ? null : Number(v.toFixed(4)))),
    );
  steps.push({
    note: '演示用半开区间 [i,j)，对角线对应空子树，代价为 q[i]。',
    line: 0,
    table: snapshot(),
    cell: [],
    deps: [],
    path: [],
  });
  for (let len = 1; len <= n; len++)
    for (let i = 0; i + len <= n; i++) {
      const j = i + len;
      weight[i][j] = weight[i][j - 1] + p[j - 1] + q[j];
      e[i][j] = Infinity;
      for (let r = i; r < j; r++) {
        const cost = e[i][r] + e[r + 1][j] + weight[i][j];
        if (cost < e[i][j]) {
          e[i][j] = cost;
          roots[i][j] = r;
        }
        seen[i][j] = true;
        steps.push({
          note: `区间 [${i},${j}) 尝试 K${r + 1} 为根：${e[i][r].toFixed(2)} + ${e[r + 1][j].toFixed(2)} + ${weight[i][j].toFixed(2)} = ${cost.toFixed(2)}。`,
          line: 3,
          table: snapshot(),
          cell: [i, j],
          deps: [
            [i, r],
            [r + 1, j],
          ],
          path: [],
        });
      }
    }
  steps.push({
    note: `最优期望代价 ${e[0][n].toFixed(2)}，最优根为 K${roots[0][n] + 1}。`,
    line: 4,
    table: snapshot(),
    cell: [0, n],
    deps: [],
    path: [],
  });
  return { steps, cost: e[0][n], roots, e, weight };
}
