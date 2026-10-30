# Setting up Sono Study for real

Every key goes in the same place: **Vercel → your project → Settings → Environment Variables**. Add it for Production (and Preview if you use it), then redeploy. For local testing, put the same lines in `.env.local`. Never commit keys to git.

Work through them in this order. The app runs without any of them, in demo mode; each key switches on one real piece.

## 1. Database: Neon (`DATABASE_URL`)
1. Sign up at neon.tech and create a project. Pick the region closest to Nigeria (Europe, e.g. Frankfurt).
2. On the project dashboard, click **Connect** and copy the connection string (`postgresql://…?sslmode=require`).
3. Set `DATABASE_URL` to it. The app creates its tables and turns on pgvector on first start.

## 2. Sign-in: Auth.js (`AUTH_SECRET`, Google, email)
1. **`AUTH_SECRET`:** run `npx auth secret` (or `openssl rand -base64 32`) and paste the result.
2. **Google sign-in** (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`):
   1. Go to console.cloud.google.com, create a project, then go to **APIs & Services → OAuth consent screen**. Choose External and fill in the app name and your email.
   2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
   3. Under **Authorized redirect URIs**, add `https://YOUR-DOMAIN/api/auth/callback/google`, and for local testing `http://localhost:3000/api/auth/callback/google`.
   4. Copy the Client ID and Client secret into the two variables.
3. **Email sign-in links** (`AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`): sign up at resend.com, add and verify your domain (it gives you DNS records to add), create an API key, and set `AUTH_EMAIL_FROM="Sono Study <login@your-domain>"`.

Set `APP_URL` to your live address (e.g. `https://sono.study`).

## 3. AI: Gemini, with Groq as backup
1. **Gemini (`GEMINI_API_KEY`):** go to aistudio.google.com, sign in with a Google account, click **Get API key → Create API key**, and copy it. The free tier is enough to start. Free-tier models and limits change often, so check the model list on that page. If you want specific models, set `GEMINI_MODEL` (a comma-separated fallback list).
2. **Groq (`GROQ_API_KEY`, optional backup):** go to console.groq.com, sign in, go to **API Keys → Create API Key**, and copy it. When Gemini hits a limit, the app switches to Groq automatically.

## 4. File storage: Cloudflare R2
1. Sign up at dash.cloudflare.com and open **R2 Object Storage**. You may need to add a card, but the free allowance covers a lot.
2. **Create bucket**, e.g. `sono-uploads`, and leave it private. That name is `R2_BUCKET`.
3. Your **Account ID** is shown on the R2 overview page (and in the dashboard URL). That's `R2_ACCOUNT_ID`.
4. Go to **Manage R2 API Tokens → Create API token**: permission **Object Read & Write**, limited to your bucket. Copy the **Access Key ID** into `R2_ACCESS_KEY_ID` and the **Secret Access Key** into `R2_SECRET_ACCESS_KEY`. The secret is shown only once.
5. Open the bucket's **Settings → CORS policy** and paste the following, with your domain:
   ```json
   [{ "AllowedOrigins": ["https://YOUR-DOMAIN"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```

## 5. Background jobs (`CRON_SECRET`)
1. Run `openssl rand -hex 32` and set the result as `CRON_SECRET`.
2. The worker at `/api/cron/jobs` must run every few minutes. It processes uploads, sends reminders, schedules Friday challenges and expires unpaid transfer claims.
   - **Vercel Pro:** `vercel.json` already schedules it every minute.
   - **Vercel Hobby** only allows a daily cron. Instead, use a free scheduler such as cron-job.org: URL `https://YOUR-DOMAIN/api/cron/jobs`, every 1–5 minutes, with the header `Authorization: Bearer YOUR_CRON_SECRET`.

## 6. Push reminders (VAPID)
1. Run `npx web-push generate-vapid-keys`.
2. Copy the Public Key into `VAPID_PUBLIC_KEY` and the Private Key into `VAPID_PRIVATE_KEY`, and set `VAPID_SUBJECT=mailto:you@your-domain`.
3. Don't change the keys later: every phone's subscription is tied to them.

## 7. Payments: OPay and PalmPay transfers
Students pay by transfer into your own OPay and PalmPay accounts. To confirm payments automatically, an Android phone signed in to those apps forwards each "money received" notification to Sono.

### The accounts
| Variable | Example |
| --- | --- |
| `OPAY_ACCOUNT_NUMBER` | your 10-digit OPay number |
| `OPAY_ACCOUNT_NAME` | the name exactly as OPay shows it to senders |
| `PALMPAY_ACCOUNT_NUMBER` / `PALMPAY_ACCOUNT_NAME` | the same for PalmPay |

Leave a pair empty to hide that option. Use these accounts **only for Sono**: every incoming transfer is treated as a possible pass payment.

### The forwarding phone
Any Android phone works, even an old one, as long as it stays on, charged and online.

1. Install OPay and PalmPay, sign in to the Sono accounts, and allow both apps to show notifications.
2. Run `openssl rand -hex 24` and set the result as `PAYMENT_ALERT_SECRET` in Vercel.
3. Install **MacroDroid** from the Play Store. You need one macro for each app:
   - **Trigger:** Device Events → Notification → Notification Received → choose the **OPay** app (any content).
   - **Action:** Web Interactions → HTTP Request:
     - Method: **POST**
     - URL: `https://YOUR-DOMAIN/api/payments/alert?key=YOUR_PAYMENT_ALERT_SECRET&app=opay`
     - Content type: **text/plain**
     - Body: tap the magic-text button and insert the **notification title**, then a new line, then the **notification text**.
   - Make a copy of the macro for **PalmPay**, with `&app=palmpay` in the URL.
4. In Android settings, give MacroDroid **notification access** and turn **battery optimisation off** for MacroDroid, OPay and PalmPay, so Android doesn't put them to sleep.
5. **Test it:** send ₦100 to the OPay account from another account. Then open **Profile → Admin → Transfers** on Sono. It should say "Last alert from the phone just now", with the ₦100 under "Money in that matched no one". If the text there is cut off or doesn't mention the amount, send me what it shows and I'll adjust the reader.

Make yourself an admin by setting `ADMIN_EMAILS=you@your-domain` (the email you sign in with).

### What students see
1. They choose a pass and tap **Pay with OPay** or **Pay with PalmPay**.
2. They see your account, an exact amount (₦500 plus ₦1–₦10, e.g. ₦503) and a code such as `SONO-K3F7Q2` for the transfer note.
3. They tap **I've sent ₦503** and the pass switches on straight away.
4. Within a minute, the phone forwards OPay's "You have received ₦503…" and Sono confirms the payment. If no matching money arrives within 24 hours, the pass switches off. Someone who has done that once in the last 30 days waits for confirmation next time.
5. The rare transfer that can't be matched (wrong amount and no code) is listed on **Admin → Transfers** with Confirm and Reject buttons. That page also warns you when the phone has gone quiet for 6 hours.

### Paystack (optional, later)
The Paystack checkout is still built in. Set `PAYSTACK_SECRET_KEY` and it appears under the OPay and PalmPay buttons (or on its own if no transfer accounts are set).

## 8. The rest
- `SUPPORT_EMAIL`: shown as Contact on the landing page.
- `ADMIN_EMAILS`: who can open the admin pages (reported questions, transfers).
