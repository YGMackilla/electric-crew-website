// Shared header, footer, theme toggle and small helpers. Edit LINKS and NAV once; every page updates.
export const LINKS = {
  discord: "https://discord.gg/uubT9dKxT",
  instagram: "https://instagram.com/electriccrewlgbtq",
  vrchat: "https://vrc.group/ELCREW.6140",
  trevor: "https://www.thetrevorproject.org",
  // The old site listed TikTok as @electriccrewlgbtq but never had a working link. Paste the real profile URL
  // here (for example https://www.tiktok.com/@yourname) and it shows up in the footer and on Contact.
  tiktok: "",
};
// Absolute base of the site, so links and images work from any page depth (including the 404 page).
export const BASE = new URL("../", import.meta.url).href;
const NAV = [
  ["Home", "index.html"],
  ["Events", "events.html"],
  ["DJ Booking", "bookings.html"],
  ["Arcade", "arcade.html"],
  ["Community", "community.html"],
  ["About", "about.html"],
  ["Contact", "contact.html"],
];

const norm = (p) => (p.split("/").pop() || "index").replace(/\.html$/, "");
const here = norm(location.pathname);

function header() {
  const discordLink = `<a class="nav-discord" href="${LINKS.discord}" target="_blank" rel="noopener">Join Discord</a>`;
  const links = NAV.map(([label, href]) => `<a href="${BASE}${href}"${norm(href) === here ? ' aria-current="page"' : ""}>${label}</a>`).join("") + discordLink;
  return `
  <a class="skip" href="#main">Skip to content</a>
  <div class="pride-bar" aria-hidden="true"></div>
  <header class="site"><div class="wrap">
    <a class="brand" href="${BASE}index.html"><img src="${BASE}assets/icon.webp" alt="" width="40" height="40"><span>Electric Crew</span></a>
    <nav class="main" id="nav" aria-label="Main">${links}</nav>
    <div class="nav-tools">
      <button class="icon-btn" id="theme" type="button" aria-label="Switch light or dark theme" title="Switch theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg></button>
      <a class="btn primary small" href="${LINKS.discord}" target="_blank" rel="noopener">Join Discord</a>
      <button class="icon-btn menu-btn" id="menu" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div></header>`;
}

function footer() {
  return `
  <footer class="site"><div class="wrap">
    <div class="stack" style="gap:10px">
      <a class="brand" href="${BASE}index.html"><img src="${BASE}assets/icon.webp" alt="" width="40" height="40"><span>Electric Crew LGBTQ</span></a>
      <p style="color:var(--ink-soft);max-width:36ch">An 18+ LGBTQIA+ and allies community in VRChat. Queer. Fierce. United.</p>
    </div>
    <div><h4>Explore</h4><ul>
      <li><a href="${BASE}events.html">Events</a></li><li><a href="${BASE}bookings.html">DJ booking</a></li>
      <li><a href="${BASE}arcade.html">Arcade</a></li><li><a href="${BASE}community.html">Community</a></li>
      <li><a href="${BASE}about.html">Our story</a></li><li><a href="${BASE}contact.html">Contact</a></li></ul></div>
    <div><h4>Find us</h4><ul>
      <li><a href="${LINKS.discord}" target="_blank" rel="noopener">Discord</a></li>
      <li><a href="${LINKS.vrchat}" target="_blank" rel="noopener">VRChat group</a></li>
      <li><a href="${LINKS.instagram}" target="_blank" rel="noopener">Instagram</a></li>
      ${LINKS.tiktok ? `<li><a href="${LINKS.tiktok}" target="_blank" rel="noopener">TikTok</a></li>` : ""}
      <li><a href="${LINKS.trevor}" target="_blank" rel="noopener">The Trevor Project</a></li></ul></div>
    <p class="fine"><a href="${BASE}terms.html">Terms of Service</a> · <a href="${BASE}privacy.html">Privacy Policy</a> · © 2026 Electric Crew LGBTQ<br>Electric Crew LGBTQ is an 18+ community. If you or someone you know needs support, The Trevor Project offers free, confidential help at any hour.</p>
  </div></footer>`;
}

function mount() {
  document.body.insertAdjacentHTML("afterbegin", header());
  document.body.insertAdjacentHTML("beforeend", footer());
  const nav = document.getElementById("nav");
  const menu = document.getElementById("menu");
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); });
  const root = document.documentElement;
  let saved = null; try { saved = localStorage.getItem("ec-theme"); } catch (e) {}
  if (saved) root.dataset.theme = saved;
  document.getElementById("theme").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark"; root.dataset.theme = next;
    try { localStorage.setItem("ec-theme", next); } catch (e) {}
  });
}
mount();

// ---- helpers shared by the events and booking pages ----
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function localTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
export function fmtDate(ms, tz) { return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(ms)); }
export function fmtTime(ms, tz) { return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms)); }
export function tzLabel(ms, tz) { try { return new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value || tz; } catch (e) { return tz; } }
