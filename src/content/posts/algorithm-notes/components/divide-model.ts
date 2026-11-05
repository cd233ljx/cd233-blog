export type SortStep = {
  note: string;
  line: number;
  values: number[];
  active: number[];
  left: number;
  right: number;
  buffer: number[];
  stack: string[];
};

export function mergeTrace(input: number[]) {
  const a = [...input],
    steps: SortStep[] = [],
    stack: string[] = [];
  const take = (
    note: string,
    line: number,
    left: number,
    right: number,
    active: number[] = [],
    buffer: number[] = [],
  ) =>
    steps.push({
      note,
      line,
      left,
      right,
      active,
      buffer: [...buffer],
      stack: [...stack],
      values: [...a],
    });
  take('先递归分开，再合并两个已经有序的区间。', 0, 0, a.length - 1);
  function sort(left: number, right: number) {
    stack.push(`sort(${left}, ${right})`);
    take(`进入区间 [${left}, ${right}]。`, 0, left, right);
    if (left >= right) {
      stack.pop();
      return;
    }
    const mid = Math.floor((left + right) / 2);
    sort(left, mid);
    sort(mid + 1, right);
    let i = left,
      j = mid + 1;
    const temp: number[] = [];
    while (i <= mid || j <= right) {
      const active = [i <= mid ? i : -1, j <= right ? j : -1];
      const useLeft = j > right || (i <= mid && a[i] <= a[j]);
      const value = useLeft ? a[i++] : a[j++];
      temp.push(value);
      take(
        `左指针 i=${active[0] < 0 ? '结束' : active[0]}，右指针 j=${active[1] < 0 ? '结束' : active[1]}；取 ${value} 写入缓冲区。`,
        4,
        left,
        right,
        active,
        temp,
      );
    }
    for (let k = 0; k < temp.length; k++) a[left + k] = temp[k];
    take(
      `将缓冲区写回 [${left}, ${right}]，这个区间已有序。`,
      5,
      left,
      right,
      [],
      temp,
    );
    stack.pop();
  }
  sort(0, a.length - 1);
  take('排序完成。', 5, 0, a.length - 1);
  return steps;
}

export function quickTrace(input: number[], kth?: number) {
  const a = [...input],
    steps: SortStep[] = [],
    stack: string[] = [];
  const take = (
    note: string,
    line: number,
    left: number,
    right: number,
    active: number[] = [],
  ) =>
    steps.push({
      note,
      line,
      left,
      right,
      active,
      buffer: [],
      stack: [...stack],
      values: [...a],
    });
  take(
    kth
      ? `寻找第 ${kth} 小，即目标下标 ${kth - 1}。`
      : '每轮把末尾元素作为基准。',
    0,
    0,
    a.length - 1,
  );
  function partition(left: number, right: number) {
    const pivot = a[right];
    let i = left;
    for (let j = left; j < right; j++) {
      take(
        `基准=${pivot}，检查 j=${j}；小于等于基准的区间为 [${left}, ${i - 1}]。`,
        2,
        left,
        right,
        [j, right],
      );
      if (a[j] <= pivot) {
        [a[i], a[j]] = [a[j], a[i]];
        take(`交换 i=${i} 与 j=${j}，把 ${a[i]} 纳入左区间。`, 3, left, right, [
          i,
          j,
        ]);
        i++;
      }
    }
    [a[i], a[right]] = [a[right], a[i]];
    take(`基准 ${pivot} 归位到下标 ${i}。`, 4, left, right, [i]);
    return i;
  }
  function sort(left: number, right: number) {
    if (left >= right) return;
    stack.push(`quick(${left}, ${right})`);
    const q = partition(left, right);
    sort(left, q - 1);
    sort(q + 1, right);
    stack.pop();
  }
  if (kth === undefined) {
    sort(0, a.length - 1);
    take('排序完成。', 5, 0, a.length - 1);
  } else {
    let left = 0,
      right = a.length - 1;
    while (left <= right) {
      const q = partition(left, right);
      if (q === kth - 1) {
        take(`第 ${kth} 小的数是 ${a[q]}；其余位置不必有序。`, 5, left, right, [
          q,
        ]);
        break;
      }
      if (q > kth - 1) right = q - 1;
      else left = q + 1;
      take(
        `目标不在被排除的一侧，只继续区间 [${left}, ${right}]。`,
        5,
        left,
        right,
      );
    }
  }
  return steps;
}

export function tileTrace(size: number, holeRow: number, holeCol: number) {
  const board = Array.from(
    { length: size },
    () => Array(size).fill(0) as number[],
  );
  board[holeRow][holeCol] = -1;
  const steps: {
    note: string;
    line: number;
    board: number[][];
    active: number[][];
    region: number[];
  }[] = [];
  let id = 0;
  const take = (
    note: string,
    line: number,
    active: number[][],
    region: number[],
  ) =>
    steps.push({ note, line, active, region, board: board.map((r) => [...r]) });
  take(
    '黑格是缺口。先用一块 L 骨牌让其余三个象限也各有一个缺口。',
    0,
    [],
    [0, 0, size],
  );
  function cover(r: number, c: number, n: number, hr: number, hc: number) {
    if (n === 1) return;
    const half = n / 2;
    const centers = [
      [r + half - 1, c + half - 1],
      [r + half - 1, c + half],
      [r + half, c + half - 1],
      [r + half, c + half],
    ];
    const quadrant = (hr >= r + half ? 2 : 0) + (hc >= c + half ? 1 : 0);
    const tile = ++id,
      active: number[][] = [];
    for (let q = 0; q < 4; q++) {
      if (q !== quadrant) {
        const [x, y] = centers[q];
        board[x][y] = tile;
        active.push([x, y]);
      }
    }
    take(
      `在 (${r},${c}) 起、边长 ${n} 的子棋盘中央放第 ${tile} 块 L；递归处理四个象限。`,
      2,
      active,
      [r, c, n],
    );
    for (let q = 0; q < 4; q++) {
      const [x, y] = q === quadrant ? [hr, hc] : centers[q];
      cover(r + (q >= 2 ? half : 0), c + (q % 2 ? half : 0), half, x, y);
    }
  }
  cover(0, 0, size, holeRow, holeCol);
  take(
    `覆盖完成：${id} 块 L，共覆盖 ${size * size - 1} 格。`,
    3,
    [],
    [0, 0, size],
  );
  return steps;
}

// For n = 2^k, XOR is the same block-copy construction as the recursive table.
export function roundRobin(n: number) {
  return Array.from({ length: n }, (_, player) =>
    Array.from({ length: n - 1 }, (_, day) => (player ^ (day + 1)) + 1),
  );
}

export function strassen2(a: number[], b: number[]) {
  const [x, y, z, w] = a,
    [r, s, t, u] = b;
  const products = [
    (x + w) * (r + u),
    (z + w) * r,
    x * (s - u),
    w * (t - r),
    (x + y) * u,
    (z - x) * (r + s),
    (y - w) * (t + u),
  ];
  const [m1, m2, m3, m4, m5, m6, m7] = products;
  return {
    products,
    result: [m1 + m4 - m5 + m7, m3 + m5, m2 + m4, m1 - m2 + m3 + m6],
  };
}
