
# Konnect Network API Integration Documentation

This document summarizes the official API documentation for integrating payments with **Konnect Network**.

---

## Environments

- **Sandbox**: For testing.  
- **Production**: For live transactions.

Each environment has its own base URL. Always start with **Sandbox**.

---

## Core Concepts

- **Orders**: Represent what the user wants to buy. An order can have multiple payments.  
- **Payments**: Requests for money, defined by amount, currency, and status.  
- **Transactions**: Actual fund transfer attempts tied to a payment.

---

## Authentication

All API calls require an `x-api-key` header.

```http
x-api-key: <YOUR_API_KEY>
```

Rate limit: **100 requests/minute** (contact support to increase).

---

## Endpoints

### 1. Initiate Payment

**Endpoint:**  
```http
POST /payments/init-payment
```

**Headers:**  
- `x-api-key`: Your API key

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| receiverWalletId | string | ✅ | Konnect wallet ID of the merchant |
| token | string | ✅ | Currency (TND, EUR, USD) |
| amount | number | ✅ | Amount (millimes for TND, centimes for EUR/USD) |
| type | string | ❌ | "immediate" (default) or "partial" |
| description | string | ❌ | Description shown to payer |
| acceptedPaymentMethods | array[string] | ❌ | "wallet", "bank_card", "e-DINAR" (default = all) |
| lifespan | number | ❌ | Expiry time in minutes |
| checkoutForm | boolean | ❌ | Require form before payment |
| addPaymentFeesToAmount | boolean | ❌ | If true, payer pays Konnect fees (default false) |
| firstName, lastName, phoneNumber, email | string | ❌ | Payer’s details |
| orderId | string | ❌ | Internal order reference |
| webhook | string | ❌ | Your webhook URL for payment updates |
| theme | string | ❌ | "light" or "dark" (default "light") |

**Response Example:**

```json
{
  "payUrl": "https://pay.konnect.network/p/abc123",
  "paymentRef": "abc123xyz"
}
```

---

### 2. Webhook

**Purpose:** Konnect notifies your server when payment status changes.

**Method:**  
```http
GET {your_webhook_url}?payment_ref=abc123xyz
```

**Steps to Handle:**
1. Extract `payment_ref` from query params.
2. Call **Get Payment Details** to confirm the status.

**Best Practices:**
- Validate `payment_ref`
- Ensure webhook is HTTPS
- Implement idempotency (same webhook may be sent multiple times)

---

### 3. Get Payment Details

**Endpoint:**  
```http
GET /payments/:paymentId
```

**Path Parameter:**  
- `paymentId` (string, required)

**Response Example:**

```json
{
  "payment": {
    "id": "abc123xyz",
    "status": "completed",
    "amountDue": 10000,
    "reachedAmount": 10000,
    "token": "TND",
    "expirationDate": "2025-10-01T12:00:00Z",
    "orderId": "order_001",
    "transactions": [
      {
        "id": "txn123",
        "status": "success",
        "amount": 10000
      }
    ]
  }
}
```

**Errors:**
- `404` → Payment not found
- `401` → Invalid/missing API key
- Expired payment → check `expirationDate`

---

## Best Practices

- Use **Sandbox** first before production.  
- Always log `paymentRef` for reconciliation.  
- Use **webhooks + Get Payment Details** together.  
- Handle partial payments carefully.  
- Respect rate limits.

---

## Example Code (Node.js)

```javascript
import fetch from "node-fetch";

const API_KEY = "your_api_key";
const BASE_URL = "https://sandbox.konnect.network/api/v1";

async function initiatePayment() {
  const response = await fetch(`${BASE_URL}/payments/init-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      receiverWalletId: "wallet_123",
      token: "TND",
      amount: 10000,
      description: "Test order",
      orderId: "order_001",
      webhook: "https://yourdomain.com/webhook"
    }),
  });

  const data = await response.json();
  console.log(data);
}

initiatePayment();
```

---

# End of Documentation
