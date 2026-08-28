import { useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { changesSinceLastRoll } from '../../core/history/selectors';
import { selectedDice } from '../../core/selection/selection';
import type { HistoryEntry } from '../../core/history/types';
import { config } from '../../config';

const MIN_FONT = 8;
const MAX_FONT = 16;
const DEFAULT_FONT = 14;

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
  const changes = changesSinceLastRoll(state.history);
  const infoPanel = config.ui.infoPanel;

  const borders = config.ui.panels.borders;

  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const fit = () => {
      let size = MAX_FONT;
      content.style.fontSize = `calc(var(--font-scale) * ${size}px)`;
      while (size > MIN_FONT && content.scrollWidth > content.clientWidth) {
        size -= 1;
        content.style.fontSize = `calc(var(--font-scale) * ${size}px)`;
      }
      setFontSize(size);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    return () => observer.disconnect();
  }, [state.dice.length, state.history, selected]);

  return (
    <div
      className="info-panel"
      style={{ textAlign: infoPanel.centered ? 'center' : 'left', borderBottom: borders ? undefined : 'none' }}
    >
      <div
        ref={contentRef}
        className="info-panel-content"
        style={{ fontSize: `calc(var(--font-scale) * ${fontSize}px)` }}
      >
        {state.dice.length === 0 ? (
          <span>{infoPanel.swipeHint}</span>
        ) : (
          <>
            <span>{state.dice.length} D6</span>
            {changes.map((entry) => (
              <span key={entry.id}> · {formatEntry(entry)}</span>
            ))}
            {selected > 0 && <span> · Selected: {selected}</span>}
          </>
        )}
      </div>
    </div>
  );
}
