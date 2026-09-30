# Current handover — 2026-09-30

**Active development moved to `../matchday-scores`, branch `codex/companion-port`. Read `../matchday-scores/HANDOVER.md` first.** All ten watch screens were ported onto the working Matchday transport alongside the phone app's Firebase/positions functionality. Both packages display as Wear Companion 1.1.0 while retaining the approved Matchday identities.

This branch (`codex/wear-companion-link`) preserves the original watch's native API selection, receiver ordering, timeout and supportLists fixes. The original phone app still hit Huawei scope-unauthorized code 8; the user chose the port rather than further investigating that identity. Keep this repository as a donor/reference. Its mock controls remain simulations, and no real trading commands were added by the port.

The sections below are historical investigation notes. Their old “next check”/“pending” instructions are superseded by the active repository's handover and device checklist.

---

# Handover — Huawei Watch GT 6 personal dashboard app

Last updated: 2026-09-22. Read this first; `SIGNING.md` and `FIREBASE-REALTIME.md` hold
the detail.

---

## 1. What we want

Open an app on my **HUAWEI WATCH GT 6** and see current values from **my own Firebase
project** (price targets from the "edos dashboards" work). Personal use only — never
published, one user, my own data.

Explicitly **not** wanted: background alerting. Telegram bot messages already cover that
and render fine on the watch. The goal is a *screen I open and look at*.

## 2. The constraint everything follows from

The GT 6 has **Bluetooth and NFC only — no Wi-Fi, no eSIM, no LTE**. It is also a
**lite wearable** (LiteOS-style), not a full HarmonyOS watch:

- Apps are **JS + HML + CSS** on the **FA model**, not ArkTS/Stage. Watch GT hardware
  physically rejects ArkTS Stage apps.
- **No background execution** — an app cannot run or resume in the background.
- **48 KB per page**, 10 MB per app, no router back stack, unreliable modern JS syntax.
- Install is by sideloading a HAP via the phone (Huawei DevEco Assistant), not hdc.

So the watch cannot hold a Firebase connection, and any data has to arrive some other way.

## 3. What we tried, in order

**a. Renewed the expired signing setup (done, works).**
Debug certificate and profile had expired 2026-06-17. Renewed in AppGallery Connect,
reusing the existing keystore and CSR. The build now passes and produces a signed HAP.
Confirmed along the way that **DevEco Studio 6.1.1 still builds lite wearable projects** —
worth knowing, since that toolchain is legacy. See `SIGNING.md`.

**b. Concluded a phone companion app was required (probably wrong — see §4).**
Reasoning: no network hardware on the watch, and the two closest reference projects
(Home Assistant for HarmonyOS, LiveScore Wearable Demo) both route everything through an
Android companion using **Wear Engine P2P**. Designed accordingly: Android app holds the
Firebase connection, watch requests data over P2P on open.

**c. Applied for Wear Engine. Rejected twice.**

| | |
|---|---|
| APP ID | `118971063` (Android app `com.edvinn.wearcompanion`) |
| 1st submission | 2026-09-13 |
| 1st rejection | 2026-09-16 — needed watch models named, needed UX diagrams; **Message notification unnecessary**; **"Launch specified app permission is not supported currently"** |
| 2nd submission | 2026-09-16, narrowed to Basic device information only, GT 6 named, UX diagram added |
| 2nd rejection | 2026-09-22 — see §4 |

Losing *Launch specified app* was significant: the watch cannot wake the phone app, so
the companion would need a permanent foreground service.

## 4. Where we are now — the current open question

The second rejection said something that may invalidate the whole companion-app design:

> "it is recommended that the watch app directly synchronize the data to the server
> (for example, using **HTTP-PROXY**) through the Internet."

Huawei is asserting the **watch app can reach the internet on its own** (necessarily
proxied via the paired phone, since there is no Wi-Fi). If true, none of the Wear Engine
work is needed.

They also demand, if we still want Wear Engine, "a description of why the Internet cannot
be used" plus screenshots of the phone-app-not-active scenario — which we cannot honestly
provide without testing the above first.

**Status: Wear Engine application is rejected and NOT resubmitted. Deliberately paused
pending the test below.**

### The test in flight

Added `entry/src/main/js/MainAbility/pages/nettest/` — a probe page with two buttons:

| Button | URL | Purpose |
|---|---|---|
| 1 Ping | `https://www.gstatic.com/generate_204` | bare connectivity; success = `OK 204`, empty body is expected |
| 2 Users A | `https://jsonplaceholder.typicode.com/users?_limit=3` | three sample users; validates JSON and shows count + first name |
| 3 Users B | `https://dummyjson.com/users?limit=3&select=firstName,lastName` | independent provider; compact three-user response |

