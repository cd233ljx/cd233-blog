import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Cells, Demo, Field, Grid, Player, Range } from './common';
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
  type Job,
} from './dp-model';

const ScheduleChart = lazy(() =>
  import('./charts').then((m) => ({ default: m.ScheduleChart })),
);

export function MatrixDemo() {
  const [example, setExample] = useState(0);
  const cases = [
    [30, 35, 15, 5, 10, 20, 25],
    [10, 30, 5, 60],
    [8, 8, 8, 8],
  ];
  const p = cases[example],
    result = useMemo(() => matrixChain(p), [example]);
  return (
    <Demo title="矩阵链：沿斜线填表，再回溯括号">
      <Field label="矩阵维度序列 p">
        <select
          value={example}
          onChange={(e) => setExample(Number(e.target.value))}
        >
          {cases.map((c, i) => (
            <option value={i} key={i}>
              {c.join(', ')}
            </option>
          ))}
        </select>
      </Field>
      <p>
        {p
          .slice(0, -1)
          .map((v, i) => `A${i + 1}: ${v}×${p[i + 1]}`)
          .join('；')}
      </p>
      <Player
        key={example}
        steps={result.steps}
        code={[
          'm[i,i] = 0',
          'for len = 2 .. n:',
          '  for each [i,j] of length len:',
          '    m[i,j] = min_k(m[i,k]+m[k+1,j]+p[i-1]*p[k]*p[j])',
          '按 split[i,j] 递归输出左右括号',
        ]}
      >
        {(s) => (
          <>
            <Grid
              values={s.table}
              rowLabels={p.slice(1).map((_, i) => `A${i + 1}`)}
              colLabels={p.slice(1).map((_, i) => `A${i + 1}`)}
              active={s.cell}
              dependencies={s.deps}
            />
            <p className="an-muted">
              绿框是当前区间；带下划线的格子是本次依赖。
            </p>
            {s.answer && <p>最优括号：{s.answer}</p>}
          </>
        )}
      </Player>
    </Demo>
  );
}

export function LCSDemo() {
  const [example, setExample] = useState(0);
  const cases = [
    ['ABCBDAB', 'BDCABA'],
    ['ABC', 'AC'],
    ['ABC', 'XYZ'],
    ['', 'ABC'],
  ];
  const [x, y] = cases[example],
    result = useMemo(() => lcsTrace(x, y), [example]);
  return (
    <Demo title="LCS：先填长度，再找一条路径">
      <Field label="两个序列">
        <select
          value={example}
          onChange={(e) => setExample(Number(e.target.value))}
        >
          {cases.map(([a, b], i) => (
            <option value={i} key={i}>
              {a || '空串'} / {b}
            </option>
          ))}
        </select>
      </Field>
      <Player
        key={example}
        steps={result.steps}
        code={[
          'dp[0,*] = dp[*,0] = 0',
          '逐行扫描 i=1..m, j=1..n',
          'if X[i-1] == Y[j-1]: dp[i,j] = dp[i-1,j-1]+1',
          'else: dp[i,j] = max(dp[i-1,j], dp[i,j-1])',
          '从右下角回溯；匹配时收下字符',
        ]}
      >
        {(s) => (
          <>
            <Grid
              values={s.table}
              rowLabels={['∅', ...x]}
              colLabels={['∅', ...y]}
              active={s.cell}
              dependencies={s.deps}
              path={s.path}
            />
            {s.answer !== undefined && (
              <p>
                已回溯的序列：<strong>{s.answer || '—'}</strong>
              </p>
            )}
          </>
        )}
      </Player>
    </Demo>
  );
}

