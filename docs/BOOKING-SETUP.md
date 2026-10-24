# Electric Crew DJ Booking System — setup

Two parts, one shared database:

| Part | What it does | Where it runs |
|---|---|---|
| `bot/` | Discord bot. `/event create` asks for name, info, VRChat world, date, then **what time slots you need**, then posts the event with one button per slot. DJs click a slot → "Thanks, you're booked for …". The post updates live. | A small Node host (Railway, Render, Fly, a VPS, or your own PC) |
| `bookings.html` | Website page. Shows the same events live (times in the visitor's own time zone, picker to switch), lets people book from the site too, and keeps every past event as an archive. | This repo's GitHub Pages site |
| `firestore.rules` | Security rules for the shared database. | Firebase console |

Bookings made in Discord appear on the site instantly; bookings made on the site update the Discord post instantly (the bot listens for changes).

---

## 1. Firebase (free, ~5 min)

1. Go to https://console.firebase.google.com → **Add project** → name it `electric-crew-bookings` (Analytics off is fine).
2. Left menu **Build → Firestore Database → Create database** → choose a region near your crew (e.g. `us-east1`) → start in **production mode**.
3. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, click **Publish**.
4. **Project settings (gear) → General → Your apps → `</>` Web** → register app (name: `website`) → copy the `firebaseConfig` block.
   Paste its values into `js/firebase-config.js` (already done for this project).
5. **Project settings → Service accounts → Generate new private key** → download the JSON → save it as `bot/serviceAccount.json`. **Keep this file private** (it's the bot's master key).

## 2. Discord bot

1. https://discord.com/developers/applications → **New Application** → name `Electric Crew Bookings`.
2. **Bot** tab → **Reset Token** → copy it. (No privileged intents needed.)
3. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`; bot permissions: *Send Messages, Embed Links, Read Message History*. Open the generated URL and add the bot to your server.
4. In `bot/`: copy `.env.example` → `.env` and fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` (General Information → Application ID), `DISCORD_GUILD_ID` (right-click server → Copy Server ID; enable Developer Mode in Discord settings if you don't see it), `ORGANIZER_ROLE` (the role allowed to create events), and `SITE_URL` (e.g. `https://electriccrewvr.xyz/bookings`).
5. Run it:
   ```bash
   cd bot
   npm install
   npm run deploy     # registers /event commands (run once)
   npm start
   ```
   Hosting for 24/7: Railway or Render free tiers work — point them at the `bot/` folder, start command `npm start`, add the `.env` values as environment variables, and upload `serviceAccount.json` (or paste its JSON into a variable and change `FIREBASE_SERVICE_ACCOUNT` logic accordingly).

### Using it
- `/event create` → fill in **name, info, world/group, date, time zone** → click **Set up time slots** → enter **start time, slot length, number of slots** (or type custom slots like `21:00-22:30` one per line) → the bot posts the event.
- DJs click **Slot N** → ephemeral "🎉 Thanks, you're booked for Sat Oct 31, 9:00 PM – 10:00 PM at <world>". Every time shows in each person's own time zone automatically (Discord timestamps).
- Clicking your own slot again unbooks you. One slot per DJ per event.
- `/event list` — upcoming events and open slots. `/event unbook event_id slot` and `/event cancel event_id` — organizers only (event ID is in the post footer).

## 3. Website

The booking page is `bookings.html` in this repo and is already live. It reads the same Firestore database as the bot, so there is nothing to add by hand. Firebase is connected in `js/firebase-config.js`.

Optional: set `DISCORD_WEBHOOK` in `js/firebase-config.js` to post a note when someone books from the website (Server Settings → Integrations → Webhooks). Anyone can read a webhook URL from page source, so use a channel you don't mind getting spammed in, and rotate it if abused.

## Notes
- Max 25 slots per event (Discord's button limit).
- Past events never get deleted — they drop into the **Past events** section on the site automatically once the last slot ends. Cancelled events show as cancelled there too.
- Website bookings are stored with the DJ name + Discord username they type; Discord bookings store the user's Discord ID so the lineup shows an @mention.
