// Charge the Crew: a 45-second three-lane runner. Plain canvas, no engine, no build step.
// Same rules as the original arcade: charge nodes are worth 40, void gates cost one of three shields.
const LANES = [-2.25, 0, 2.25];
const RUN_SECONDS = 45;
const Z_FAR = -27, Z_PLAYER = 1.25, Z_GONE = 5;
const COLORS = ["#ffe14a", "#2fe6ff", "#ff3d8b"];

export function createGame(canvas, onEvent) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let running = false, lane = 1, px = 0;
  let score = 0, shield = 3, left = RUN_SECONDS, spawnCd = 0.4, emitCd = 0, flash = 0, pop = [];
  let things = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(280, Math.round(r.width)); H = Math.max(280, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const snap = () => ({ score, shield, secondsRemaining: Math.max(0, Math.ceil(left)) });
  const emit = (type) => onEvent && onEvent({ type, payload: snap() });

  function reset() {
    things = []; pop = []; lane = 1; px = 0; score = 0; shield = 3; left = RUN_SECONDS; spawnCd = 0.3; emitCd = 0; flash = 0;
    emit("update"); draw();
  }
  function start() { reset(); running = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); canvas.focus(); }
  function stop() { running = false; }
  function move(d) { if (running) lane = Math.max(0, Math.min(2, lane + d)); }

  function spawn() {
    const li = Math.floor(Math.random() * 3);
    const kind = Math.random() > 0.32 ? "charge" : "void";
    things.push({ kind, x: LANES[li], z: Z_FAR, color: kind === "charge" ? COLORS[Math.floor(Math.random() * 3)] : "#8b3dff", spin: Math.random() * 6 });
  }

  function end() { running = false; emit("complete"); draw(); }

  function update(dt) {
    left -= dt; spawnCd -= dt; emitCd -= dt; flash = Math.max(0, flash - dt);
    px += (LANES[lane] - px) * Math.min(1, dt * 11);
    if (spawnCd <= 0) { spawn(); spawnCd = 0.64 + Math.random() * 0.54; }
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i]; t.z += dt * 8.2; t.spin += dt * 2.4;
      if (Math.abs(t.z - Z_PLAYER) < 0.85 && Math.abs(t.x - px) < 0.82) {
        if (t.kind === "charge") { score += 40; pop.push({ x: t.x, z: t.z, text: "+40", color: t.color, age: 0 }); }
        else { shield -= 1; flash = 0.35; pop.push({ x: t.x, z: t.z, text: "−1", color: "#ff5d7a", age: 0 }); }
        things.splice(i, 1);
        if (shield <= 0) { emit("update"); end(); return; }
      } else if (t.z > Z_GONE) things.splice(i, 1);
    }
    pop = pop.filter((p) => (p.age += dt) < 0.7);
    if (emitCd <= 0) { emit("update"); emitCd = 0.12; }
    if (left <= 0) { left = 0; emit("update"); end(); }
  }

  // Perspective: depth 0 is the horizon, 1 is the player's lane line.
  const horizon = () => H * 0.2;
  const depth = (z) => Math.min(1.3, Math.max(0, (z - Z_FAR) / (Z_PLAYER - Z_FAR)));
  const sy = (d) => horizon() + (H * 0.84 - horizon()) * Math.pow(d, 1.7);
  const sc = (d) => 0.07 + 0.93 * Math.pow(d, 1.7);
  const sx = (x, d) => W / 2 + (x / 2.25) * W * 0.27 * sc(d) * 1.35;

  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; }

  function draw() {
    if (!W) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c0820"); g.addColorStop(0.2, "#1a0d3a"); g.addColorStop(0.2, "#0a0916"); g.addColorStop(1, "#05040d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun band on the horizon
    const hz = horizon();
    const sun = ctx.createLinearGradient(0, hz - H * 0.12, 0, hz);
    sun.addColorStop(0, "rgba(255,61,139,0)"); sun.addColorStop(1, "rgba(255,225,74,.5)");
    ctx.fillStyle = sun; ctx.fillRect(0, hz - H * 0.12, W, H * 0.12);

    // road
    ctx.beginPath();
    ctx.moveTo(sx(-4.9, 0), sy(0)); ctx.lineTo(sx(4.9, 0), sy(0)); ctx.lineTo(sx(4.9, 1.15), sy(1.15)); ctx.lineTo(sx(-4.9, 1.15), sy(1.15)); ctx.closePath();
    ctx.fillStyle = "#0e0c20"; ctx.fill();
    // moving cross lines
    const off = (performance.now() / 1000 * 0.9) % 1;
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const d = ((i + off) / 14); const y = sy(d);
      ctx.strokeStyle = `rgba(47,230,255,${0.08 + d * 0.22})`;
      ctx.beginPath(); ctx.moveTo(sx(-4.9, d), y); ctx.lineTo(sx(4.9, d), y); ctx.stroke();
    }
    // lane lines + edges
    [-3.4, -1.125, 1.125, 3.4].forEach((x, i) => {
      ctx.strokeStyle = i === 0 || i === 3 ? "rgba(255,61,139,.7)" : "rgba(47,230,255,.65)"; ctx.lineWidth = 2;
      glow(i === 0 || i === 3 ? "#ff3d8b" : "#2fe6ff", 8);
      ctx.beginPath(); ctx.moveTo(sx(x, 0), sy(0)); ctx.lineTo(sx(x, 1.15), sy(1.15)); ctx.stroke(); noGlow();
    });

    // things, far to near
    things.slice().sort((a, b) => a.z - b.z).forEach((t) => {
      const d = depth(t.z), s = sc(d), x = sx(t.x, d), y = sy(d) - 28 * s, r = 30 * s;
      if (r < 1.5) return;
      ctx.save(); ctx.translate(x, y);
      if (t.kind === "charge") {
        glow(t.color, 18 * s + 4); ctx.fillStyle = t.color; ctx.rotate(Math.sin(t.spin) * 0.35);
        ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
        noGlow(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.35, 0); ctx.lineTo(0, r * 0.2); ctx.lineTo(-r * 0.35, 0); ctx.closePath(); ctx.fill();
      } else {
        glow("#8b3dff", 16 * s + 4); ctx.fillStyle = "#2a0f55"; ctx.strokeStyle = "#8b3dff"; ctx.lineWidth = Math.max(2, 4 * s);
        ctx.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2); ctx.strokeRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2); noGlow();
        ctx.strokeStyle = "#8b3dff"; ctx.lineWidth = Math.max(1.5, 3 * s);
        ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(r * 0.55, r * 0.55); ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.55, r * 0.55); ctx.stroke();
      }
      ctx.restore();
    });

    // player
    const pd = depth(Z_PLAYER), ps = sc(pd), pxs = sx(px, pd), pys = sy(pd) - 22 * ps, pr = 24 * ps;
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(pxs, sy(pd) + 4, pr * 1.1, pr * 0.3, 0, 0, 7); ctx.fill();
    glow(flash > 0 ? "#ff5d7a" : "#ffe14a", 26);
    const pg = ctx.createRadialGradient(pxs - pr * 0.3, pys - pr * 0.3, pr * 0.1, pxs, pys, pr);
    pg.addColorStop(0, "#ffffff"); pg.addColorStop(0.45, flash > 0 ? "#ff8aa0" : "#ffe14a"); pg.addColorStop(1, flash > 0 ? "#b0203f" : "#d99a00");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pxs, pys, pr, 0, 7); ctx.fill(); noGlow();

    // pops
    ctx.font = "800 22px 'Bricolage Grotesque', system-ui, sans-serif"; ctx.textAlign = "center";
    pop.forEach((p) => {
      const d = depth(p.z); ctx.globalAlpha = 1 - p.age / 0.7; ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx(p.x, d), sy(d) - 70 * sc(d) - p.age * 50); ctx.globalAlpha = 1;
    });
    if (flash > 0) { ctx.fillStyle = `rgba(255,61,100,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  }

  function frame(now) {
    if (!running) { draw(); return; }
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    update(dt); draw();
    if (running) raf = requestAnimationFrame(frame);
  }

  // input
  const onKey = (e) => {
    if (!running) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { move(-1); e.preventDefault(); }
    if (k === "arrowright" || k === "d") { move(1); e.preventDefault(); }
  };
  let sx0 = 0, sy0 = 0;
  canvas.addEventListener("pointerdown", (e) => { sx0 = e.clientX; sy0 = e.clientY; });
  canvas.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx0;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(e.clientY - sy0)) move(dx > 0 ? 1 : -1);
    else if (Math.abs(dx) < 10) { const r = canvas.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); }
  });
  window.addEventListener("keydown", onKey);
  new ResizeObserver(resize).observe(canvas);
  resize(); reset();
  return { start, stop, move, resize };
}
