# DiagnoBot Beta: Conversation, Location, Booking and Payment

## Start

Use Node.js 22.19+ (or Node 24) and run `npm install`, then `npm start` from the app folder. The terminal prints the patient and operator URLs. Existing `.env` credentials load automatically. Do not overwrite an existing `.env` with the example file.

Only one process can open an embedded database directory. Stop the previous server with Ctrl+C before restarting. For parallel previews, use a different PORT and DATA_DIR; each preview then has separate accounts and bookings.

Sign in with **Demo patient** in sample mode. Select **Assistant / BETA** for multi-turn replies. **Guided** preserves the original intent-routing workflow. Operators sign in with **Demo operator** to see conversation metrics, support requests, appointments and payment states.

## Conversation And Sources

- `BETA_ASSISTANT=true` enables the beta. `false` disables the beta chat endpoint.
- `GROQ_MODEL` selects the model for both chat modes; the existing `GROQ_API_KEY` is reused. Restart after configuration changes.
- The last ten beta turns are stored in the encrypted session context and supplied to Groq. Session expiry is 30 minutes. This is short session memory, not permanent chat history.
- Known name, email and numeric identifiers are redacted before model calls. This is not a complete medical-data de-identification system. Use fictional content locally. Live use requires provider/privacy review and `GROQ_LIVE_APPROVED=true`.
- Patient report records, precise browser coordinates, payment credentials and account passwords are not included in model context. Report access uses the original authenticated route.
- The model can suggest opening a form but cannot execute bookings, payments, refunds or account actions. It is instructed not to diagnose, interpret results or recommend treatment. Generated replies may still be inaccurate; authoritative prices and statuses are displayed by the app.
- Enable **Approved websites** on a beta message to retrieve configured HTML pages. This is not a search engine or unrestricted URL browser. User-supplied URLs are not fetched.
- `WEB_SOURCES` is a JSON array of up to three operator-approved HTTPS page URLs, for example `WEB_SOURCES=["https://www.nhs.uk/tests-and-treatments/blood-tests/"]`. `[]` disables it. Sample mode defaults to that NHS page; live mode defaults to no sources.
- Retrieval checks robots rules, public DNS addresses, HTTPS, content type and size. It blocks redirects, IP literals, private networks and nonstandard ports, pins validated DNS addresses for each connection, and extracts text without running scripts. Pages are capped at 128 KiB and excerpts at 4,000 characters. Results and failed attempts are cached for ten minutes.
- Replies show fetched source links and retrieval failures. External page content is treated as untrusted data, not instructions. No login-protected pages or anti-bot bypasses are supported. Operators remain responsible for site terms and permission to retrieve configured pages.

## Location And Appointments

**Use my location** invokes the browser permission prompt only after a click. Denying permission leaves manual city selection available. Geolocation needs HTTPS or a browser-trusted localhost origin. Coordinates are kept only in browser memory and used to rank configured centres by approximate straight-line distance. They are not uploaded to Groq or saved in the database. Changing the city clears them. This is not routing distance or a map search for every nearby clinic.

**Book appointment** opens city, centre, test, date and time controls. The price comes from the server catalogue, not the model or browser. Confirming creates a pending reservation; completing payment confirms it. **My appointments** supports payment, refresh, cancellation of unpaid/sample reservations, and changing location/time while retaining the same test and price. A pending Stripe checkout must be completed or cancelled before rescheduling. Paid cancellations/refunds go to support and are not automatically refunded by this app.

Sample centres have approximate city-area coordinates and generated weekday/Saturday slots for the next 14 days. They are fictional appointments, not bookings with real clinics. Times use Asia/Kolkata. The slot constraint allows one active appointment per centre/time. Users may hold up to five future appointments. Unpaid reservations without a checkout expire after 30 minutes when booking APIs are accessed. Stripe checkout reservations expire through a signed webhook or user-triggered refresh after Stripe reports expiration.

Live catalogues need `city`, optional public `latitude`/`longitude`, and a `slots` array of ISO timestamps on each centre, plus test prices in INR. Only configured future slots within 30 days are offered in live mode. This app manages its own inventory; synchronization with a lab scheduling platform, clinic staffing/capacity and notifications are not implemented. Configure and review those operational requirements before offering real appointments.

## Payment Modes

`PAYMENT_MODE=demo` is the local default. **Sample payment** and **Simulate payment** create a `simulated` payment state. They do not contact a gateway, request a card or move money. Demo payment is prohibited in live data mode.

