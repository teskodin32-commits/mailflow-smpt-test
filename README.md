# MailFlow Free Gmail SMTP Test (isolated)

This is a separate personal/non-commercial SMTP test project. It does not change or connect to your live MailFlow database, campaigns, OAuth, or Render service.

## 1. Generate a Gmail App Password

- Enable Google 2-Step Verification: https://myaccount.google.com/security
- Create a 16-character App Password: https://myaccount.google.com/apppasswords
- Use your Gmail address and the generated App Password. **Never** use your regular Gmail password.

## 2. Create a separate GitHub repository

- Create a PRIVATE repo named `mailflow-smtp-test`.
- Extract this ZIP. Upload its contents so the repo root contains `api/`, `public/`, and `package.json`.
- Do not upload Gmail App Passwords, keys, or local `.env` files.

## 3. Create a new Vercel project

- In Vercel, Add New → Project → Import the `mailflow-smtp-test` repository.
- Set **Framework Preset** to **Other**. Keep **Root Directory** at the repository root.
- Add these Environment Variables under project Settings → Environment Variables (or during import):
  - `GMAIL_ADDRESS` = your Gmail address (example: `youraddress@gmail.com`)
  - `GMAIL_APP_PASSWORD` = your 16-character Google App Password (remove spaces)
  - `TEST_RECIPIENT` = your own test inbox (ideally the same Gmail address)
  - `TEST_SECRET` = a private random value at least 24 characters long; generate using `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"` or a password manager.
- Deploy. If you added variables after the first deployment, **redeploy** to apply them.

## 4. Test

- Open the new Vercel project URL in your browser.
- Enter `TEST_SECRET` (not the Google App Password).
- Select `1. Verify Gmail login`.
- If it succeeds, select `2. Send to test inbox` and check inbox/spam.
- This test sends **only to the server-configured TEST_RECIPIENT**. There is no public, arbitrary-recipient email endpoint.

## 5. Know the limits

- Vercel Hobby is free for **personal, non-commercial** use only and subject to compute/usage limits. Not appropriate for live business campaigns.
- Vercel allows outgoing SMTP on port 465. Render Free does not.
- This test DOES NOT automatically add SMTP support to your actual MailFlow app. To use both methods in MailFlow while keeping Render Free, a separate authenticated HTTPS relay integration is needed, with secure credential handling and proper safeguards. Do not change your production app until this test works.
- Gmail can reject unusual connection locations and has sending limits. App Passwords are less preferred than Google OAuth.

## Safety

No Gmail credentials are exposed to the test page. Vercel environment variables are server-side only. Use strong unique TEST_SECRET. Never share App Password, TEST_SECRET or SMTP_CREDENTIALS_KEY, and do not commit them to GitHub. This is a limited, single-destination test, not an email marketing relay.
