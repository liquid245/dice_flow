# DiceFlow — Product Specification

## Product

DiceFlow is an assistant for tabletop wargames that makes dice rolling faster, easier and more enjoyable.

The product is based on a previous version that was already used successfully in real games.

The new version preserves the proven workflow while improving usability, Game Feel, performance and extensibility.

## MVP

The MVP supports only standard six-sided dice (D6).

The core gameplay loop is:

Roll → Result → Modify → Select → Next Roll

A roll consists of selecting a number of dice and assigning each die a random value.

After a roll, the player can modify the result before the next roll.

## Dice

Each die has:

- type
- value
- selection state
- visual state

MVP:

D6 with values 1–6.

The architecture must allow future dice with arbitrary numbers of faces and arbitrary face properties, but these are not implemented in the MVP.

Selected dice are visually highlighted and slightly animated.

## Game Table

The table displays dice grouped by value.

For D6:

6
5
4
3
2
1

Dice automatically move to the group corresponding to their current value.

The table must support working comfortably with large numbers of dice.

Dice created or modified by later operations should be visually distinguishable from the original roll.

## Selection

The player can:

- select individual dice;
- select a range of dice;
- select a group;
- select multiple groups;
- select a range of groups.

Selection is performed through touch interaction.

Tap behaviour:

- a tap on a non-selected die selects it;
- a tap on another non-selected die selects the inclusive range from the first to the last die;
- a tap on an already-selected die clears the selection;
- a tap on a non-selected die while a range is selected clears the selection.

Swipe: press a die and swipe toward other dice before the drag delay elapses. The range from the start die to the die currently under the finger is selected live, updating in real time. Once a swipe begins, drag does not engage.

Group swipe: swiping across groups selects the range of groups live, from the start group to the group currently under the finger.

Hold: press and hold a die for about one second (without moving past the threshold), then drag to move dice between groups.

While a die is being dragged, it grows and follows the cursor; when several dice are moved, they gather around the cursor and follow it as a group.

The exact gesture implementation may evolve during development.

## Actions

### Roll

Roll starts a new roll iteration.

It rolls the selected dice and removes all dice that are not selected — they no longer participate.

The Roll button is inactive when no dice are selected.

### ReRoll

Rerolls the selected dice within the current iteration.

If no dice are selected, ReRoll rerolls every die on the table.

### Add

Adds dice. Each added die receives a random value and immediately appears in the group matching that value.

If dice are selected, the button displays the number selected.

Example:

5 selected → `Add 5`

If nothing is selected:

`Add 1`

Deleted values are remembered: a die added without an explicit value reuses the value of the last deleted die, so delete-then-add leaves values unchanged. This memory is cleared by Roll, ReRoll and Clear.

During the empty-table swipe, assigned values are remembered: if dice are removed and then re-added within the same gesture, they return with the same values.

Consecutive Add and Delete presses within one round coalesce into a single net action. For example, pressing "Add 5", then "Delete 2", then "Add 1" is recorded as a single "Add 4" action.

### Delete

Deletes selected dice.

The button displays the number of selected dice when applicable.

If no dice are selected, Delete may remove the most recently added player-created die.

Deleted dice values are remembered so a subsequent Add returns the same value (see Add).

### Move

Moves selected dice into another group.

The button displays the number of selected dice when applicable.

### Enhance

Increases the value of selected D6 dice by one.

Enhance is a special case of Move (move +1). It is not implemented in the current MVP.

### Clear

Completely clears the table after confirmation.

## Empty Table

When the table contains no dice, the application displays:

Swipe Finger to Add or Reduse Dices

The swipe works only when the table is completely empty — after launch or after Clear.

While the finger is held on the screen, vertical movement changes the number of dice.

Dice appear immediately in their groups.

Values assigned during the swipe are remembered: dice removed and then re-added during the same gesture return with the same values.

After the finger is released, this special add/reduce interaction stops.

The number of dice is fixed when the finger is released, and the whole gesture is treated as a single action.

## Undo / Redo

Undo and Redo operate on gameplay state.

They have unlimited depth within the session.

Undo and Redo navigate the action history: every action except selection can be undone.

After a new action is performed following Undo, the abandoned Redo branch is removed.

Consecutive identical actions coalesce into a single undoable step. For example, pressing "Add 1" five times in a row is one action that adds five dice; an empty-table swipe is one action whose number of dice is fixed when the finger is released. A mixed Add/Delete sequence within one round also coalesces into a single net action: "Add 5, Delete 2, Add 1" is one "Add 4" step.

