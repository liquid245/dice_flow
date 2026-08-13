# AGENTS.md

## Project

DiceFlow is a web-based 3D dice assistant for tabletop wargames.

The project is developed primarily with AI coding agents under human direction.

Before making changes, read:

- `SPEC.md` — product requirements
- `ARCHITECTURE.md` — technical architecture
- `TODO.md` — current development priorities

Do not duplicate the contents of these documents here.

## General Rules

- Make the smallest change that completely solves the task.
- Do not implement features that were not requested.
- Do not perform unrelated refactoring.
- Do not change product behaviour without explicit instruction.
- Do not invent product decisions.
- Prefer simple, explicit solutions over abstractions for hypothetical future requirements.
- Do not add dependencies without a clear technical reason.
- Preserve existing behaviour unless the task explicitly changes it.

If a requested change conflicts with the architecture, explain the conflict before making a large architectural change.

## Architecture Rules

DiceFlow has three primary layers:

UI
→ Game Core
→ Renderer

The Game Core is pure TypeScript and is the authoritative source of gameplay state.

The Game Core must not depend on:

- React
- Three.js
- WebGL
- DOM APIs
- browser-specific APIs

The Game Core must be testable independently of the browser.

The UI is responsible for displaying state, receiving input and dispatching actions.

The UI must not contain gameplay rules.

The Renderer is responsible for:

- 3D dice
- animations
- particles
- camera
- materials
- visual selection
- visual movement
- Game Feel

The Renderer must not determine dice results or implement gameplay rules.

## State

Game State is the single source of truth.

Do not store authoritative gameplay state inside:

- React components
- Three.js objects
- DOM elements
- animation controllers

Gameplay state and visual state are separate concepts.

For example:

Game State:
dice.value = 6

Renderer State:
dice is currently rotating

## Actions

Gameplay changes must happen through explicit actions.

Current actions:

- Roll
- ReRoll
- Add
- Delete
- Move
- Select
- Clear
- Undo
- Redo

Enhance is a special case of Move and is not implemented in the MVP.

Undo and Redo operate on state history.

Avoid hidden mutations and side effects.

## MVP Boundary

The MVP supports D6 only.

MVP features:

- Roll
- ReRoll
- Add
- Delete
- Move
- Selection
- Groups
- Undo
- Redo
- Clear
- History
- 3D rendering
- Game Feel
- PWA
- Offline operation
- Fast startup
- Low battery usage

Future features must not be implemented unless explicitly requested:

- custom dice
- custom face properties
- content packs
- store
- payments
- remote configuration
- expanded analytics
- GitHub feature requests
- Buy Me a Coffee
- push notifications

Do not create large placeholder systems for future features.

## Performance

Startup speed and battery consumption are first-class requirements.

The application should not continuously render when nothing is happening.

Prefer an event-driven rendering model:

IDLE
→ interaction / animation
→ render
→ IDLE

Avoid unnecessary permanent `requestAnimationFrame` loops.

Do not block startup on optional network operations.

The application must remain usable offline.

## PWA

DiceFlow is a PWA.

It must support:

- installation
- offline operation
- cached application shell
- fast subsequent startup

The application should become interactive as early as possible.

Optional work such as analytics, remote configuration and resource updates should happen after startup whenever possible.

## Input

Input handling must be separate from gameplay rules.

Current interactions include:

- tap
- long press
- drag
- swipe
- group selection
- range selection

Gesture implementation may evolve during development.

Do not encode gesture-specific logic into the Game Core.

## Testing

Core logic must have automated tests.

At minimum, test:

- Roll
- ReRoll
- Add
- Delete
- Move
- Selection
- Undo
- Redo
- Clear
- History

For every meaningful Core change:

1. Add or update tests.
2. Run relevant tests.
3. Run the full test suite when practical.
4. Run type checking and build.
5. Inspect the final diff.

Never claim that a change works without verification.

## Development Workflow

For every task:

1. Read the relevant specification.
2. Inspect the existing implementation.
3. Identify the smallest required change.
4. Implement the change.
5. Add or update tests.
6. Run validation.
7. Inspect the diff.
8. Report what changed and what was verified.

Do not rewrite large parts of the project when a smaller change is sufficient.

## Git

Do not:

- reset unrelated user changes
- delete unrelated files
- rewrite history
- commit secrets
- modify unrelated code

Keep commits focused when committing is requested.

## Dependencies

Before adding a dependency:

1. Check whether the functionality already exists.
2. Check whether it can be implemented simply without a dependency.
3. Consider bundle size.
4. Consider startup performance.
5. Consider offline compatibility.
6. Consider long-term maintenance.

Do not add a dependency merely for convenience.

## Communication

Before a non-trivial implementation, briefly state:

- what was found;
- what will be changed.

After implementation, report:

- files changed;
- tests/checks executed;
- remaining issues.

Keep reports concise.

## Agent Authority

The coding agent is an implementation assistant.

The human developer is the product owner.

The agent must not independently:

- redesign the UX;
- change gameplay rules;
- add product features;
- replace the technology stack;
- introduce major architectural changes.

When a product decision is required, ask the human.