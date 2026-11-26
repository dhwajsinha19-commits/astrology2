/* ============================================================
   PICKER — a 3D birth-date selector made of three rotating
   drums (year · month · day) that detonates when you reveal.
   ============================================================ */
'use strict';

const Picker = (() => {
  const el = document.getElementById('pickerView');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const FOV = 38;
  let camDist = 10;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const minYear = 1900, maxYear = new Date().getFullYear();
  const R = 3.7, STEP = 0.4, ITEM_H = 1.1, VIS = 5, POOL = VIS * 2 + 1, TEX = 200;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const GOLD = new THREE.Color(0xffd36b), DIM = new THREE.Color(0x8d84c9), WHITE = new THREE.Color(0xffffff);

  const sel = { year: 2000, month: 6, day: 15 };
  const cols = [
    { key: 'year', title: 'YEAR', x: -3.45, w: 2.5, pos: sel.year - minYear, n: () => maxYear - minYear + 1, label: i => String(minYear + i) },
    { key: 'month', title: 'MONTH', x: -0.05, w: 3.5, pos: sel.month - 1, n: () => 12, label: i => MONTHS[i] },
    { key: 'day', title: 'DAY', x: 3.35, w: 2.1, pos: sel.day - 1, n: () => daysInMonth(sel.year, sel.month), label: i => String(i + 1) },
  ];
  let active = 1, state = 'idle', stateT = 0, onChange = () => {};

  /* ----- backdrop: slowly turning kundali mandala ----- */
  function mandalaTexture() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.strokeStyle = 'rgba(255,214,140,.9)'; g.fillStyle = 'rgba(255,214,140,.9)';
    [490, 470, 380, 300, 215, 130].forEach((r, i) => { g.lineWidth = i === 0 ? 3 : 1.4; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.2832; g.save(); g.rotate(a);
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -130); g.lineTo(0, -470); g.stroke();
      g.font = '46px "Noto Sans Devanagari", serif'; g.textAlign = 'center'; g.fillText(SIGNS[i].sym + '︎', 0, -418);
      g.font = '24px "Noto Sans Devanagari", serif'; g.fillText(SIGNS[i].dev, 0, -335);
      // lotus petal
      g.beginPath(); g.moveTo(0, -130); g.quadraticCurveTo(48, -215, 0, -300); g.quadraticCurveTo(-48, -215, 0, -130); g.stroke();
      g.restore();
    }
    g.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {                 // interlocking triangles
      g.beginPath();
      for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.2832 + k * Math.PI - Math.PI / 2; const x = Math.cos(a) * 215, y = Math.sin(a) * 215; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }
  const mandala = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshBasicMaterial({ map: mandalaTexture(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  mandala.position.z = -5; scene.add(mandala);

  /* ----- floating dust ----- */
  const dustN = 260, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 22; dustPos[i * 3 + 1] = (Math.random() - 0.5) * 12; dustPos[i * 3 + 2] = -4 + Math.random() * 9; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.07, map: Util.softTexture(), color: 0xffd9a0, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ----- text sprites / frames ----- */
  function labelSprite(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const g = c.getContext('2d'); g.font = '600 44px Cinzel, serif'; g.textAlign = 'center'; g.fillStyle = '#c9bff7';
    g.letterSpacing = '14px'; g.fillText(text, 256 + 7, 62);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(1.9, 0.36, 1); return s;
  }
  function roundedRect(w, h, r, seg = 8) {
    const pts = [], corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
    corners.forEach(([cx, cy, a0]) => { for (let i = 0; i <= seg; i++) { const a = (a0 + (i / seg) * 90) * DEG; pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0)); } });
    return pts;
  }
  const glowTex = Util.softTexture(128, [[0, 'rgba(255,200,110,.9)'], [0.5, 'rgba(255,170,90,.25)'], [1, 'rgba(255,150,80,0)']]);

  /* ----- build columns ----- */
  const allItems = [];
  cols.forEach(col => {
    col.group = new THREE.Group(); col.group.position.x = col.x; scene.add(col.group);
    col.pool = [];
    col.vel = 0; col.target = null; col.hold = 0; col.dragging = false; col.dirty = true;
    const cw = Math.round(col.w * TEX), ch = Math.round(ITEM_H * TEX);
    for (let s = 0; s < POOL; s++) {
      const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
      const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: DIM.clone() });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(col.w, ITEM_H), mat);
      col.group.add(mesh);
      const item = { mesh, canvas, tex, mat, idx: null, col };
      mesh.userData.item = item; col.pool.push(item); allItems.push(item);
    }
    // gold selection frame + glow
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(roundedRect(col.w + 0.18, ITEM_H + 0.12, 0.2)), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9 }));
    frame.position.z = 0.05; col.group.add(frame); col.frame = frame;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(col.w + 1.6, ITEM_H + 1.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.z = -0.1; col.group.add(glow); col.glow = glow;
    const lab = labelSprite(col.title); lab.position.set(0, 0.76, 0.1); col.group.add(lab); col.lab = lab;
  });

  function drawItem(item, i) {
    const { canvas } = item, col = item.col, g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(18,12,48,.55)'; g.strokeStyle = 'rgba(190,175,255,.35)'; g.lineWidth = 3;
    const r = 34; g.beginPath(); g.moveTo(r + 3, 3); g.arcTo(w - 3, 3, w - 3, h - 3, r); g.arcTo(w - 3, h - 3, 3, h - 3, r); g.arcTo(3, h - 3, 3, 3, r); g.arcTo(3, 3, w - 3, 3, r); g.closePath(); g.fill(); g.stroke();
    const text = col.label(i);
    let size = 112; g.font = `600 ${size}px Cinzel, "Cormorant Garamond", serif`;
    const wmax = w * 0.84; const mw = g.measureText(text).width; if (mw > wmax) { size *= wmax / mw; g.font = `600 ${size}px Cinzel, "Cormorant Garamond", serif`; }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(255,255,255,.55)'; g.shadowBlur = 10;
    g.fillText(text, w / 2, h / 2 + 6);
    if (col.key === 'month') { g.shadowBlur = 0; g.font = '600 30px "Noto Sans Devanagari", serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'right'; g.fillText(['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'][i], w - 28, h - 24); }
    item.tex.needsUpdate = true; item.idx = i;
  }
  if (document.fonts) document.fonts.ready.then(() => cols.forEach(c => { c.dirty = true; }));

  /* ----- selection plumbing ----- */
  function readSelection() {
    const y = minYear + clamp(Math.round(cols[0].pos), 0, cols[0].n() - 1);
    const m = clamp(Math.round(cols[1].pos), 0, 11) + 1;
    const dn = daysInMonth(y, m);
    const d = clamp(Math.round(cols[2].pos), 0, dn - 1) + 1;
    if (y !== sel.year || m !== sel.month || d !== sel.day) {
      const dayShrunk = y !== sel.year || m !== sel.month;
      sel.year = y; sel.month = m; sel.day = d;
      if (dayShrunk) {
        const c = cols[2]; if (c.pos > dn - 1) c.target = dn - 1;
        c.dirty = true;
      }
      onChange({ ...sel });
    }
  }

  /* ----- input ----- */
  const ray = new THREE.Raycaster();
  function pickColumn(clientX) {
    const r = el.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width - 0.5) * 2;
    const halfW = Math.tan(FOV * DEG / 2) * camDist * (r.width / r.height);
    const wx = nx * halfW;
    let best = null, bd = 1e9;
    cols.forEach(c => { const d = Math.abs(wx - c.x); if (d < bd) { bd = d; best = c; } });
    return bd < best.w / 2 + 0.45 ? best : null;
  }
  const ppu = () => el.clientHeight / (2 * Math.tan(FOV * DEG / 2) * camDist);   // pixels per world unit at z=0
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (state !== 'idle') return;
    const col = pickColumn(e.clientX); if (!col) return;
    active = cols.indexOf(col);
    col.dragging = true; col.vel = 0; col.target = null;
    drag = { col, y: e.clientY, sy: e.clientY, sx: e.clientX, t: performance.now(), moved: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const { col } = drag, dy = e.clientY - drag.y, now = performance.now();
    drag.moved += Math.abs(dy); drag.y = e.clientY;
    const di = -dy / (ppu() * R * STEP * 0.97);
    col.pos = clamp(col.pos + di, -0.4, col.n() - 0.6);
    const dt = Math.max(1, now - drag.t) / 1000; drag.t = now;
    col.vel = col.vel * 0.6 + (di / dt) * 0.4;
  });
  const endDrag = e => {
    if (!drag) return; const { col } = drag; col.dragging = false;
    if (Math.abs(e.clientY - drag.sy) + Math.abs(e.clientX - drag.sx) < 6) {   // a tap: jump to the tapped row
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(col.pool.filter(p => p.mesh.visible).map(p => p.mesh))[0];
      if (hit) col.target = clamp(hit.object.userData.item.idx, 0, col.n() - 1);
      col.vel = 0;
    }
    drag = null;
  };
  el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', endDrag);
  el.addEventListener('wheel', e => {
    if (state !== 'idle') return;
    e.preventDefault();
    const col = pickColumn(e.clientX) || cols[active]; active = cols.indexOf(col);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    col.pos = clamp(col.pos + dy * 0.0075, -0.4, col.n() - 0.6); col.vel = 0; col.target = null; col.hold = performance.now() + 150;
  }, { passive: false });
  addEventListener('keydown', e => {
    if (state !== 'idle' || document.body.classList.contains('phase-results')) return;
    const col = cols[active];
    if (e.key === 'ArrowUp') col.target = clamp(Math.round(col.pos) - 1, 0, col.n() - 1);
    else if (e.key === 'ArrowDown') col.target = clamp(Math.round(col.pos) + 1, 0, col.n() - 1);
    else if (e.key === 'ArrowLeft') active = Math.max(0, active - 1);
    else if (e.key === 'ArrowRight') active = Math.min(2, active + 1);
    else if (e.key === 'Enter') document.getElementById('revealBtn').click();
    else return;
    e.preventDefault();
  });

  /* ----- explosion assets ----- */
  const boom = { pts: null, rings: [], rays: null, light: null, core: null, shake: 0 };
  function spawnExplosion() {
    const N = 3600, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), colr = new Float32Array(N * 3);
    const pal = [0xffd36b, 0xff9b54, 0xff6fb5, 0xa98bff, 0x7fdcff, 0xffffff].map(h => new THREE.Color(h));
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * 6.2832, s = Math.sqrt(1 - u * u);
      const sp = 3 + Math.pow(Math.random(), 1.6) * 17;
      vel[i * 3] = s * Math.cos(a) * sp; vel[i * 3 + 1] = s * Math.sin(a) * sp * 0.85; vel[i * 3 + 2] = u * sp * 0.9 + 2;
      const c = pal[(Math.random() * pal.length) | 0]; colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, map: Util.softTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 }));
    pts.userData.vel = vel; pts.frustumCulled = false; scene.add(pts); boom.pts = pts;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), new THREE.MeshBasicMaterial({ color: [0xffd36b, 0xff7fc0, 0x8fd8ff][i], transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.userData.delay = i * 0.12; ring.scale.setScalar(0.01); scene.add(ring); boom.rings.push(ring);
    }
    const rp = []; for (let i = 0; i < 90; i++) { const a = Math.random() * 6.2832, l = 0.5 + Math.random() * 1.5; rp.push(0, 0, 0, Math.cos(a) * l, Math.sin(a) * l, 0); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    boom.rays = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); boom.rays.scale.setScalar(0.1); scene.add(boom.rays);
  }
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: Util.softTexture(256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,214,140,.8)'], [1, 'rgba(255,160,90,0)']]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.z = 0.4; scene.add(core);

  function clearExplosion() {
    if (boom.pts) { scene.remove(boom.pts); boom.pts.geometry.dispose(); boom.pts = null; }
    boom.rings.forEach(r => scene.remove(r)); boom.rings.length = 0;
    if (boom.rays) { scene.remove(boom.rays); boom.rays = null; }
    core.material.opacity = 0;
  }

  /* ----- per-frame ----- */
  let doneCb = null, boomCb = null, boomFired = false, doneFired = false;
  function fit(aspect) {
    const need = 5.6;
    camDist = Math.max(10, need / (Math.tan(FOV * DEG / 2) * aspect));
    camera.position.set(0, 0, camDist);
  }

  function update(dt, t, rect) {
    fit(rect.width / rect.height);
    stateT += dt;
    mandala.rotation.z += dt * (state === 'idle' ? 0.03 : state === 'charge' ? 0.5 + stateT * 1.5 : 0.25);
    dust.rotation.y += dt * 0.02; dust.rotation.z += dt * 0.01;

    // ---------- explosion choreography ----------
    let shake = 0, camPush = 0;
    if (state === 'charge') {
      const k = clamp(stateT / 1.0, 0, 1);
      shake = 0.02 + k * k * 0.16;
      core.material.opacity = k * 0.9; core.scale.setScalar(0.5 + k * k * 5);
      camPush = k * 1.2;
      if (stateT >= 1.0) { state = 'boom'; stateT = 0; detonate(); }
    } else if (state === 'boom') {
      const k = stateT;
      shake = Math.max(0, 0.3 - k * 0.6);
      core.material.opacity = Math.max(0, 1 - k * 1.8); core.scale.setScalar(5 + k * 26);
      camera.fov = FOV + Math.max(0, 22 * Math.exp(-k * 4)); camera.updateProjectionMatrix();
      camPush = -Math.exp(-k * 3) * 1.5;
      stepExplosion(dt, k);
      if (!boomFired && k > 0.35) { boomFired = true; boomCb && boomCb(); }
      if (!doneFired && k > 2.9) { doneFired = true; state = 'done'; doneCb && doneCb(); }
    }
    scene.position.y = -0.25;
    camera.position.z = camDist - camPush;
    camera.position.x = (Math.random() - 0.5) * shake; camera.position.y = (Math.random() - 0.5) * shake;

    // ---------- drums ----------
    const now = performance.now();
    cols.forEach((col, ci) => {
      const n = col.n();
      if (state === 'idle' || state === 'charge') {
        if (!col.dragging && now >= col.hold) {
          if (col.target != null) {
            col.pos += (col.target - col.pos) * (1 - Math.exp(-11 * dt));
            if (Math.abs(col.target - col.pos) < 0.004) { col.pos = col.target; col.target = null; }
          } else if (Math.abs(col.vel) > 0.7) { col.pos += col.vel * dt; col.vel *= Math.exp(-3.4 * dt); }
          else { col.vel = 0; const tg = clamp(Math.round(col.pos), 0, n - 1); col.pos += (tg - col.pos) * (1 - Math.exp(-13 * dt)); }
          col.pos = clamp(col.pos, -0.4, n - 0.6);
        }
        const base = Math.round(col.pos);
        col.pool.forEach(p => { p.mesh.visible = false; });
        for (let i = base - VIS; i <= base + VIS; i++) {
          if (i < 0 || i >= n) continue;
          const item = col.pool[mod(i, POOL)];
          if (item.idx !== i || col.dirty) drawItem(item, i);
          const off = i - col.pos, a = -off * STEP, ad = Math.abs(a);
          if (ad > 1.02) continue;
          const m = item.mesh; m.visible = true;
          m.position.set(0, R * Math.sin(a), R * Math.cos(a) - R); m.rotation.set(-a, 0, 0);
          const near = clamp(1 - Math.abs(off) * 1.15, 0, 1);
          m.scale.setScalar(1 + near * 0.12);
          item.mat.opacity = clamp(1 - Math.pow(ad / 1.02, 2), 0, 1) * (0.55 + 0.45 * near);
          item.mat.color.copy(DIM).lerp(GOLD, near);
          if (state === 'charge') item.mat.color.lerp(WHITE, clamp(stateT / 0.9, 0, 1));
        }
        col.dirty = false;
        const isA = ci === active;
        col.frame.material.opacity = isA ? 1 : 0.5; col.glow.material.opacity = (isA ? 0.5 : 0.22) + (state === 'charge' ? stateT * 0.8 : 0);
        col.lab.material.opacity = isA ? 1 : 0.55;
        col.group.position.x = col.x + (state === 'charge' ? (Math.random() - 0.5) * shake * 1.2 : 0);
      } else {
        // exploded items fly off
        col.frame.material.opacity = Math.max(0, col.frame.material.opacity - dt * 2.5);
        col.glow.material.opacity = Math.max(0, col.glow.material.opacity - dt * 2);
        col.lab.material.opacity = Math.max(0, col.lab.material.opacity - dt * 3);
      }
    });
    if (state === 'idle') readSelection();
  }

  function detonate() {
    spawnExplosion();
    allItems.forEach(it => {
      const m = it.mesh; if (!m.visible) return;
      const wp = new THREE.Vector3(); m.getWorldPosition(wp);
      const dir = wp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 1.5)).normalize();
      it.v = dir.multiplyScalar(5 + Math.random() * 9); it.spin = new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      // re-parent into world space so the columns' groups don't matter
      scene.attach(m);
    });
    document.getElementById('flash').classList.remove('go'); void document.getElementById('flash').offsetWidth; document.getElementById('flash').classList.add('go');
  }

  function stepExplosion(dt, k) {
    allItems.forEach(it => {
      if (!it.v) return;
      const m = it.mesh; m.position.addScaledVector(it.v, dt); it.v.multiplyScalar(Math.exp(-0.9 * dt));
      m.rotation.x += it.spin.x * dt; m.rotation.y += it.spin.y * dt; m.rotation.z += it.spin.z * dt;
      it.mat.opacity = Math.max(0, it.mat.opacity - dt * 0.7); it.mat.color.lerp(WHITE, 0.1);
    });
    if (boom.pts) {
      const p = boom.pts.geometry.attributes.position, v = boom.pts.userData.vel, a = p.array, damp = Math.exp(-1.15 * dt);
      for (let i = 0; i < a.length; i += 3) { a[i] += v[i] * dt; a[i + 1] += v[i + 1] * dt; a[i + 2] += v[i + 2] * dt; v[i] *= damp; v[i + 1] *= damp; v[i + 2] *= damp; v[i + 1] -= dt * 0.6; }
      p.needsUpdate = true; boom.pts.material.opacity = clamp(1.25 - k * 0.42, 0, 1);
    }
    boom.rings.forEach(r => {
      const kk = Math.max(0, k - r.userData.delay); r.scale.setScalar(0.2 + kk * 15); r.material.opacity = Math.max(0, 0.95 - kk * 0.85);
    });
    if (boom.rays) { boom.rays.scale.setScalar(0.1 + k * 14); boom.rays.material.opacity = Math.max(0, 0.9 - k * 1.3); boom.rays.rotation.z += dt * 0.3; }
  }

  /* ----- public API ----- */
  const view = Stage.addView(el, scene, camera, update);
  return {
    view, sel,
    getDate: () => ({ ...sel }),
    onChange: fn => { onChange = fn; onChange({ ...sel }); },
    explode(onBoom, onDone) {
      if (state !== 'idle') return;
      boomCb = onBoom; doneCb = onDone; boomFired = doneFired = false; state = 'charge'; stateT = 0;
      cols.forEach(c => { c.dragging = false; c.target = null; c.vel = 0; });
    },
    reset() {
      clearExplosion();
      allItems.forEach(it => { it.v = null; it.col.group.add(it.mesh); it.mat.opacity = 1; it.idx = null; });
      cols.forEach(c => { c.dirty = true; });
      camera.fov = FOV; camera.updateProjectionMatrix();
      state = 'idle'; stateT = 0; view.enabled = true;
    },
    get state() { return state; },
  };
})();
