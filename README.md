# wearable-demo — lights 1.0.9

The original watch package `com.edvinn.firstwearableapplication` now opens **Lights** directly. It loads an ordered catalogue from the signed-in Wear Companion phone 0.1.5. Credentials stay in Firebase/on the phone; the watch receives only IDs, names and action availability.

The scrollable page has explicit On/Off actions. Buttons stay unavailable until loaded and while a command is pending. Refresh fetches updated configuration without rebuilding. A removed/empty catalogue replaces old controls. Results report request acceptance, not sensed physical state; a timeout means outcome unknown and is never automatically retried.

**Tools** or swipe right opens diagnostics. Tools offers Lights, P2P test and Exit. All positions/trading/mock routes have been removed. Native Wear Engine imports, registered peer identity and receiver-before-request ordering are retained.

Configure in **EDOS Dashboard → Admin → Lights Config**, Firestore `lights-config/{Firebase UID}`. See `../wear-companion/README.md` and `../../edos-dashboard/docs/lights-config.md` for setup. No private lights file is bundled into either app.

## Build and checks

Build the signed HAP through the existing DevEco Studio configuration; retain the local signing files/profile. Output: `entry/build/default/outputs/default/entry-default-signed.hap`.

```sh
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node --test test/*.test.mjs
```

The tests exercise the real page/native wrapper: receiver readiness, catalogue chunks, Refresh replacement, command correlation, duplicate taps, failures, timeouts and cleanup. Compiled bundles must also pass the JerryScript verifier used by Matchday Scores. Transfer the signed HAP manually; physical validation is separate from local tests.

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
