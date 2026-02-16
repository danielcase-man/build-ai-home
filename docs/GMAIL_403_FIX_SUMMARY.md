# Gmail OAuth 403 Error - Fix Summary

## The Issue
You're getting `Error 403: access_denied` when trying to authenticate with Gmail OAuth.

## Root Cause
The 403 error is typically caused by one of these issues:
1. **Test users not configured** - Your email isn't in the test users list
2. **Redirect URI mismatch** - The URI doesn't match exactly in Google Cloud Console
3. **Gmail API not enabled** - The API needs to be enabled for your project
4. **OAuth consent screen not configured** - Missing required configuration

## Immediate Fix Steps

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Make sure you're in the correct project

### Step 2: Configure OAuth Consent Screen
1. Navigate to **"APIs & Services" → "OAuth consent screen"**
2. If in **Testing** mode:
   - Click **"ADD USERS"**
   - Add: `danielcase.info@gmail.com`
   - Add any other emails you'll use for testing
3. Ensure these fields are filled:
   - App name: UBuildIt Manager
   - User support email: danielcase.info@gmail.com
   - Developer contact: danielcase.info@gmail.com

### Step 3: Verify OAuth 2.0 Credentials
1. Navigate to **"APIs & Services" → "Credentials"**
2. Find your OAuth 2.0 Client ID: `217172068796-irtjungt5t2oko60pk8tatnq5norq6m8.apps.googleusercontent.com`
3. Click to edit it
4. In **Authorized redirect URIs**, ensure this EXACT URL is present:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
   ⚠️ **IMPORTANT**: Must match exactly - no trailing slash, correct port, correct path

### Step 4: Enable Gmail API
1. Navigate to **"APIs & Services" → "Enabled APIs"**
2. Search for **"Gmail API"**
3. Click **"ENABLE"** if not already enabled

### Step 5: Clear Browser and Test
1. Clear cookies for `accounts.google.com`
2. Clear browser cache
3. Restart your Next.js server: `npm run dev`
4. Try the authentication flow again

## Files Created to Help

### 1. Documentation
- `docs/fix-google-oauth-403.md` - Detailed troubleshooting guide
- `docs/GMAIL_403_FIX_SUMMARY.md` - This quick reference

### 2. Verification Script
Run this to check your configuration:
```bash
node scripts/verify-oauth-config.js
```

### 3. Enhanced UI Component
- `src/components/GmailConnect.tsx` - Better error handling and user guidance

## Your Current Configuration
Based on your `.env.local`:
- ✅ Client ID: `217172068796-irtjungt5t2oko60pk8tatnq5norq6m8.apps.googleusercontent.com`
- ✅ Client Secret: Set (ends with ...EuIR)
- ✅ Redirect URI: `http://localhost:3000/api/auth/google/callback`
- ✅ User Email: `danielcase.info@gmail.com`

## Quick Checklist
- [ ] Gmail API is enabled
- [ ] danielcase.info@gmail.com is in test users list
- [ ] Redirect URI matches exactly in Google Console
- [ ] OAuth consent screen is configured
- [ ] Browser cache/cookies cleared
- [ ] Server restarted

## If Still Not Working

### Option 1: Try Incognito Mode
Sometimes cached OAuth sessions cause issues.

### Option 2: Create New OAuth Credentials
1. In Google Cloud Console, create new OAuth 2.0 credentials
2. Update `.env.local` with new Client ID and Secret
3. Restart server

### Option 3: Check Browser Console
Look for specific error messages that might give more context.

## Common Mistakes to Avoid
1. **Trailing slash in redirect URI** - Don't add one unless it's in Google Console
2. **Wrong port number** - Must be 3000 for localhost development
3. **HTTP vs HTTPS** - Use HTTP for localhost
4. **Not adding test users** - Essential when app is in testing mode
5. **Not enabling Gmail API** - Often overlooked step

## Need More Help?
1. Check browser developer console for detailed errors
2. Run `node scripts/verify-oauth-config.js` to verify setup
3. Review `docs/fix-google-oauth-403.md` for detailed instructions
4. Check Google Cloud Console logs for authentication attempts

## Success Indicators
When properly configured, you should:
1. See Google's OAuth consent screen
2. Be able to select your Google account
3. See permission requests for Gmail access
4. Be redirected back to your app with `?success=connected`