For actual gateway testing, provision a Stripe account and configure these values privately in `.env`:

```dotenv
PAYMENT_MODE=stripe
STRIPE_SECRET_KEY=<your Stripe test secret>
STRIPE_WEBHOOK_SECRET=<your webhook signing secret>
APP_ORIGIN=http://127.0.0.1:3000
```

Use an origin matching the printed server URL. Sample data accepts only `sk_test_` keys. Secrets never go to browser JavaScript. If Stripe is unavailable in your business region/account, use another supported gateway; an account cannot be provisioned by this application.

Forward Stripe events during local testing with the Stripe CLI:

```powershell
stripe listen --forward-to http://127.0.0.1:3000/api/payments/webhook
```

Enter the signing secret printed by the CLI directly into your local configuration, then restart the app. Keep the listener running. Use Stripe's documented test payment methods only in test mode. In deployed environments, register an HTTPS webhook endpoint for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`.

Checkout uses a server-owned INR amount, a generic reservation description and an opaque booking ID. Test names and patient profiles are not passed to Stripe. A success-page URL never proves payment. Confirmation requires either a verified Stripe signature or authenticated server-to-server retrieval, matched against checkout ID, booking ID, exact amount, currency and test/live mode. Database state transitions and checkout creation are idempotent.

Live money requires a supported, activated merchant account, live credentials, live data configuration, HTTPS and webhook delivery. Review tax/invoice requirements, refund policy, privacy, retention and reconciliation before activation. Automatic refunds, chargeback handling and external refund synchronization are not implemented. `PAYMENT_MODE=disabled` permits pending reservations but does not offer payment or mark them confirmed.

## Themes

The sun/moon button in the header switches between light and dark themes on both patient and operator pages. The initial theme follows the browser's system preference. An explicit choice is saved locally, survives refresh, and synchronizes between tabs on the same origin. No account or server setting is changed. Guided and Assistant use a two-segment switch; the separate Beta badge identifies the assistant's release status.

## Inspect Database Data

The operator dashboard shows appointments, payment states, support requests and audit events while the app is running. For table rows, use the read-only CLI below from the app folder.

Local storage is PGlite, an embedded PostgreSQL engine, not a PostgreSQL TCP server. pgAdmin, psql and ordinary VS Code PostgreSQL connections cannot connect directly to it. The normal app stores files in `.data/postgres`; the separate port-3001 preview uses `.data/beta-preview/postgres`. Do not open or edit those internal files manually, and do not delete the accompanying encryption key.

Stop the server using the target directory with Ctrl+C before inspection. Embedded storage allows only one process at a time. The inspector refuses to open an active database and does not run schema migrations.

```powershell
# Default database: list table counts, then inspect the newest bookings.
npm run db:inspect
npm run db:inspect -- bookings

# Separate beta preview database: same operations, using its own data directory.
npm run db:inspect -- --preview
npm run db:inspect -- --preview bookings
npm run db:inspect -- --preview users
npm run db:inspect -- --preview audit_logs
```

Available tables: `users`, `sessions`, `bookings`, `audit_logs`, `tickets`, `ticket_messages`. Output is limited to the newest 25 rows of the selected table. Password hashes, profile ciphertext, verification/reset tokens, session tokens/CSRF, encrypted conversations and message bodies are excluded. Prices are stored in minor currency units: `20000` paise means INR 200. This command reads existing data; it cannot modify records or run arbitrary SQL.

Restart the app after inspection. To restart against the preview data in PowerShell:

```powershell
$env:PORT = '3001'
$env:DATA_DIR = Join-Path $PWD '.data/beta-preview'
npm run dev
```

For a normal PostgreSQL client, configure `DATABASE_URL` to point to a separately provisioned PostgreSQL server, then connect the client to that server with your own credentials. Switching `DATABASE_URL` does not automatically migrate PGlite data. The inspection command also supports an existing external database through `DATABASE_URL`; `--preview` always selects the local preview instead.

## Validation

Run `npm test` and `npm run lint`. Tests cover history isolation, known-identifier redaction, malformed model replies, blocked network destinations, robots handling, slot conflicts, server-side pricing, booking ownership, idempotency, simulation separation, signature rejection, amount mismatch and duplicate payment events. Gateway API behavior is tested with injected responses and signed synthetic events; a merchant-account end-to-end payment test still requires your Stripe test credentials.

The original documents describe earlier WhatsApp designs. This file documents the implemented web beta. No regulatory compliance certification is claimed.