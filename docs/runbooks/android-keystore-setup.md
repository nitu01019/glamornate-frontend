# Runbook — One-time Android upload keystore creation and backup

**When to run this:** once, before the very first Play Store upload. Never again unless you lose the keystore (see backup section — losing it is *catastrophic*).

**How long it takes:** ~20 minutes end-to-end, most of it spent producing secure backups.

**Who should run it:** the account owner for the `com.glamornate.app` Play Console listing (the human who will manage releases).

**Why this matters:** Google Play uses the *upload key* to verify every new version you submit. If you rotate or lose this key, Google can recover access only via a multi-week manual process through Play Console support, and only if you enabled Play App Signing (which we do — see §4). Back up the keystore file and its passwords in two independent vaults before you ship.

---

## 1. Prerequisites

- A JDK 17+ is on your `PATH` (`keytool` ships with the JDK).
- You are at the repository root: `<repo-root>`.
- You have decided on three strings:
  - **storePassword** — 16+ char random password (the "keystore" password).
  - **keyPassword** — 16+ char random password (the "alias" password). May equal storePassword but a distinct value is more defensible.
  - **keyAlias** — short identifier, conventionally `glamornate-upload`.

Generate fresh passwords with:

```bash
openssl rand -base64 24
openssl rand -base64 24
```

Save them to your password manager (1Password / Bitwarden / KeePassXC) under a new entry named `Glamornate Android Upload Keystore`. Include the passwords, the alias, and the generation date.

## 2. Create the keystore

Run the command below from the repo root. Replace the `-dname` fields with the real legal entity that owns the Play Console account.

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore android/app/glamornate-upload.keystore \
  -alias glamornate-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=Glamornate, OU=Mobile, O=Glamornate Technologies Pvt Ltd, L=Bengaluru, ST=Karnataka, C=IN"
```

When prompted:
- `Enter keystore password` → paste the `storePassword` from your password manager.
- `Re-enter new password` → same.
- `Enter key password for <glamornate-upload>` → paste the `keyPassword`.
- `Re-enter new password` → same.

Verify:

```bash
keytool -list -v -keystore android/app/glamornate-upload.keystore -alias glamornate-upload
```

You should see `Valid from: ... until: ...` ~27 years out, an RSA 4096-bit key, and an SHA256 fingerprint. Copy the SHA-256 fingerprint into your password manager entry — you will paste it into the Firebase console when adding the Android app.

## 3. Wire it into the build

1. Copy the template:
   ```bash
   cp android/app/keystore.properties.example android/app/keystore.properties
   ```
2. Edit `android/app/keystore.properties` and paste the real values:
   ```
   storeFile=glamornate-upload.keystore
   storePassword=<the storePassword>
   keyAlias=glamornate-upload
   keyPassword=<the keyPassword>
   ```
3. Confirm neither the keystore nor the properties file is staged by git:
   ```bash
   git status --short android/app/
   ```
   You should see *nothing* for `glamornate-upload.keystore` or `keystore.properties`. If either shows up, stop and fix `.gitignore` before continuing.

## 4. Enable Play App Signing (strongly recommended)

Play App Signing lets Google manage the *app signing key* while we only hold the *upload key*. If the upload key is ever lost or compromised, Google can let us register a new one without re-publishing the app.

1. Log in to [Play Console](https://play.google.com/console).
2. Select (or create) the Glamornate app entry.
3. In the left nav, go to **Setup → App integrity**.
4. Under **App signing** confirm it says "Google generates and manages your app signing key." If it offers an upgrade path, accept it.
5. When you upload the first bundle, Google will ask you to register our upload key — use the `.keystore` from §2.

## 5. Back up the keystore (non-negotiable)

Losing this file means we can never update the app again under the same Play listing. Store copies in at least two independent locations, encrypted:

1. **1Password (or equivalent):** attach the `.keystore` file to the password-manager entry that holds the passwords. 1Password encrypts attachments at rest.
2. **Offline media:** put the file on an encrypted USB stick (VeraCrypt or `age -e`) and store it in a locked drawer at the founder's home. Label it `Glamornate upload keystore — DO NOT LOSE`.
3. *(Optional, enterprise)* a GCS bucket with Customer-Managed Encryption Key (CMEK) and IAM restricted to the founder.

Do a recovery dry-run right now: delete `android/app/glamornate-upload.keystore` from the repo, copy it back from your password-manager attachment, and confirm a `gradle bundleRelease` still succeeds. Put the passwords through a final drill by typing them back into your password manager's TOTP field or similar — you are testing muscle memory, not the file system.

## 6. Rotation

You should not need to rotate the upload key. If a leak is suspected:

1. Freeze production rollout in Play Console (Halt rollout).
2. Create a new keystore following §2 with a different filename (e.g. `glamornate-upload-v2.keystore`).
3. In Play Console → **App integrity → Upload key certificate**, request to change the upload key. Follow Google's instructions (involves uploading a PEM for the new cert and signing a challenge).
4. Update `android/app/keystore.properties` locally.
5. Publish a new build signed with the new upload key.
6. Delete the compromised keystore file from every vault.

## 7. Done-checklist

- [ ] Keystore file exists at `android/app/glamornate-upload.keystore`.
- [ ] `keystore.properties` populated and NOT staged by git.
- [ ] Passwords + alias + SHA-256 fingerprint saved in password manager.
- [ ] Encrypted backup placed in a second, independent vault.
- [ ] Play App Signing confirmed enabled on the Play Console listing.
- [ ] A dry-run `bash scripts/release-build.sh` produces a signed `.aab` with exit code 0.
