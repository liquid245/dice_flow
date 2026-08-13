# TODO

## Как работать с TODO

`TODO.md` содержит только актуальные задачи разработки.

TODO не является спецификацией продукта или архитектуры. Перед реализацией задачи необходимо сверяться с:

- `SPEC.md` — что должно делать приложение;
- `ARCHITECTURE.md` — как оно должно быть устроено;
- `AGENTS.md` — правила работы AI с проектом.

### Правила

- Выполнять задачи сверху вниз, если не указано иное.
- Одна задача должна представлять собой небольшой законченный результат.
- Не добавлять в TODO задачи только ради гипотетических будущих возможностей.
- Не считать упоминание будущей функции в архитектуре задачей на реализацию.
- После выполнения задачи отметить её как выполненную.
- Если в процессе обнаружена новая необходимая задача, добавить её в TODO.
- Если задача требует изменения продукта или архитектуры, сначала обновить соответствующую спецификацию.
- Не удалять выполненные задачи без необходимости: они могут быть полезны как история разработки.

### Статусы

Используются следующие обозначения:

- `[ ]` — задача не выполнена;
- `[-]` — задача в работе;
- `[x]` — задача выполнена.

### Формат задачи

Каждая задача должна быть сформулирована как конкретное действие с понятным результатом.

Хорошо:

- `[ ] Реализовать выбор одного кубика`
- `[ ] Добавить тесты для ReRoll`
- `[ ] Реализовать сохранение Game State в IndexedDB`

Плохо:

- `[ ] Сделать Selection`
- `[ ] Улучшить производительность`
- `[ ] Подумать о будущем магазине`

AI не должен самостоятельно расширять задачу за пределы её формулировки.

## Приведение репозитория в рабочее состояние

- [x] Инициализировать npm-проект (package.json, .gitignore, engines node>=20)
- [x] Настроить TypeScript (tsconfig.json, strict)
- [x] Настроить Vite + React (vite.config.ts, @vitejs/plugin-react)
- [x] Установить зависимости: react, react-dom, three, @types/three и dev-инструменты (vite, typescript, vitest, vite-plugin-pwa, eslint)
- [x] Создать entry point: index.html, src/app/main.tsx, src/app/App.tsx
- [x] Настроить Vitest + smoke-тест
- [x] Настроить PWA: manifest + service worker (vite-plugin-pwa)
- [x] Создать структуру каталогов src/ (core, ui, renderer, input, storage, services, pwa, app)
- [x] Настроить ESLint + npm-скрипты (dev/build/preview/test/typecheck/lint)
- [x] Верификация: typecheck + test + lint + build проходят

## Движок (Core)

- [x] Определить типы кубика (src/core/dice/types.ts): DiceId = string; DiceType = 'd6'; OperationKind = 'roll' | 'reroll' | 'add' | 'move'; Die { id, type, value, selected, origin }
- [x] Определить GameState (src/core/game/state.ts): { dice: Die[]; history: HistoryEntry[]; swipeAddAvailable: boolean }
- [x] Определить EngineDeps { random, nextId, now } и Action union (src/core/actions/types.ts): roll | reroll | add{count, values?} | delete{count?} | move{targetValue} | select{ids, mode} | clear | undo | redo
- [x] Реализовать чистую функцию reduce(state, action, deps) (src/core/game/reducer.ts)
- [x] Реализовать add: случайные значения (+N), опциональные явные значения для восстановления при свайпе + тесты
- [x] Реализовать delete: выбранные или последний добавленный + тесты
- [x] Реализовать roll: новая итерация — бросок выбранных, удаление невыбранных + тесты
- [x] Реализовать reroll: переброс выбранных (или всех, если ничего не выбрано) + тесты
- [x] Реализовать move: перемещение выбранных в целевую группу + тесты
- [x] Реализовать select: set/toggle/add/remove + тесты
- [x] Реализовать clear: очистка стола + swipeAddAvailable = true + тесты
- [x] Реализовать undo/redo: навигация по истории действий (все действия отменяемы), коалесцирование одинаковых действий + тесты
- [x] Реализовать History: плоский лог всех действий (roll/reroll/add/delete/move/select/clear) + тесты
- [x] Реализовать селекторы: groupByValue, selectedDice, counts + тесты
- [x] Реализовать движок createEngine: dispatch, subscribe, canUndo/canRedo, beginTransaction/endTransaction + тесты
- [x] Коалесцировать историю внутри транзакции (свайп = одна запись "add N") + тесты

## Input Layer

- [x] Реализовать SwipeAddSession: чистый контроллер жеста (add/delete с запоминанием значений) + тесты
- [x] Реализовать хук useSwipeAdd и подключить свайп на пустом столе в GameTable
- [x] Реализовать tap-cycle выбора (одиночный → диапазон → сброс) + тесты
- [x] Реализовать drag для Move (перетаскивание выбранных в целевую группу) + тесты
- [x] Реализовать group swipe (выбор диапазона групп) + тесты
- [ ] Long press: уточнить поведение (SPEC привязывает long press к move, уже покрыто drag)