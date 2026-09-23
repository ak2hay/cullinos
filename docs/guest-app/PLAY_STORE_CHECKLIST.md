# Cullinos Guest — Play Store & production checklist

## Before closed testing

- [ ] Run migration / schema push including `guest_firebase_uid` (`firebase_uid` on `guest_users`)
- [ ] Set Firebase Admin on VM (see [FIREBASE_PROD.md](./FIREBASE_PROD.md)) — `FIREBASE_PROJECT_ID` + service account
- [ ] Set `FCM_SERVER_KEY` (platform settings or env)
- [ ] Razorpay keys configured (`RAZORPAY_KEY_ID` / secret)
- [ ] At least 2 outlets with `marketplaceListed=true`, lat/lng, cuisine tags
- [ ] Delivery zones with pincode for those outlets
- [ ] Confirm `android/app/google-services.json` present (Firebase)
- [ ] Phone + Email/Password + Google enabled in Firebase Auth
- [ ] Add Play App Signing SHA-1/SHA-256 to Firebase Android app
- [ ] Replace debug signing with upload keystore (`android/key.properties` from `key.properties.example`)
- [ ] Read [INSTALL_TRUST.md](./INSTALL_TRUST.md) — sideload Play Protect warnings vs Play distribution
- [ ] Privacy policy URL live (`https://cullinos.com/privacy`)
- [ ] Data Safety form: phone, approximate/precise location, purchase history, device IDs

## QA matrix

| Flow | Steps | Pass |
|------|-------|------|
| Firebase Phone login | OTP → guest JWT exchange | |
| Firebase Google login | Google → guest JWT exchange | |
| Firebase Email login | Email/password → guest JWT exchange | |
| Legacy PIN login | Existing users still work | |
| Discover nearby | Grant location → listed outlets | |
| Offers feed | Active coupon appears | |
| Open outlet | Membership ensure + loyalty wallet | |
| Scan QR | Table session → dine-in mode | |
| Takeaway order | Cart → place → pay later | |
| Pay now | Razorpay success → verify | |
| Coupon | Validate + discount applied (server) | |
| Delivery quote | In-zone / out-of-zone | |
| Delivery order | Create DeliveryOrder + staff status patch | |
| Push | FCM on ready / delivery status | |
| Order history | Cross-outlet list + detail | |
| Force update | `GUEST_APP_FORCE_UPDATE=true` blocks app | |
| Soft update | `GUEST_APP_SOFT_UPDATE_MESSAGE` + min version | Non-blocking dialog |
| Kill/maintenance | `GUEST_APP_MAINTENANCE` message | |
| Runtime portal | Super Admin `/guest-ops/runtime` | Preferred ops UI for guest_app keys |

## Release commands

```bash
cd apps/guest
flutter pub get
flutter build appbundle --flavor prod -t lib/main_prod.dart
```

Upload AAB to Play Console → internal → closed → production (10% staged).

## Idempotency & rate limits

- Guest OTP: 10 req / min (throttler)
- Marketplace nearby: 60 / min
- Order create: client sends `idempotencyKey`
- Payment verify: signature + webhook claim table

## Observability

- API: existing PII redaction + structured logs
- App: add Firebase Crashlytics before production rollout
