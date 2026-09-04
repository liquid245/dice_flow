import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { config } from '../../config';
import { currentIteration, describeSelection, formatAction, formatSelectionText } from '../feed';

const MIN_FONT = 8;
const MAX_FONT = 16;
const MAX_ROWS = 3;

interface View {
  rows: string[];
  centered: boolean;
}

export function InfoPanel() {
  const { state } = useGame();
  const infoPanel = config.ui.infoPanel;
  const uiHistory = config.ui.history;

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT);
  const [view, setView] = useState<View>({ rows: [''], centered: false });

  const content = useMemo<View>(() => {
    if (state.dice.length === 0) {
      return { rows: [infoPanel.swipeHint], centered: true };
    }
    const entries = currentIteration(state.history);
    const lastEntries = entries.length > MAX_ROWS ? entries.slice(entries.length - MAX_ROWS) : entries;
    const rows = lastEntries.map((entry) => formatAction(entry));
    const totalText = `${state.dice.length} ${uiHistory.diceWord}`;
    if (rows.length === 0) {
      const selection = describeSelection(state.dice, state.selection);
      const selectionText = selection ? formatSelectionText(selection) : null;
      return {
        rows: [selectionText ? `${totalText}${uiHistory.segmentSep}${selectionText}` : totalText],
        centered: false,
      };
    }
    const selection = describeSelection(state.dice, state.selection);
    const selectionText = selection ? formatSelectionText(selection) : null;
    const lastText = formatAction(entries[entries.length - 1]);
    rows[rows.length - 1] = [lastText, totalText, selectionText]
      .filter((part): part is string => part !== null)
      .join(uiHistory.segmentSep);
    return { rows, centered: false };
  }, [state.dice, state.history, state.selection, infoPanel.swipeHint, uiHistory]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const contentBox = contentRef.current;
    const measure = measureRef.current;
    if (!root || !contentBox || !measure) return;

    const measureWidth = (text: string, size: number): number => {
      measure.style.fontSize = `calc(var(--font-scale) * ${size}px)`;
      measure.textContent = text;
      return measure.getBoundingClientRect().width;
    };

    const applySize = () => {
      const btn = document.querySelector<HTMLElement>('.action-bar button');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const row = document.querySelector<HTMLElement>('.action-row');
      let gap = 8;
      if (row) {
        const cs = getComputedStyle(row);
        const cg = parseFloat(cs.columnGap);
        const rg = parseFloat(cs.rowGap);
        gap = Number.isFinite(cg) ? cg : Number.isFinite(rg) ? rg : 8;
      }
      root.style.width = `${Math.ceil(rect.width * 3 + gap * 2)}px`;
      root.style.height = `${Math.ceil(rect.height * 2 + gap)}px`;
    };

    const fit = () => {
      applySize();

      const maxWidth = contentBox.clientWidth;
      let bestSize = MIN_FONT;
      for (let size = MAX_FONT; size >= MIN_FONT; size--) {
        if (content.rows.every((row) => measureWidth(row, size) <= maxWidth)) {
          bestSize = size;
          break;
        }
      }

      setFontSize((prev) => (prev === bestSize ? prev : bestSize));
      setView((prev) => {
        if (prev.centered === content.centered && prev.rows.length === content.rows.length) {
          const same = prev.rows.every((row, i) => row === content.rows[i]);
          if (same) return prev;
        }
        return content;
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [content]);

  return (
    <div ref={rootRef} className="info-panel">
      <div
        ref={contentRef}
        className="info-panel-content"
        style={{ fontSize: `calc(var(--font-scale) * ${fontSize}px)` }}
      >
        {view.rows.map((row, i) => (
          <div key={i} className={view.centered ? 'history-line history-line--center' : 'history-line'}>
            {row}
          </div>
        ))}
        <span ref={measureRef} className="measure" aria-hidden="true" />
      </div>
    </div>
  );
}