Screen shows `OK <code>` / `FAIL <code>` / `NO API` / `THREW`. Console logs are prefixed
`[NETTEST]` and carry more of the body than fits on the watch.

**Already learned: `import fetch from '@system.fetch'` compiles.** The module exists for
lite wearable and its strings are in the built binary. What is unproven is whether a
request completes on a GT 6.

Reaching it: `pages/nettest/nettest` is first in `config.json`'s pages array (intended to
make it the launch page), and there is also an **"HTTP test" button** added to the
existing index page which routes to it. The launch-order approach did not appear to take
effect on device — either a stale install or the runtime always launching
`pages/index/index`.

## 5. The two branches

**If the ping succeeds — abandon Wear Engine entirely.**
The watch app calls the Firebase REST API directly. No companion app, no foreground
service, no 1 KB message cap, no approval process, no Samsung-side setup. Strictly better
than the design we spent two weeks on. Remaining work is then just the watch UI and
getting Firebase auth right from a constrained JS runtime.

**If it fails — the failure is the evidence Huawei asked for.**
Capture the error code and screen, put it in the application as the answer to "why the
Internet cannot be used", and resubmit. Then the companion-app design stands, with:
a persistent Android foreground service (no remote launch available), HMS Core installed
on the Samsung S23, Huawei Health allowed background + pop-ups + battery exemption, and a
visible "can't reach phone" state on the watch because it will happen in normal use.

## 6. Reference

**Repo** `github.com/edvinn8/wearable-demo` — watch app, bundle
`com.edvinn.firstwearableapplication`, `deviceType: ["liteWearable"]`, `apiType: faMode`.

**Signing** — `certs/` sits beside the repo and is NOT in git. `build-profile.json5` is
gitignored (holds keystore passwords), so a fresh clone cannot build until it is
recreated; `SIGNING.md` has the template and the renewal procedure.

