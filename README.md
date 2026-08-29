# Cullinos — Restaurant Operating System

Cullinos is Rkyves's multi-tenant restaurant platform — one cloud backend, role-specific apps (POS, kitchen, floor, guest, admin), offline-capable operations, and GST-native billing.

## Apps

| App | Port | Purpose |
|-----|------|---------|
| API | 3000 | NestJS REST + WebSocket |
| POS | 5173 | Cashier terminal |
| KDS | 5174 | Kitchen display |
| Waiter | 5175 | Floor staff |
| Customer | 5176 | QR / online ordering |
| Admin | 5181 | Owner dashboard |
| Management | 5182 | Multi-outlet chains |
| Super Admin | 5183 | Platform ops |
| Web | 5180 | Marketing site |
| Gateway | — | Electron offline sync |

## Quick start

```bash
cp .env.example .env
npm run docker:up
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Demo login: `admin@cullinos.com` / `demo1234`

## Brand

- Charcoal `#0F0F1A` + Amber `#D4A017`
- Inter (UI) + JetBrains Mono (order numbers)
- Customer channels: "Powered by Rkyves"

## License

Proprietary — Rkyves
