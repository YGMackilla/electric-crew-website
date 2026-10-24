// Electric Crew LGBTQ — DJ set-slot booking bot
// Flow: /event create -> event details modal -> "Set up time slots" button -> slots modal
//       -> bot posts the event with one button per slot -> DJs click to book (click again to unbook)
//       -> every change updates the post live and is mirrored on the website (shared Firebase database).
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  Client, GatewayIntentBits, Events, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, MessageFlags,
} from "discord.js";
import admin from "firebase-admin";

// ---------- Firebase ----------
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, "utf8"))),
});
const db = admin.firestore();
const events = db.collection("events");

// ---------- Discord ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const SITE_URL = process.env.SITE_URL || "";
const MAX_SLOTS = 25; // Discord allows 25 buttons per message
const BRAND = 0xff2d95;

// ---------- Time helpers (no extra libraries) ----------
function tzOffsetMs(utcMs, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - utcMs;
}
// "2026-10-25 21:00" in tz -> UTC ms
function localToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  guess -= tzOffsetMs(guess, tz);
  guess = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(guess, tz);
  return guess;
}
function validTz(tz) { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; } }
const ts = (ms, style = "F") => `<t:${Math.floor(ms / 1000)}:${style}>`;

// ---------- Permissions ----------
function isOrganizer(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageEvents) || member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const role = process.env.ORGANIZER_ROLE?.trim();
  return role ? member.roles.cache.some(r => r.name === role) : false;
}

// ---------- Event post rendering ----------
function buildEmbed(ev) {
  const open = ev.slots.filter(s => !s.dj).length;
  const lineup = ev.slots.map(s => {
    const who = s.dj ? (s.dj.discordId ? `<@${s.dj.discordId}>` : `**${s.dj.name}**`) : "🟢 OPEN";
    return `**#${s.n}**  ${ts(s.start, "t")} – ${ts(s.end, "t")}  →  ${who}`;
  }).join("\n");
  const e = new EmbedBuilder()
    .setColor(ev.status === "cancelled" ? 0x777777 : BRAND)
    .setTitle(`${ev.status === "cancelled" ? "❌ CANCELLED — " : "🎧 "}${ev.name}`)
    .setDescription(ev.info || null)
    .addFields(
      { name: "📅 When", value: `${ts(ev.start, "F")} → ${ts(ev.end, "t")}\n(${ts(ev.start, "R")}, shown in **your** time zone)` },
      { name: "🌐 World / Group", value: ev.world || "TBA" },
      { name: `🎚️ DJ Slots — ${open} open`, value: lineup.slice(0, 1024) },
    )
    .setFooter({ text: `Click a slot to book it · click yours again to unbook · Event ID: ${ev.id}` });
  if (SITE_URL) e.setURL(SITE_URL);
  return e;
}
function buildButtons(ev) {
  const over = Date.now() > ev.end || ev.status === "cancelled";
  const rows = [];
  for (let i = 0; i < ev.slots.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ev.slots.slice(i, i + 5).map(s => new ButtonBuilder()
        .setCustomId(`claim:${ev.id}:${s.n}`)
        .setLabel(`Slot ${s.n}`)
        .setStyle(s.dj ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(over)),
    ));
  }
  return rows;
}
const refreshing = new Map();
async function refreshPost(ev) {
  if (!ev.channelId || !ev.messageId) return;
  if (refreshing.get(ev.id)) return; // debounce
  refreshing.set(ev.id, true);
  setTimeout(() => refreshing.delete(ev.id), 1500);
  try {
    const ch = await client.channels.fetch(ev.channelId);
    const msg = await ch.messages.fetch(ev.messageId);
    await msg.edit({ embeds: [buildEmbed(ev)], components: buildButtons(ev) });
  } catch (err) { console.error("refreshPost", ev.id, err.message); }
}

// ---------- Modals ----------
function detailsModal() {
  return new ModalBuilder().setCustomId("ev:details").setTitle("New Event — details").addComponents(
    row(new TextInputBuilder().setCustomId("name").setLabel("Event name").setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true)),
    row(new TextInputBuilder().setCustomId("info").setLabel("Event info / description").setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(false)),
    row(new TextInputBuilder().setCustomId("world").setLabel("VRChat world or group (name or link)").setStyle(TextInputStyle.Short).setMaxLength(300).setRequired(true)),
    row(new TextInputBuilder().setCustomId("date").setLabel("Date (YYYY-MM-DD)").setStyle(TextInputStyle.Short).setPlaceholder("2026-10-31").setRequired(true)),
    row(new TextInputBuilder().setCustomId("tz").setLabel("Your time zone (IANA name)").setStyle(TextInputStyle.Short).setValue("America/New_York").setRequired(true)),
  );
}
function slotsModal(draftId) {
  return new ModalBuilder().setCustomId(`ev:slots:${draftId}`).setTitle("What time slots do you need?").addComponents(
    row(new TextInputBuilder().setCustomId("start").setLabel("First slot starts at (HH:MM, 24h)").setStyle(TextInputStyle.Short).setPlaceholder("21:00").setRequired(true)),
    row(new TextInputBuilder().setCustomId("len").setLabel("Slot length in minutes").setStyle(TextInputStyle.Short).setValue("60").setRequired(true)),
    row(new TextInputBuilder().setCustomId("count").setLabel(`How many slots? (1–${MAX_SLOTS})`).setStyle(TextInputStyle.Short).setValue("4").setRequired(true)),
    row(new TextInputBuilder().setCustomId("custom").setLabel("OR custom slots, one per line: HH:MM-HH:MM").setStyle(TextInputStyle.Paragraph).setPlaceholder("21:00-22:30\n22:30-23:30\n(leave empty to use length × count)").setRequired(false)),
  );
}
const row = c => new ActionRowBuilder().addComponents(c);
const drafts = new Map(); // draftId -> details (lives only until slots are submitted)

