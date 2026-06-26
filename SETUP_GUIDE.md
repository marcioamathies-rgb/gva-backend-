# GVA — Step-by-Step Admin Account Setup Guide

## YOUR ADMIN CREDENTIALS (after setup)
- Membership ID: GVA-ADMIN-0001
- Password: whatever YOU set in step 5 below
- (Nobody else, including the developers, can see your password — it is encrypted before storage)

---

## STEP 1 — Deploy the Backend (10 minutes)

### Option A: Render.com (Recommended — free)
1. Go to https://render.com → Sign up for free
2. Click "New +" → PostgreSQL
   - Name: gva-db
   - Plan: Free
   - Click "Create Database"
   - **Copy the "External Database URL"** shown on the dashboard
3. Click "New +" → Web Service
   - Connect your GitHub repo (upload the gva-backend folder first)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

### Option B: Railway.app (Alternative)
1. Go to https://railway.app → Sign up
2. New Project → Deploy from GitHub repo
3. Add Plugin → PostgreSQL (Railway creates it automatically)

### Option C: Your Own Server (VPS/cPanel)
1. Install Node.js 18+ and PostgreSQL
2. Upload the gva-backend folder via FTP/SSH
3. Create a database: `createdb gva_db`

---

## STEP 2 — Set Environment Variables

In your hosting dashboard (Render: Settings → Environment), add these:

```
DATABASE_URL       = (paste your Postgres URL from Step 1)
DATABASE_SSL       = true
JWT_SECRET         = (any long random string, e.g. GVA2025@SecureKey!ChangeThis#Now)
JWT_EXPIRES_IN     = 7d
BCRYPT_SALT_ROUNDS = 12

# Email (for password reset alerts)
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your_gmail@gmail.com
SMTP_PASS = (your Gmail App Password — see Step 3)

# File uploads (Cloudinary — free at cloudinary.com)
CLOUDINARY_CLOUD_NAME = your_cloud_name
CLOUDINARY_API_KEY    = your_api_key
CLOUDINARY_API_SECRET = your_api_secret

# Stripe (for monetization — free at stripe.com)
STRIPE_SECRET_KEY       = sk_live_...
STRIPE_WEBHOOK_SECRET   = whsec_...

# Site URL
CORS_ORIGIN = https://your-website-domain.com
ADMIN_EMAIL = marcioamathies@gmail.com
MODERATOR_ALERT_EMAIL = gva.lrorg@gmail.com
```

---

## STEP 3 — Set Up Gmail for Email Alerts

1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already on
3. Search for "App passwords" → Create one for "Mail"
4. Copy the 16-character password → use it as SMTP_PASS above

---

## STEP 4 — Run the Database Migration

In your hosting dashboard, open the Shell/Console tab and run:
```
npm run migrate
```
This creates all tables. You will see: "Migration complete."

---

## STEP 5 — Create Your Super Admin Account ⭐

This is the only step that creates your personal login.

1. Open your website URL
2. Add `?admin-setup=true` to the end:
   - Example: `https://your-gva-site.com/?admin-setup=true`
3. A setup form will appear — fill in:
   - Your full name
   - Your email address  
   - A strong password (8+ characters, include numbers)
4. Click "Create Super Admin Account"
5. ✅ Done — your credentials are now saved encrypted in the database

**Your login details:**
- Go to the website → click "Member Login"
- Membership ID: `GVA-ADMIN-0001`
- Password: what you set in the form above

---

## STEP 6 — Upload Your Website

1. Download `gva-website.html`
2. Open it in a text editor
3. Find line: `const API_URL = 'https://gva-backend.onrender.com'`
4. Replace with your actual backend URL from Step 1
5. Upload to your web hosting (Netlify, cPanel, GitHub Pages, etc.)

---

## TROUBLESHOOTING

**"Setup has already been completed" appears:**
→ An admin account already exists. Use Membership ID: GVA-ADMIN-0001 with your password.
→ If you forgot your password, go to the backend Shell and run:
   `node -e "require('./src/db/resetAdmin')"`

**"Could not reach backend" appears:**
→ Your backend URL in the website HTML doesn't match your deployed URL
→ Check that all environment variables are set and the migration ran

**Login says "Invalid ID or password":**
→ Make sure you're typing GVA-ADMIN-0001 exactly (capital letters, dashes)
→ Password is case-sensitive

---

## QUICK REFERENCE — All Staff Membership IDs
| Role         | Membership ID Format   | Password Reset                    |
|--------------|------------------------|-----------------------------------|
| Super Admin  | GVA-ADMIN-0001         | Alert sent to marcioamathies@gmail.com |
| Moderator    | GVA-MOD-XXXX           | Alert sent to gva.lrorg@gmail.com |
| Member       | GVA-ONLINE-YYYY-MM-XXX | Admin or Moderator resets it      |
