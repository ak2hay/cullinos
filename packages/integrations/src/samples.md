# Aggregator webhook sample payloads

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
