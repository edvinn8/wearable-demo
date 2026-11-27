# wearable-demo — Híd (lights)

The watch app is called **Híd** ("bridge" in Hungarian), like its phone app; bundle `com.edvinn.firstwearableapplication` is unchanged. Its round icon is the phone app's bridge (`design/hid-icon.svg`; rebuild the PNGs with the `rsvg-convert` lines in that file).

The original watch package `com.edvinn.firstwearableapplication` opens **Lights** directly. It loads the list from the signed-in Wear Companion phone 0.1.6, which reads EDOS Dashboard's `light-states` and switches through the dashboard's `setLight` function (see `../wear-companion/README.md`). The watch receives only light IDs, names, room labels and states.

Each row shows the light's name, its room (or the latest message) and one toggle: **On** (amber), **Off** (grey), or a disabled **Offline** / **?**. A tap flips the toggle at once (shown with "…") and sends the opposite action; the phone's reply confirms it, keeps it with "not confirmed yet", or puts it back with the reason. Several lights can switch at once; the same light ignores taps until its reply arrives. No reply within 20 s marks the light **?** (outcome unknown) until a Refresh. Nothing is retried automatically.

**Back** or swipe right opens the main menu: **Lights** and **Exit**, with room for more features, and the installed version below them. The version is set only in `entry/src/main/config.json` (`app.version`); the menu reads it at runtime with `@system.app.getInfo()`. Native Wear Engine imports, registered peer identity and receiver-before-request ordering are retained.

Choose which lights appear in **EDOS Dashboard → Lights → settings** (the same choice as the dashboard page). No private lights file is bundled into either app.

## Build and checks

Build the signed HAP with the standalone DevEco toolchain (`~/.local/share/traedo-watch-ci/deveco`, see `../matchday-scores/docs`) or DevEco Studio; retain the local signing files/profile. Output: `entry/build/default/outputs/default/entry-default-signed.hap`.

```sh
D=~/.local/share/traedo-watch-ci/deveco
DEVECO_SDK_HOME=$D/sdk JAVA_HOME=$D/jbr/Contents/Home PATH="$D/tools/node/bin:$PATH" \
  "$D/tools/hvigor/bin/hvigorw" assembleHap --mode module -p product=default -p module=entry@default -p buildMode=debug --no-daemon
node ../matchday-scores/watch/scripts/verify-lite-bundle.mjs "$PWD/entry/build/default/intermediates/lite_source/default/assets/js"
```

```sh
~/.local/share/traedo-watch-ci/deveco/tools/node/bin/node --test test/*.test.mjs
```

The tests exercise the real page/native wrapper: receiver readiness, catalogue chunks, instant toggles, parallel switches, repeat taps, reply correlation, failures, timeouts, Refresh during a switch and cleanup. Compiled bundles must also pass the JerryScript verifier used by Matchday Scores. Transfer the signed HAP manually; physical validation is separate from local tests.

## Huawei Lite timer and vibration lesson

GT 6 device testing in the sibling Matchday Scores watch app (2.3.5, 2026-10-07)
confirmed that chained Short vibrations work through ten buzzes, including patterns
longer than two seconds. Scheduling all buzz timeouts upfront had truncated patterns
and apparently starved the later alert-dismissal timer. The exact timer limit is inferred,
not documented. This Lights app currently has no vibration sequences to migrate.

For future patterns, request a buzz and schedule only the next one. Do not wait for the
native success callback as if it indicated motor completion. Reserve alert dismissal
separately, check timer allocation, and cancel/revision-guard callbacks on hide, exit or
failure. See [the detailed findings and rules](../matchday-scores/docs/WATCH-VIBRATIONS.md)
in the sibling checkout.