export function SubarrayDemo() {
  const [mode, setMode] = useState('sum'),
    [example, setExample] = useState(0),
    [empty, setEmpty] = useState(true);
  const cases = [
    [-2, 11, -4, 13, -5, -2],
    [-2, -3, -1],
    [-2, 3, -4],
    [0, -2, -3, 0, 4],
  ];
  const a = cases[example],
    product = mode === 'product';
  const steps = useMemo(
    () => subarrayTrace(a, product, empty),
    [example, product, empty],
  );
  return (
    <Demo title="连续子段：当前结尾与全局最优">
      <div className="an-fields">
        <Field label="目标">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sum">最大子段和</option>
            <option value="product">最大子段积（非空）</option>
          </select>
        </Field>
        <Field label="输入">
          <select
            value={example}
            onChange={(e) => setExample(Number(e.target.value))}
          >
            {cases.map((v, i) => (
              <option key={i} value={i}>
                {v.join(', ')}
              </option>
            ))}
          </select>
        </Field>
        {!product && (
          <Field label="子段定义">
            <select
              value={String(empty)}
              onChange={(e) => setEmpty(e.target.value === 'true')}
            >
              <option value="true">允许空段（课件）</option>
              <option value="false">必须非空</option>
            </select>
          </Field>
        )}
      </div>
      <Player
        key={`${mode}-${example}-${empty}`}
        steps={steps}
        code={
          product
            ? [
                'hi = lo = best = a[0]',
                '保存 oldHi 和 oldLo',
                'hi,lo = max,min(a[i], oldHi*a[i], oldLo*a[i])',
                'best = max(best, hi)',
              ]
            : [
                'ending = a[0]; best 按空段约定初始化',
                'ending = max(a[i], ending + a[i])',
                'best = max(best, ending)',
              ]
        }
      >
        {(s) => (
          <>
            <Cells
              values={a}
              active={s.active}
              muted={a.map((_, i) => i).filter((i) => i > s.index)}
            />
            <p className="an-muted">
              绿框为当前全局最优子段；正在处理下标 {s.index}。
            </p>
            <Grid
              values={s.rows.map((r) => r.slice(1))}
              rowLabels={s.rows.map((r) => String(r[0]))}
              colLabels={
                product
                  ? ['a[i]', '结尾最大', '结尾最小', '全局最大']
                  : ['a[i]', '结尾最大', '全局最大']
              }
            />
          </>
        )}
      </Player>
    </Demo>
  );
}

export function KnapsackDemo() {
  const [example, setExample] = useState(0),
    [capacity, setCapacity] = useState(6);
  const examples = [
    { w: [4, 3, 2], v: [5, 2, 1] },
    { w: [2, 2, 6, 5, 4], v: [6, 3, 5, 4, 6] },
  ];
  const { w, v } = examples[example],
    result = useMemo(() => knapsack(w, v, capacity), [example, capacity]);
  return (
    <Demo title="0-1 背包：每次只读上一行">
      <div className="an-fields">
        <Field label="物品组">
          <select
            value={example}
            onChange={(e) => {
              const x = Number(e.target.value);
              setExample(x);
              setCapacity(x ? 10 : 6);
            }}
          >
            <option value={0}>课件三件物品</option>
            <option value={1}>课件五件物品</option>
          </select>
        </Field>
        <Field label={`容量 C = ${capacity}`}>
          <Range
            label="背包容量"
            min={0}
            max={12}
            value={capacity}
            onChange={setCapacity}
          />
        </Field>
      </div>
      <p>
        {w.map((weight, i) => `物品${i + 1}：重${weight}/值${v[i]}`).join('；')}
      </p>
      <Player
        key={`${example}-${capacity}`}
        steps={result.steps}
        code={[
          'dp[0,*] = dp[*,0] = 0',
          'for i = 1 .. n, c = 1 .. C:',
          '  if w[i] > c: dp[i,c] = dp[i-1,c]',
          '  else: dp[i,c] = max(dp[i-1,c], dp[i-1,c-w[i]]+v[i])',
          '从 dp[n,C] 回溯选中的物品',
        ]}
      >
        {(s) => (
          <>
            <Grid
              values={s.table}
              rowLabels={s.table.map((_, i) => `前${i}件`)}
              active={s.cell}
              dependencies={s.deps}
              path={s.path}
            />
            {s.answer && <p>选择：{s.answer}</p>}
          </>
        )}
      </Player>
      <details>
        <summary>同一张表的跳跃点</summary>
        <p>以下是完整计算后的最后一行，只保留价值上升的位置。</p>
        <p>
          {result.dp
            .at(-1)!
            .flatMap((value, c, row) =>
              c === 0 || value > row[c - 1] ? [`(${c}, ${value})`] : [],
            )
            .join(' → ')}
        </p>
      </details>
    </Demo>
  );
}