// ---------- Interactions ----------
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === "event") return handleCommand(i);
    if (i.isModalSubmit() && i.customId === "ev:details") return handleDetails(i);
    if (i.isButton() && i.customId.startsWith("ev:setup:")) {
      const draftId = i.customId.split(":")[2];
      if (!drafts.has(draftId)) return i.reply({ content: "That draft expired — run `/event create` again.", flags: MessageFlags.Ephemeral });
      return i.showModal(slotsModal(draftId));
    }
    if (i.isModalSubmit() && i.customId.startsWith("ev:slots:")) return handleSlots(i);
    if (i.isButton() && i.customId.startsWith("claim:")) return handleClaim(i);
  } catch (err) {
    console.error(err);
    const payload = { content: "Something went wrong — try again in a moment.", flags: MessageFlags.Ephemeral };
    if (i.deferred || i.replied) i.followUp(payload).catch(() => {}); else i.reply(payload).catch(() => {});
  }
});

async function handleCommand(i) {
  const sub = i.options.getSubcommand();
  if (sub === "create") {
    if (!isOrganizer(i.member)) return i.reply({ content: "Only event organizers can create events.", flags: MessageFlags.Ephemeral });
    return i.showModal(detailsModal());
  }
  if (sub === "list") {
    const snap = await events.where("status", "==", "open").get();
    const upcoming = snap.docs.filter(d => d.data().end > Date.now()).sort((a, b) => a.data().start - b.data().start).slice(0, 15);
    if (!upcoming.length) return i.reply({ content: "No upcoming events yet.", flags: MessageFlags.Ephemeral });
    const lines = upcoming.map(d => { const e = d.data(); const open = e.slots.filter(s => !s.dj).length; return `• **${e.name}** — ${ts(e.start, "f")} — ${open}/${e.slots.length} slots open${e.channelId ? ` — https://discord.com/channels/${e.guildId}/${e.channelId}/${e.messageId}` : ""}`; });
    return i.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  }
  if (sub === "cancel" || sub === "unbook") {
    if (!isOrganizer(i.member)) return i.reply({ content: "Organizers only.", flags: MessageFlags.Ephemeral });
    const id = i.options.getString("event_id").trim();
    const ref = events.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return i.reply({ content: "No event with that ID.", flags: MessageFlags.Ephemeral });
    if (sub === "cancel") {
      await ref.update({ status: "cancelled" });
      await refreshPost({ id, ...doc.data(), status: "cancelled" });
      return i.reply({ content: `Cancelled **${doc.data().name}**.`, flags: MessageFlags.Ephemeral });
    }
    const n = i.options.getInteger("slot");
    const ev = doc.data();
    const slot = ev.slots.find(s => s.n === n);
    if (!slot) return i.reply({ content: "No slot with that number.", flags: MessageFlags.Ephemeral });
    slot.dj = null;
    await ref.update({ slots: ev.slots });
    await refreshPost({ id, ...ev });
    return i.reply({ content: `Slot ${n} is open again.`, flags: MessageFlags.Ephemeral });
  }
}

async function handleDetails(i) {
  const f = k => i.fields.getTextInputValue(k).trim();
  const tz = f("tz");
  const date = f("date");
  if (!validTz(tz)) return i.reply({ content: `"${tz}" isn't a valid time zone. Examples: America/New_York, America/Los_Angeles, Europe/London, Australia/Sydney.`, flags: MessageFlags.Ephemeral });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return i.reply({ content: "Date must look like 2026-10-31.", flags: MessageFlags.Ephemeral });
  const draftId = `${i.user.id}-${Date.now()}`;
  drafts.set(draftId, { name: f("name"), info: f("info"), world: f("world"), date, tz, createdBy: i.user.id, createdByTag: i.user.tag, guildId: i.guildId, channelId: i.channelId });
  setTimeout(() => drafts.delete(draftId), 15 * 60 * 1000);
  return i.reply({
    content: `**${f("name")}** on ${date} (${tz}) — now tell me what time slots you need.`,
    components: [row(new ButtonBuilder().setCustomId(`ev:setup:${draftId}`).setLabel("Set up time slots").setStyle(ButtonStyle.Primary))],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSlots(i) {
  const draftId = i.customId.split(":")[2];
  const d = drafts.get(draftId);
  if (!d) return i.reply({ content: "That draft expired — run `/event create` again.", flags: MessageFlags.Ephemeral });
  const f = k => i.fields.getTextInputValue(k).trim();
  const custom = f("custom");
  let slots = [];
  if (custom) {
    const lines = custom.split("\n").map(s => s.trim()).filter(Boolean);
    for (const [idx, line] of lines.entries()) {
      const m = line.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
      if (!m) return i.reply({ content: `Couldn't read slot line "${line}". Use HH:MM-HH:MM.`, flags: MessageFlags.Ephemeral });
      let s = localToUtc(d.date, m[1], d.tz), e = localToUtc(d.date, m[2], d.tz);
      if (e <= s) e += 24 * 3600 * 1000;          // crosses midnight
      if (idx > 0 && s < slots[idx - 1].start) s += 24 * 3600 * 1000, e += 24 * 3600 * 1000;
      slots.push({ n: idx + 1, start: s, end: e, dj: null });
    }
  } else {
    const len = parseInt(f("len"), 10), count = parseInt(f("count"), 10);
    const startStr = f("start");
    if (!/^\d{1,2}:\d{2}$/.test(startStr)) return i.reply({ content: "Start time must look like 21:00.", flags: MessageFlags.Ephemeral });
    if (!(len >= 5 && len <= 600)) return i.reply({ content: "Slot length must be 5–600 minutes.", flags: MessageFlags.Ephemeral });
    if (!(count >= 1 && count <= MAX_SLOTS)) return i.reply({ content: `Slot count must be 1–${MAX_SLOTS}.`, flags: MessageFlags.Ephemeral });
    const start0 = localToUtc(d.date, startStr, d.tz);
    for (let k = 0; k < count; k++) slots.push({ n: k + 1, start: start0 + k * len * 60000, end: start0 + (k + 1) * len * 60000, dj: null });
  }
  if (slots.length > MAX_SLOTS) return i.reply({ content: `Max ${MAX_SLOTS} slots per event.`, flags: MessageFlags.Ephemeral });

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  drafts.delete(draftId);
  const ref = events.doc();
  const ev = {
    id: ref.id, name: d.name, info: d.info, world: d.world, tz: d.tz, date: d.date,
    start: slots[0].start, end: slots[slots.length - 1].end, slots,
    status: "open", createdBy: d.createdBy, createdByTag: d.createdByTag, createdAt: Date.now(),
    guildId: d.guildId, channelId: d.channelId, messageId: null,
  };
  const msg = await i.channel.send({ embeds: [buildEmbed(ev)], components: buildButtons(ev) });
  ev.messageId = msg.id;
  await ref.set(ev);
  return i.editReply(`Posted **${ev.name}** with ${slots.length} slots. Event ID \`${ev.id}\` (it's also in the post footer).`);
}

async function handleClaim(i) {
  const [, id, nStr] = i.customId.split(":");
  const n = parseInt(nStr, 10);
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const ref = events.doc(id);
  let result, ev;
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) { result = "missing"; return; }
    ev = { id, ...doc.data() };
    const slot = ev.slots.find(s => s.n === n);
    if (!slot) { result = "missing"; return; }
    if (ev.status !== "open" || Date.now() > ev.end) { result = "closed"; return; }
    if (slot.dj) {
      if (slot.dj.discordId === i.user.id) { slot.dj = null; result = "unbooked"; }
      else { result = "taken"; return; }
    } else {
      if (ev.slots.some(s => s.dj?.discordId === i.user.id)) { result = "already"; return; }
      slot.dj = { name: i.member?.displayName || i.user.username, discordId: i.user.id, discordTag: i.user.tag, source: "discord", claimedAt: Date.now() };
      result = { slot };
    }
    tx.update(ref, { slots: ev.slots });
  });
  if (result === "missing") return i.editReply("That event no longer exists.");
  if (result === "closed") return i.editReply("Bookings for this event are closed.");
  if (result === "taken") return i.editReply("That slot was just taken — grab another open one!");
  if (result === "already") return i.editReply("You already have a slot in this event. Click your slot to unbook first if you want to switch.");
  await refreshPost(ev);
  if (result === "unbooked") return i.editReply(`You've been removed from slot ${n}. It's open again.`);
  const s = result.slot;
  return i.editReply(
    `🎉 **Thanks, ${i.member?.displayName || i.user.username} — you're booked!**\n` +
    `**When:** ${ts(s.start, "F")} – ${ts(s.end, "t")} (${ts(s.start, "R")})\n` +
    `**Where:** ${ev.world}\n**Event:** ${ev.name}` +
    (SITE_URL ? `\nSee the live lineup: ${SITE_URL}` : ""),
  );
}

// ---------- Live mirror: website bookings update the Discord post ----------
client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  events.where("status", "==", "open").onSnapshot(snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === "modified") refreshPost({ id: ch.doc.id, ...ch.doc.data() });
    });
  }, err => console.error("snapshot", err));
});

client.login(process.env.DISCORD_TOKEN);
