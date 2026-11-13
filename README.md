# Roofing website template for Whop

A complete site for a US roofing company, hosted on Whop Websites. It covers the whole money path of a roofing job: inspection fee, project deposit with the card kept on file, and a final invoice for the balance.

Northgable Roofing is a made-up company. Replace its reviews and credentials with real ones before showing the site to customers.

## Make it yours

Nothing structural changes when you swap the company.

| To change | Edit |
| - | - |
| Name, phone, hours, services, service area, reviews, all page copy | `src/config/site.ts` |
| Prices and what each plan is called | `src/config/offers.json`, then `pnpm whop:sync` |
| Colors and type | the `@theme` block and the `.theme-sage` / `.theme-bone` tokens in `src/styles.css` |

To set up a new business:

```bash
whop login
```

```bash
whop apps init --app_type website --name "Acme Roofing" --domain acme-roofing --template <this app's id>
```

```bash
rm src/config/whop.generated.json && pnpm whop:sync
```

```bash
whop apps secrets set --secret OFFICE_PASSCODE=choose-a-long-passcode
```

```bash
whop apps deploy
```

## How each Whop feature is used

| Feature | Where |
| - | - |
| Hosting and deploys | `whop apps deploy`, with the `whop()` Vite plugin |
| Products and plans | `scripts/whop-sync.mjs` creates them from `offers.json` |
| `ExpressCheckoutElement` | `src/routes/checkout.$offer.tsx`, for fixed-price services |
| `PaymentElement`, `EmailElement`, `BrandingElement` | `src/components/checkout/PayForms.tsx` |
| Leads API | `src/server/estimate.functions.ts` |
| Setup intent (card on file) | `saveCard` in `src/server/checkout.functions.ts` |
| Deposit charged to the saved card | `chargeDeposit` in the same file |
| Invoices API | `billBalance` in `src/server/office.functions.ts`, used from `/office` |
| Pixel | `src/lib/track.ts` |

Card numbers only ever go into Whop's hosted fields. The server charges plan IDs it looks up itself, so the browser can't set a price.

### The job flow

1. A homeowner requests an estimate. The form creates a Whop lead.
2. They book an inspection or pay a deposit at `/checkout/<offer>`. The deposit first saves the card with a setup intent, then charges the deposit plan to that card.
3. After the walkthrough, staff open `/office`, enter the balance and pick how to collect it:
   - **Charge the card on file**: creates the invoice with `payment_method_id` and issues it.
   - **Email the invoice**: sends it, and the customer pays on Whop's checkout.

Pay-over-time methods such as Klarna, Afterpay and Splitit appear inside the Whop elements once the account is approved for them. No code is needed.

### Estimate form and Whop users

`POST /leads` needs a Whop `user_id`, and a homeowner only has an email. The form first matches an earlier lead or an existing member. For a new contact it creates a draft invoice with `email_address`, which finds or creates the user, then voids that draft straight away. It charges and emails nothing, but each new contact uses up one invoice number.

### Pixel events

| Event | Fires when |
| - | - |
| `service_viewed` | the services section comes into view, or a service is picked |
| `estimate_requested` | a lead has been created |
| `deposit_started` | the deposit checkout opens |
| `view_content`, `lead`, `initiate_checkout` | the standard events alongside those |

Add `?pixel=debug` to any URL to see events as they fire. They also appear in the Whop pixel dashboard about a minute later.

## Deploy to Vercel

The same code also runs on Vercel. Vercel sets `VERCEL=1` during its build, which switches the build to a Nitro server (see `vite.config.ts`), and `vercel.json` already sets the build command.

1. Import this repository in Vercel. No framework preset or build settings are needed.
2. Add the environment variables from `.env.example`. On Vercel, `WHOP_API_KEY` is required: it's a company API key from https://whop.com/dashboard/developer. Whop hosting provides one automatically; other hosts don't.
3. Deploy.

The Whop pixel is added automatically on hosts other than Whop, so the custom events still reach your Whop dashboard. For Apple Pay and Google Pay buttons, register the Vercel domain once:

```bash
whop domains create your-site.vercel.app --apple_pay '{}'
```

`vercel.json` already serves the Apple Pay verification file Whop asks for.

To test a production build locally on Node:

```bash
pnpm build:node && pnpm start:node
```

## Test mode

`?mode=test` runs checkout against Whop's sandbox, where no money moves. It needs a one-time setup with a key from [sandbox.whop.com](https://sandbox.whop.com/dashboard/developer):

```bash
WHOP_SANDBOX_API_KEY=your_key pnpm whop:sync --sandbox
```

```bash
whop apps secrets set --secret WHOP_SANDBOX_API_KEY=your_key
```

```bash
whop apps deploy
```

Then open `/checkout/deposit?mode=test` and pay with card `4242 4242 4242 4242`, any future date and any CVC. The job desk works in test mode too, at `/office?mode=test`, once the sandbox business has completed Whop's account verification; Whop refuses to issue invoices before that.

## Develop

```bash
pnpm install
```

```bash
whop apps dev
```

Built with TanStack Start, React, Tailwind, three.js and Motion. The 3D roof is drawn from primitives and procedural textures, so there are no model files. It falls back to a flat drawing without WebGL and holds still under reduced-motion settings. The sky behind it follows the local time set in `site.ts`; add `?sky=morning`, `day`, `dusk` or `night` to preview one.
