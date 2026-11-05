import { describe, expect, it } from 'vitest';
import {
  binaryTrace,
  fibonacciTrace,
  hanoiTrace,
  partitions,
  permutationTrace,
  powerTrace,
  recurrenceLevels,
  sumTrace,
} from './foundations-model';
import {
  mergeTrace,
  quickTrace,
  roundRobin,
  strassen2,
  tileTrace,
} from './divide-model';
import {
  compression,
  johnson,
  knapsack,
  lcsTrace,
  matrixChain,
  optimalBST,
  polygonGame,
  schedule,
  subarrayTrace,
} from './dp-model';

function permutations<T>(a: T[]): T[][] {
  return a.length
    ? a.flatMap((x, i) =>
        permutations(a.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      )
    : [[]];
}
function subsequences(a: string) {
  return Array.from({ length: 2 ** a.length }, (_, mask) =>
    [...a].filter((_, i) => mask & (1 << i)).join(''),
  );
}
function expressionValues(a: number[], ops: string[]): number[] {
  if (a.length === 1) return a;
  return ops.flatMap((op, k) =>
    expressionValues(a.slice(0, k + 1), ops.slice(0, k)).flatMap((x) =>
      expressionValues(a.slice(k + 1), ops.slice(k + 1)).map((y) =>
        op === '+' ? x + y : x * y,
      ),
    ),
  );
}

describe('正文中的数值与递归轨迹', () => {
  it('核对求和、快速幂、排列与划分', () => {
    expect(sumTrace(4).at(-1)?.output).toEqual(['10']);
    for (const n of [0, 1, 2, 5, 10, 20]) {
      expect(powerTrace(2, n).at(-1)?.output).toEqual([String(2 ** n)]);
      expect(powerTrace(2, n).some((s) => s.line === 1)).toBe(true);
    }
    expect(new Set(permutationTrace(4).at(-1)?.output).size).toBe(24);
    expect(partitions(6)).toHaveLength(11);
    expect(partitions(5, 3)).toHaveLength(5);
  });
  it('每次 Hanoi 移动只改变一块盘且不把大盘压在小盘上', () => {
    for (let n = 1; n <= 5; n++) {
      const steps = hanoiTrace(n);
      let previous = steps[0].rods!;
      for (const step of steps.slice(1, -1)) {
        const rods = step.rods!;
        expect(rods.flat().sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, i) => i + 1),
        );
        for (const rod of rods)
          expect(rod.every((v, i) => i === 0 || rod[i - 1] > v)).toBe(true);
        expect(
          rods.filter((rod, i) => rod.length !== previous[i].length),
        ).toHaveLength(2);
        previous = rods;
      }
      expect(steps.at(-1)?.rods?.[1]).toEqual(
        Array.from({ length: n }, (_, i) => n - i),
      );
      expect(steps.at(-1)?.output).toEqual([String(2 ** n - 1)]);
    }
  });
  it('二分的成功、失败、空数组与区间收缩', () => {
    const a = [1, 3, 5, 8, 13, 21, 34, 55];
    for (const target of [13, 1, 55, 7, 0, 60]) {
      const end = binaryTrace(a, target).at(-1)!;
      if (a.includes(target)) expect(end.active).toEqual([a.indexOf(target)]);
      else expect(end.left!).toBeGreaterThan(end.right!);
    }
    expect(binaryTrace([], 1).at(-1)?.line).toBe(6);
  });
  it('Fibonacci 调用数与递归树的逐层费用', () => {
    expect(fibonacciTrace(6, false).at(-1)?.calls).toBe(25);
    expect(fibonacciTrace(6, true).at(-1)?.calls).toBe(11);
    expect(fibonacciTrace(6, true).at(-1)?.memo[6]).toBe(8);
    expect(recurrenceLevels(2, 2, 1, 3).map((r) => r[4])).toEqual([8, 8, 8, 8]);
    expect(strassen2([1, 2, 3, 4], [5, 6, 7, 8]).result).toEqual([
      19, 22, 43, 50,
    ]);
  });
});

