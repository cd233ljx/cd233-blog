import { lazy, Suspense, useMemo, useState } from 'react';
import { Cells, Demo, Field, Grid, Player, Range } from './common';
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
import { strassen2 } from './divide-model';

const GrowthChart = lazy(() =>
  import('./charts').then((m) => ({ default: m.GrowthChart })),
);

export function ComplexityDemo() {
  const [power, setPower] = useState(4);
  const n = 2 ** power;
  const rows: [string, number][] = [
    ['1', 1],
    ['log₂ n', power],
    ['n', n],
    ['n log₂ n', n * power],
    ['n²', n * n],
    ['2ⁿ', 2 ** n],
  ];
  return (
    <Demo title="拖动规模，比较增长速度">
      <Field label={`输入规模 n = ${n}`}>
        <Range
          label="输入规模指数"
          min={1}
          max={8}
          value={power}
          onChange={setPower}
        />
      </Field>
      <Suspense
        fallback={
          <p className="an-chart-placeholder">
            增长图加载中，下方可查看完整数值。
          </p>
        }
      >
        <GrowthChart rows={rows} />
      </Suspense>
      <Grid
        values={[
          rows.map(([, count]) =>
            count < 1000000
              ? count.toLocaleString('en-US')
              : count.toExponential(1),
          ),
        ]}
        colLabels={rows.map(([label]) => label)}
        rowLabels={['操作次数']}
      />
      <p className="an-muted">
        条长使用 log₂(次数 +
        1)，便于同时看清不同数量级；表格为模型次数，不是实测耗时。
      </p>
      <p>
        选择排序比较次数：n(n−1)/2 = <strong>{(n * (n - 1)) / 2}</strong>。n
        翻倍时，平方项约变成四倍。
      </p>
    </Demo>
  );
}