| Item | Value |
|---|---|
| Watch debug cert + profile | valid to **2027-09-12** |
| Watch cert SHA-256 | `9A:3A:7E:58:C0:61:C4:F5:20:3A:85:A8:BA:B6:1B:35:8A:7F:BC:37:E2:BE:49:14:D6:E3:38:50:71:97:D4:F1` |
| Android keystore | `certs/android-companion.jks`, alias `wearcompanion` (PKCS#12 despite the extension) |
| Android SHA-256 | `73:A6:B2:5A:06:E3:9E:BA:A6:D1:4E:4A:0F:53:54:0A:F2:25:E4:CF:18:2A:53:3E:EE:E9:D1:03:4C:DA:2F:CF` |
| Registered device UDID | `397892A9CF695A8AF8914B99DCC4576E075FE3E898E6F5963A14255D51A6398A` |
| Phone | Samsung Galaxy S23 (non-Huawei Android — needs HMS Core for Wear Engine) |

**Decision on file:** watch and phone package names deliberately differ; they name each
other explicitly via peer package name + fingerprint rather than renaming the watch
bundle. The watch fingerprint is tied to the debug certificate, so **renewing the cert in
2027 means updating it in the phone app too**, or P2P fails with result code 206.

**Wear Engine lives in the HUAWEI Developer Console** (*App services → Development → Wear
Engine*), **not** AppGallery Connect. Searching AGC for "wear" finds nothing; that is
expected, not a fault.

## 7. Other documents

- `SIGNING.md` — certificates, keystores, renewal procedure, build and install flow.
- `FIREBASE-REALTIME.md` — full feasibility analysis, Wear Engine application history
  and rejections, API limits, FAQ gotchas, reference implementations, sources.
- `../wear_engine_ux.png` — UX diagram submitted with the second application.
- `../Data Permission and Usage Description.xlsx`, `../User Authorization Path
  Description.xlsx` — the filled application documents as submitted.

## 8. Immediate next step

Manually rebuild/install version **1.0.2**. Open the test page, tap **1 HTTP**,
wait for a result (or the 15-second timeout), then tap **2 HTTPS**. Capture both
results and the `[NETTEST]` logs. **3 Users JSON** retains the JSON parsing probe.

Temporary scaffolding to remove afterwards: the `nettest` page, its entry in
`config.json`, the "HTTP test" button and `goNet` handler on the index page, and the
`index.hml.bak` / `index.js.bak` backups.

## Navigation fix — 2026-09-22

The HTTP-test button was bound to `goNet`, but the method was nested under `data`
and used `router.push`. Handlers now live on the page export and navigation uses
`router.replace`, as required by the lite-wearable page model. The index page is
explicitly first again; its button spacing is reduced to fit the test button.
Version code is 1000001, name 1.0.1, with a visible NETTEST label on the index and
version on the test page. Source-level navigation/timer checks pass; device behavior
and HTTP support remain unverified. Rebuild/install still required.

The probe now distinguishes non-2xx HTTP responses and invalid JSON from success. Public endpoint checks on a computer do not verify connectivity on the watch. No rebuild performed for this endpoint update.


## Protocol comparison diagnostics — 2026-09-22

On GT6, version 1.0.1 reached `@system.fetch` but all three HTTPS endpoints failed
with `-6 / conect socket fail!` despite Huawei Health being connected. This does
not isolate DNS, TLS, or phone-proxy availability.

Version 1.0.2 compares `http://example.com/` and `https://example.com/` using the
same request options. Both returned 200, no redirect, and 559 bytes from the
computer during preparation; watch behavior remains unverified. The generic
system.fetch reference suggests `deviceConfig.default.network.cleartextTraffic`,
but the installed lite schema rejects `network` (hvigor error 00303038). That
setting has been removed and `deviceConfig` restored to `{}`. Both installed
HMS and OpenHarmony lite schemas allow only `keepAlive` inside `default` or
`liteWearable`; moving the setting is not a supported workaround. HTTP behavior
is still an experiment, including whether this runtime permits cleartext at all.
Use only public test data; do not send Firebase credentials or data over HTTP.
Reference: https://developer.huawei.com/consumer/en/doc/harmonyos-references-V3/js-apis-system-fetch-0000001333640985-V3

Each request logs its ID, protocol/label, URL, result, and elapsed milliseconds.
A 15-second watchdog updates the screen if no success/fail callback arrives.
It cannot cancel native fetch. Late callbacks remain in logs but cannot overwrite
results; repeated taps while waiting are ignored. Timers are cleared on response
and page destruction. The third button retains JSONPlaceholder users.

HTTP success with HTTPS failure narrows the issue to a protocol-dependent path;
it does not alone prove a TLS defect. Matching failures still do not prove GT6
HTTP proxy is unsupported: request Huawei's exact GT6 liteWearable HTTP-PROXY
API/sample for a Samsung Android pairing, referencing their recommendation.
No rebuild performed; user will rebuild manually.

The config error was reproduced with the installed lite JSON schemas, without
running a build. After removing the unsupported setting, both schema checks pass.
Version remains 1.0.2; the protocol probes, timing logs, and watchdog are unchanged.
A matching HTTP/HTTPS failure is not conclusive about TLS because cleartext policy
for this lite runtime remains unverified. No rebuild performed.


## Wear Engine resubmission - 2026-09-22

Resubmitted the existing Android Wear Companion application, App ID 118971063,
package com.edvinn.wearcompanion, through Chrome. Huawei console confirmed
**To be reviewed**, with displayed last update **2026-09-22 23:30:50**.
Only Basic device information remains selected; no notification or remote-launch
permission was added. Lightweight wearable and existing/planned watch app remain selected.

The description now reports the actual GT6 -6 fetch failures for HTTP and HTTPS,
requests clarification of the HTTP-PROXY API, links the public GT4/GT5 messaging
sample, and describes manual phone startup plus an unavailable/retry watch state.

Replaced the data-permission attachment with
`docs/wear-engine/data-permission-resubmission-2026-09-22.pdf` (3 pages).
It includes app/permission details, the original v1.0.1 log screenshot, clearly
attributed user-reported v1.0.2 results, and proposed active/inactive UX mockups.
No working Wear Engine integration or proven lack of GT6 HTTP support is claimed.
The existing user-authorization-path attachment was retained.

A separate email was prepared in Gmail for hihealth@huawei.com; the assistant
has not sent it. No bot/app rebuild was performed during resubmission.

## Wear Engine approved — P2P test, 2026-09-30

The Wear Engine application was approved. The HTTP-vs-P2P question is moot for now: P2P is the path.

- **Phone side:** new repo `wear-companion` (beside this one, `com.edvinn.wearcompanion`) — a P2P
  smoke test: permission → find watch → ping → send, and it echoes whatever the watch sends. Its
  README has the build steps and the identity table.
- **Watch side (this repo, 1.0.3):** *P2P test* page (`pages/p2p`) — ping the phone, send hello,
  shows what arrives. Uses the official lite-wearable SDK `common/wearengine.js` **5.0.2.306**
  (zip SHA-256 `64130a34…1b56`, matches Huawei's download page).
- **Fingerprints:** the watch names the phone by the SHA-256 of `certs/android-companion.jks`
  (uppercase hex, `common/peer.js`); the phone names the watch by
  `com.edvinn.firstwearableapplication_` + base64 of the EC public key in `certs/mac-cert.cer`
  (`MainActivity.WATCH_FINGERPRINT`). A new watch certificate means a new fingerprint on the phone.
- **Next:** build both, run the test order in `wear-companion/README.md`. Once messages flow both
  ways, the phone fetches the dashboard data and pushes it to the watch (≤1 KB per message).

### Positions page — 1.0.4

The app now opens on **Positions** (`pages/positions`): net P/L, equity, margin level and one row per
symbol + side, from the phone's `LinkService` (wear-companion), which answers `{"t":"get"}` from a live
Firestore listener on `relay-positions`. Refreshes every 30 s while open; says "phone unavailable" when
no answer comes within 10 s. *Tools* leads to the old home page (HTTP test, P2P test).
Message format: `wear-companion/app/src/main/java/com/edvinn/wearcompanion/Protocol.java`.

### Mock UI — 1.0.5

*Tools → Mock UI* previews the planned watch app on made-up data (`common/mock.js`), no phone needed:
hub → **Positions** (tap a row → group detail with facts, DCA layers and a two-step close on an overlay
layer) · **Layered DCA** (running first; tap → Stop/Start with confirm) · **Account** (vertical cards:
equity, today/week P/L, margin-level arc, equity chart, source) · **States** (loading, phone
unavailable, error, cBot not updating/stopped, no positions). Swipe right = one level up everywhere;
the crown scrolls lists. Nothing in the mock sends anything.

### HTTP test removed — 1.0.6

The `pages/nettest` HTTP test page (and the INTERNET permission only it used) is gone: the watch gets
its data over Wear Engine P2P from the phone, so direct HTTP from the watch isn't needed. The sections
above that mention it are history.


## Connection comparison with Matchday Scores — 2026-09-30

Matchday watch 1.0.8 + phone 1.0.2 is user-confirmed working. This app pair remains pending a physical retest. The fixes below are on branch `codex/wear-companion-link`; there is no UI modernization in this change.

Verified for Wear Companion in Chrome AGC: Android package `com.edvinn.wearcompanion`, app ID `118971063`, and registered SHA-256 match this watch's configured phone peer. The public key derived from the non-CA `mac-cert.cer` signer matches `WearIds.WATCH_FINGERPRINT`. The watch debug profile is for `com.edvinn.firstwearableapplication`. Source device discovery already selects connected devices without Matchday's old capability filter. The original compiled pages all pass the SDK lite parser, so the old regex/error-34 defect was not reproduced here. Positions uses numeric age rather than ISO timestamps, so Matchday's nanosecond timestamp fix does not apply.

Prepared watch 1.0.7 connection fixes:

- Added the missing `module.metaData.customizeData` supportLists declaration for the existing Wear Companion package and signer, matching the working Matchday configuration pattern. Device impact still requires the retest.
- Reproduced `FeatureAbility is not defined` when the native version callback is delayed. The original wrapper chose the legacy branch while `version` was still undefined. It now chooses native detect/subscribe/send/unsubscribe by API availability, retaining its existing callback interface and legacy fallback.
- Positions now waits for receiver registration before the initial request and periodic refresh. Late registration cannot restart a destroyed page.
- Reproduced a false timeout after a fast response: the timeout was armed after sending. It is now armed before sending so a reply can clear it.
- Native detect/subscribe/send failures retain the native operation, data and code in the watch log.

Validation: `node --test test/*.test.mjs` exercises the actual wrapper/page code with a controlled native boundary: delayed and immediate version callbacks, echo exchange, registration errors, registration ordering/destruction, fast replies, and config/peer consistency. All six tests pass after reproducing the failures. Use DevEco's bundled Node if system Node is unavailable; no package-wide `type: module` is needed. Existing vendor CRLF line endings are preserved.

The phone is not connected through ADB, so its installed APK signer and current runtime error could not be read. Ask for the phone's Permission / Find watch / Ping log. A separate Scope unauthorized error must be diagnosed from the installed APK identity and Huawei authorization; these watch fixes do not establish that an authorization cache expired. No AGC settings or phone source were changed.

Next device check after rebuilding the signed watch HAP: keep Wear Companion open, start its watch link, confirm Listening, then use watch Tools → P2P test → Send hello. The phone should log the incoming text and the watch should show the echoed text. This proves transport without requiring Firebase sign-in. Then try Positions → Refresh; a Sign in on the phone message is a successfully received application response, not a connection failure.

Build status: user authorized the rebuild. Signed wearable-demo 1.0.7 HAP built successfully on 2026-09-30; all 11 compiled app/page scripts pass the SDK lite parser and the outer HAP passes signature and digest verification. Artifact: `entry/build/default/outputs/default/wearable-demo-1.0.7-signed.hap`, SHA-256 `4d0c75d08e17d9d96a4079878a90d4b90c5c6c422beb6bfcf567430f1d0f3937`. The existing CSS `text-color` warnings remain for the later UI work. Phone APK unchanged. Manual transfer/install and the physical echo test remain pending.
