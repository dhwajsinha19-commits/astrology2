/* ============================================================
   STARS — a 2D star-field whose stars join into constellations
   around the cursor whenever it moves.
   ============================================================ */
'use strict';

const Stars = (() => {
  const c = document.getElementById('stars'), ctx = c.getContext('2d');
  let W = 0, H = 0, dpr = 1, stars = [], sparks = [], shooters = [];
  const mouse = { x: -9999, y: -9999, last: -1e9, px: 0, py: 0 };
  const RADIUS = 190, LINK = 120;
  const PALETTE = ['255,222,150', '190,178,255', '150,222,255', '255,255,255', '255,190,220'];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(420, Math.round((W * H) / 5200));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.pow(Math.random(), 3) * 1.8,
      tw: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
      depth: 0.25 + Math.random() * 0.75, col: PALETTE[(Math.random() * PALETTE.length) | 0],
    }));
  }
  addEventListener('resize', resize); resize();

  addEventListener('pointermove', e => {
    const now = performance.now();
    const dx = e.clientX - mouse.px, dy = e.clientY - mouse.py;
    mouse.px = mouse.x = e.clientX; mouse.py = mouse.y = e.clientY; mouse.last = now;
    const sp = Math.hypot(dx, dy);
    for (let i = 0, n = Math.min(3, (sp / 14) | 0); i < n; i++) {
      sparks.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 40 - dx * 1.2, vy: (Math.random() - 0.5) * 40 - dy * 1.2, life: 1, col: PALETTE[(Math.random() * 3) | 0] });
    }
    if (sparks.length > 80) sparks.splice(0, sparks.length - 80);
  }, { passive: true });
  addEventListener('pointerleave', () => { mouse.last = -1e9; });

  function draw(dt, t) {
    const now = performance.now();
    const idle = now - mouse.last;
    // strength: full while moving, fades over ~1.4s after the cursor stops
    const s = idle < 250 ? 1 : Math.max(0, 1 - (idle - 250) / 1400);
    ctx.clearRect(0, 0, W, H);

    if (Math.random() < dt * 0.12) shooters.push({ x: Math.random() * W, y: Math.random() * H * 0.5, vx: 500 + Math.random() * 300, vy: 200 + Math.random() * 200, life: 1 });

    const near = [];
    const ox = (mouse.x - W / 2) / W, oy = (mouse.y - H / 2) / H;
    for (const st of stars) {
      st.x += st.vx * dt * st.depth * 0.2; st.y += st.vy * dt * st.depth * 0.2;
      if (st.x < -10) st.x = W + 10; if (st.x > W + 10) st.x = -10; if (st.y < -10) st.y = H + 10; if (st.y > H + 10) st.y = -10;
      const px = st.x - ox * 18 * st.depth, py = st.y - oy * 18 * st.depth;
      st._x = px; st._y = py;
      const d = Math.hypot(px - mouse.x, py - mouse.y);
      const tw = 0.5 + 0.5 * Math.sin(t * st.sp + st.tw);
      let a = 0.25 + 0.55 * tw * st.depth, r = st.r;
      if (s > 0 && d < RADIUS) { const k = (1 - d / RADIUS) * s; a = Math.min(1, a + k * 0.7); r += k * 1.6; near.push(st); st._d = d; }
      ctx.fillStyle = `rgba(${st.col},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill();
      if (r > 1.5) { ctx.fillStyle = `rgba(${st.col},${(a * 0.12).toFixed(3)})`; ctx.beginPath(); ctx.arc(px, py, r * 3.4, 0, 6.2832); ctx.fill(); }
    }

    // ambient faint constellation threads between very close stars
    ctx.lineWidth = 0.6;
    for (let i = 0; i < stars.length; i += 2) {
      const a = stars[i];
      for (let j = i + 1; j < Math.min(stars.length, i + 14); j++) {
        const b = stars[j], d = Math.hypot(a._x - b._x, a._y - b._y);
        if (d < 62) { ctx.strokeStyle = `rgba(190,178,255,${((1 - d / 62) * 0.09).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(a._x, a._y); ctx.lineTo(b._x, b._y); ctx.stroke(); }
      }
    }

    // cursor constellation
    if (s > 0 && near.length) {
      ctx.lineWidth = 1;
      for (const st of near) {
        const k = (1 - st._d / RADIUS) * s;
        ctx.strokeStyle = `rgba(255,222,150,${(k * 0.55).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(st._x, st._y); ctx.stroke();
      }
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          const a = near[i], b = near[j], d = Math.hypot(a._x - b._x, a._y - b._y);
          if (d < LINK) {
            const k = (1 - d / LINK) * s * Math.min(1 - a._d / RADIUS, 1 - b._d / RADIUS) * 1.6;
            ctx.strokeStyle = `rgba(190,178,255,${Math.min(0.6, k * 0.8).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a._x, a._y); ctx.lineTo(b._x, b._y); ctx.stroke();
          }
        }
      }
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 60);
      g.addColorStop(0, `rgba(255,222,150,${(0.22 * s).toFixed(3)})`); g.addColorStop(1, 'rgba(255,222,150,0)');
      ctx.fillStyle = g; ctx.fillRect(mouse.x - 60, mouse.y - 60, 120, 120);
    }

    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life -= dt * 1.6;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      ctx.fillStyle = `rgba(${p.col},${(p.life * 0.8).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.life * 1.4, 0, 6.2832); ctx.fill();
    }
    // shooting stars
    for (let i = shooters.length - 1; i >= 0; i--) {
      const p = shooters[i]; p.life -= dt * 0.9; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) { shooters.splice(i, 1); continue; }
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 0.12, p.y - p.vy * 0.12);
      g.addColorStop(0, `rgba(255,255,255,${p.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); ctx.stroke();
    }
  }
  Stage.onFrame(draw);
  return { draw };
})();
