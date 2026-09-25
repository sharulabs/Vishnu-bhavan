# Vishnu Bhavan · Toongabbie

React website with a Node.js/Express booking-request service. This project is separate from the NexMop Flutter application. No Supabase or Flutter files were changed.

## Run locally

Requires Node 22.13 or newer (built-in `node:sqlite`; experimental warning on Node 22 is expected).

```sh
npm install
npm run dev
```

Open http://localhost:3000. One server runs both React and the API.

```sh
npm test
npm run build
npm start
```

## What works

- Responsive restaurant home page, accessible mobile navigation, category-filtered menu and source links.
- Contact, Google Maps directions and delivery menu links.
- Booking requests saved durably to `data/bookings.sqlite`, with server-side validation, Sydney dates/times, consent, size limits, rate limiting, duplicate-submit protection and idempotent retries.
- Booking errors and pending-success states. No request is presented as a confirmed reservation.

## Before accepting real bookings

The default is **preview mode**: submissions are saved locally and **not sent to the restaurant**. The interface explicitly explains this. No real reservation is made.

1. Verify the restaurant's contact details, opening hours, dine-in prices and permission to use its branding. Current information is from public third-party listings, not a restaurant-approved content pack.
2. Deploy the Node server to a host with a persistent disk; set `DATA_DIR` to that disk. Use a single instance for this SQLite implementation. Bind `HOST=0.0.0.0` if required by the host and provide HTTPS at the reverse proxy.
3. Connect a restaurant-approved HTTPS booking webhook and set `BOOKING_WEBHOOK_URL`, optional `BOOKING_WEBHOOK_TOKEN`, `PUBLIC_ORIGIN` and `BOOKING_MODE=live`. Live startup is blocked without a webhook and origin.
4. The webhook receives contact details, requested date/time, guest count, notes, reference and pending status. It must deduplicate by the `Idempotency-Key` header (booking reference), route to restaurant staff and respond with 2xx only after accepting delivery. Staff confirmation happens in that external booking workflow. There is no email provider or staff admin portal configured in this project.
5. Agree on booking slots and capacity with the restaurant. This is a **request workflow**, not a real-time table inventory system. Wednesday is excluded based on public listings; slots run 9 am–7 pm within the overlap of listed hours. Confirm these settings before launch.
6. Put appropriate retention, backups, file access controls and monitoring in place for contact data. The SQLite file is private server storage, never served to browsers. There is no public booking-list API. Production rate limiting is currently per process/IP; configure trusted proxies carefully and use shared limiting before scaling.
7. Add restaurant-approved privacy information and replace illustrative food photography if actual restaurant images are available.

Variables can be set by your host or loaded with `node --env-file=.env server/index.js --production`. `.env` is ignored. The project does not automatically load it with `npm start`.

## Sources and content notes

Researched 25 September 2026:

- Address, telephone and Wednesday closure: [Zmenu listing](https://www.zmenu.com/vishnu-bhavan-vegetarian-restaurant-toongabbie-toongabbie-online-menu/): 5A Portico Parade, Toongabbie NSW 2146; (02) 9682 6926. Listed trading hours 7:30 am–9 pm except Wednesday.
- Selected menu names and AUD prices: [Uber Eats restaurant menu](https://www.ubereats.com/au/store/vishnu-bhavan-toongabbie/mN36-mg2SzCTQXKI4HmDoA). Delivery hours show 9 am–8 pm except Wednesday. Because sources disagree, the website tells guests to call for hours. Online delivery prices are explicitly indicative, not claimed as dine-in prices. Descriptions are original summaries, not claims about recipe/allergen composition.
- Hero photograph: [Zoshua Colah on Unsplash](https://unsplash.com/photos/a-delicious-dosa-is-served-with-sides-3qHDm3IQCUs), under the [Unsplash License](https://unsplash.com/license). This depicts food at another venue and is labelled **illustrative food photography**. It is not represented as a photograph of Vishnu Bhavan.
- Typeface: DM Sans and Playfair Display via Google Fonts, with system fallbacks.

## Architecture

`src/main.jsx` owns presentation and form interaction; `src/menu.js` contains the sourced menu. `server/booking.js` handles validation and SQLite persistence. `server/app.js` owns HTTP routes and request delivery. `server/index.js` connects the app to Vite for development or serves the built React site in production.

No deployment has been performed. The Sites host uses a Worker runtime rather than the requested persistent Node.js server; deploy this project to a Node-compatible host.
