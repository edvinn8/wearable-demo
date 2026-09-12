# Signing

`build-profile.json5` is gitignored because it contains the keystore passwords, so a
fresh clone has **no signing config at all** and will fail to build. This file records
what to recreate and how.

## Where the material lives

Signing files sit in a `certs/` folder **beside** the repo, not inside it:

```
wearable-huawei/
├── certs/          <- not in git, never commit
└── wearable-demo/  <- this repo
```

| File | What it is |
|---|---|
| `mac-store.p12` | Keystore (private key). Alias `alias`. **Does not expire — keep it.** |
| `mac-csr.csr` | Certificate signing request generated from the keystore. Reusable. |
| `mac-cert.cer` | Debug certificate chain issued by AGC against the CSR. **Expires.** |
| `testProfileDebug.p7b` | Debug provisioning profile: binds cert + bundle ID + device. **Expires.** |

The `default_FirstWearableApplication_*` files in `certs/` are leftovers from an
automatic-signing attempt and are unused. Automatic signing does not apply here —
lite wearable requires manual signing.

## Current validity

| Artifact | Valid until |
|---|---|
| `mac-cert.cer` | **2027-09-12** |
| `testProfileDebug.p7b` | **2027-09-12** |

History: the first pair was issued 2025-12-19 with only 180 days' validity and expired
2026-06-17, which broke the build until renewed on 2026-09-12. AGC now issues 1 year.

## Restoring the config after a fresh clone

Add this to `build-profile.json5` under `app`, with absolute paths to your `certs/`
folder. Enter the passwords through DevEco (`File > Project Structure > Signing Configs`)
rather than by hand — it stores them encrypted, and the encrypted blobs are
machine-specific, so copying them between machines will not work.

```json5
"signingConfigs": [
  {
    "name": "default",
    "type": "HarmonyOS",
    "material": {
      "storeFile": "<abs>/certs/mac-store.p12",
      "storePassword": "<set via DevEco>",
      "keyAlias": "alias",
      "keyPassword": "<set via DevEco>",
      "signAlg": "SHA256withECDSA",
      "profile": "<abs>/certs/testProfileDebug.p7b",
      "certpath": "<abs>/certs/mac-cert.cer"
    }
  }
]
```

## Renewing an expired certificate

Symptom — the build runs the whole lite pipeline and dies on the last task:

```
ERROR: Failed :entry:default@LegacySignLiteBin...
ERROR: 11013002 Certificate format is incorrect, please check your appCertFile parameter.
Error Message: The certificate has expired! NotAfter: ...
```

In [AppGallery Connect](https://developer.huawei.com/consumer/en/service/josp/agc/index.html)
→ **Certificates, App IDs and Profiles**:

1. **Certificate management** — delete the expired debug certificate. The account is
   capped at 2 debug certs, so clear the dead one first.
2. **New Certificate** → type *Debug* → upload the existing `certs/mac-csr.csr`.
   Do not generate a new keypair. Download and save over `certs/mac-cert.cer`.
3. **Device management** — confirm the GT 6 is registered (UDID below).
4. **Profile management** — delete the expired debug profile, create a new one:
   type *Debug*, App ID `com.edvinn.firstwearableapplication`, the **new** certificate,
   and the device. Download and save over `certs/testProfileDebug.p7b`.

Keep both filenames identical and no config changes are needed. Rebuild.

Verify locally before rebuilding:

```sh
# Certificate chain dates. Three certs print: Huawei root, Huawei CA,
# then YOUR leaf cert last - that is the one that expires.
openssl crl2pkcs7 -nocrl -certfile certs/mac-cert.cer | \
  openssl pkcs7 -print_certs -noout -text | grep -A2 "Validity"

# Profile validity, device and bundle, with readable dates.
openssl smime -verify -inform DER -in certs/testProfileDebug.p7b -noverify 2>/dev/null | \
  python3 -c "
import sys, json, datetime
d = json.load(sys.stdin)
v = d['validity']
f = lambda t: datetime.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d')
print('type    :', d['type'])
print('valid   :', f(v['not-before']), '->', f(v['not-after']))
print('bundle  :', d['bundle-info']['bundle-name'])
print('devices :', d['debug-info']['device-ids'])
"
```

## Registered device

```
GT 6 UDID: 397892A9CF695A8AF8914B99DCC4576E075FE3E898E6F5963A14255D51A6398A
```

The profile only authorises this UDID. A different watch needs registering in AGC and
a regenerated profile.

## Building and installing

Built with DevEco Studio 6.1.1 (confirmed to still support lite wearable — the
`Legacy*` hvigor tasks). Output:

```
entry/build/default/outputs/default/entry-default-signed.hap
```

GT-series watches do not accept hdc or Wi-Fi debugging, so there is no Run button path:

1. Copy the signed HAP to the phone into a folder named `haps` (that exact name).
2. Open **Huawei DevEco Assistant**, with the watch paired in Huawei Health.
3. Install from there.

If the Assistant cannot see the watch, reopen Huawei Health first to re-establish the
connection, then retry.

## Android companion app (Wear Engine)

The phone-side companion needs its own signing identity, separate from the HarmonyOS
one above. It lives in the same `certs/` folder.

| File | Notes |
|---|---|
| `android-companion.jks` | PKCS#12 despite the `.jks` extension (modern keytool default). Alias `wearcompanion`. |

**SHA-256 fingerprint**

```
73:A6:B2:5A:06:E3:9E:BA:A6:D1:4E:4A:0F:53:54:0A:F2:25:E4:CF:18:2A:53:3E:EE:E9:D1:03:4C:DA:2F:CF
```

This one value appears in three places and must match in all of them:

1. AGC → Project settings → General → SHA-256 certificate fingerprint
2. The Wear Engine service application
3. `PEER_FINGERPRINT` in the watch app, so it can authenticate the phone app

**Losing `android-companion.jks` breaks the Wear Engine grant.** The fingerprint is
registered with Huawei and cannot be changed without re-applying. Back it up separately
from this machine.

Regenerate the fingerprint with:

```sh
/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home/bin/keytool -list -v \
  -alias wearcompanion -keystore certs/android-companion.jks | grep SHA256
```

(macOS has no system Java; `/usr/bin/keytool` is a stub that only prints an error. Use
DevEco's bundled JBR by absolute path.)

## Caveats

This project is `deviceType: ["liteWearable"]` on the FA model (`apiType: "faMode"`)
with JS pages under `entry/src/main/js/`. Both the FA model and lite wearable are
legacy. It still builds on 6.1.1, but do not assume a future DevEco release will keep
that pipeline — pin the working IDE version if this project matters.
