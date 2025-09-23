# Payment System Implementation Documentation

## Overview
A comprehensive payment system has been implemented for the MedQ medical education platform, supporting three payment methods and two subscription types.

## Features Implemented

### 1. Database Schema
- **Payment Model**: Tracks all payment transactions with support for multiple payment methods
- **VoucherCode Model**: Admin-generated voucher codes for subscription activation
- **VoucherCodeUsage Model**: Tracks voucher code usage by users
- **Payment Enums**: PaymentMethod, PaymentStatus, SubscriptionType

### 2. Payment Methods
1. **Konnect Gateway**: Online payment processing using Tunisian Konnect payment gateway
2. **Voucher Codes**: Admin-generated codes for instant subscription activation
3. **Custom Payment**: Manual payment with proof upload (bank transfer, phone payment, etc.)

### 3. Subscription Types
- **Semester**: Single semester subscription
- **Annual**: Full year subscription

### 4. User Interface

#### Dashboard
- Existing UpsellBanner prompts free users to upgrade
- UpgradeDialog redirects to payment page

#### Profile Page
- Upgrade button links to payment page
- Subscription status display

#### Payment Page (`/upgrade`)
- Three payment method options
- Amount calculation based on subscription type
- File upload for custom payment proof

### 5. Admin Interface

#### Admin Payments Page (`/admin/payments`)
- View all payments with filtering
- Payment status management
- User profile access for payment verification

#### Admin Vouchers Page (`/admin/vouchers`)
- Generate voucher codes
- View existing vouchers and usage
- Manage voucher expiration

#### User Profile Enhancement
- Payment history display
- Subscription status
- Custom payment proof viewing
- Payment verification buttons

### 6. API Routes

#### Payment Routes
- `POST /api/payments/init` - Initialize payment process
- `GET /api/payments/konnect/webhook` - Konnect webhook handler
- `POST /api/payments/upload-proof` - Upload custom payment proof
- `GET /api/payments/status` - Check payment status

#### Admin Routes
- `GET /api/admin/payments` - List all payments
- `PUT /api/admin/payments/[id]/verify` - Verify custom payments
- `GET /api/admin/vouchers` - List vouchers
- `POST /api/admin/vouchers` - Generate voucher codes
- `GET /api/admin/users/[id]` - Enhanced with payment data

## Setup Instructions

### 1. Environment Variables
Add these variables to your `.env` file:

```env
# Konnect Payment Gateway Configuration (Sandbox)
KONNECT_API_KEY="your-konnect-api-key"
KONNECT_WALLET_ID="your-konnect-wallet-id"
KONNECT_BASE_URL="https://sandbox.konnect.network/api/v1"
```

### 2. Database Migration
The schema has been updated with payment models. Run:
```bash
npx prisma db push
```

### 3. Konnect Integration
- Sign up for Konnect sandbox account
- Get API key and wallet ID
- Update environment variables
- Test with sandbox before production

## Payment Flow

### Konnect Gateway Flow
1. User selects subscription type and Konnect payment
2. API creates payment record with "pending" status
3. User redirected to Konnect payment page
4. Konnect webhook updates payment status
5. Subscription activated on successful payment

### Voucher Code Flow
1. User enters voucher code
2. System validates code availability and expiration
3. Subscription activated immediately
4. Voucher marked as used

### Custom Payment Flow
1. User selects custom payment method
2. User uploads proof image
3. Payment marked as "awaiting_verification"
4. Admin reviews proof and verifies/rejects
5. Subscription activated on verification

## Security Features
- JWT-based authentication
- Admin role verification
- File upload validation
- Payment webhook verification
- Voucher code uniqueness

## Testing
1. Start development server: `npm run dev`
2. Access dashboard as free user to see upgrade prompts
3. Test payment flows in sandbox mode
4. Test admin payment management

## Production Deployment
1. Update Konnect configuration to production endpoints
2. Set up proper webhook URLs
3. Configure file upload storage
4. Test all payment flows thoroughly

## Admin Tasks
- Generate voucher codes for marketing campaigns
- Monitor payment statuses
- Verify custom payment proofs
- Manage subscription renewals

## File Structure
```
src/
├── app/
│   ├── admin/
│   │   ├── payments/
│   │   └── vouchers/
│   ├── api/
│   │   ├── payments/
│   │   └── admin/
│   └── upgrade/
├── components/
│   ├── admin/
│   └── subscription/
└── types/
```

## Next Steps
1. Test thoroughly in sandbox environment
2. Integrate with production Konnect account
3. Set up automated subscription renewal reminders
4. Add payment analytics and reporting
5. Implement subscription tier management

## Support
For issues with the payment system:
1. Check environment variables are correctly set
2. Verify database schema is up to date
3. Test Konnect API connectivity
4. Review payment logs in admin dashboard