describe('排序与构造的不变式', () => {
  it('排序和每个排名都与数值排序一致，含重复值与负数', () => {
    for (const a of [
      [],
      [1],
      [4, 4, 4, 4],
      [6, 7, 5, 2, 5, 8],
      [0, -1, 8, -3],
    ]) {
      const sorted = [...a].sort((x, y) => x - y);
      expect(mergeTrace(a).at(-1)?.values).toEqual(sorted);
      expect(quickTrace(a).at(-1)?.values).toEqual(sorted);
      for (let k = 1; k <= a.length; k++)
        expect(quickTrace(a, k).at(-1)?.values[k - 1]).toBe(sorted[k - 1]);
    }
  });
  it('每个缺口位置均覆盖一次，每块骨牌为 L 形', () => {
    for (const n of [2, 4, 8])
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const board = tileTrace(n, r, c).at(-1)!.board;
          expect(board[r][c]).toBe(-1);
          expect(board.flat().filter((x) => x <= 0)).toEqual([-1]);
          for (let id = 1; id <= (n * n - 1) / 3; id++) {
            const cells = board.flatMap((row, i) =>
              row.flatMap((v, j) => (v === id ? [[i, j]] : [])),
            );
            expect(cells).toHaveLength(3);
            for (const axis of [0, 1])
              expect(
                Math.max(...cells.map((p) => p[axis])) -
                  Math.min(...cells.map((p) => p[axis])),
              ).toBe(1);
          }
        }
  });
  it('循环赛每人遇到其余选手一次，且每日对阵互相对应', () => {
    for (const n of [2, 4, 8]) {
      const table = roundRobin(n);
      table.forEach((row, i) => {
        expect([...row].sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, j) => j + 1).filter((j) => j !== i + 1),
        );
        row.forEach((opponent, day) =>
          expect(table[opponent - 1][day]).toBe(i + 1),
        );
      });
    }
  });
});

