// Live events and DJ slot booking. Uses Firestore when configured, otherwise a local demo with sample events.
import { FIREBASE_CONFIG, DISCORD_WEBHOOK } from "./firebase-config.js";

export const CONFIGURED = !Object.values(FIREBASE_CONFIG).some((v) => String(v).includes("PASTE_ME"));
const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

let EVENTS = [];
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(EVENTS));

// ---- demo data (only used before Firebase is configured) ----
function demoEvents() {
  const H = 3600e3, now = Date.now();
  const mk = (id, name, info, world, startOffsetH, slotCount, names) => {
    const start = Math.ceil((now + startOffsetH * H) / (30 * 60e3)) * 30 * 60e3;
    const slots = Array.from({ length: slotCount }, (_, i) => ({
      n: i + 1, start: start + i * H, end: start + (i + 1) * H,
      dj: names[i] ? { name: names[i], discord: null, source: "demo", claimedAt: now } : null,
    }));
    return { id, name, info, world, tz: "America/Los_Angeles", status: "open", start, end: start + slotCount * H, slots };
  };
  return [
    mk("demo-1", "Rave Night (sample)", "Sample event shown until the booking database is connected.\nBring your best glow.", "VRChat group: Electric Crew", 30, 4, ["DJ Pandatron", "", "", ""]),
    mk("demo-2", "Pride Dance Party (sample)", "Another sample event. Real events appear here as soon as hosts create them in Discord.", "Sunset Voyage, VRChat", 126, 5, ["", "", "", "", ""]),
  ];
}

// ---- Firestore ----
let fs = null, db = null;
async function boot() {
  if (!CONFIGURED) { EVENTS = demoEvents(); emit(); return; }
  try {
    const [{ initializeApp }, store] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)]);
    fs = store; db = store.getFirestore(initializeApp(FIREBASE_CONFIG));
    store.onSnapshot(store.collection(db, "events"), (snap) => {
      EVENTS = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => Array.isArray(e.slots));
      emit();
    }, (err) => { listeners.forEach((fn) => fn(null, err)); });
  } catch (err) { listeners.forEach((fn) => fn(null, err)); }
}
boot();

export function subscribe(fn) { listeners.add(fn); if (EVENTS.length || !CONFIGURED) fn(EVENTS); return () => listeners.delete(fn); }

export const isUpcoming = (e, now = Date.now()) => e.status === "open" && e.end > now;
export const isLive = (e, now = Date.now()) => isUpcoming(e, now) && e.start <= now;

export async function bookSlot(eventId, n, name, discord) {
  const claim = { name, discord: discord || null, source: "web", claimedAt: Date.now() };
  if (!CONFIGURED) {
    const e = EVENTS.find((x) => x.id === eventId); const s = e?.slots.find((x) => x.n === n);
    if (!s) throw new Error("Event not found.");
    if (s.dj) throw new Error("That slot was just taken. Pick another one.");
    s.dj = claim; emit(); return { e, slot: s };
  }
  const ref = fs.doc(db, "events", eventId);
  const out = await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists()) throw new Error("Event not found.");
    const e = snap.data(); const slot = e.slots.find((s) => s.n === n);
    if (e.status !== "open" || Date.now() > e.end) throw new Error("Bookings are closed for this event.");
    if (slot.dj) throw new Error("That slot was just taken. Pick another one.");
    slot.dj = claim; tx.update(ref, { slots: e.slots }); return { e, slot };
  });
  notify(`🎧 **${name}**${discord ? ` (@${discord})` : ""} booked slot ${n} of **${out.e.name}** from the website. <t:${Math.floor(out.slot.start / 1000)}:F>`);
  return out;
}

export async function unbookSlot(eventId, n) {
  if (!CONFIGURED) { const s = EVENTS.find((x) => x.id === eventId)?.slots.find((x) => x.n === n); if (s) s.dj = null; emit(); return; }
  const ref = fs.doc(db, "events", eventId);
  await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref); const e = snap.data(); const slot = e.slots.find((s) => s.n === n);
    if (slot.dj) slot.dj = null; tx.update(ref, { slots: e.slots });
  });
}

function notify(content) {
  if (!DISCORD_WEBHOOK) return;
  fetch(DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => {});
}

// what this browser has booked, so it can show "you" and offer "unbook me"
export const mine = (() => { try { return JSON.parse(localStorage.getItem("ec_mine") || "{}"); } catch (e) { return {}; } })();
export const saveMine = () => { try { localStorage.setItem("ec_mine", JSON.stringify(mine)); } catch (e) {} };
