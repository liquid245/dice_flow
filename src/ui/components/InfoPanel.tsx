import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useGame } from '../../app/game';
import { changesSinceLastRoll } from '../../core/history/selectors';
import { selectedDice } from '../../core/selection/selection';
import type { HistoryEntry } from '../../core/history/types';
import { config } from '../../config';

const HOLD_MS = 500;

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

  const [expanded, setExpanded] = useState(false);
  const [held, setHeld] = useState(false);
  const pressStartRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const collapsedRef = useRef<HTMLSpanElement>(null);

  const open = expanded || held;

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const onPointerDown = () => {
    pressStartRef.current = performance.now();
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => setHeld(true), HOLD_MS);
  };

  const onPointerUp = () => {
    const duration = performance.now() - pressStartRef.current;
    clearHoldTimer();
    if (duration < HOLD_MS) {
      setExpanded((value) => !value);
    }
    setHeld(false);
  };

  const onPointerCancel = () => {
    clearHoldTimer();
    setHeld(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpanded((value) => !value);
    }
  };

  const parts: string[] = [];
  if (state.dice.length > 0) parts.push(`${state.dice.length} D6`);
  changes.forEach((entry) => parts.push(formatEntry(entry)));
  if (selected > 0) parts.push(`Selected: ${selected}`);

  const inline = parts.length > 0 ? parts.join(' · ') : infoPanel.swipeHint;

  useLayoutEffect(() => {
    const el = collapsedRef.current;
    if (!el) return;
    const base = 14 * (config.ui.fontScale ?? 1);
    const fit = () => {
      el.style.fontSize = `${base}px`;
      if (open) return;
      const avail = el.clientWidth;
      const full = el.scrollWidth;
      if (full > avail && avail > 0) {
        el.style.fontSize = `${Math.max(0.6, avail / full) * base}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, inline]);

  return (
    <button
      type="button"
      className={`info-panel${open ? ' is-open' : ''}`}
      style={{ textAlign: infoPanel.centered ? 'center' : 'left', borderBottom: borders ? undefined : 'none' }}
      aria-expanded={open}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <span className="info-collapsed" ref={collapsedRef}>
        {inline}
      </span>
      <span className="info-expand" aria-hidden={!open}>
        <span className="info-expand-inner">
          {parts.map((line, index) => (
            <span className="info-line" key={`${index}-${line}`}>
              {line}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