export function CompressionDemo() {
  const [example, setExample] = useState(0);
  const cases = [
    [1, 1, 1, 1, 255, 255, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0],
    [1, 2, 3, 4, 5, 6],
    [255, 1, 255, 1],
  ];
  const a = cases[example],
    result = useMemo(() => compression(a), [example]);
  return (
    <Demo title="变位压缩：节省像素位数，也要支付段头">
      <Field label="像素序列">
        <select
          value={example}
          onChange={(e) => setExample(Number(e.target.value))}
        >
          {cases.map((v, i) => (
            <option key={i} value={i}>
              {v.join(', ')}
            </option>
          ))}
        </select>
      </Field>
      <Player
        key={example}
        steps={result.steps}
        code={[
          'dp[0] = 0',
          'for i = 1 .. n:',
          '  for len = 1 .. min(i,255):',
          '    dp[i] = min(dp[i], dp[i-len]+len*bits(last segment)+11)',
          '按记录的 len 回溯分段',
        ]}
      >
        {(s) => (
          <>
            <Cells values={a} active={s.path.map(([, c]) => c - 1)} />
            <Grid
              values={s.table}
              rowLabels={['最少位数', '末段长度']}
              active={s.cell}
              dependencies={s.deps}
            />
            {s.answer && <p>分段：{s.answer}</p>}
          </>
        )}
      </Player>
    </Demo>
  );
}

