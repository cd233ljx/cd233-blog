export type BasicStep = {
  note: string;
  line: number;
  values: number[];
  active: number[];
  stack: string[];
  output: string[];
  rods?: number[][];
  left?: number;
  right?: number;
};
const base = (): BasicStep => ({
  note: '',
  line: 0,
  values: [],
  active: [],
  stack: [],
  output: [],
});

export function sumTrace(n: number) {
  const steps: BasicStep[] = [],
    stack: string[] = [];
  function visit(k: number): number {
    stack.push(`sum(${k})：等待子调用`);
    steps.push({
      ...base(),
      stack: [...stack],
      note: `进入 sum(${k})，当前有 ${stack.length} 个调用帧。`,
      line: 0,
    });
    let result: number;
    if (k === 0) {
      result = 0;
      steps.push({
        ...base(),
        stack: [...stack],
        note: '到达 sum(0) = 0，开始返回。',
        line: 1,
      });
    } else {
      const child = visit(k - 1);
      result = k + child;
      stack[stack.length - 1] = `sum(${k})：${k} + ${child} = ${result}`;
      steps.push({
        ...base(),
        stack: [...stack],
        note: `子调用返回 ${child}，本层得到 ${result}。`,
        line: 3,
      });
    }
    stack.pop();
    return result;
  }
  const result = visit(n);
  steps.push({
    ...base(),
    note: `结果 ${result}；所有调用帧已退出。`,
    line: 3,
    output: [String(result)],
  });
  return steps;
}

export function hanoiTrace(n: number) {
  const rods = [
    Array.from({ length: n }, (_, i) => n - i),
    [] as number[],
    [] as number[],
  ];
  const steps: BasicStep[] = [],
    stack: string[] = [];
  let count = 0;
  const take = (note: string, line: number) =>
    steps.push({
      ...base(),
      rods: rods.map((r) => [...r]),
      stack: [...stack],
      note,
      line,
      output: [String(count)],
    });
  take('把 A 上的全部盘子移到 B；C 是辅助柱。', 0);
  function move(k: number, from: number, to: number, aux: number) {
    if (k === 0) return;
    stack.push(`H(${k}, ${'ABC'[from]}→${'ABC'[to]}, 借 ${'ABC'[aux]})`);
    move(k - 1, from, aux, to);
    const disc = rods[from].pop()!;
    rods[to].push(disc);
    count++;
    take(
      `第 ${count} 次移动：盘 ${disc} 从 ${'ABC'[from]} 到 ${'ABC'[to]}。`,
      3,
    );
    move(k - 1, aux, to, from);
    stack.pop();
  }
  move(n, 0, 1, 2);
  take(`完成：${count} = 2^${n} − 1 次移动。`, 4);
  return steps;
}

export function permutationTrace(n: number) {
  const a = Array.from({ length: n }, (_, i) => i + 1),
    output: string[] = [],
    steps: BasicStep[] = [];
  const take = (depth: number, note: string, line: number) =>
    steps.push({
      ...base(),
      values: [...a],
      active: Array.from({ length: depth }, (_, i) => i),
      output: [...output],
      note,
      line,
    });
  take(0, '从第 0 位开始，依次选定每一位。', 0);
  function dfs(depth: number) {
    if (depth === n) {
      output.push(a.join(''));
      take(depth, `输出 ${a.join('')}。`, 1);
      return;
    }
    for (let i = depth; i < n; i++) {
      [a[depth], a[i]] = [a[i], a[depth]];
      take(depth + 1, `交换位置 ${depth} 与 ${i}，固定前 ${depth + 1} 位。`, 3);
      dfs(depth + 1);
      [a[depth], a[i]] = [a[i], a[depth]];
      take(depth, `撤销交换，恢复进入这一分支前的数组。`, 5);
    }
  }
  dfs(0);
  take(0, `共 ${output.length} 个排列。交换式枚举的输出不保证字典序。`, 5);
  return steps;
}

export function partitions(n: number, max = n): number[][] {
  if (n === 0) return [[]];
  const result: number[][] = [];
  for (let x = Math.min(n, max); x >= 1; x--) {
    for (const rest of partitions(n - x, x)) result.push([x, ...rest]);
  }
  return result;
}

