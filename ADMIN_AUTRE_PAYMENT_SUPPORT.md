# Admin Panel - Autre Payment Method Support

## Changes Made

### Issue
The admin payments page didn't show action buttons (view proof, accept, reject) for payments made using "Autre méthodes" (other payment methods).

### Solution

Updated `/src/app/admin/payments/page.tsx` to include `autre_payment` in the payment actions:

#### 1. View Proof Button
**Before:**
```tsx
{payment.method === 'custom_payment' && payment.proofImageUrl && (
  <Button onClick={() => {...}}>
    <Eye className="h-3 w-3" />
    <span className="ml-1">Voir preuve</span>
  </Button>
)}
```

**After:**
```tsx
{(payment.method === 'custom_payment' || payment.method === 'autre_payment') && payment.proofImageUrl && (
  <Button onClick={() => {...}}>
    <Eye className="h-3 w-3" />
    <span className="ml-1">Voir preuve</span>
  </Button>
)}
```

#### 2. Accept/Reject Buttons
**Before:**
```tsx
{(payment.method === 'custom_payment' || payment.method === 'konnect_gateway') && 
 (payment.status === 'awaiting_verification' || payment.status === 'pending') && (
  // Accept/Reject buttons
)}
```

**After:**
```tsx
{(payment.method === 'custom_payment' || payment.method === 'autre_payment' || payment.method === 'konnect_gateway') && 
 (payment.status === 'awaiting_verification' || payment.status === 'pending') && (
  // Accept/Reject buttons
)}
```

## Features Enabled

Admins can now:
1. **View Proof Image**: Click "Voir preuve" to see the uploaded payment proof for `autre_payment` transactions
2. **Accept Payment**: Click "Accepter" to verify and approve the payment
   - Generates activation key
   - Sends key to user via email
   - Updates payment status to `verified`
3. **Reject Payment**: Click "Refuser" to reject the payment
   - Updates payment status to `rejected`
   - Adds admin notes if provided

## Backend Support

The backend already supports `autre_payment`:
- ✅ `/api/payments/init/route.ts` - Creates payment records
- ✅ `/api/admin/payments/[paymentId]/verify/route.ts` - Handles accept/reject actions
- ✅ Database enum updated with `autre_payment` value

## User Flow

1. User selects "Autre méthodes" on upgrade page
2. User fills payment details and uploads proof
3. Payment created with status `awaiting_verification`
4. Admin sees payment in admin panel with action buttons
5. Admin clicks "Voir preuve" to review payment proof
6. Admin clicks "Accepter" → Activation key sent to user
7. User receives email with activation key
8. User activates subscription with the key

## Testing

To test:
1. Go to `/admin/payments`
2. Find a payment with method "Autre méthodes"
3. Verify you see:
   - "Voir preuve" button (if proof uploaded)
   - "Accepter" button
   - "Refuser" button
4. Click "Voir preuve" → Dialog opens with payment details and proof image
5. Click "Accepter" → Payment verified, activation key generated and emailed
6. Check payment status changes to "verified"
7. Check activation key is displayed in the payment record
