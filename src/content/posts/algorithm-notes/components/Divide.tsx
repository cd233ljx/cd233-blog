import { useMemo, useState } from 'react';
import { Cells, Demo, Field, Grid, Player, Range } from './common';
import { mergeTrace, quickTrace, roundRobin, tileTrace } from './divide-model';

const arrays = [
  [49, 38, 65, 97, 76, 13, 27],
  [6, 7, 5, 2, 5, 8],
  [1, 2, 3, 4, 5, 6],
  [4, 4, 4, 4, 4],
];
export function MergeDemo() {
  const [example, setExample] = useState(0);
  const steps = useMemo(() => mergeTrace(arrays[example]), [example]);
  return (
    <Demo title="归并排序：指针选数，缓冲区写回">
      <Field label="输入">
        <select
          value={example}
          onChange={(e) => setExample(Number(e.target.value))}
        >
          {arrays.map((a, i) => (
            <option key={i} value={i}>
              {a.join(', ')}
            </option>
          ))}
        </select>
      </Field>
      <Player
        key={example}
        steps={steps}
        code={[
          'sort(left, right):',
          '  if left >= right: return',
          '  mid = (left + right) // 2',
          '  sort(left, mid); sort(mid+1, right)',
          '  merge: 比较左右指针，较小者写入 temp',
          '  将 temp 写回 a[left..right]',
        ]}
      >
        {(s) => (
          <>
            <p className="an-muted">{s.stack.join(' → ') || '调用结束'}</p>
            <Cells
              values={s.values}
              active={s.active}
              muted={s.values
                .map((_, i) => i)
                .filter((i) => i < s.left || i > s.right)}
            />
            <p>本次合并的缓冲区</p>
            <Cells values={s.buffer.length ? s.buffer : ['空']} />
          </>
        )}
      </Player>
    </Demo>
  );
}

export function QuickDemo() {
  const [example, setExample] = useState(1),
    [mode, setMode] = useState('sort'),
    [k, setK] = useState(3);
  const a = arrays[example],
    rank = Math.min(k, a.length);
  const steps = useMemo(
    () => quickTrace(a, mode === 'select' ? rank : undefined),
    [example, mode, rank],
  );
  return (
    <Demo title="快排与选择：两边递归，还是只留一边">
      <div className="an-fields">
        <Field label="任务">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sort">快速排序</option>
            <option value="select">第 k 小</option>
          </select>
        </Field>
        <Field label="输入">
          <select
            value={example}
            onChange={(e) => setExample(Number(e.target.value))}
          >
            {arrays.map((v, i) => (
              <option value={i} key={i}>
                {v.join(', ')}
              </option>
            ))}
          </select>
        </Field>
        {mode === 'select' && (
          <Field label={`k = ${rank}`}>
            <Range
              label="第 k 小"
              min={1}
              max={a.length}
              value={rank}
              onChange={setK}
            />
          </Field>
        )}
      </div>
      <Player
        key={`${example}-${mode}-${rank}`}
        steps={steps}
        code={[
          'partition(left, right):',
          '  pivot = a[right]; i = left',
          '  for j = left .. right-1:',
          '    if a[j] <= pivot: swap(a[i++], a[j])',
          '  swap(a[i], a[right]); return i',
          mode === 'sort'
            ? '递归排序基准两侧'
            : '比较 i 与 k-1；仅进入目标所在侧',
        ]}
      >
        {(s) => (
          <>
            <Cells
              values={s.values}
              active={s.active}
              muted={s.values
                .map((_, i) => i)
                .filter((i) => i < s.left || i > s.right)}
            />
            <p className="an-muted">
              当前处理区间 [{s.left}, {s.right}
              ]；高亮为比较或交换位置。演示固定取末元素作基准。
            </p>
          </>
        )}
      </Player>
    </Demo>
  );
}

export function ChessDemo() {
  const [size, setSize] = useState(4),
    [hole, setHole] = useState([0, 0]);
  const steps = useMemo(() => tileTrace(size, hole[0], hole[1]), [size, hole]);
  return (
    <Demo title="点击任意格子，重新指定缺口">
      <Field label="棋盘边长">
        <select
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setHole([0, 0]);
          }}
        >
          {[2, 4, 8].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Field>
      <Player
        key={`${size}-${hole.join(',')}`}
        steps={steps}
        code={[
          'cover(board, hole):',
          '  if side == 1: return',
          '  中央放一块 L，避开含原缺口的象限',
          '  对四个各缺一格的子棋盘递归',
        ]}
      >
        {(s) => (
          <>
            <div
              className="an-board"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            >
              {s.board.flatMap((row, r) =>
                row.map((v, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`第 ${r + 1} 行第 ${c + 1} 列，${v < 0 ? '缺口' : v === 0 ? '未覆盖' : '骨牌 ' + v}`}
                    className={`${v < 0 ? 'an-hole' : v ? (v % 2 ? 'an-tile-odd' : 'an-tile-even') : ''} ${s.active.some(([i, j]) => r === i && c === j) ? 'is-active' : ''}`}
                    onClick={() => setHole([r, c])}
                  >
                    {v < 0 ? '×' : v || '·'}
                  </button>
                )),
              )}
            </div>
            <p className="an-muted">
              同一数字属于同一块 L；绿框是本步新放的骨牌。坐标从 0 开始。
            </p>
          </>
        )}
      </Player>
    </Demo>
  );
}

export function TournamentDemo() {
  const [n, setN] = useState(4),
    [day, setDay] = useState(1);
  const table = roundRobin(n),
    chosen = Math.min(day, n - 1);
  return (
    <Demo title="循环赛：检查同一天是否重复出赛">
      <div className="an-fields">
        <Field label="选手数（2 的幂）">
          <select
            value={n}
            onChange={(e) => {
              setN(Number(e.target.value));
              setDay(1);
            }}
          >
            {[2, 4, 8].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label={`第 ${chosen} 天`}>
          <Range
            label="比赛日"
            min={1}
            max={n - 1}
            value={chosen}
            onChange={setDay}
          />
        </Field>
      </div>
      <Grid
        values={table}
        rowLabels={table.map((_, i) => `选手 ${i + 1}`)}
        colLabels={table[0].map((_, i) => `第 ${i + 1} 天`)}
        path={table.map((_, i) => [i, chosen - 1])}
      />
      <p>
        本日对阵：
        {table
          .flatMap((row, i) =>
            i + 1 < row[chosen - 1] ? [`${i + 1} ↔ ${row[chosen - 1]}`] : [],
          )
          .join('；')}
      </p>
    </Demo>
  );
}
