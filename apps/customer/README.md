# Customer web — decommissioned

The Customer web storefront (`order.cullinos.com`) has been replaced by the **Cullinos App** (Flutter Android) at `apps/guest`.

- Table / session QR -> `https://guest.cullinos.com/o/{org}/{outlet}?table=` / `?session=`
- Kiosk -> Cullinos App route `/o/{org}/{outlet}/kiosk`
- Archived source: `archive/customer-web`

Do not restore this package into the monorepo build without migrating remaining features into the Cullinos App first.