describe('DP 与独立穷举的结果一致', () => {
  it('矩阵链算例与括号方案', () => {
    expect(matrixChain([10, 30, 5, 60]).cost).toBe(4500);
    expect(matrixChain([30, 35, 15, 5, 10, 20, 25]).cost).toBe(15125);
    expect(matrixChain([8, 8]).cost).toBe(0);
  });
  it('LCS 输出确为双方子序列，且长度最优', () => {
    for (const [x, y] of [
      ['ABCBDAB', 'BDCABA'],
      ['ABC', 'AC'],
      ['ABC', 'XYZ'],
      ['', 'ABC'],
      ['AAA', 'AA'],
    ]) {
      const a = subsequences(x),
        b = new Set(subsequences(y)),
        result = lcsTrace(x, y);
      expect(a).toContain(result.answer);
      expect(b.has(result.answer)).toBe(true);
      expect(result.length).toBe(
        Math.max(...a.filter((s) => b.has(s)).map((s) => s.length)),
      );
    }
  });
  it('子段和与积覆盖全负、零与负负得正的情形', () => {
    for (const a of [
      [-2, 11, -4, 13, -5, -2],
      [-2, -3, -1],
      [-2, 3, -4],
      [0, -2, -3, 0, 4],
    ]) {
      const segments = a.flatMap((_, i) =>
        a.slice(i).map((_, j) => a.slice(i, i + j + 1)),
      );
      for (const product of [false, true])
        for (const empty of [false, true]) {
          const max = Math.max(
            ...segments.map((s) =>
              s.reduce((v, x) => (product ? v * x : v + x), product ? 1 : 0),
            ),
          );
          const result = subarrayTrace(a, product, empty).at(-1)!;
          expect(result.best).toBe(!product && empty ? Math.max(0, max) : max);
          expect(
            result.active.reduce(
              (v, i) => (product ? v * a[i] : v + a[i]),
              product ? 1 : 0,
            ),
          ).toBe(result.best);
        }
    }
  });
  it('背包最优价值与回溯物品相符，容量不足时不选', () => {
    const w = [2, 2, 6, 5, 4],
      v = [6, 3, 5, 4, 6];
    for (let c = 0; c <= 12; c++) {
      const subsets = Array.from({ length: 2 ** w.length }, (_, mask) =>
        w.map((_, i) => i).filter((i) => mask & (1 << i)),
      );
      const best = Math.max(
        ...subsets
          .filter((s) => s.reduce((t, i) => t + w[i], 0) <= c)
          .map((s) => s.reduce((t, i) => t + v[i], 0)),
      );
      const result = knapsack(w, v, c);
      expect(result.value).toBe(best);
      expect(result.chosen.reduce((t, i) => t + v[i - 1], 0)).toBe(best);
      expect(
        result.chosen.reduce((t, i) => t + w[i - 1], 0),
      ).toBeLessThanOrEqual(c);
    }
  });
  it('压缩费用等于穷举所有合法切分的最小成本', () => {
    for (const a of [
      [1, 1, 1, 1, 255, 255, 1, 1, 1, 1],
      [0, 0, 0],
      [1, 2, 3, 4, 5, 6],
    ]) {
      for (const limit of [2, 255]) {
        const costs: number[] = [];
        for (let mask = 0; mask < 2 ** (a.length - 1); mask++) {
          const parts: number[][] = [[]];
          a.forEach((x, i) => {
            parts.at(-1)!.push(x);
            if (i < a.length - 1 && mask & (1 << i)) parts.push([]);
          });
          if (parts.every((p) => p.length <= limit))
            costs.push(
              parts.reduce(
                (cost, p) =>
                  cost +
                  11 +
                  p.length * Math.max(1, Math.max(...p).toString(2).length),
                0,
              ),
            );
        }
        const result = compression(a, limit);
        expect(result.bits).toBe(Math.min(...costs));
        expect(result.segments.flat()).toEqual(a);
      }
    }
    expect(compression([1, 1, 1, 1, 255, 255, 1, 1, 1, 1]).bits).toBe(57);
  });
  it('多边形每个断口保留的最小、最大值均正确', () => {
    const a = [-7, 4, 2, 5],
      ops = ['+', '*', '+', '*'];
    for (let cut = 0; cut < a.length; cut++) {
      const chain = [...a.slice(cut), ...a.slice(0, cut)];
      const operators = [...ops.slice(cut), ...ops.slice(0, cut)].slice(0, -1);
      const possible = expressionValues(chain, operators),
        result = polygonGame(a, ops, cut);
      expect(result.min).toBe(Math.min(...possible));
      expect(result.max).toBe(Math.max(...possible));
    }
  });
  it('Johnson 工期等于所有排列中的最短工期', () => {
    const jobs = [
      { id: 'A', a: 3, b: 6 },
      { id: 'B', a: 8, b: 2 },
      { id: 'C', a: 4, b: 7 },
      { id: 'D', a: 6, b: 3 },
    ];
    expect(schedule(jobs).time).toBe(25);
    const result = schedule(johnson(jobs));
    expect(result.time).toBe(23);
    expect(result.time).toBe(
      Math.min(...permutations(jobs).map((order) => schedule(order).time)),
    );
    for (const j of result.jobs)
      expect(j.startB).toBeGreaterThanOrEqual(j.endA);
  });
  it('BST 的概率加权深度与 DP 期望值使用相同口径', () => {
    const p = [0.6, 0.1],
      q = [0.1, 0.1, 0.1],
      result = optimalBST(p, q);
    function cost(i: number, j: number, depth: number): number {
      if (i === j) return q[i] * (depth + 1);
      const r = result.roots[i][j];
      return (
        p[r] * (depth + 1) + cost(i, r, depth + 1) + cost(r + 1, j, depth + 1)
      );
    }
    expect(result.cost).toBeCloseTo(1.6);
    expect(cost(0, p.length, 0)).toBeCloseTo(result.cost);
  });
});
