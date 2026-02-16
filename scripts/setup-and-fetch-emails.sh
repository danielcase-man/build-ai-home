#!/bin/bash

echo "🚀 Starting UBuildIt Email Fetcher"
echo "=================================="
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Dev server is not running!"
    echo ""
    echo "Please start the dev server in another terminal:"
    echo "  npm run dev"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Dev server is running"
echo ""

# Get auth URL
echo "📧 Getting Gmail auth URL..."
AUTH_RESPONSE=$(curl -s http://localhost:3000/api/gmail/auth)
AUTH_URL=$(echo $AUTH_RESPONSE | grep -o '"authUrl":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_URL" ]; then
    echo "❌ Failed to get auth URL"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo "✅ Auth URL generated"
echo ""
echo "🔐 Please open this URL in your browser to connect Gmail:"
echo ""
echo "$AUTH_URL"
echo ""
echo "After authorizing, you'll be redirected back to the app."
echo "Press Enter once you've completed the authorization..."
read

echo ""
echo "🔍 Fetching emails from Daniel Arredondo..."
node scripts/fetch-arredondo-emails.js
