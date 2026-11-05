import { useEffect, useId, useState, type ReactNode } from 'react';
import * as Slider from '@radix-ui/react-slider';
import {
  Check,
  Code2,
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import './notes.css';

export type Step = { note: string; line?: number };

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="an-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Range({
  label,
  value,
  min = 0,
  max,
  onChange,
  disabled = false,
  valueText,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  valueText?: string;
}) {
  return (
    <Slider.Root
      className="an-slider"
      min={min}
      max={Math.max(min + 1, max)}
      step={1}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      disabled={disabled || max <= min}
    >
      <Slider.Track className="an-slider-track">
        <Slider.Range className="an-slider-fill" />
      </Slider.Track>
      <Slider.Thumb
        className="an-slider-thumb"
        aria-label={label}
        aria-valuetext={valueText}
      />
    </Slider.Root>
  );
}

export function Demo({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="algo-notes not-prose" aria-labelledby={id}>
      <header className="an-heading">
        <span className="an-eyebrow">
          <FlaskConical size={14} aria-hidden="true" /> 交互实验
        </span>
        <h3 id={id}>{title}</h3>
        <p>改变输入，再逐步观察算法的选择。</p>
      </header>
      <div className="an-body">{children}</div>
    </section>
  );
}

export function Cells({
  values,
  active = [],
  muted = [],
  labels,
}: {
  values: (number | string)[];
  active?: number[];
  muted?: number[];
  labels?: string[];
}) {
  return (
    <div className="an-cells">
      {values.map((v, i) => (
        <div
          key={i}
          className={`an-cell ${active.includes(i) ? 'is-active' : ''} ${muted.includes(i) ? 'is-muted' : ''}`}
        >
          <small>{labels?.[i] ?? i}</small>
          <strong>{v}</strong>
          {active.includes(i) && (
            <span className="an-sr-only">（当前关注）</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Grid({
  values,
  rowLabels,
  colLabels,
  active,
  dependencies = [],
  path = [],
}: {
  values: (number | string | null)[][];
  rowLabels?: string[];
  colLabels?: string[];
  active?: number[];
  dependencies?: number[][];
  path?: number[][];
}) {
  const has = (cells: number[][], r: number, c: number) =>
    cells.some(([i, j]) => i === r && j === c);
  return (
    <>
      <div
        className="an-scroll"
        tabIndex={0}
        role="region"
        aria-label="算法状态表，可横向滚动"
      >
        <table className="an-table">
          <thead>
            <tr>
              <th scope="col">状态</th>
              {values[0]?.map((_, j) => (
                <th scope="col" key={j}>
                  {colLabels?.[j] ?? j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {values.map((row, i) => (
              <tr key={i}>
                <th scope="row">{rowLabels?.[i] ?? i}</th>
                {row.map((v, j) => {
                  const state =
                    active?.[0] === i && active?.[1] === j
                      ? 'active'
                      : has(path, i, j)
                        ? 'path'
                        : has(dependencies, i, j)
                          ? 'dependency'
                          : '';
                  const label = {
                    '': '',
                    active: '当前计算',
                    path: '选中路径',
                    dependency: '读取来源',
                  }[state];
                  return (
                    <td key={j} className={state ? `is-${state}` : ''}>
                      {v === null ? '·' : v === Infinity ? '∞' : v}
                      {label && <span className="an-sr-only">（{label}）</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(active || dependencies.length > 0 || path.length > 0) && (
        <div className="an-legend" aria-label="表格图例">
          <span>
            <i className="is-active" />
            当前计算
          </span>
          <span>
            <i className="is-dependency" />
            读取来源
          </span>
          <span>
            <i className="is-path" />
            选中路径
          </span>
          <span>· 未填 / 不适用</span>
        </div>
      )}
    </>
  );
}

export function Player<T extends Step>({
  steps,
  code,
  children,
}: {
  steps: T[];
  code?: string[];
  children: (step: T, index: number) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [delay, setDelay] = useState(1000);
  useEffect(() => {
    setReady(true);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    const pause = () => setPlaying(false);
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', pause);
    document.addEventListener('astro:before-swap', pause);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', pause);
      document.removeEventListener('astro:before-swap', pause);
    };
  }, []);
  useEffect(() => {
    if (!playing || index >= steps.length - 1) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (index + 1 >= steps.length - 1) setPlaying(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, index, steps.length, delay]);
  const last = index >= steps.length - 1;
  const jump = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(i, steps.length - 1)));
  };
  const step = steps[index];
  if (!step) return <p className="an-muted">当前输入没有可展示的步骤。</p>;
  return (
    <div className="an-player">
      <div className="an-toolbar">
        <div className="an-controls" role="group" aria-label="演示播放控制">
          <button
            type="button"
            disabled={!ready || index === 0}
            onClick={() => jump(index - 1)}
          >
            <SkipBack size={15} aria-hidden="true" />
            上一步
          </button>
          <button
            type="button"
            className="an-primary"
            disabled={!ready || last}
            onClick={() => jump(index + 1)}
          >
            下一步
            <SkipForward size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!ready || reduced}
            onClick={() => {
              if (last) setIndex(0);
              setPlaying((v) => !v);
            }}
          >
            {playing ? (
              <Pause size={15} aria-hidden="true" />
            ) : (
              <Play size={15} aria-hidden="true" />
            )}
            {playing ? '暂停' : last ? '重播' : '播放'}
          </button>
          <button
            type="button"
            disabled={!ready || index === 0}
            onClick={() => jump(0)}
            aria-label="重置演示"
            title="重置演示"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
        <label className="an-speed">
          速度
          <select
            aria-label="播放速度"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          >
            <option value={1600}>慢速</option>
            <option value={1000}>常速</option>
            <option value={400}>快速</option>
          </select>
        </label>
      </div>
      <div className="an-progress">
        <span>
          <b>{String(index + 1).padStart(2, '0')}</b> / {steps.length}
        </span>
        <Range
          label="演示进度"
          max={steps.length - 1}
          value={index}
          onChange={jump}
          disabled={!ready}
          valueText={`第 ${index + 1} 步，共 ${steps.length} 步`}
        />
        <button
          type="button"
          className="an-result"
          disabled={!ready || last}
          onClick={() => jump(steps.length - 1)}
        >
          {last ? (
            <>
              <Check size={14} aria-hidden="true" />
              已完成
            </>
          ) : (
            '看结果'
          )}
        </button>
      </div>
      {reduced && (
        <p className="an-muted">
          已遵循系统的减弱动态效果设置，请使用单步或进度条。
        </p>
      )}
      <div className="an-stage">{children(step, index)}</div>
      <div
        className="an-explanation"
        aria-live={playing ? 'off' : 'polite'}
        aria-atomic="true"
      >
        <span>{last ? '本次结果' : '这一步'}</span>
        <p>{step.note}</p>
      </div>
      {code && (
        <details className="an-code" open>
          <summary>
            <Code2 size={15} aria-hidden="true" />
            执行逻辑<span>伪代码 · 高亮当前行</span>
          </summary>
          <pre>
            <code>
              {code.map((line, i) => (
                <span
                  className={step.line === i ? 'is-active' : ''}
                  aria-current={step.line === i ? 'step' : undefined}
                  key={i}
                >
                  <b aria-hidden="true">{i + 1}</b>
                  {line}
                  {'\n'}
                </span>
              ))}
            </code>
          </pre>
        </details>
      )}
    </div>
  );
}