## History

History records every action the player performs: Roll, ReRoll, Add, Delete, Move and Clear.

Undo and Redo navigate this same history and are not recorded as separate entries.

Add and Delete within the same round are collapsed into a single net entry: "Add 5, Delete 2, Add 1" is recorded as "Add 4".

Example:

20d6 → Roll → 4d6:6 → ReRoll → 2d6:6 → Explode

`4d6:6` means four dice with value 6.

`Explode` is a special case of Add and is not implemented in the MVP.

Operations after the initial Roll receive different visual shades.

Dice associated with an operation receive the corresponding shade so the player can understand which results came from which operation.

Only a limited number of recent history lines are visible during normal play.

A "Show Full History" function displays the history of the entire session.

Groups of rolls are separated by timestamps.

## Information Area

The upper area of the interface is an information panel.

The top row displays three segments in order:

- total dice on the table;
- changes since the last Roll or Clear;
- selected dice count.

The changes segment shows only the actions performed since the most recent Roll or Clear. After a Roll or Clear it is empty until the next modification.

It does not have to permanently display History.

Possible future content includes:

- current dice statistics;
- current results;
- quotes;
- messages.

Example:

20 D6

6: 4
5: 3
4: 5
3: 2
2: 3
1: 3

Another possible display:

"Лучше умереть за Императора,
чем жить для себя."

The final content and priority of these modes may change during development.

## Interface

The main action bar contains:

Roll
ReRoll
Add X
Move X

Delete X
Undo
Redo
Clear

When no dice are selected:

Roll is inactive.

ReRoll rerolls every die.

Add displays `1`.

Move displays `1` if the action is available.

Delete displays `Delete`.

When dice are selected, the relevant buttons display the number of selected dice.

The exact arrangement may change during UI development.

## Visual Design

The application uses 3D dice.

The initial implementation should focus on:

3D models
Materials
Lighting
Animation
Game Feel

Pixel-art rendering is an optional visual layer and may be added later.

It must not affect gameplay architecture.

## Game Feel

Game Feel is a major part of the product.

It may include:

- dice animations;
- sounds;
- particles;
- visual effects;
- camera effects;
- special reactions to results.

Examples:

Add → pop sound

Delete → air/wind sound

Roll → dice sound

Good result → stronger sound and particles

Bad result → different sound and particles

The exact effects are subject to experimentation during development.

Game Feel must not change gameplay rules.

## Platform

DiceFlow is distributed as a PWA.

Requirements:

- works in a browser;
- can be installed on a device;
- works offline after initial caching;
- supports multiple device platforms;
- starts very quickly;
- uses minimal battery.

## Startup

The application should prioritize immediate usability.

Preferred sequence:

Open
→ Show application
→ Restore local state
→ Interactive
→ Optional background work

Network requests must not unnecessarily delay the application.

## Performance

The application should not continuously render when there is nothing to animate or interact with.

Preferred behaviour:

IDLE
→ User interaction / animation
→ Render
→ IDLE

Performance optimization must preserve responsiveness and visual quality.

## Future Features

The architecture must support future expansion, but these features are outside the MVP.

### Custom Dice

Support for:

- arbitrary numbers of faces;
- arbitrary face values;
- additional face properties;
- special wargame dice.

### Content Packs

Support for:

- dice sets;
- backgrounds;
- sounds;
- effects;
- visual themes.

### Store and Payments

Future support for content sales and purchases.

The payment provider must remain replaceable.

### Remote Configuration

Future support for remotely controlled:

- announcements;
- images;
- messages;
- buttons;
- feature information;
- version information.

### Analytics

Future support for measuring:

- launches;
- installations;
- sessions;
- active users;
- platform;
- application version.

Analytics must not block startup.

### Feature Requests

The application may provide a way to request features through:

- GitHub;
- Telegram;
- another external communication channel.

### Buy Me a Coffee

The application may provide a link for supporting the developer.

### Push Notifications

Future possibility.

Push notifications are not required for the MVP.

## Non-Goals

DiceFlow does not require:

- physics-based dice;
- online multiplayer;
- server-side gameplay simulation;
- accounts;
- permanent network connection;
- continuous rendering.

The game state and dice results are local.

## Product Principle

The primary goal is not to maximize the number of features.

The primary goal is to make the existing dice workflow extremely fast, clear and pleasant.

Every new feature should be evaluated against:

"Does this make playing a wargame with DiceFlow faster, clearer or more enjoyable?"

If not, it should not be added to the MVP.