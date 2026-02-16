# Fixing Google OAuth 403 Access Denied Error

## Problem
Getting `Error 403: access_denied` when trying to authenticate with Gmail API.

## Solution Steps

### 1. Verify Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one if needed)
3. Make sure the Gmail API is enabled:
   - Go to "APIs & Services" > "Enabled APIs"
   - Search for "Gmail API"
   - Click "Enable" if not already enabled

### 2. Configure OAuth Consent Screen

This is the most common cause of the 403 error.

1. Go to "APIs & Services" > "OAuth consent screen"
2. Configure the following:

#### Publishing Status
- If your app is in **Testing** mode (which is fine for development):
  - Add test users who can access the app
  - Click "ADD USERS" and add: `danielcase.info@gmail.com`
  - Add any other email addresses you'll use for testing

#### App Information
- App name: UBuildIt Manager
- User support email: danielcase.info@gmail.com
- Developer contact: danielcase.info@gmail.com

#### Scopes
Make sure these scopes are added:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

### 3. Verify OAuth 2.0 Client Configuration

1. Go to "APIs & Services" > "Credentials"
2. Find your OAuth 2.0 Client ID (217172068796-irtjungt5t2oko60pk8tatnq5norq6m8.apps.googleusercontent.com)
3. Click on it to edit
4. Verify the following:

#### Authorized Redirect URIs
Make sure this EXACT URL is added (case-sensitive, including trailing slashes):
```
http://localhost:3000/api/auth/google/callback
```

If you plan to deploy, also add your production URL:
```
https://yourdomain.com/api/auth/google/callback
```

### 4. Clear Browser Cache and Cookies

Sometimes old OAuth sessions can cause issues:
1. Clear cookies for accounts.google.com
2. Clear browser cache
3. Try in an incognito/private window

### 5. Verify Environment Variables

Your `.env.local` file looks correct, but double-check:
- `GOOGLE_CLIENT_ID` matches the one in Google Cloud Console
- `GOOGLE_CLIENT_SECRET` is correct (regenerate if unsure)
- `GOOGLE_REDIRECT_URI` exactly matches what's in Google Cloud Console

### 6. Common Issues and Solutions

#### Issue: "Access blocked: This app's request is invalid"
**Solution**: The redirect URI doesn't match exactly. Check for:
- Trailing slashes
- HTTP vs HTTPS
- Port numbers (3000 in development)
- Exact path match

#### Issue: "Google hasn't verified this app"
**Solution**: This is normal for apps in testing mode. Click "Continue" (may be under "Advanced")

#### Issue: User not in test users list
**Solution**: Add the email to test users in OAuth consent screen

### 7. Testing the Fix

After making these changes:
1. Restart your Next.js development server
2. Clear browser cache/cookies
3. Try the authentication flow again

### 8. If Still Not Working

Create a new OAuth 2.0 Client ID:
1. Go to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. Choose "Web application"
4. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Copy the new Client ID and Secret
6. Update your `.env.local` file
7. Restart your server

## Quick Checklist

- [ ] Gmail API is enabled in Google Cloud Console
- [ ] OAuth consent screen is configured
- [ ] Test users are added (if in testing mode)
- [ ] Redirect URI matches exactly in Google Cloud Console
- [ ] Environment variables are correct
- [ ] Browser cache/cookies cleared
- [ ] Server restarted after changes

## Additional Notes

For production deployment:
1. Consider moving OAuth consent screen to "Production" status
2. Add production redirect URIs
3. Complete app verification if using sensitive scopes
4. Use HTTPS for production redirect URIs