export function binaryTrace(a: number[], target: number) {
  const steps: BasicStep[] = [];
  let left = 0,
    right = a.length - 1;
  const take = (note: string, line: number, active: number[] = []) =>
    steps.push({ ...base(), values: [...a], left, right, active, note, line });
  take('初始区间包含全部元素，下标从 0 开始。', 0);
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    take(`left=${left}，right=${right}，mid=${mid}，a[mid]=${a[mid]}。`, 2, [
      mid,
    ]);
    if (a[mid] === target) {
      take(`找到 ${target}，返回下标 ${mid}。`, 3, [mid]);
      return steps;
    }
    if (a[mid] < target) {
      left = mid + 1;
      take(`${a[mid]} < ${target}，排除中点和左半区。`, 4);
    } else {
      right = mid - 1;
      take(`${a[mid]} > ${target}，排除中点和右半区。`, 5);
    }
  }
  take(`left > right，区间为空，${target} 不在数组中。`, 6);
  return steps;
}

export function powerTrace(a: number, exponent: number) {
  const steps: BasicStep[] = [],
    stack: string[] = [];
  function power(n: number): number {
    stack.push(`pow(${a}, ${n})`);
    steps.push({
      ...base(),
      stack: [...stack],
      note: `进入 pow(${a}, ${n})。`,
      line: 0,
    });
    if (n === 0) {
      steps.push({
        ...base(),
        stack: [...stack],
        note: '指数为 0，直接返回 1。',
        line: 1,
      });
      stack.pop();
      return 1;
    }
    const half = power(Math.floor(n / 2));
    const result = n % 2 === 0 ? half * half : half * half * a;
    steps.push({
      ...base(),
      stack: [...stack],
      note: `half=${half}，复用它：${half} × ${half}${n % 2 ? ' × ' + a : ''} = ${result}。`,
      line: n % 2 ? 4 : 3,
    });
    stack.pop();
    return result;
  }
  const result = power(exponent);
  steps.push({
    ...base(),
    note: `${a}^${exponent} = ${result}，每层只递归一次。`,
    line: exponent === 0 ? 1 : exponent % 2 ? 4 : 3,
    output: [String(result)],
  });
  return steps;
}

export function fibonacciTrace(n: number, memoized: boolean) {
  const memo: (number | null)[] = Array(n + 1).fill(null);
  const visits = Array(n + 1).fill(0) as number[];
  const steps: {
    note: string;
    line: number;
    memo: (number | null)[];
    visits: number[];
    stack: number[];
    calls: number;
  }[] = [];
  const stack: number[] = [];
  let calls = 0;
  const take = (note: string, line: number) =>
    steps.push({
      note,
      line,
      memo: [...memo],
      visits: [...visits],
      stack: [...stack],
      calls,
    });
  take('F(0)=0，F(1)=1。调用次数包含命中缓存和边界的调用。', 0);
  function f(k: number): number {
    calls++;
    visits[k]++;
    stack.push(k);
    take(`调用 F(${k})，累计 ${calls} 次。`, 0);
    if (memoized && memo[k] !== null) {
      take(`F(${k}) 已经算过，直接取 ${memo[k]}。`, 1);
      stack.pop();
      return memo[k]!;
    }
    const value = k <= 1 ? k : f(k - 1) + f(k - 2);
    take(`算得 F(${k}) = ${value}。`, k <= 1 ? 2 : 3);
    memo[k] = value;
    take(`F(${k}) = ${value}${memoized ? '，存入缓存' : '，返回结果'}。`, 4);
    stack.pop();
    return value;
  }
  const result = f(n);
  take(`F(${n}) = ${result}，共调用 ${calls} 次。`, 4);
  return steps;
}

export function recurrenceLevels(
  a: number,
  b: number,
  p: number,
  height: number,
) {
  const n = b ** height;
  const rows = Array.from({ length: height }, (_, depth) => {
    const nodes = a ** depth,
      size = n / b ** depth;
    return [depth, nodes, size, size ** p, nodes * size ** p];
  });
  rows.push([height, a ** height, 1, 1, a ** height]);
  return rows;
}
