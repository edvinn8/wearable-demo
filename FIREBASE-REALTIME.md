# Reading Firebase data on the Watch GT 6 — Feasibility

Investigation: can this lite wearable app show data from Firebase? Scope is personal
use only, on a **Watch GT 6** paired to a **Samsung S23 (Android)**.

Use case: *open the watch app, see current dashboard data.* Not background alerting —
that is already handled by Telegram bot messages.

## Verdict

**Viable.** An Android companion app is required as a mediator, but the "open it and
look" use case is the easy version of this problem — it sidesteps the platform's
worst limitation.

## Why the watch cannot talk to Firebase directly

Two independent blockers:

1. **No network hardware path.** The GT 6 has Bluetooth (BT 6.0, BR+BLE) and NFC.
   **No Wi-Fi, no eSIM, no LTE.** Its only route to the internet is the paired phone.
2. **No background execution.** The lite wearable runtime cannot run apps in the
   background: "App can not run in the background, and cannot be resumed in the same
   state."

A Firebase SDK on-device is impossible regardless: no WebSocket support, an old JS
dialect, 10 MB app / 48 KB-per-page budget.

## Architecture

```mermaid
sequenceDiagram
    participant W as GT 6 app (lite JS)
    participant P as Android app (S23)
    participant F as Firebase
    W->>P: P2P request on app open
    P->>F: read (SDK or REST)
    F-->>P: data
    P-->>W: P2P response, <=1KB
    Note over W,P: optional: keep listener alive<br/>while watch screen is open
```

**Request/response on open, not a persistent push pipeline.** The watch asks when it
starts; the phone fetches and replies. Optionally the phone keeps a Firebase listener
alive for the few minutes the watch screen is on, so values update while you look.

This matters: you do **not** need a 24/7 foreground service holding a Firebase
connection, which is the part that OEM battery managers break. The phone only works
when the watch asks.

## The constraint that will actually shape this: 1 KB

| Channel | Limit |
|---|---|
| **P2P text message** | **1 KB** |
| File transfer phone → watch | 100 MB |
| File transfer watch → phone | 4 MB |

1 KB is the whole budget for a dashboard payload. Design consequences:

- **Do all work on the phone.** Filter, sort, round, format there. Send the watch
  display-ready values, never raw Firebase documents.
- **Use short keys and compact encoding.** `{"t":142.5,"d":-2.1}`, not
  `{"currentTarget": 142.5, "dailyDelta": -2.1}`.
- **Paginate by screen.** One message per watch screen. If you need more, the watch
  requests page 2 rather than the phone pushing everything.
- File transfer exists as an escape hatch for larger payloads, but it is clumsy for
  frequently-changing values — treat 1 KB as the real design budget.

Combined with the **48 KB per page** and **no router back stack** limits, the watch app
should be a small number of flat, mostly-static screens whose text nodes get updated.

## Prerequisites

- **Apply for Wear Engine** in the Huawei developer console (App Services → Wear Engine
  → Apply). Two spreadsheets required: *Data Permission and Usage Description* and
  *User Authorization Path Description*. **Individuals are eligible.** Reported
  turnaround ranges from 3–5 days to ~2 weeks. Nothing P2P is testable until it clears,
  so apply before building.
- **`wearengine.js`** in `entry/src/main/js/MainAbility/wearengine/`.
- **`PEER_PKG_NAME` + `PEER_FINGERPRINT`** on both sides. The fingerprint comes from the
  Android app's signing cert, so that signing config must be stable — if you re-sign the
  Android app, the pairing breaks.
- **`DEVICE_MANAGER`** permission on the Android side.
- Watch paired in Huawei Health; both apps installed.

## API surface

**Android:** `HiWear.getP2pClient()` → `send()`, `registerReceiver()`, `getAppVersion()`
(returns -1 if the watch app is not installed), `ping()`.

