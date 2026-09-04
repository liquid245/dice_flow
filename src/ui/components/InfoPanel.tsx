import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../app/game';
import { config } from '../../config';
import { buildHistoryFeed } from '../feed';

const MIN_FONT = 6;
const MAX_FONT = 16;
const LINE_HEIGHT = 20;
const LINE_FACTOR = LINE_HEIGHT / MAX_FONT;
const FIT_LIMIT = 2 / 3;

function historyRowLimit(): number {
  const landscape = window.matchMedia('(orientation: landscape)').matches;
  return config.ui.infoPanel.historyRows[landscape ? 'landscape' : 'portrait'];
}

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
  const prevExpandedRef = useRef(false);
  const prevChunkKeyRef = useRef(chunkKey);

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

    let singleRow = false;
    let buttonFont = MAX_FONT;
    let collapsedH = 0;
    let vInset = 0;

    const applySize = () => {
      const bar = document.querySelector<HTMLElement>('.action-bar');
      const btn = bar?.querySelector<HTMLElement>('button');
      if (!bar || !btn) return;
      const rect = btn.getBoundingClientRect();
      singleRow = getComputedStyle(bar).flexDirection === 'row';
      const fontScale =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
      const btnFont = parseFloat(getComputedStyle(btn).fontSize) / fontScale;
      buttonFont = Math.max(MIN_FONT, Math.min(MAX_FONT, Math.round(btnFont)));

      const row = document.querySelector<HTMLElement>('.action-row');
      let gap = 8;
      if (row) {
        const cs = getComputedStyle(row);
        const cg = parseFloat(cs.columnGap);
        const rg = parseFloat(cs.rowGap);
        gap = Number.isFinite(cg) ? cg : Number.isFinite(rg) ? rg : 8;
      }
      root.style.width = singleRow ? '' : `${Math.ceil(rect.width * 3 + gap * 2)}px`;
      collapsedH = singleRow ? Math.ceil(rect.height) : Math.ceil(rect.height * 2 + gap);
      const rootStyle = getComputedStyle(root);
      vInset =
        (parseFloat(rootStyle.paddingTop) || 0) +
        (parseFloat(rootStyle.paddingBottom) || 0) +
        (parseFloat(rootStyle.borderTopWidth) || 0) +
        (parseFloat(rootStyle.borderBottomWidth) || 0);
      if (expanded) {
        contentBox.style.lineHeight = '';
        root.style.height = '';
        contentBox.style.height = `${historyRowLimit() * LINE_HEIGHT}px`;
      } else {
        contentBox.style.lineHeight = singleRow ? 'normal' : '';
        root.style.height = `${collapsedH}px`;
        root.style.setProperty('--panel-band', '0px');
      }
    };

    const fit = () => {
      applySize();

      if (expanded) {
        setFontSize((prev) => (prev === MAX_FONT ? prev : MAX_FONT));
        return;
      }
      if (feed.system) {
        const font = singleRow ? buttonFont : MAX_FONT;
        setFontSize((prev) => (prev === font ? prev : font));
        return;
      }

      const maxWidth = contentBox.clientWidth;
      const heightCap = Math.floor(((collapsedH - vInset) / LINE_FACTOR) * FIT_LIMIT);
      const maxFont = singleRow ? buttonFont : Math.max(MAX_FONT, heightCap);

      let bestSize = MIN_FONT;
      for (let size = maxFont; size >= MIN_FONT; size--) {
        if (measureWidth(feed.summary, size) <= maxWidth) {
          bestSize = size;
          break;
        }
      }
      if (!singleRow) {
        contentBox.style.lineHeight = `${Math.round(bestSize * LINE_FACTOR)}px`;
      }
      setFontSize((prev) => (prev === bestSize ? prev : bestSize));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [feed.summary, feed.system, expanded]);

  useLayoutEffect(() => {
    const box = contentRef.current;
    if (!box || !expanded) {
      prevExpandedRef.current = expanded;
      prevChunkKeyRef.current = chunkKey;
      return;
    }
    const justOpened = !prevExpandedRef.current;
    const newEvent = prevChunkKeyRef.current !== chunkKey;
    if (justOpened || newEvent) box.scrollTop = box.scrollHeight;
    prevExpandedRef.current = expanded;
    prevChunkKeyRef.current = chunkKey;
  }, [expanded, chunkKey]);

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
          <>
            {feed.rows.map((row, i) => (
              <div key={i} className="history-line history-line--expand">
                {row}
              </div>
            ))}
            <div className="history-line history-line--expand history-line--live">
              {collapsedText}
            </div>
          </>
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
