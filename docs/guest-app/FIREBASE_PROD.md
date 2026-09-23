# Cullinos Guest — production Firebase go-live

Project: `rkyves-cullinos` (same Firebase project for all flavors).

## 1. Firebase Console (already mostly done)

- [x] Android apps: `com.cullinos.guest` (+ `.dev` / `.staging`)
- [x] iOS app: `com.cullinos.cullinosGuest`
- [x] Email/Password + Google Sign-In deployed
- [x] Phone Auth enabled + test numbers
- [x] Debug SHA-1 registered
- [ ] **Play App Signing SHA-1 + SHA-256** on `com.cullinos.guest` (after Play Console upload)
- [ ] Re-download `google-services.json` after Play SHA is added

## 2. Production API (VM)

On the server `.env` (from `.env.production.example`):

```bash
FIREBASE_PROJECT_ID=rkyves-cullinos
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # single-line JSON
# OR
# FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-adminsdk.json
# and place the file under ./secrets/ on the host (compose mounts it read-only)
```

Generate the key: Firebase Console → Project settings → Service accounts → **Generate new private key**.

Then rebuild/redeploy API and push schema:

```bash
# on VM, from app dir
docker compose -f docker-compose.prod.yml up -d --build api
# schema (firebase_uid on guest_users) — use your usual script, e.g.:
# python scripts/vm-db-sync-schema.py
# or inside API container:
# npx prisma db push --schema=packages/prisma/prisma/schema.prisma
```

Confirm API logs show: `Firebase Admin initialized`.

## 3. Prod Guest app build

```bash
cd apps/guest
# Optional upload keystore (recommended before Play):
# copy android/key.properties.example → android/key.properties and fill values
flutter build appbundle --flavor prod -t lib/main_prod.dart
```

Prod API base URL is already `https://api.cullinos.com/api/v1` in `lib/main_prod.dart`.

## 4. Smoke test after deploy

1. Install prod build (or internal track)
2. Sign in with Google / Email / Phone
3. Confirm `POST /api/v1/public/guest/auth/firebase` returns `accessToken`
4. Open an outlet / place a test order (needs phone on account for membership)
