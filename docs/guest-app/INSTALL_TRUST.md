# Why Android says the app is “unsafe”

Sideloaded APKs (copied from `dist-exports/`, Drive, WhatsApp, etc.) are **not** installed through Google Play. Play Protect treats them as unknown apps — especially when the APK is signed with the **debug** keystore.

## How Cullinos Guest is signed today

[`android/app/build.gradle.kts`](../android/app/build.gradle.kts) uses a real upload keystore **only if** `android/key.properties` exists. Otherwise **release builds fall back to debug signing**.

That is fine for local emulators. It is **not** fine for sharing APKs with restaurants or customers.

## Fix (production)

1. Create an upload keystore (once; back it up offline):

```powershell
cd apps/guest/android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias cullinos-guest-upload
```

2. Copy [`key.properties.example`](../android/key.properties.example) → `android/key.properties` and fill passwords / paths. **Never commit** `key.properties` or `*.jks`.

3. Build an **AAB** (preferred for Play), not a casual APK:

```powershell
cd apps/guest
flutter build appbundle --flavor prod -t lib/main_prod.dart
```

Output: `build/app/outputs/bundle/prodRelease/app-prod-release.aab`

4. Upload to [Play Console](https://play.google.com/console) → **Internal testing** → closed → production. Enable **Play App Signing**.

5. Copy **App signing** SHA-1 / SHA-256 from Play Console into Firebase Android app `com.cullinos.guest`, then re-download `google-services.json`.

6. Put the Play/upload cert SHA-256 into [`infrastructure/www/guest-landing/.well-known/assetlinks.json`](../../infrastructure/www/guest-landing/.well-known/assetlinks.json) (replace the placeholder) so App Links verify.

Full checklist: [PLAY_STORE_CHECKLIST.md](./PLAY_STORE_CHECKLIST.md).

## Until Play is live

- Testers will still see Play Protect / “unknown app” for any sideload — that is expected.
- Prefer a **release-signed** APK (`key.properties` present) over debug-signed exports.
- Instruct testers: install only from a trusted Cullinos source → More details → Install anyway (wording varies by Android version).
- Set `GUEST_APP_PLAY_STORE_URL` in Super Admin → Guest ops → Runtime once the listing (or internal track link) exists so QR download landing points at Play.

## What will **not** remove the warning

- Changing Flutter UI or notification code
- Rebuilding the same debug-signed APK
- Hosting the APK on a website without Play / a trusted enterprise MDM channel
