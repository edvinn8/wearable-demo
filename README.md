# wearable-demo

## Lights — 1.0.8

Open **Tools → Lights** from Positions, or **Lights** from the watch's start menu. The scrollable
page loads its light names and available On/Off actions from wear-companion. The crown scrolls;
swipe right or Back returns to Tools. Buttons are unavailable until the catalogue is loaded and
while a command is pending. The status reports the request result, not a sensed switch state.

All names and webhook IDs live in the phone's private `app/src/main/assets/lights.json`; adding
lights requires only a phone rebuild, not a watch rebuild. See `../wear-companion/README.md`.

Run watch checks with DevEco's Node:

```sh
/Applications/DevEco-Studio.app/Contents/tools/node/bin/node --test test/*.test.mjs
```

The tests exercise the actual page and Wear Engine wrapper with a controlled native boundary:
receiver readiness, placeholders, catalogue chunks, command correlation, duplicate taps, failures,
timeouts, and cleanup. Physical phone/watch validation remains a separate device check.
