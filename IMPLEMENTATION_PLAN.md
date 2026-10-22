# Simplified Dashboard Implementation Plan

## STATUS: Ready for batch implementation

## Changes Needed:

### 1. Backend - OTP Auth (DONE - Model updated)
- ✅ Added emailVerificationOtp and otpExpiry to User model
- TODO: Update auth routes to generate and verify OTP
- TODO: Update email service to send OTP

### 2. Backend - Widget Without Website
- TODO: Allow widget creation without website requirement
- TODO: Add widget CRUD endpoints

### 3. Backend - Delete Conversation
- TODO: Add DELETE /conversations/:id endpoint

### 4. Frontend - Simplified Sidebar
- TODO: Remove all menu items except: Inbox, History, Settings, Logout
- TODO: Remove workspace selector

### 5. Frontend - Create Widget Button
- TODO: Add button in header
- TODO: Create modal component

### 6. Frontend - OTP Verification
- TODO: Update signup page with OTP input
- TODO: Add verify-otp API call

### 7. Frontend - History Page
- TODO: Create history page with conversation list
- TODO: Add delete functionality

### 8. Frontend - Settings Page
- TODO: Create settings page with widget list
- TODO: Add widget configuration UI

## Next: Commit current changes and deploy to see OTP model update
