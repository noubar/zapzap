# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- A shared arcade theme and reusable result screen now centralize ZapZap colors, typography, spacing, reaction-time formatting, and end-of-round actions.
- Accessible names, hints, states, and text cues accompany the reaction controls and color feedback.
- Pure gameplay helpers and deterministic automated tests for reaction boundaries, random waiting, reaction comparison, target validation, and stale-timer prevention.
- A round timer manager that tracks randomized-signal, animation-frame, deadline, and result-transition callbacks.
- `tsx` and `@types/node` development dependencies for portable TypeScript test execution.

### Changed

- All four game variants, the main menu, and the tutorial now use a consistent high-contrast arcade presentation with safe-area-aware, responsive layouts.
- Multiplayer screens clearly distinguish Player 1 and Player 2, preserve opposite-player orientation, and show readable round outcomes and failure reasons.
- Held, GO, success, failure, victory, and reaction-time states now have consistent visual and textual feedback without changing gameplay timing or touch ownership.
- Reaction releases from Gesture Handler screens now carry a monotonic UI-thread timestamp into the game logic.
- Valid-signal timestamps are established on the next animation frame after the signal state is requested, reducing the gap between timing start and visual presentation.

### Fixed

- Result screens and HUD values now use consistent millisecond formatting and avoid corrupted symbol encoding.
- Safe-area padding prevents controls and status text from colliding with phone cutouts and home indicators.
- One-finger single-player rounds now preserve held state, use the selected difficulty deadline, require a fresh hold for every round, and fully clear transient state on restart.
- All modes enforce `reactionTime <= deadline` as valid and reject measured late releases even when a timeout callback is delayed.
- Round/session guards prevent stale timers, duplicate scoring, and prior rounds from changing a reset game.
- Tutorial animation callbacks and animation work are fully cancelled when the screen unmounts.
- Gesture cancellation and interruption clear held state and follow the active round's normal release rules.
- Two-player reaction handling no longer mutates React state directly.

### Known Limitations

- Automated browser viewport inspection was unavailable in this environment; responsive appearance, multi-touch feel, haptics, and safe-area behavior still require phone/tablet and physical Android/iOS verification.
- Exact display photon-to-touch latency cannot be measured from JavaScript. Animation-frame signal timing and UI-thread release timestamps reduce software scheduling error but still include platform rendering and input latency.
- Simultaneous two-finger and four-finger behavior still requires physical Android and iOS device validation.