**Watch (FA model, matches this project):** `new P2pClient()`,
`setPeerPkgName()`, `setPeerFingerPrint()`, `p2pClient.send()`, receive callback.
Binary conversion via `textEncoder.encodeInto()`.

## Which Firebase product?

Worth settling before writing the companion. Your dashboards project keeps per-user
state in **Firestore**, not Realtime Database — different SDK and different REST
semantics, though from the watch's perspective nothing changes since the phone does all
Firebase work.

- **Firestore**: `addSnapshotListener` for live, `get()` for one-shot. Fine either way.
- **Realtime Database**: `ValueEventListener`, or REST with `Accept: text/event-stream`
  for SSE streaming.

If the watch only reads on open, a one-shot `get()` is simpler and cheaper than a
listener, and avoids holding any connection at all.

## Application status

**Submitted 2026-09-13 -> rejected 2026-09-16 -> revised and resubmitted 2026-09-16 09:38, status "To be reviewed".**

Track it at *HUAWEI Developer Console -> App services -> Development -> Wear Engine*
(not AppGallery Connect).

| | |
|---|---|
| Product name | Wear Companion |
| APP ID | `118971063` |
| Package | `com.edvinn.wearcompanion` |
| Supported model | HUAWEI WATCH GT 6 |

### What the rejection said

Verbatim points from the HUAWEI Wear Engine Developer Team:

1. Specify the watch models to be supported.
2. Provide screenshots or UX diagrams of the phone and watch showing the Wear Engine
   scenarios.
3. Basic device information alone is sufficient for P2P between phone and watch app;
   Message notification is not needed. Also: *"the following scenario is not supported:
   'The notification carries a button that opens the wearable app for the full view.'"*
4. **"The Launch specified app permission is not supported currently."**

Plus: *"You only need to apply for the Wear Engine service permission for phone apps, but
not for wearable device apps."*

**Basic device information itself was never questioned** — the P2P architecture stands.

### The consequence that matters: no wake-on-open

`com.huawei.hiwear.startremoteapp` is **not available**, so the watch cannot start the
companion app. That settles the open question in the negative:

- The Android companion must already be running when the watch app asks for data.
- That means a **persistent foreground service** with a notification, plus a battery
  optimisation exemption on the S23. Both reference projects do exactly this, so it is a
  proven pattern, not a workaround.
- The Samsung-side setup (HMS Core installed, Huawei Health background + pop-ups,
  battery exemption) moves from "nice to have" to load-bearing. If any of it lapses, the
  watch app shows stale data or nothing.

Design accordingly: the watch app needs a visible "can't reach phone" state, because that
will happen in normal use.

### Resubmission (2026-09-16, accepted into review)

| Requested | Status |
|---|---|
| `com.huawei.hiwear.devicemanager` | kept — the only permission now requested |
| `com.huawei.hiwear.notification` | dropped, per point 3 |
| `com.huawei.hiwear.startremoteapp` | dropped, not supported |

Documents updated:

- Permission table cut to the single Basic device information row.
- HUAWEI WATCH GT 6 named explicitly as the only supported model, in both the permission
  row and the App Information sheet.
- A **UX diagram** (`wear_engine_ux.png`, in the parent folder) embedded beneath the
  permission table: phone screen, watch screen, and the labelled P2P request/response
  between them, with the Firebase read and the no-connectivity constraint shown.
- The requirements text now states explicitly that the phone app is started by the user
  and runs in the foreground, and that no remote-launch capability is requested — heading
  off point 4 on a second pass.
- Authorization document: launch-app paragraph removed; HMS Core requirement added.

### Remaining weak point

No live screenshots — only the UX diagram. The submission states that the integration
cannot be built before access is granted (the APIs return "Scope unauthorized"). The
rejection asked for "screenshots **or** UX diagrams", so this should now be satisfied, but
it is the likeliest sticking point if it bounces again.

## Wear Engine application — verified details

Confirmed against Huawei's docs (page last updated 2026-04-08) and the live consoles.

