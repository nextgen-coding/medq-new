# Autre Payment Method Fix

## Issue
When users selected "Autre méthodes" (Other payment methods) on the upgrade page, uploaded proof and filled in details, they would get an "Invalid payment method" error when clicking "Confirmer le paiement".

## Root Cause
The `autre_payment` method was defined in the Prisma schema and used in the frontend, but the backend API (`/api/payments/init/route.ts`) didn't have a handler for it. When the payment was submitted, it would fall through to the default error handler.

## Solution

### 1. Backend API (`/src/app/api/payments/init/route.ts`)
Added a complete handler for `PaymentMethod.autre_payment` that:
- Validates payment details and proof when not buying a key
- Creates a payment record with status `awaiting_verification`
- Returns success response with appropriate message
- Mirrors the logic of `custom_payment` but with different messaging

```typescript
// Handle autre payment method (other payment methods)
if (method === PaymentMethod.autre_payment) {
  // For other payment methods when buying key, no requirements - team will contact
  if (isBuyingKey) {
    // No validation needed for other payments when buying keys
  } else {
    // For regular autre payments, require both details and proof
    if (!customPaymentDetails) {
      return NextResponse.json(
        { error: 'Payment details are required for other payment methods' },
        { status: 400 }
      )
    }

    if (!proofFileUrl) {
      return NextResponse.json(
        { error: 'Proof of payment is required for other payment methods' },
        { status: 400 }
      )
    }
  }

  const payment = await prisma.payment.create({
    data: {
      userId: request.user!.userId,
      amount: finalAmount,
      method: PaymentMethod.autre_payment,
      status: 'awaiting_verification',
      subscriptionType,
      customPaymentDetails: customPaymentDetails || (isBuyingKey ? 'Other payment method - team will contact' : ''),
      proofImageUrl: proofFileUrl,
      isBuyingKey: isBuyingKey || false
    }
  })

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    message: isBuyingKey ? 'Payment request submitted - team will contact you' : 'Payment submitted for verification',
    requiresProof: !isBuyingKey
  })
}
```

### 2. Frontend Validation (`/src/app/upgrade/page.tsx`)
Added validation checks to ensure users provide required information before submitting:

```typescript
if (state.method === 'autre_payment' && !state.isBuyingKey && !state.customPaymentDetails.trim()) {
  toast({
    title: 'Erreur',
    description: 'Veuillez entrer les détails du paiement',
    variant: 'destructive'
  })
  return
}

if (state.method === 'autre_payment' && !state.isBuyingKey && !state.proofFileUrl) {
  toast({
    title: 'Erreur',
    description: 'Veuillez téléverser une preuve de paiement',
    variant: 'destructive'
  })
  return
}
```

### 3. Success Message Handling (`/src/app/upgrade/page.tsx`)
Added proper success message for `autre_payment` method:

```typescript
else if (state.method === 'autre_payment') {
  title = '🎉 Paiement enregistré !'
  enhancedDescription = `Votre demande de paiement a été enregistrée. ${data.message}`
}
```

## Testing

To test the fix:
1. Go to `/upgrade` page
2. Select "Autre méthodes" payment option
3. Fill in payment details
4. Upload proof of payment
5. Click "Confirmer le paiement"
6. Should see success message: "🎉 Paiement enregistré !"
7. Payment should be created in database with status `awaiting_verification`
8. Admin can verify payment in admin panel

## Impact

- ✅ Users can now successfully submit payments using "Autre méthodes"
- ✅ Payment records are properly created in the database
- ✅ Admin can review and verify these payments
- ✅ Consistent behavior with `custom_payment` method
- ✅ Proper validation and error messages

## Related Files

- `/src/app/api/payments/init/route.ts` - Backend payment initialization
- `/src/app/upgrade/page.tsx` - Frontend upgrade page with payment flow
- `/prisma/schema.prisma` - Payment method enum definition
- `/src/app/admin/payments/page.tsx` - Admin payment verification (already supports autre_payment)
