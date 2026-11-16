# Expanded multiplayer device testing

ZapZap's automated tests verify the generalized rules, radial geometry, pointer ownership, shared timing model, player-count validation, and stale-event protection for up to eight players. The web export verifies that the generalized route and calibration route build. These checks do not establish a physical device's multitouch limit.

## Implemented input policy

- Each radial player owns the sector where their stable native pointer ID begins.
- Moving outside that sector does not transfer the contact to another player.
- Release and cancellation finish only the owning player's input.
- A second contact in an occupied sector is ignored and cannot replace the controlling pointer.
- Touches in the neutral center or outside the arena are ignored.
- App backgrounding, navigation cleanup, replay, and round changes invalidate pending timers and held state.
- Orientation or viewport changes cancel an active round before geometry and ownership are rebuilt.

The menu combines a screen-space estimate with the highest simultaneous pointer count observed on the built-in TEST MULTITOUCH surface. Counts above four remain unavailable until observed. This result is evidence from one test, not a permanent hardware specification. Expo and React Native do not expose a supported cross-platform API that reports an exact reliable contact maximum.

## Orientation and build consequences

- Existing smartphone gameplay remains portrait-only; radial multiplayer and calibration can rotate to use the limiting screen dimension.
- A viewport change cancels the active round and clears pointer ownership before rebuilding the arena inside the safe-area bounds.
- Expanding supported orientations in `app.json` changes native configuration, so development and release binaries need to be rebuilt. Expo Go is useful for interaction checks but is not proof of standalone-build behavior; iPad multitasking and platform policy can still constrain an orientation request.

## Physical-device checks still required

- Three and four simultaneous contacts on representative Android and iOS phones.
- Five, six, seven, and eight simultaneous contacts on representative Android and iOS tablets.
- Simultaneous and near-simultaneous release ordering at every supported count.
- Cancellation and movement near region boundaries.
- Touches crossing sector borders without ownership transfer.
- Extra contacts inside an already occupied sector.
- Physical screen-edge and system-navigation gesture interference.
- Portrait/landscape changes during idle, waiting, GO, and results.
- Small-phone and tablet hand spacing, sector size, and label readability.
- Real visual GO simultaneity and frame responsiveness under eight active contacts.
- Shared audio and haptic behavior with multiple participants.
- Backgrounding and returning during waiting and GO phases.
- Repeated complete eight-player matches, replay, and return-to-menu cleanup.

No physical-device testing is claimed for this implementation.
