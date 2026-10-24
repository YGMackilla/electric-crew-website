// Crew board for the arcade. Uses the same Firebase project as the DJ bookings; without it, scores stay on this device.
import { FIREBASE_CONFIG } from "./firebase-config.js";

export const CONFIGURED = !Object.values(FIREBASE_CONFIG).some((v) => String(v).includes("PASTE_ME"));
const SDK = "https://www.gstatic.com/firebasejs/10.14.1";
const LS_BEST = "ec-arcade-best", LS_NAME = "ec-arcade-name", LS_LOCAL = "ec-arcade-board";

let fs = null, db = null, ready = null;
function boot() {
  if (!CONFIGURED) return Promise.resolve(false);
  if (!ready) ready = Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)])
    .then(([{ initializeApp }, store]) => { fs = store; db = store.getFirestore(initializeApp(FIREBASE_CONFIG)); return true; })
    .catch(() => false);
  return ready;
}

const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

export const myBest = () => Number(read(LS_BEST, 0)) || 0;
export const myName = () => read(LS_NAME, "");

export function recordRun(score) {
  const best = myBest(); if (score > best) write(LS_BEST, String(score));
  return score > best;
}

export async function loadBoard() {
  if (!(await boot())) {
    let rows = []; try { rows = JSON.parse(read(LS_LOCAL, "[]")); } catch (e) {}
    return { shared: false, rows };
  }
  const q = fs.query(fs.collection(db, "arcade_scores"), fs.orderBy("score", "desc"), fs.limit(10));
  const snap = await fs.getDocs(q);
  return { shared: true, rows: snap.docs.map((d) => ({ name: d.data().name, score: d.data().score })) };
}

export async function saveScore(name, score, secs) {
  name = String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (!name) throw new Error("Type a name or handle for the board.");
  write(LS_NAME, name);
  secs = Math.min(45, Math.max(5, Math.round(secs)));
  if (!(await boot())) {
    let rows = []; try { rows = JSON.parse(read(LS_LOCAL, "[]")); } catch (e) {}
    rows.push({ name, score }); rows.sort((a, b) => b.score - a.score);
    write(LS_LOCAL, JSON.stringify(rows.slice(0, 10)));
    return;
  }
  await fs.addDoc(fs.collection(db, "arcade_scores"), { name, score, secs, at: fs.serverTimestamp() });
}
