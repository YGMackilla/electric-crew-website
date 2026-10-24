# Electric Crew LGBTQ website

A clean, fast, static site (no build step, no server). Pages: Home, Events, DJ Booking, Arcade, Community, About, Contact, Terms, Privacy, and a 404. Every page from the old Manus site is here, at the same address (`/events`, `/arcade`, `/contact`, `/terms`, `/privacy` and so on), plus the new DJ Booking page.

## Edit content
- Links (Discord, VRChat group, Instagram, TikTok): `js/site.js`. TikTok is empty because the old site never had a working link; paste the profile URL into `LINKS.tiktok` and it appears in the footer and on Contact.
- Community nights, regular events, history, crew, story: `js/content.js`
- Colors, type, spacing: `css/site.css` (tokens at the top)

## DJ booking and live events
The booking page and the events page read the same Firestore `events` collection that the Discord bot writes.
1. Create a Firebase project and a Firestore database, then publish `firestore.rules`.
2. Paste your web app config into `js/firebase-config.js`. Until then the site shows clearly labelled sample events.
3. Run the Discord bot in `bot/` (see `docs/BOOKING-SETUP.md`). Hosts type `/event create`; DJs claim slots on Discord or on the site.

### Arcade crew board
The arcade uses the same Firebase project: scores go in a `arcade_scores` collection (name, score, run length), protected by the rules in `firestore.rules`. Republish the rules after pulling this version. Without Firebase the board keeps scores on the visitor's own device.

### Contact form
The Contact page shows Discord and Instagram buttons. To also show a message form, put a Discord webhook URL in `DISCORD_WEBHOOK` in `js/firebase-config.js`; messages then land in the channel that webhook points at. Note that a webhook URL in a public site can be found by anyone, so use a private staff channel you can lock down or regenerate.

Never commit `bot/.env` or `serviceAccount.json`.

## Publish
Any static host works. For GitHub Pages: push this folder to a repo, then Settings > Pages > Deploy from branch `main`, folder `/ (root)`.
The 404 page loads its styles from the site root (`/css/site.css`), so it needs the custom domain at the root (or a repo named like your domain), not a `username.github.io/repo/` address. Everything else works from any path.
Keep the old site running until the new one is checked, then point `electriccrewvr.xyz` at it.

## Not carried over yet
- The arcade is rebuilt without the old 3D engine and sign-in: same 45-second three-lane rules, new canvas look, no login needed to post a score.
- Automatic Discord event sync (the new booking bot covers events that hosts create with `/event create`).
- The old site's artwork files. Add event-night art to `assets/` and reference it in `js/content.js`.
