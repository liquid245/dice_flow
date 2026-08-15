import { describe, it, expect } from 'vitest';
import { createEngine } from './engine';
import type { EngineDeps } from './deps';

function makeDeps(): EngineDeps {
  let id = 0;
  return {
    random: () => 0,
    nextId: () => `d${++id}`,
    now: () => 1000,
  };
}

describe('engine', () => {
  it('dispatches actions and notifies subscribers', () => {
    const engine = createEngine(makeDeps());
    let notified = 0;
    engine.subscribe(() => notified++);
    engine.dispatch({ type: 'add', count: 2 });
    expect(engine.getState().dice).toHaveLength(2);
    expect(notified).toBe(1);
  });

  it('records every action in history except selection', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 3 });
    engine.dispatch({ type: 'select', ids: ['d1'], mode: 'set' });
    engine.dispatch({ type: 'move', targetValue: 5 });
    engine.dispatch({ type: 'select', ids: ['d2'], mode: 'set' });
    engine.dispatch({ type: 'roll' });
    engine.dispatch({ type: 'delete' });
    engine.dispatch({ type: 'clear' });

    const history = engine.getState().history;
    expect(history.map((e) => e.kind)).toEqual(['add', 'move', 'roll', 'delete', 'clear']);
    expect(history[0].count).toBe(3);
    expect(history[1]).toMatchObject({ kind: 'move', count: 1, value: 5 });
  });

  it('records the reroll value when the selected dice are uniform', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 3, values: [6, 6, 2] });
    engine.dispatch({ type: 'select', ids: ['d1', 'd2'], mode: 'set' });
    engine.dispatch({ type: 'reroll' });
    const last = engine.getState().history[engine.getState().history.length - 1];
    expect(last).toMatchObject({ kind: 'reroll', count: 2, value: 6 });
  });

  it('undoes and redoes every action, excluding selection', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 2 });
    engine.dispatch({ type: 'select', ids: ['d1'], mode: 'set' });
    expect(engine.getState().dice.filter((d) => d.selected)).toHaveLength(1);

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);

    engine.dispatch({ type: 'redo' });
    expect(engine.getState().dice).toHaveLength(2);
  });

  it('selection is not undoable and not recorded', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 2 });
    engine.dispatch({ type: 'select', ids: ['d1'], mode: 'set' });

    expect(engine.getState().dice.filter((d) => d.selected)).toHaveLength(1);
    expect(engine.getState().history.map((e) => e.kind)).toEqual(['add']);

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);
  });

  it('group-range selection is not recorded', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 3, values: [1, 2, 3] });
    engine.dispatch({ type: 'selectGroups', min: 1, max: 2 });
    expect(engine.getState().dice.filter((d) => d.selected)).toHaveLength(2);
    expect(engine.getState().history.map((e) => e.kind)).toEqual(['add']);
  });

  it('coalesces consecutive adds into a single action', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.getState().dice).toHaveLength(3);
    expect(engine.getState().history).toHaveLength(1);
    expect(engine.getState().history[0]).toMatchObject({ kind: 'add', count: 3 });

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);
  });

  it('clears the redo branch after a new action follows undo', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 2 });
    engine.dispatch({ type: 'undo' });
    expect(engine.canRedo()).toBe(true);

    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.canRedo()).toBe(false);
  });

  it('coalesces a transaction into a single undo step', () => {
    const engine = createEngine(makeDeps());
    engine.beginTransaction();
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'delete' });
    engine.dispatch({ type: 'add', count: 2 });
    engine.endTransaction();
    expect(engine.getState().dice).toHaveLength(3);

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);
  });

  it('coalesces consecutive adds within a transaction into one history entry', () => {
    const engine = createEngine(makeDeps());
    engine.beginTransaction();
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'add', count: 1 });
    engine.dispatch({ type: 'add', count: 1 });
    engine.endTransaction();

    expect(engine.getState().dice).toHaveLength(3);
    expect(engine.getState().history).toHaveLength(1);
    expect(engine.getState().history[0]).toMatchObject({ kind: 'add', count: 3 });

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
  });

  it('undo restores history along with the dice', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.getState().history).toHaveLength(1);

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().history).toHaveLength(0);
  });

  it('nets add and delete into a single entry', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 5 });
    engine.dispatch({ type: 'delete', count: 2 });
    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.getState().dice).toHaveLength(4);
    expect(engine.getState().history).toHaveLength(1);
    expect(engine.getState().history[0]).toMatchObject({ kind: 'add', count: 4 });
  });

  it('nets a modification past zero into a delete entry', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 3 });
    engine.dispatch({ type: 'select', ids: ['d1'], mode: 'set' });
    engine.dispatch({ type: 'move', targetValue: 5 });
    engine.dispatch({ type: 'delete', count: 2 });
    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.getState().history.map((e) => [e.kind, e.count])).toEqual([
      ['add', 3],
      ['move', 1],
      ['delete', 1],
    ]);
  });

  it('undoes a whole netted modification as one step', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 5 });
    engine.dispatch({ type: 'delete', count: 2 });
    engine.dispatch({ type: 'add', count: 1 });
    expect(engine.getState().dice).toHaveLength(4);

    engine.dispatch({ type: 'undo' });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);
  });

  it('restore replaces state and clears undo history', () => {
    const engine = createEngine(makeDeps());
    engine.dispatch({ type: 'add', count: 2 });
    expect(engine.canUndo()).toBe(true);

    engine.restore({ dice: [], history: [], swipeAddAvailable: false, rememberedValues: [], selectedGroups: null });
    expect(engine.getState().dice).toHaveLength(0);
    expect(engine.getState().swipeAddAvailable).toBe(false);
    expect(engine.canUndo()).toBe(false);
    expect(engine.canRedo()).toBe(false);
  });
});
