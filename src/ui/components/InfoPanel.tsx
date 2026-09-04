import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { config } from '../../config';
import { buildHistoryFeed } from '../feed';

const MIN_FONT = 6;
const MAX_FONT = 16;

export function InfoPanel() {
  const { state } = useGame();
  const infoPanel = config.ui.infoPanel;

  const feed = useMemo(
    () => buildHistoryFeed(state.dice, state.selection, state.history, infoPanel.swipeHint),
    [state.dice, state.selection, state.history, infoPanel.swipeHint],
  );

  const chunkKey = useMemo(() => feed.chunk.map((entry) => entry.id).join('\n'), [feed.chunk]);
  const [expanded, setExpanded] = useState(false);
  const [fontSize, setFontSize] = useState(MAX_FONT);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [prevChunkKey, setPrevChunkKey] = useState(chunkKey);
  if (prevChunkKey !== chunkKey) {
    setPrevChunkKey(chunkKey);
    setExpanded(false);
  }

  const collapsedText = feed.system ?? feed.summary;

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
      if (expanded) {
        root.style.height = '';
      } else {
        root.style.height = `${Math.ceil(rect.height * 2 + gap)}px`;
      }
    };

    const fit = () => {
      applySize();

      if (expanded || feed.system) {
        setFontSize((prev) => (prev === MAX_FONT ? prev : MAX_FONT));
        return;
      }

      const maxWidth = contentBox.clientWidth;
      let bestSize = MIN_FONT;
      for (let size = MAX_FONT; size >= MIN_FONT; size--) {
        if (measureWidth(feed.summary, size) <= maxWidth) {
          bestSize = size;
          break;
        }
      }
      setFontSize((prev) => (prev === bestSize ? prev : bestSize));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [feed.summary, feed.system, expanded]);

  const modifiers = [
    feed.active ? 'info-panel--active' : '',
    expanded ? 'info-panel--expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={`info-panel ${modifiers}`}
      aria-expanded={expanded}
      onClick={() => {
        if (feed.active) setExpanded((value) => !value);
      }}
    >
      <div
        ref={contentRef}
        className="info-panel-content"
        style={{ fontSize: `calc(var(--font-scale) * ${fontSize}px)` }}
      >
        {expanded ? (
          feed.rows.map((row, i) => (
            <div key={i} className="history-line history-line--expand">
              {row}
            </div>
          ))
        ) : (
          <div
            className={`history-line history-line--center${feed.system ? ' history-line--wrap' : ''}`}
          >
            {collapsedText}
          </div>
        )}
        <span ref={measureRef} className="measure" aria-hidden="true" />
      </div>
    </div>
  );
}
