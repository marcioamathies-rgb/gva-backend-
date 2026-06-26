# GVA Backend — Setup & Deployment

Secure backend for Greater Vision Association: hashed passwords (bcrypt), JWT auth,
PostgreSQL storage, and real-time community chat (Socket.io).

**Security note:** this replaces the browser-only storage in the prototype website.
Passwords are hashed before they ever touch the database — even with full database
access, no one can read the original password.

---

## Fastest path: deploy on Render (free tier, ~10 minutes)

Render gives you a free web service **and** a free managed PostgreSQL database,
both owned by your own account — nobody else can see or touch your data.

1. **Create a Render account** at https://render.com (free, no card required for the free tier).
2. **Create the database first:**
   - Dashboard → New → PostgreSQL → name it `gva-db` → Free plan → Create.
   - Once it's ready, copy the **Internal Database URL** shown on its page.
3. **Push this code to a GitHub repo** (or use Render's "Upload" option if available):
   ```
   git init
   git add .
   git commit -m "GVA backend"
   git remote add origin <your-empty-github-repo-url>
   git push -u origin main
   ```
4. **Create the web service:**
   - Dashboard → New → Web Service → connect your repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Free plan.
5. **Set environment variables** on the web service (Settings → Environment):
   - `DATABASE_URL` = the Internal Database URL from step 2
   - `DATABASE_SSL` = `true`
   - `JWT_SECRET` = a long random string (generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `JWT_EXPIRES_IN` = `7d`
   - `CORS_ORIGIN` = the URL of your website (or `*` while testing)
6. **Run the migration once**, using Render's Shell tab on the web service:
   ```
   npm run migrate
   ```
7. Your API is now live at `https://your-service-name.onrender.com`.

---

## Connecting the frontend

The website (`gva-website.html`) currently talks to browser-only storage. To
connect it to this real backend, the `fetch`-style calls need to point at your
new API instead of `window.storage`:

- Registration → `POST https://your-service-name.onrender.com/api/auth/register`
- Login → `POST https://your-service-name.onrender.com/api/auth/login`
- Super Admin setup → `POST https://your-service-name.onrender.com/api/setup`
- Chat → connect via Socket.io to `https://your-service-name.onrender.com`, passing the JWT in `auth: { token }`

Send me your live API URL once it's deployed and I'll wire the website to call it directly.

---

## Local development

```
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm run migrate
npm run dev
```

## What's included

- `src/db/schema.sql` — full schema (users, members, scholarships, events,
  attendance, certificates, finance, chat, CMS, audit logs)
- `src/controllers/authController.js` — setup wizard, registration, login (bcrypt + JWT)
- `src/controllers/memberController.js` — admin/moderator member management,
  approval, status changes, password resets
- `src/controllers/chatController.js` + `src/sockets/chat.js` — real-time
  community chat with mute/lock moderation
- `src/middleware/auth.js` — JWT verification and role-based access control
