# Flutter setup (Windows)

SDK path: `A:\flutter`

## Cursor terminal PATH

```powershell
$env:Path = "A:\flutter\bin;" + $env:Path
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"
```

Fully quit/reopen Cursor so `flutter` is on PATH permanently.

## Emulator

AVD: `cullinos_pixel`

```powershell
flutter emulators --launch cullinos_pixel
```

Wait until the emulator shows the home screen, then `flutter devices` — use the listed id (often `emulator-5554`).

## Firebase Auth (Guest)

Project: `rkyves-cullinos`

### Phone / SMS (required for OTP)

The orange error *"SMS unable to be sent until this region enabled"* means India is blocked in Firebase:

1. Firebase Console → **Authentication** → **Sign-in method** → enable **Phone**
2. **Authentication** → **Settings** → **SMS region policy** → allow **India (+91)** (or switch policy to allow-list including IN)
3. For emulator testing, add a **Phone test number** under Sign-in method → Phone (skips real SMS)

Also ensure Android SHA-1 is registered (debug keystore) and `google-services.json` is current.

### Email / password

Enable **Email/Password** under Sign-in method. The app now **requires email verification** before the account can use Cullinos APIs — after register, open the verification link, then sign in.

### Release SHA fingerprints (Play Store / signed APK)

Debug SHA-1 is already registered. For production you need the **release** certificate fingerprints too:

1. **If you use Google Play App Signing** (recommended):
   - Play Console → your app → **Setup → App integrity** (or **Release → Setup → App signing**)
   - Copy **App signing key certificate** SHA-1 and SHA-256
   - Firebase Console → Project settings → Android app (`com.cullinos.guest`) → **Add fingerprint** for both
2. **If you sign locally with an upload keystore**:
   ```powershell
   keytool -list -v -keystore path\to\upload.keystore -alias YOUR_ALIAS
   ```
   Add the printed SHA-1 / SHA-256 the same way in Firebase.
3. After adding fingerprints, re-download `google-services.json` into `android/app/`.

Note: local `prod` builds currently use the **debug** signing config in `android/app/build.gradle.kts` **unless** `android/key.properties` exists, so shared APKs often trigger Play Protect “unsafe” warnings. See [docs/guest-app/INSTALL_TRUST.md](../docs/guest-app/INSTALL_TRUST.md). Play Store builds use Play’s signing cert — that is the one that matters for production Google / Phone Auth.

### Nest API Firebase bridge

Guest Firebase sign-in exchanges a Firebase ID token for a Cullinos guest JWT:

`POST /api/v1/public/guest/auth/firebase` `{ "idToken": "..." }`

Configure the API with a Firebase service account:

1. Firebase Console → Project settings → **Service accounts** → **Generate new private key**
2. Save the JSON outside the repo (never commit it)
3. In `.env`:
   ```
   FIREBASE_PROJECT_ID=rkyves-cullinos
   FIREBASE_SERVICE_ACCOUNT_PATH=C:/secrets/rkyves-cullinos-firebase-adminsdk.json
   ```
4. Run the Prisma migration that adds `firebase_uid` on `guest_users`

## Backend (required for OTP / API)

Port **3000** is often taken by other apps on this machine. Prefer API on **3001**:

```powershell
docker start cullinos-postgres cullinos-redis
cd A:\cullinos
$env:PORT = "3001"; $env:API_PORT = "3001"
npm run dev --workspace=@cullinos/api
```

## Run Guest app

```powershell
$env:Path = "A:\flutter\bin;" + $env:Path
$env:JAVA_HOME = "C:\Program Files\Java\jdk-23"
$env:GRADLE_USER_HOME = "C:\Users\Admin\.gradle"
cd A:\cullinos\apps\guest
flutter run --flavor dev -t lib/main_dev.dart -d emulator-5554 --android-skip-build-dependency-validation --dart-define=GUEST_API_BASE=http://10.0.2.2:3001/api/v1
```

## Toolchain notes (already configured here)

- JDK **23** (`flutter config --jdk-dir`)
- Gradle **8.14.3** zip at `A:\gradle\gradle-8.14.3-bin.zip` (wrapper uses this local file URL; do not store it under `%TEMP%`)
- Prefer `GRADLE_USER_HOME=A:\gradle\home` so caches are not wiped with Temp cleanup
- NDK **28.2.13676358**
- CMake **3.22.1**
- Core library desugaring enabled
