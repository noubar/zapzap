# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Optional Fake Signals across all four game variants, using randomized blue, purple, and amber flashes that must be ignored before the real white GO signal.
- A lightweight deterministic fake-signal scheduler with randomized counts, colors, timing, duration, safety gaps, and round-generation cancellation.
- Fake-signal regression coverage for scheduling geometry, color selection, false starts, target independence, multiplayer synchronization, stale callbacks, persistence, and consecutive rounds.
- A safe-area-aware Game Options route for difficulty, multiplayer format, haptics, future feature visibility, and confirmed preference reset.
- Versioned, validated offline settings persistence using `@react-native-async-storage/async-storage`, including corrupted-data recovery and legacy migration.
- Easy, Normal, Hard, and Insane difficulty profiles with centralized 500, 350, 250, and 180 ms reaction deadlines.
- Single Round, Best of 3, Best of 5, and Best of 7 multiplayer formats alongside the existing Three Lives rules.
- Deterministic settings and match-format tests covering hydration, persistence, migration, reset, immutable round snapshots, scoring, and draws.
- Deterministic multiplayer outcome utilities and regression coverage for shared signaling, readiness, exact ties, deadlines, wrong-finger releases, duplicate input, life penalties, match resets, and repeated rounds.
- A shared arcade theme and reusable result screen now centralize ZapZap colors, typography, spacing, reaction-time formatting, and end-of-round actions.
- Accessible names, hints, states, and text cues accompany the reaction controls and color feedback.
- Pure gameplay helpers and deterministic automated tests for reaction boundaries, random waiting, reaction comparison, target validation, and stale-timer prevention.
- A round timer manager that tracks randomized-signal, animation-frame, deadline, and result-transition callbacks.
- `tsx` and `@types/node` development dependencies for portable TypeScript test execution.

### Changed

- The persistent Fake Signals option is now enabled in Game Options and described as “Ignore colored flashes. Release only on white.”
- Fake-enabled rounds suppress signal haptics so the genuine white signal has no unique nonvisual cue; existing GO haptics remain unchanged when Fake Signals is off.
- Two-player fake flashes share one schedule and color, while two-finger variants independently randomize which button flashes without influencing the genuine targets.
- Signal colors are centralized in a platform-independent palette shared by gameplay scheduling and presentation.
- All four game variants now read centralized settings; reaction deadlines are snapshotted per round and multiplayer format is locked for the complete match.
- Existing vibration behavior now uses the persistent Haptic Feedback preference without adding work to the reaction timestamp path.
- The legacy Medium difficulty is presented and migrated as Normal, while maintaining its 350 ms deadline.
- Multiplayer score presentation switches between remaining lives and round wins according to the selected format.
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

- Fake flashes remain presentation-only waiting states: they never create a reaction timestamp, deadline, score, life penalty, or valid release path.
- Fake callbacks are cancelled with the owning round and cannot outlive reset, failure, success, timeout, match completion, or navigation cleanup.
- Settings hydration cannot overwrite saved preferences with defaults before the initial storage read completes, and unchanged values do not trigger redundant writes.
- Sound Effects and Visual Effects are clearly unavailable rather than implying active functionality.
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

- Sound playback and optional decorative visual effects remain unavailable and are labeled Coming Soon in Game Options.
- Fake-signal flash perception and cancellation during operating-system interruptions still require physical Android and iOS verification.
- Four-finger gesture recognition and near-simultaneous native release delivery still require physical Android and iOS device testing.
- Automated browser viewport inspection was unavailable in this environment; responsive appearance, multi-touch feel, haptics, and safe-area behavior still require phone/tablet and physical Android/iOS verification.
- Exact display photon-to-touch latency cannot be measured from JavaScript. Animation-frame signal timing and UI-thread release timestamps reduce software scheduling error but still include platform rendering and input latency.
- Simultaneous two-finger and four-finger behavior still requires physical Android and iOS device validation.
