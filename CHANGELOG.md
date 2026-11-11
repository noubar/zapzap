# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Deterministic multiplayer outcome utilities and regression coverage for shared signaling, readiness, exact ties, deadlines, wrong-finger releases, duplicate input, life penalties, match resets, and repeated rounds.
- A shared arcade theme and reusable result screen now centralize ZapZap colors, typography, spacing, reaction-time formatting, and end-of-round actions.
- Accessible names, hints, states, and text cues accompany the reaction controls and color feedback.
- Pure gameplay helpers and deterministic automated tests for reaction boundaries, random waiting, reaction comparison, target validation, and stale-timer prevention.
- A round timer manager that tracks randomized-signal, animation-frame, deadline, and result-transition callbacks.
- `tsx` and `@types/node` development dependencies for portable TypeScript test execution.

### Changed

- Both multiplayer modes now settle rounds from independently captured per-player results using one shared signal timestamp and one guarded outcome calculation.
- Multiplayer reaction controls explicitly allow simultaneous cross-component gesture recognition so one active hold does not cancel another player's or finger's handler.
- Multiplayer round summaries now show each player's reaction time or explicit failure reason alongside the winner and updated lives.
- Two-finger multiplayer still randomizes each player's target independently, but activates both targets in the same frame-aligned signal event.
- All four game variants, the main menu, and the tutorial now use a consistent high-contrast arcade presentation with safe-area-aware, responsive layouts.
- Multiplayer screens clearly distinguish Player 1 and Player 2, preserve opposite-player orientation, and show readable round outcomes and failure reasons.
- Held, GO, success, failure, victory, and reaction-time states now have consistent visual and textual feedback without changing gameplay timing or touch ownership.
- Reaction releases from Gesture Handler screens now carry a monotonic UI-thread timestamp into the game logic.
- Valid-signal timestamps are established on the next animation frame after the signal state is requested, reducing the gap between timing start and visual presentation.

### Fixed

- Multiplayer releases no longer replace the active deadline timer after the first valid reaction; both players remain independently recordable until settlement.
- Duplicate releases and stale callbacks cannot apply multiple life penalties, and match completion cancels all remaining round callbacks.
- Simultaneous failures collected in the same frame now produce the established draw penalty for both players instead of depending on callback order.
- Play Again fully resets multiplayer lives, targets, held inputs, reaction records, round guards, and timers.
- Result screens and HUD values now use consistent millisecond formatting and avoid corrupted symbol encoding.
- Safe-area padding prevents controls and status text from colliding with phone cutouts and home indicators.
- One-finger single-player rounds now preserve held state, use the selected difficulty deadline, require a fresh hold for every round, and fully clear transient state on restart.
- All modes enforce `reactionTime <= deadline` as valid and reject measured late releases even when a timeout callback is delayed.
- Round/session guards prevent stale timers, duplicate scoring, and prior rounds from changing a reset game.
- Tutorial animation callbacks and animation work are fully cancelled when the screen unmounts.
- Gesture cancellation and interruption clear held state and follow the active round's normal release rules.
- Two-player reaction handling no longer mutates React state directly.

### Known Limitations

- Four-finger gesture recognition and near-simultaneous native release delivery still require physical Android and iOS device testing.
- Automated browser viewport inspection was unavailable in this environment; responsive appearance, multi-touch feel, haptics, and safe-area behavior still require phone/tablet and physical Android/iOS verification.
- Exact display photon-to-touch latency cannot be measured from JavaScript. Animation-frame signal timing and UI-thread release timestamps reduce software scheduling error but still include platform rendering and input latency.
- Simultaneous two-finger and four-finger behavior still requires physical Android and iOS device validation.