**It is not in AppGallery Connect.** Searching AGC for "wear" returns nothing, in both
*Manage open capabilities* and *Manage APIs*, because Wear Engine lives in the separate
**HUAWEI Developer Console**: *Console -> App services -> Development -> Wear Engine ->
Apply for Wear Engine*.

**Individual developers can only apply for two permissions:** *Basic device information*
and *Message notification*. That sounds fatal but is not — the permission table shows
**P2P messaging sits under Basic device information**, not under some restricted tier:

| Permission | Open capability | Covers |
|---|---|---|
| **Basic device information** (`DEVICE_MANAGER`) | Wearable device status management | List paired devices, battery, connection status, available space |
| | **Communications management** | **Sending P2P messages or files; receiving P2P messages or files** |
| Message notification (`NOTIFY`) | Message notification management | Push templated notifications to the watch |
| Wearable user status (`WEAR_USER_STATUS`) | — | Wearing status, heart rate alerts |
| Human body sensor | — | Restricted to professional research institutions |

So **tick Basic device information only.** Message notification is redundant here.

Form fields to expect:

- **Product Type**: Android App (iOS App and HarmonyOS App also listed)
- **Select**: the registered Android app — requires HUAWEI ID service applied for it
- **APK Name**
- **Basic information**: which wearables to support — for a GT 6 choose
  **Harmony Lightweight Smart Wearable Device**
- **Is an application developed on the wearable device?** → **Yes**
- Two uploads: *data permission and use instructions*, and *description of user
  authorization paths*. Both have a **Download Example** link on the form itself; Excel
  or PDF, under 10 MB.

### Two constraints found in the application fine print

1. **"The following capabilities require that your mobile app be running in the
   foreground and the Huawei Health app be running properly in the background."**
   This bears directly on the wake question. Read strictly it means the phone app must
   be on screen; read as Android terminology it means a foreground *service* (persistent
   notification) is enough, which is what the reference projects do. Assume a foreground
   service is needed and verify with the hello-world round trip before building on it.
2. **"If you want to support non-Huawei Android phones, check whether the Huawei Health
   app can run in the background on these phones."** The S23 is a non-Huawei phone, so
   Huawei Health needs a battery-optimisation exemption in Samsung's settings or the
   link dies silently.

Also noted: **"The wearable capability does not support iOS devices"** — the Android
phone is not just convenient here, it is required.

### Answered: the app cannot be woken remotely

The 2026-09-16 rejection settled this — *"The Launch specified app permission is not
supported currently."* There is no remote launch, so the companion must be alive before
the watch asks. Use a foreground service and treat the phone-unreachable case as a normal
state the watch UI has to show, not an edge case.

## Gotchas from the Wear Engine FAQ

Collected from Huawei's FAQ (last updated 2025-10-13). These cost real debugging time.

**Package names differ by design — configure peers explicitly.** Huawei's FAQ says
"by default, the package name on the wearable device should be consistent with the package
name on the phone." Ours are deliberately different:

| | |
|---|---|
| Watch app bundle | `com.edvinn.firstwearableapplication` |
| Phone app package | `com.edvinn.wearcompanion` |

**Decision (2026-09-13): keep both names as they are.** The matching-name rule is only the
fallback used when no peer is specified. Renaming the watch bundle would mean a new
HarmonyOS App ID and a regenerated debug profile (the profile is bundle-bound — the
certificate is not), bought for cosmetics alone. Instead, name the peer explicitly on both
sides:

**Watch side** (lite wearable, in the project config alongside the P2P setup) — point at
the phone app and the Android keystore's fingerprint:

```
PEER_PKG_NAME     = com.edvinn.wearcompanion
PEER_FINGERPRINT  = 73:A6:B2:5A:06:E3:9E:BA:A6:D1:4E:4A:0F:53:54:0A:
                    F2:25:E4:CF:18:2A:53:3E:EE:E9:D1:03:4C:DA:2F:CF
```

