# Aggregator webhook sample payloads

## UrbanPiper (recommended)

Configure in UrbanPiper, each with custom header `x-aggregator-secret: <secret from Admin → Swiggy & Zomato>`:

```
POST /aggregators/webhooks/urbanpiper/:organizationId/orders   (order relay)
POST /aggregators/webhooks/urbanpiper/:organizationId/status   (order status change)
POST /aggregators/webhooks/urbanpiper/:organizationId/rider    (rider status)
```

`order.store.merchant_ref_id` must equal the outlet's store ref id (defaults to the Cullinos outlet id).
Items pushed from Cullinos echo our ids in `merchant_id` (`<menuItemId>`, options `variant:<id>` / `mod:<id>`).

```json
{
  "order": {
    "details": {
      "id": 987654,
      "order_type": "delivery",
      "instructions": "Less spicy",
      "order_subtotal": 480,
      "total_taxes": 24,
      "order_total": 504,
      "created": 1760000000000,
      "ext_platforms": [{ "name": "swiggy", "id": "SWG-1122" }]
    },
    "store": { "merchant_ref_id": "<outlet-id>" },
    "items": [
      {
        "id": 111,
        "merchant_id": "<menu-item-id>",
        "title": "Paneer Tikka",
        "quantity": 2,
        "price": 200,
        "options_to_add": [{ "merchant_id": "variant:<variant-id>", "title": "Full", "price": 20 }]
      }
    ]
  },
  "customer": { "name": "Asha", "phone": "+919876543210", "address": { "line_1": "12 MG Road", "city": "Pune" } }
}
```

Status: `{ "order_id": 987654, "new_state": "Cancelled", "message": "Customer cancelled" }`
Rider: `{ "order_id": 987654, "delivery_info": { "current_state": "assigned", "delivery_person_details": { "name": "Ravi", "phone": "98xxxxxx10" } } }`

## Direct Swiggy / Zomato (legacy)

Webhook endpoint (public, secret header required):

```
POST /aggregators/webhooks/swiggy/:organizationId
POST /aggregators/webhooks/zomato/:organizationId
Header: x-aggregator-secret: <webhookSecret from admin>
```

## Swiggy — new order

```json
{
  "event": "order.new",
  "order": {
    "order_id": "SW123456789",
    "customer_name": "Rahul Sharma",
    "customer_phone": "9876543210",
    "instructions": "Less spicy",
    "subtotal": 450,
    "tax": 22.5,
    "order_total": 472.5,
    "commission": 94.5,
    "restaurant_payout": 378,
    "placed_at": "2026-09-16T10:30:00+05:30",
    "items": [
      {
        "item_id": "SW_ITEM_001",
        "name": "Paneer Butter Masala",
        "quantity": 1,
        "unit_price": 280
      },
      {
        "item_id": "SW_ITEM_002",
        "name": "Butter Naan",
        "quantity": 2,
        "unit_price": 85
      }
    ]
  },
  "outlet_external_id": "OUTLET_SW_001"
}
```

Query `?outletId=<cullinos-outlet-uuid>` or set `outlet_external_id` mapped in admin.

## Zomato — new order

```json
{
  "event": "order.placed",
  "tab": {
    "tab_id": "ZM987654321",
    "customer_name": "Priya Patel",
    "customer_phone": "9123456780",
    "special_instructions": "No onion",
    "subtotal": 520,
    "tax_amount": 26,
    "total": 546,
    "commission_amount": 109.2,
    "net_amount": 436.8,
    "created_at": "2026-09-16T11:00:00+05:30",
    "dishes": [
      {
        "item_id": "ZM_DISH_101",
        "name": "Chicken Biryani",
        "quantity": 1,
        "unit_price": 320
      },
      {
        "item_id": "ZM_DISH_102",
        "name": "Raita",
        "quantity": 1,
        "unit_price": 60
      }
    ]
  },
  "restaurant_id": "REST_ZM_001"
}
```

## Settlement CSV columns

```
provider,external_order_id,order_date,gross_amount,commission,payout,outlet_id
swiggy,SW123456789,2026-09-16,472.50,94.50,378.00,<outlet-uuid>
zomato,ZM987654321,2026-09-16,546.00,109.20,436.80,<outlet-uuid>
```