export function PolygonDemo() {
  const [cut, setCut] = useState(0),
    [example, setExample] = useState(0);
  const cases = [
    { a: [-7, 4, 2, 5], ops: ['+', '*', '+', '*'] },
    { a: [-2, -3, -4, 5], ops: ['*', '+', '*', '+'] },
  ];
  const { a, ops } = cases[example];
  const all = useMemo(() => a.map((_, i) => polygonGame(a, ops, i)), [example]);
  const result = all[cut],
    best = Math.max(...all.map((r) => r.max));
  return (
    <Demo title="多边形游戏：选择断口，比较括号">
      <div className="an-fields">
        <Field label="例子">
          <select
            value={example}
            onChange={(e) => setExample(Number(e.target.value))}
          >
            {cases.map((c, i) => (
              <option key={i} value={i}>
                {c.a.map((v, j) => `${v} ${c.ops[j]}`).join(' ')} ↻
              </option>
            ))}
          </select>
        </Field>
        <Field label="链的起点（删去它前面的边）">
          <select value={cut} onChange={(e) => setCut(Number(e.target.value))}>
            {a.map((v, i) => (
              <option key={i} value={i}>
                顶点 {i}：{v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p>
        当前链：
        {result.chain
          .map(
            (v, i) =>
              `${v}${i < result.operators.length ? ' ' + result.operators[i] + ' ' : ''}`,
          )
          .join('')}
      </p>
      <Player
        key={`${cut}-${example}`}
        steps={result.steps}
        code={[
          'min[i,i] = max[i,i] = value[i]',
          '按长度、左端点、最后运算位置 k 枚举',
          '加法：最小+最小；最大+最大',
          '乘法：比较 min×min、min×max、max×min、max×max',
          '比较全部断口，选择全局最大值',
        ]}
      >
        {(s) => (
          <>
            <Grid values={s.table} active={s.cell} dependencies={s.deps} />
            <p className="an-muted">表中显示区间最大值。{s.extra}</p>
            {s.answer && <p>括号：{s.answer}</p>}
          </>
        )}
      </Player>
      <details>
        <summary>比较全部断口</summary>
        <Cells
          values={all.map((r) => r.max)}
          labels={a.map((_, i) => `从顶点${i}`)}
          active={all.flatMap((r, i) => (r.max === best ? [i] : []))}
        />
        <p>环的最高得分：{best}</p>
      </details>
    </Demo>
  );
}

const jobSets: Job[][] = [
  [
    { id: 'A', a: 3, b: 6 },
    { id: 'B', a: 8, b: 2 },
    { id: 'C', a: 4, b: 7 },
    { id: 'D', a: 6, b: 3 },
  ],
  [
    { id: 'A', a: 5, b: 1 },
    { id: 'B', a: 1, b: 5 },
    { id: 'C', a: 3, b: 3 },
    { id: 'D', a: 2, b: 4 },
  ],
];
export function JohnsonDemo() {
  const [example, setExample] = useState(0),
    [order, setOrder] = useState([0, 1, 2, 3]);
  const jobs = jobSets[example],
    current = schedule(order.map((i) => jobs[i])),
    optimal = schedule(johnson(jobs));
  const move = (index: number, direction: number) => {
    const next = [...order];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setOrder(next);
  };
  return (
    <Demo title="调整作业顺序，观察 M2 的等待">
      <Field label="作业组">
        <select
          value={example}
          onChange={(e) => {
            setExample(Number(e.target.value));
            setOrder([0, 1, 2, 3]);
          }}
        >
          <option value={0}>示例一</option>
          <option value={1}>示例二</option>
        </select>
      </Field>
      <div className="an-scroll">
        <table className="an-table">
          <thead>
            <tr>
              <th>作业</th>
              <th>M1 耗时</th>
              <th>M2 耗时</th>
              <th>顺序</th>
            </tr>
          </thead>
          <tbody>
            {order.map((id, i) => (
              <tr key={id}>
                <td>{jobs[id].id}</td>
                <td>{jobs[id].a}</td>
                <td>{jobs[id].b}</td>
                <td>
                  <button
                    disabled={i === 0}
                    aria-label={`前移 ${jobs[id].id}`}
                    onClick={() => move(i, -1)}
                  >
                    前移
                  </button>{' '}
                  <button
                    disabled={i === order.length - 1}
                    aria-label={`后移 ${jobs[id].id}`}
                    onClick={() => move(i, 1)}
                  >
                    后移
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Suspense
        fallback={
          <p className="an-chart-placeholder">
            时间轴加载中，下方可展开精确起止时间。
          </p>
        }
      >
        <ScheduleChart jobs={current.jobs} time={current.time} />
      </Suspense>
      <p>
        当前顺序 {current.jobs.map((j) => j.id).join(' → ')}，总工期{' '}
        <strong>{current.time}</strong>；Johnson 最优工期{' '}
        <strong>{optimal.time}</strong>。
      </p>
      <button
        onClick={() =>
          setOrder(
            optimal.jobs.map((j) => jobs.findIndex((x) => x.id === j.id)),
          )
        }
      >
        使用 Johnson 顺序
      </button>
      <details>
        <summary>查看精确起止时间</summary>
        <Grid
          values={current.jobs.map((j) => [j.startA, j.endA, j.startB, j.endB])}
          rowLabels={current.jobs.map((j) => j.id)}
          colLabels={['M1 开始', 'M1 结束', 'M2 开始', 'M2 结束']}
        />
      </details>
    </Demo>
  );
}

export function BSTDemo() {
  const [example, setExample] = useState(0);
  const cases = [
    { label: '中间键常被查', p: [0.1, 0.5, 0.1], q: [0.05, 0.05, 0.1, 0.1] },
    {
      label: '第一个键常被查',
      p: [0.55, 0.1, 0.05],
      q: [0.05, 0.05, 0.1, 0.1],
    },
    {
      label: '查找常落在末尾空隙',
      p: [0.1, 0.1, 0.1],
      q: [0.05, 0.05, 0.05, 0.55],
    },
  ];
  const { p, q } = cases[example],
    result = useMemo(() => optimalBST(p, q), [example]);
  function tree(i: number, j: number, label: string): ReactNode {
    if (i === j)
      return (
        <li>
          {label}：空隙 d{i}（q={q[i]}）
        </li>
      );
    const root = result.roots[i][j];
    return (
      <li>
        {label}：K{root + 1}（p={p[root]}）
        <ul className="an-tree">
          {tree(i, root, '左')}
          {tree(root + 1, j, '右')}
        </ul>
      </li>
    );
  }
  return (
    <Demo title="查找频率改变，最优根也会改变">
      <Field label="概率分布">
        <select
          value={example}
          onChange={(e) => setExample(Number(e.target.value))}
        >
          {cases.map((c, i) => (
            <option key={i} value={i}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <p>
        p = [{p.join(', ')}]；q = [{q.join(', ')}]；概率总和为 1。
      </p>
      <Player
        key={example}
        steps={result.steps}
        code={[
          'e[i,i] = q[i]  // 半开区间为空',
          'for len = 1 .. n:',
          '  w[i,j] = Σp[i..j-1] + Σq[i..j]',
          '  e[i,j] = min_r(e[i,r] + e[r+1,j] + w[i,j])',
          '记录最优 r，递归构造左右子树',
        ]}
      >
        {(s, i) => (
          <>
            <Grid values={s.table} active={s.cell} dependencies={s.deps} />
            {i === result.steps.length - 1 && (
              <ul className="an-tree">{tree(0, p.length, '根')}</ul>
            )}
          </>
        )}
      </Player>
    </Demo>
  );
}
