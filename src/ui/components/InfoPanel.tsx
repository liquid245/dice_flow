import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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
  const pressRafRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const open = expanded || held;

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
      cancelAnimationFrame(pressRafRef.current);
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const startPressGlow = () => {
    const el = buttonRef.current;
    if (!el) return;
    cancelAnimationFrame(pressRafRef.current);
    const animate = () => {
      const t = Math.min(1, (performance.now() - pressStartRef.current) / HOLD_MS);
      el.style.setProperty('--press', t.toFixed(3));
      if (t < 1) pressRafRef.current = requestAnimationFrame(animate);
    };
    pressRafRef.current = requestAnimationFrame(animate);
  };

  const stopPressGlow = () => {
    cancelAnimationFrame(pressRafRef.current);
    pressRafRef.current = 0;
    buttonRef.current?.style.removeProperty('--press');
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pressStartRef.current = performance.now();
    clearHoldTimer();
    startPressGlow();
    holdTimerRef.current = window.setTimeout(() => setHeld(true), HOLD_MS);
  };

  const onPointerUp = () => {
    const duration = performance.now() - pressStartRef.current;
    clearHoldTimer();
    stopPressGlow();
    if (duration < HOLD_MS) {
      setExpanded((value) => !value);
    }
    setHeld(false);
  };

  const onPointerCancel = () => {
    clearHoldTimer();
    stopPressGlow();
    setHeld(false);
  };

  const onPointerLeave = () => {
    if (holdTimerRef.current === null) return;
    clearHoldTimer();
    stopPressGlow();
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

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`info-panel${open ? ' is-open' : ''}`}
      style={{ textAlign: infoPanel.centered ? 'center' : 'left', borderBottom: borders ? undefined : 'none' }}
      aria-expanded={open}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <span className="info-collapsed">{inline}</span>
      <span className="info-expand" aria-hidden={!open}>
        <span className="info-expand-inner">
          <span className="info-expand-body">
            {parts.map((line, index) => (
              <span className="info-line" key={`${index}-${line}`}>
                {line}
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}
