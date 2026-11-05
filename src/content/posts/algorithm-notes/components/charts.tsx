import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { schedule } from './dp-model';

const tick = { fill: 'var(--muted)', fontSize: 11 };
const tooltip = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--ink)',
};

export function GrowthChart({ rows }: { rows: [string, number][] }) {
  const data = rows.map(([name, count]) => ({
    name,
    count,
    scale: Math.log2(count + 1),
    label: count < 1e6 ? count.toLocaleString('en-US') : count.toExponential(1),
  }));
  return (
    <div
      className="an-chart"
      role="group"
      aria-label="不同增长阶的操作次数，对数刻度；完整数值见下表"
    >
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 72, bottom: 12, left: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            dataKey="scale"
            tick={tick}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={tick}
            width={66}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-muted)' }}
            contentStyle={tooltip}
            formatter={(_value, _name, item) => [
              item.payload.label,
              '模型次数',
            ]}
          />
          <Bar
            dataKey="scale"
            fill="var(--red-ink)"
            radius={[0, 4, 4, 0]}
            barSize={18}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="label"
              position="right"
              fill="var(--ink)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="an-muted">横轴：log₂(操作次数 + 1)</p>
    </div>
  );
}

export function ScheduleChart({ jobs, time }: ReturnType<typeof schedule>) {
  const data = jobs.flatMap((job) => [
    { name: `${job.id} · M1`, interval: [job.startA, job.endA] },
    { name: `${job.id} · M2`, interval: [job.startB, job.endB] },
  ]);
  return (
    <div
      className="an-chart"
      role="group"
      aria-label="作业时间轴；各作业的两台机器共用时间刻度"
    >
      <ResponsiveContainer width="100%" height={300} minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            domain={[0, time]}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={64}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-muted)' }}
            contentStyle={tooltip}
            formatter={(value) => [
              Array.isArray(value) ? value.join(' – ') : value,
              '起止时间',
            ]}
          />
          <Bar
            dataKey="interval"
            fill="var(--red-ink)"
            radius={3}
            barSize={16}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="an-muted">
        横轴为时间。比较每个作业在 M1 的结束点与 M2 的开始点，可看到等待。
      </p>
    </div>
  );
}
