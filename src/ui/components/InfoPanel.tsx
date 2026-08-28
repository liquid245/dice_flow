import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { changesSinceLastRoll } from '../../core/history/selectors';
import { selectedDice } from '../../core/selection/selection';
import type { HistoryEntry } from '../../core/history/types';
import { config } from '../../config';

const MIN_FONT = 8;
const MAX_FONT = 16;
const MAX_LINES = 3;

function formatEntry(entry: HistoryEntry): string {
  const history = config.ui.history;
  const kind = history.kindLabels[entry.kind] ?? entry.kind;
  const count = entry.count > 0 ? `${history.countPrefix}${entry.count}` : '';
  const value = entry.value !== undefined ? `${history.valuePrefix}${entry.value}` : '';
  return history.format.replace('{kind}', kind).replace('{count}', count).replace('{value}', value);
}

export function InfoPanel() {
  const { state } = useGame();
  const selected = selectedDice(state.dice, state.selection).length;
  const changes = useMemo(() => changesSinceLastRoll(state.history), [state.history]);
  const infoPanel = config.ui.infoPanel;

  const borders = config.ui.panels.borders;

  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT);
  const [lines, setLines] = useState<string[][]>([]);

  const items = useMemo(() => {
    return state.dice.length === 0
      ? [infoPanel.swipeHint]
      : [
          `${state.dice.length} D6`,
          ...changes.map((entry) => formatEntry(entry)),
          ...(selected > 0 ? [`Selected: ${selected}`] : []),
        ];
  }, [state.dice.length, changes, selected, infoPanel.swipeHint]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const measure = measureRef.current;
    if (!content || !measure) return;

    const measureWidth = (text: string, size: number): number => {
      measure.style.fontSize = `calc(var(--font-scale) * ${size}px)`;
      measure.textContent = text;
      return measure.getBoundingClientRect().width;
    };

    const fit = () => {
      const maxWidth = content.clientWidth;
      let bestSize = MIN_FONT;
      let bestLines: string[][] = [[]];

      for (let size = MAX_FONT; size >= MIN_FONT; size--) {
        const laid: string[][] = [[]];
        for (const item of items) {
          const line = laid[laid.length - 1];
          const candidate = line.length === 0 ? item : `${line.join(' · ')} · ${item}`;
          if (line.length === 0 || measureWidth(candidate, size) <= maxWidth) {
            line.push(item);
          } else {
            laid.push([item]);
          }
        }
        bestSize = size;
        bestLines = laid;
        if (laid.length <= MAX_LINES) break;
      }

      if (bestLines.length > MAX_LINES) {
        bestLines = bestLines.slice(-MAX_LINES);
      }
      setFontSize(bestSize);
      setLines(bestLines);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    return () => observer.disconnect();
  }, [items]);

  return (
    <div
      className="info-panel"
      style={{
        justifyContent: infoPanel.centered ? 'center' : 'flex-start',
        borderBottom: borders ? undefined : 'none',
      }}
    >
      <div
        ref={contentRef}
        className="info-panel-content"
        style={{
          fontSize: `calc(var(--font-scale) * ${fontSize}px)`,
          alignItems: infoPanel.centered ? 'center' : 'flex-start',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className="history-line">
            {line.map((item, j) => (
              <span key={j}>
                {j > 0 && <span className="dot"> · </span>}
                {item}
              </span>
            ))}
          </div>
        ))}
        <span ref={measureRef} className="measure" aria-hidden="true" />
      </div>
    </div>
  );
}
