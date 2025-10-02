# Payment Verification Flow Update

## Overview
Updated the admin payment verification system to send activation keys to users instead of directly activating their subscriptions.

## Changes Made

### 1. Modified `/src/app/api/admin/payments/[paymentId]/verify/route.ts`

**Previous behavior:**
- When admin accepts a payment, it directly activates the user's subscription
- Sets `hasActiveSubscription: true` on the user
- Sets `subscriptionExpiresAt` to the appropriate date

**New behavior:**
- When admin accepts a payment:
  1. Generates a unique activation key (format: `MEDQ-S-XXXXXX` for semester, `MEDQ-Y-XXXXXX` for annual)
  2. Creates a voucher code record in the database
  3. Updates payment status to `verified`
  4. Stores the activation key in the payment record
  5. Sends the activation key to the user's email via `sendActivationKeyEmail()`
  6. User must manually enter the activation key to activate their subscription

- When admin rejects a payment:
  - Only marks the payment as `rejected`
  - No activation key is generated
  - No subscription is activated

### 2. Modified `/src/app/admin/payments/page.tsx`

**Updated the success message:**
- Now displays: "Paiement vérifié. Une clé d'activation a été générée et envoyée à l'utilisateur par email."
- Clearly indicates that the user needs to activate their subscription manually

## Flow Diagram

```
Admin Accepts Payment
        ↓
Generate Activation Key (MEDQ-S-XXXXXX or MEDQ-Y-XXXXXX)
        ↓
Create Voucher Code Record
        ↓
Update Payment (status: verified, activationKey: XXX)
        ↓
Send Email with Activation Key to User
        ↓
User receives email with activation key
        ↓
User manually enters key in the app
        ↓
Subscription is activated
```

## Key Benefits

1. **Better control**: Users must explicitly activate their subscription
2. **Email verification**: Ensures user has access to their registered email
3. **Audit trail**: Activation keys are tracked in the database
4. **Flexibility**: Users can activate when ready
5. **Security**: Prevents automatic activation without user confirmation

## Database Records

When a payment is verified:
- **Payment table**: `status` = 'verified', `activationKey` = generated key
- **VoucherCode table**: New record with the generated key
- **User table**: No immediate changes (updated when user activates key)

## Email Template

The activation key is sent using the existing `sendActivationKeyEmail()` function in `/src/lib/email.tsx`, which uses the `ActivationKeyEmail` React Email component.

## Notes

- Automatic payments (Konnect gateway webhook) continue to activate subscriptions directly
- Only manual payment verification by admin now uses activation keys
- If email sending fails, the key is still stored in the payment record for manual retrieval
