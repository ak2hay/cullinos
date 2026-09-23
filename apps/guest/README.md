# Cullinos App (Android)

Diner marketplace + outlet ordering. Replaces the former Customer web storefront (`order.cullinos.com`). Table QR deep-links to `https://guest.cullinos.com/o/{org}/{outlet}?table=` / `?session=`.

Cullinos App (Flutter)

Android-first marketplace app for Cullinos tenants: Discover nearby outlets, scan table QR for outlet mode, order (dine-in / takeaway / delivery), loyalty wallets, Razorpay, FCM.

## Prerequisites

- Flutter 3.24+ (`flutter doctor`)
- Android SDK / emulator
- API running (default `http://10.0.2.2:3000/api/v1` on Android emulator)

## Flavors

| Flavor | Entry | API base override |
|--------|-------|-------------------|
| dev | `lib/main_dev.dart` | `GUEST_API_BASE` |
| staging | `lib/main_staging.dart` | env |
| prod | `lib/main_prod.dart` | production URL |

```bash
cd apps/guest
flutter pub get
flutter run --flavor dev -t lib/main_dev.dart
```

Release:

```bash
flutter build appbundle --flavor prod -t lib/main_prod.dart
```

## Deep links

- App link: `https://guest.cullinos.com/o/{orgSlug}/{outletSlug}?session=` / `?table=`
- Custom: `cullinos://outlet/{orgSlug}/{outletSlug}`
- Table QR (print): `https://guest.cullinos.com/o/{org}/{outlet}?org=&outlet=&table=` — download-first landing; opens app when installed, else Play / browser
- Wired via `app_links` in [`lib/core/deep_links.dart`](lib/core/deep_links.dart)
- Sideload / Play Protect: see [docs/guest-app/INSTALL_TRUST.md](../../docs/guest-app/INSTALL_TRUST.md)

## Firebase / Razorpay

1. Add `android/app/google-services.json`
2. Set `FCM_SERVER_KEY` in API platform settings / env
3. Configure Razorpay keys on the API (existing platform config)

See [docs/guest-app/PLAY_STORE_CHECKLIST.md](../../docs/guest-app/PLAY_STORE_CHECKLIST.md).
