#!/usr/bin/env node

/**
 * Script to verify Google OAuth configuration
 * Run with: node scripts/verify-oauth-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Google OAuth Configuration...\n');

// Check environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Required OAuth variables
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

console.log('📋 Environment Variables Check:\n');
let hasAllVars = true;

requiredVars.forEach(varName => {
  if (envVars[varName]) {
    console.log(`✅ ${varName}: Set`);
    if (varName === 'GOOGLE_CLIENT_ID') {
      console.log(`   Value: ${envVars[varName]}`);
    } else if (varName === 'GOOGLE_REDIRECT_URI') {
      console.log(`   Value: ${envVars[varName]}`);
    }
  } else {
    console.log(`❌ ${varName}: Missing`);
    hasAllVars = false;
  }
});

console.log('\n📋 Configuration Details:\n');

// Check redirect URI format
if (envVars.GOOGLE_REDIRECT_URI) {
  const redirectUri = envVars.GOOGLE_REDIRECT_URI;
  console.log('Redirect URI Analysis:');
  
  if (redirectUri.includes('localhost')) {
    console.log('✅ Using localhost for development');
  }
  
  if (redirectUri.startsWith('http://')) {
    console.log('⚠️  Using HTTP (okay for localhost, but use HTTPS in production)');
  } else if (redirectUri.startsWith('https://')) {
    console.log('✅ Using HTTPS');
  }
  
  if (redirectUri.endsWith('/')) {
    console.log('⚠️  Redirect URI ends with slash - make sure this matches exactly in Google Console');
  }
  
  console.log(`\nExpected callback endpoint: ${redirectUri}`);
}

// Check for Gmail API related variables
console.log('\n📋 Additional Gmail Configuration:\n');
if (envVars.GMAIL_USER_EMAIL) {
  console.log(`✅ Gmail User Email: ${envVars.GMAIL_USER_EMAIL}`);
} else {
  console.log('⚠️  GMAIL_USER_EMAIL not set (optional but recommended)');
}

// Provide next steps
console.log('\n🔧 Next Steps:\n');
console.log('1. Go to https://console.cloud.google.com/');
console.log('2. Select your project');
console.log('3. Navigate to "APIs & Services" > "OAuth consent screen"');
console.log('4. Ensure your app is configured and test users are added');
console.log('5. Navigate to "APIs & Services" > "Credentials"');
console.log(`6. Verify OAuth 2.0 Client ID: ${envVars.GOOGLE_CLIENT_ID || 'NOT SET'}`);
console.log(`7. Verify Redirect URI is EXACTLY: ${envVars.GOOGLE_REDIRECT_URI || 'NOT SET'}`);
console.log('\n⚠️  Remember: The redirect URI must match EXACTLY (including http/https, port, and path)');

if (!hasAllVars) {
  console.log('\n❌ Some required environment variables are missing!');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
}

console.log('\n📚 For detailed troubleshooting, see: docs/fix-google-oauth-403.md');
