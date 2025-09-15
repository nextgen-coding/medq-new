# Database Setup for Authentication

## The Problem
The Google OAuth sign-in works, but users are redirected back to the login form because profiles are not being created in the database automatically.

## The Solution
You need to run the database migration to set up the proper table structure and triggers.

## Steps to Fix

### 1. Run the Database Migration
You need to execute the SQL migration in your Supabase database. You can do this through:

**Option A: Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy and paste the contents of `supabase/migrations/001_setup_profiles_trigger.sql`
4. Execute the SQL

**Option B: Supabase CLI**
```bash
supabase db push
```

### 2. Test the Debug Endpoint
After running the migration, test the debug endpoint:
```
http://localhost:3000/api/debug-auth-env
```

This will show you:
- Environment variable status
- Current profiles in the database
- Auth users in the database

### 3. What the Migration Does
- Creates the `profiles` table with proper foreign key to `auth.users`
- Sets up Row Level Security (RLS) policies
- Creates a trigger that automatically creates a profile when a user signs up
- Sets up automatic timestamp updates

### 4. Expected Behavior After Migration
- When a user signs in with Google, a record will be created in `auth.users`
- The trigger will automatically create a corresponding record in `profiles`
- The user will be redirected to the dashboard instead of back to login

## Current Issues Fixed
1. **Missing foreign key relationship** between `profiles` and `auth.users`
2. **No automatic profile creation** when users sign up
3. **Manual profile creation conflicts** with SupabaseAdapter

## Testing
After running the migration:
1. Try signing in with Google again
2. Check the debug endpoint to see if profiles are being created
3. Verify that you're redirected to the dashboard instead of back to login 