**Phone side** (`P2pClient`) — point back at the watch bundle and the HarmonyOS debug
certificate's fingerprint:

```java
p2pClient.setPeerPkgName("com.edvinn.firstwearableapplication");
p2pClient.setPeerFingerPrint("9A:3A:7E:58:C0:61:C4:F5:20:3A:85:A8:BA:B6:1B:35:"
                           + "8A:7F:BC:37:E2:BE:49:14:D6:E3:38:50:71:97:D4:F1");
```

Both fingerprints are SHA-256 of the respective signing certificates: the phone's from
`certs/android-companion.jks`, the watch's from the leaf certificate in `certs/mac-cert.cer`
(see SIGNING.md for how to regenerate each). **The watch fingerprint changes when the debug
certificate is renewed** — currently 2027-09-12 — so it has to be updated in the phone app
at each renewal, or P2P starts failing with result code 206.

Get either of these wrong and it surfaces as `ping` returning "Invalid argument", or
result code 206.

**A non-Huawei phone needs HMS Core.** "If you are using a non-Huawei phone, you need to
install HMS Core (APK) on your phone and allow Huawei Health to display pop-up windows
while running in the background." The S23 needs HMS Core installed *and* Huawei Health
allowed to pop up from the background — on top of the battery-optimisation exemption.

**Scopes are cached for up to 24 hours.** After the application is approved, calls can
still fail with "Scope unauthorized" because Huawei Health has not refreshed. Clear the
Huawei Health app's data (or reinstall it) to force it. Also: the phone must be online
for the scope refresh to happen at all.

**Result code 206 on lite wearable communication** — the full cause list:

- Package name or certificate fingerprint mismatch between phone and watch app
- For a lite wearable, the phone's package name and fingerprint must be configured in the
  **watch project's `config.json`** (and the watch's details configured on the phone side)
- **The lite wearable app is not running in the foreground** — the watch app must be open
- No registered message receiver on one side
- The message sent is empty
- Bluetooth not connected

**There is no sandbox.** APIs return "Scope unauthorized" until the application is
approved; there is no debug or test mode that bypasses review.

## Reference implementations

- **[Home-Assistant-HarmonyOS-Next](https://github.com/gentslava/Home-Assistant-HarmonyOS-Next)**
  — closest precedent. Explicitly supports **Watch GT 4/5/6** with a lite-JavaScript app
  plus Android companion over Wear Engine P2P, with a shared versioned protocol. Also
  confirms "Watch GT physically rejects third-party ArkTS Stage applications". Read its
  P2P protocol design before inventing your own.
- **[LiveScore-Wearable-Demo](https://github.com/minkiapps/LiveScore-Wearable-Demo)** —
  live data on lite wearables (GT2 Pro, GT Runner, GT3, GT3 Pro, Fit2); Android app
  fetches and relays via Wear Engine.
- **[sportwatch-wear-engine-lite-wearable-to-mobile](https://github.com/Explore-In-HMOS-Wearable/sportwatch-wear-engine-lite-wearable-to-mobile)**
  — minimal Huawei sample for the lite wearable side: `wearengine.js` placement, peer
  config, message send/receive.

## Sources

- [Huawei Watch GT 6 specifications](https://consumer.huawei.com/en/wearables/watch-gt6/specs/) — connectivity, no Wi-Fi
- [P2P Communication Between Android and HarmonyOS Wearable (FA + Stage Model)](https://dev.to/harmonyos/p2p-communication-between-android-and-next-wearable-fa-stage-model-device-technical-guide-3d9e) — APIs, size limits
- [HarmonyOS dev guide — lite wearable limitations](https://github.com/megaacheyounes/harmonyos-dev-guide)
- [What is Huawei Wear Engine? How to Apply](https://medium.com/huawei-developers/what-is-huawei-wear-engine-how-to-apply-for-huawei-wear-engine-c039a3b02d6d)
- [Wear Engine — Huawei Developers](https://developer.huawei.com/consumer/en/hms/huawei-wearengine)