export function RecursionDemo() {
  const [mode, setMode] = useState('sum'),
    [n, setN] = useState(4);
  const steps = useMemo(
    () => (mode === 'sum' ? sumTrace(n) : hanoiTrace(n)),
    [mode, n],
  );
  const code =
    mode === 'sum'
      ? [
          'sum(n):',
          '  if n == 0: return 0',
          '  child = sum(n - 1)',
          '  return n + child',
        ]
      : [
          'H(n, from, to, aux):',
          '  if n == 0: return',
          '  H(n - 1, from, aux, to)',
          '  move(from, to)',
          '  H(n - 1, aux, to, from)',
        ];
  return (
    <Demo title="调用栈与 Hanoi 移动">
      <div className="an-fields">
        <Field label="例子">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sum">递归求和</option>
            <option value="hanoi">Hanoi 塔</option>
          </select>
        </Field>
        <Field label={`规模 n = ${n}`}>
          <Range label="递归规模" min={1} max={5} value={n} onChange={setN} />
        </Field>
      </div>
      <Player key={`${mode}-${n}`} steps={steps} code={code}>
        {(s) => (
          <>
            {s.rods && (
              <>
                <div className="an-rods">
                  {s.rods.map((rod, i) => (
                    <div
                      className="an-rod"
                      key={i}
                      aria-label={`柱 ${'ABC'[i]}`}
                    >
                      {rod.map((d) => (
                        <div
                          className="an-disc"
                          key={d}
                          style={{ width: `${28 + d * 12}%` }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  className="an-rods"
                  style={{ marginTop: 0, textAlign: 'center' }}
                >
                  {['A 起点', 'B 终点', 'C 辅助'].map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
              </>
            )}
            <p className="an-muted">栈顶在上；每行属于一个尚未返回的调用。</p>
            <div className="an-stack">
              {s.stack.map((frame, i) => (
                <div key={i}>{frame}</div>
              ))}
            </div>
            {!!s.output.length && (
              <p>
                结果 / 已移动次数：<strong>{s.output.join('')}</strong>
              </p>
            )}
          </>
        )}
      </Player>
    </Demo>
  );
}

export function EnumerationDemo() {
  const [mode, setMode] = useState('permutation'),
    [n, setN] = useState(3);
  const steps = useMemo(() => permutationTrace(Math.min(n, 4)), [n]);
  const list = useMemo(() => partitions(n), [n]);
  const withMax = list.filter((row) => row[0] === Math.min(3, n)),
    withoutMax = list.filter((row) => row[0] < Math.min(3, n));
  return (
    <Demo title="排列的撤销，与划分的两类分支">
      <div className="an-fields">
        <Field label="问题">
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setN(3);
            }}
          >
            <option value="permutation">全排列</option>
            <option value="partition">整数划分</option>
          </select>
        </Field>
        <Field label={`n = ${n}`}>
          <Range
            label="枚举规模"
            min={1}
            max={mode === 'permutation' ? 4 : 8}
            value={n}
            onChange={setN}
          />
        </Field>
      </div>
      {mode === 'permutation' ? (
        <Player
          key={n}
          steps={steps}
          code={[
            'perm(depth):',
            '  if depth == n: output(a); return',
            '  for i = depth .. n-1:',
            '    swap(a[depth], a[i])',
            '    perm(depth + 1)',
            '    swap(a[depth], a[i]) // 撤销',
          ]}
        >
          {(s) => (
            <>
              <Cells values={s.values} active={s.active} />
              <p>
                已输出 {s.output.length} 个：{s.output.join(' · ') || '—'}
              </p>
            </>
          )}
        </Player>
      ) : (
        <>
          <p>
            q({n}, {n}) = <strong>{list.length}</strong>；所有划分按非增序书写：
          </p>
          <p>{list.map((row) => row.join('+')).join('；')}</p>
          <p>
            看 q({n}, {Math.min(3, n)})：含最大加数 {Math.min(3, n)} 的有{' '}
            {withMax.length} 个，不含它的有 {withoutMax.length}{' '}
            个。两组不重不漏。
          </p>
          <details>
            <summary>展开这两个分支</summary>
            <p>含：{withMax.map((r) => r.join('+')).join('；') || '无'}</p>
            <p>不含：{withoutMax.map((r) => r.join('+')).join('；') || '无'}</p>
          </details>
        </>
      )}
    </Demo>
  );
}

export function BinaryDemo() {
  const [target, setTarget] = useState(13);
  const a = [1, 3, 5, 8, 13, 21, 34, 55];
  const steps = useMemo(() => binaryTrace(a, target), [target]);
  return (
    <Demo title="二分查找：看区间如何缩小">
      <Field label="目标值">
        <select
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        >
          {[13, 1, 55, 7, 0, 60].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Player
        key={target}
        steps={steps}
        code={[
          'left = 0; right = n - 1',
          'while left <= right:',
          '  mid = left + (right - left) // 2',
          '  if a[mid] == x: return mid',
          '  if a[mid] < x: left = mid + 1',
          '  else: right = mid - 1',
          'return -1',
        ]}
      >
        {(s) => (
          <Cells
            values={s.values}
            active={s.active}
            muted={a
              .map((_, i) => i)
              .filter((i) => i < s.left! || i > s.right!)}
          />
        )}
      </Player>
    </Demo>
  );
}

export function PowerDemo() {
  const [n, setN] = useState(10);
  const steps = useMemo(() => powerTrace(2, n), [n]);
  return (
    <Demo title="快速幂：一次子调用，复用两次">
      <Field label={`计算 2^${n}`}>
        <Range label="幂指数" min={0} max={20} value={n} onChange={setN} />
      </Field>
      <Player
        key={n}
        steps={steps}
        code={[
          'pow(a, n):',
          '  if n == 0: return 1',
          '  half = pow(a, n // 2)',
          '  if n is even: return half * half',
          '  return half * half * a',
        ]}
      >
        {(s) => (
          <div className="an-stack">
            {s.stack.map((frame, i) => (
              <div key={i}>{frame}</div>
            ))}
          </div>
        )}
      </Player>
    </Demo>
  );
}

const recurrenceOptions = [
  { label: '二分查找：T(n/2)+1', a: 1, b: 2, p: 0, order: 'Θ(log n)' },
  { label: '归并排序：2T(n/2)+n', a: 2, b: 2, p: 1, order: 'Θ(n log n)' },
  { label: 'Karatsuba：3T(n/2)+n', a: 3, b: 2, p: 1, order: 'Θ(n^(log₂ 3))' },
  { label: '普通矩阵分块：8T(n/2)+n²', a: 8, b: 2, p: 2, order: 'Θ(n³)' },
  { label: 'Strassen：7T(n/2)+n²', a: 7, b: 2, p: 2, order: 'Θ(n^(log₂ 7))' },
];
export function RecurrenceDemo() {
  const [kind, setKind] = useState(1),
    [height, setHeight] = useState(4);
  const option = recurrenceOptions[kind],
    rows = recurrenceLevels(option.a, option.b, option.p, height);
  return (
    <Demo title="递归树：每层的总工作量">
      <div className="an-fields">
        <Field label="递推式">
          <select
            value={kind}
            onChange={(e) => setKind(Number(e.target.value))}
          >
            {recurrenceOptions.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`树高 ${height}，n = ${2 ** height}`}>
          <Range
            label="递归树高度"
            min={1}
            max={6}
            value={height}
            onChange={setHeight}
          />
        </Field>
      </div>
      <Grid
        values={rows.map((r) => r.slice(1))}
        colLabels={['节点数', '每个规模', '单节点工作', '整层工作']}
        rowLabels={rows.map((_, i) =>
          i === height ? `${i}（叶）` : String(i),
        )}
      />
      <p>
        总工作量 = {rows.map((r) => r[4]).join(' + ')} ={' '}
        <strong>{rows.reduce((sum, r) => sum + r[4], 0)}</strong>，增长阶为{' '}
        {option.order}。
      </p>
      <p className="an-muted">
        演示取 f(n)=n^p、T(1)=1；实际算法的常数系数可不同。
      </p>
    </Demo>
  );
}

export function MultiplicationDemo() {
  const [value, setValue] = useState(0);
  const cases = [
      [12, 34],
      [37, 86],
      [99, 99],
    ],
    [x, y] = cases[value];
  const a = Math.floor(x / 10),
    b = x % 10,
    c = Math.floor(y / 10),
    d = y % 10;
  const z2 = a * c,
    z0 = b * d,
    z1 = (a + b) * (c + d) - z2 - z0;
  const s = strassen2([1, 2, 3, 4], [5, 6, 7, 8]);
  return (
    <Demo title="少一次乘法，代数恒等式仍成立">
      <Field label="两位数乘法">
        <select
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        >
          {cases.map((pair, i) => (
            <option value={i} key={i}>
              {pair.join(' × ')}
            </option>
          ))}
        </select>
      </Field>
      <p>
        ac = {z2}；bd = {z0}；(a+b)(c+d) = {(a + b) * (c + d)}。
      </p>
      <p>
        ad+bc = {z1}；结果 = {z2}×100 + {z1}×10 + {z0} ={' '}
        <strong>{x * y}</strong>。
      </p>
      <details>
        <summary>看一个 2×2 的 Strassen 例子</summary>
        <p>A = [[1,2],[3,4]]，B = [[5,6],[7,8]]</p>
        <Cells
          values={s.products}
          labels={s.products.map((_, i) => `M${i + 1}`)}
        />
        <Grid
          values={[s.result.slice(0, 2), s.result.slice(2)]}
          rowLabels={['C 第一行', 'C 第二行']}
        />
      </details>
    </Demo>
  );
}

export function FibonacciDemo() {
  const [n, setN] = useState(6),
    [memo, setMemo] = useState(true);
  const steps = useMemo(() => fibonacciTrace(n, memo), [n, memo]);
  return (
    <Demo title="重复调用，还是查一次缓存">
      <div className="an-fields">
        <Field label="算法">
          <select
            value={String(memo)}
            onChange={(e) => setMemo(e.target.value === 'true')}
          >
            <option value="true">记忆化递归</option>
            <option value="false">朴素递归</option>
          </select>
        </Field>
        <Field label={`n = ${n}`}>
          <Range
            label="Fibonacci 下标"
            min={2}
            max={8}
            value={n}
            onChange={setN}
          />
        </Field>
      </div>
      <Player
        key={`${n}-${memo}`}
        steps={steps}
        code={[
          'f(k):',
          memo ? '  if cached(k): return memo[k]' : '  // 不查缓存',
          '  if k <= 1: value = k',
          '  else: value = f(k - 1) + f(k - 2)',
          memo ? '  memo[k] = value; return value' : '  return value',
        ]}
      >
        {(s) => (
          <>
            <p>
              累计调用：<strong>{s.calls}</strong>；当前栈：
              {s.stack.map((k) => `F(${k})`).join(' → ') || '已返回'}
            </p>
            <Grid
              values={[s.memo, s.visits]}
              rowLabels={[memo ? '缓存值' : '最近返回值', '调用次数']}
            />
          </>
        )}
      </Player>
    </Demo>
  );
}
