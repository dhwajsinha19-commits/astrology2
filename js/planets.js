/* ============================================================
   PLANETS — procedurally painted, spinning Navagraha, plus the
   "birth sky" orrery that places all nine on the zodiac ring.
   ============================================================ */
'use strict';

const Planets = (() => {
  /* ---------- 3D value noise ---------- */
  const h3 = (x, y, z, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s + 1, 1103515245); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function noise(x, y, z, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h3(xi, yi, zi, s), h3(xi + 1, yi, zi, s), u), l(h3(xi, yi + 1, zi, s), h3(xi + 1, yi + 1, zi, s), u), v),
      l(l(h3(xi, yi, zi + 1, s), h3(xi + 1, yi, zi + 1, s), u), l(h3(xi, yi + 1, zi + 1, s), h3(xi + 1, yi + 1, zi + 1, s), u), v), w);
  }
  function fbm(x, y, z, s = 0, oct = 5) { let a = 0.5, f = 1, sum = 0, norm = 0; for (let i = 0; i < oct; i++) { sum += a * noise(x * f, y * f, z * f, s + i * 7); norm += a; f *= 2; a *= 0.5; } return sum / norm; }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  function craterField(n, seed) {
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    return Array.from({ length: n }, () => { const u = rnd() * 2 - 1, a = rnd() * 6.2832, q = Math.sqrt(1 - u * u); return { x: q * Math.cos(a), y: u, z: q * Math.sin(a), r: 0.03 + Math.pow(rnd(), 2.2) * 0.2 }; });
  }
  function craterShade(px, py, pz, field) {
    let sh = 0;
    for (const c of field) {
      const d = Math.acos(Math.max(-1, Math.min(1, px * c.x + py * c.y + pz * c.z))) / c.r;
      if (d < 1.35) { if (d < 0.9) sh -= 0.35 * (1 - d * d * 0.6); else if (d < 1.15) sh += 0.28 * (1 - Math.abs(d - 1.02) * 7); }
    }
    return sh;
  }
  const CRATERS = { Moon: craterField(90, 11), Mercury: craterField(110, 29), Mars: craterField(36, 5) };
  const wrapLon = d => { while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };

  const PAINT = {
    Sun(px, py, pz) {
      const n = fbm(px * 2.6, py * 2.6, pz * 2.6, 3), m = fbm(px * 9, py * 9, pz * 9, 40);
      let c = mix([255, 110, 15], [255, 238, 130], clamp01(n * 1.35 + m * 0.35 - 0.2));
      const sp = fbm(px * 1.8 + 1.7, py * 1.8, pz * 1.8, 90);
      if (sp > 0.64) c = mix(c, [110, 30, 0], clamp01((sp - 0.64) / 0.1) * 0.75);
      return c;
    },
    Moon(px, py, pz) {
      const n = fbm(px * 3, py * 3, pz * 3, 5), mare = smooth(0.52, 0.6, fbm(px * 1.4 + 4, py * 1.4, pz * 1.4, 70));
      let c = mix([214, 216, 228], [152, 156, 176], n * 0.9); c = mix(c, [96, 100, 122], mare * 0.8);
      const sh = craterShade(px, py, pz, CRATERS.Moon) * 70; return [c[0] + sh, c[1] + sh, c[2] + sh];
    },
    Mars(px, py, pz, lat) {
      const n = fbm(px * 3, py * 3, pz * 3, 8), dark = smooth(0.5, 0.62, fbm(px * 2 + 3, py * 2, pz * 2 + 1, 60));
      let c = mix([196, 98, 52], [150, 62, 34], n); c = mix(c, [78, 40, 32], dark * 0.65);
      const sh = craterShade(px, py, pz, CRATERS.Mars) * 36; c = [c[0] + sh, c[1] + sh * 0.7, c[2] + sh * 0.6];
      const cap = smooth(1.18, 1.3, Math.abs(lat) + (n - 0.5) * 0.2); return mix(c, [250, 245, 240], cap);
    },
    Mercury(px, py, pz) {
      const n = fbm(px * 4, py * 4, pz * 4, 12);
      let c = mix([154, 196, 168], [92, 130, 112], n); const sh = craterShade(px, py, pz, CRATERS.Mercury) * 75; return [c[0] + sh, c[1] + sh, c[2] + sh];
    },
    Jupiter(px, py, pz, lat, lon) {
      const t = fbm(px * 3, py * 6, pz * 3, 21), v = lat + (t - 0.5) * 0.28;
      const b = 0.5 + 0.5 * Math.sin(v * 15), f = 0.5 + 0.5 * Math.sin(v * 41 + t * 5);
      let c = mix([248, 226, 168], [196, 120, 62], b * 0.8 + f * 0.25); c = mix(c, [236, 196, 130], (1 - b) * 0.3);
      const dx = wrapLon(lon - 3.9) / 0.34, dy = (lat + 0.34) / 0.13, e = dx * dx + dy * dy;
      if (e < 1.6) c = mix(c, [206, 72, 44], (1 - e / 1.6) * 0.95);
      return c;
    },
    Venus(px, py, pz) {
      const w1 = fbm(px * 2, py * 2, pz * 2, 2), w2 = fbm(px * 2, py * 2, pz * 2, 5), w3 = fbm(px * 2, py * 2, pz * 2, 9);
      const n = fbm(px * 3 + w1 * 1.6, py * 3 + w2 * 1.6, pz * 3 + w3 * 1.6, 33);
      return mix([255, 244, 226], [232, 178, 170], clamp01((n - 0.25) * 1.6));
    },
    Saturn(px, py, pz, lat) {
      const t = fbm(px * 3, py * 7, pz * 3, 17), v = lat + (t - 0.5) * 0.12, b = 0.5 + 0.5 * Math.sin(v * 24 + t * 3);
      let c = mix([232, 214, 168], [192, 164, 116], b); return mix(c, [128, 140, 205], smooth(0.9, 1.4, Math.abs(lat)) * 0.45);
    },
    Rahu(px, py, pz) {
      const n = fbm(px * 2.2, py * 2.2, pz * 2.2, 8), w = fbm(px * 2 + n * 1.5, py * 2, pz * 2 + n * 1.5, 31);
      const vein = Math.pow(1 - Math.abs(w - 0.5) * 2, 7);
      return mix([18, 10, 36], [60, 38, 120], n); const c = mix([18, 10, 36], [60, 38, 120], n); return mix(c, [178, 140, 255], vein * 0.85);
    },
    Ketu(px, py, pz) {
      const n = fbm(px * 2.4, py * 2.4, pz * 2.4, 3), w = fbm(px * 2.6 + n * 1.3, py * 2.6, pz * 2.6 + n * 1.3, 51);
      const vein = Math.pow(1 - Math.abs(w - 0.5) * 2, 6), c = mix([36, 22, 20], [96, 58, 40], n);
      return mix(c, [255, 140, 40], vein * 0.95);
    },
  };
  PAINT.Rahu = function (px, py, pz) {
    const n = fbm(px * 2.2, py * 2.2, pz * 2.2, 8), w = fbm(px * 2 + n * 1.5, py * 2, pz * 2 + n * 1.5, 31);
    const vein = Math.pow(1 - Math.abs(w - 0.5) * 2, 7), c = mix([18, 10, 36], [60, 38, 120], n);
    return mix(c, [178, 140, 255], vein * 0.85);
  };

  const texCache = {};
  function planetTexture(name) {
    if (texCache[name]) return texCache[name];
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), paint = PAINT[name];
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), py = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = ((x + 0.5) / W) * 6.2832, col = paint(cl * Math.cos(lon), py, cl * Math.sin(lon), lat, lon), i = (y * W + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; texCache[name] = t; return t;
  }

  const glowMat = (hex, k = 1.6, p = 1.7) => new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(hex) }, k: { value: k }, p: { value: p } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c; uniform float k; uniform float p; varying vec3 vN; varying vec3 vV; void main(){ float i=pow(clamp(-dot(vN,vV),0.0,1.0),p)*k; gl_FragColor=vec4(c*i,i); }',
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const soft = (stops) => Util.softTexture(128, stops);
  const sprite = (tex, color, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };

  function ringTexture(name) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 4; const g = c.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const u = x / 512; let a = 0.0;
      if (u > 0.04 && u < 0.3) a = 0.45 + 0.3 * noise(u * 40, 1, 1);          // C ring
      if (u > 0.32 && u < 0.62) a = 0.85 + 0.15 * noise(u * 70, 2, 3);        // B ring
      if (u > 0.64 && u < 0.7) a = 0.04;                                      // Cassini division
      if (u > 0.7 && u < 0.97) a = 0.55 + 0.25 * noise(u * 55, 5, 1);         // A ring
      const l = 150 + 70 * noise(u * 30, 4, 4); g.fillStyle = `rgba(${l + 40},${l + 20},${l - 30},${a})`; g.fillRect(x, 0, 1, 4);
    }
    return new THREE.CanvasTexture(c);
  }

  /** Builds a spinning planet. Returns { group, update } with a unit radius of ~1.6. */
  function buildPlanet(name) {
    const info = GRAHAS[name], hex = info.hex, group = new THREE.Group(), R = 1.6;
    const body = new THREE.Group(); body.rotation.z = 0.35; group.add(body);
    const tex = planetTexture(name), isSun = name === 'Sun';
    const m = isSun ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: name === 'Moon' || name === 'Mercury' || name === 'Mars' ? 0.95 : 0.7, metalness: 0, emissive: new THREE.Color(hex), emissiveIntensity: name === 'Rahu' || name === 'Ketu' ? 0.18 : 0.05 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), m); body.add(sphere);
    const extras = [];
    const glowK = { Sun: 2.4, Moon: 1.2, Venus: 1.6, Jupiter: 1.2, Rahu: 2.4, Ketu: 2.4, Saturn: 1.3, Mars: 1.4, Mercury: 1.2 }[name] || 1.3;
    group.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.22, 48, 32), glowMat(hex, glowK, isSun ? 1.2 : 1.9)));

    if (isSun) {
      const corona = sprite(soft([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,200,90,.75)'], [0.5, 'rgba(255,120,30,.25)'], [1, 'rgba(255,90,10,0)']]), 0xffffff, 8.4, 0.9); group.add(corona);
      const rays = new THREE.Group(); group.add(rays);
      for (let i = 0; i < 18; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.6 + (i % 3) * 0.9), new THREE.MeshBasicMaterial({ map: soft([[0, 'rgba(255,200,100,0)'], [0.4, 'rgba(255,190,90,.7)'], [1, 'rgba(255,160,60,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.position.set(Math.cos(i * 0.349) * (R + 0.9), Math.sin(i * 0.349) * (R + 0.9), 0); r.rotation.z = i * 0.349 - Math.PI / 2; rays.add(r); }
      extras.push((t) => { rays.rotation.z = t * 0.08; corona.scale.setScalar(8.4 + Math.sin(t * 1.4) * 0.25); });
    }
    if (name === 'Saturn') {
      const rg = new THREE.RingGeometry(R * 1.35, R * 2.3, 128, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
      for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (d - R * 1.35) / (R * 0.95), 0.5); }
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2 + 0.05; body.add(ring);
    }
    if (name === 'Rahu' || name === 'Ketu') {
      const N = 420, pos = new Float32Array(N * 3), seed = Array.from({ length: N }, () => [Math.random() * 6.28, 2 + Math.random() * 1.7, (Math.random() - 0.5) * 0.35, 0.2 + Math.random() * 0.5]);
      const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: name === 'Rahu' ? 0.14 : 0.1, map: soft([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]), color: name === 'Rahu' ? 0x9a7cff : 0xff9448, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.frustumCulled = false; group.add(pts); pts.rotation.x = 0.45;
      if (name === 'Rahu') {   // eclipse corona
        const ec = new THREE.Mesh(new THREE.TorusGeometry(R * 1.04, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0xc9b3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })); ec.rotation.y = 0.5; group.add(ec); extras.push((t) => { ec.rotation.z = t * 0.5; });
      }
      extras.push((t) => { for (let i = 0; i < N; i++) { const s = seed[i], a = s[0] + t * s[3] * (name === 'Rahu' ? 1 : -1); pos[i * 3] = Math.cos(a) * s[1]; pos[i * 3 + 1] = s[2]; pos[i * 3 + 2] = Math.sin(a) * s[1]; } pts.geometry.attributes.position.needsUpdate = true; });
    }
    // little orbiting satellite + orbit line
    const orb = new THREE.Group(); group.add(orb); orb.rotation.set(0.5, 0, 0.2);
    if (name !== 'Saturn' && name !== 'Rahu' && name !== 'Ketu') {
      const line = new THREE.Mesh(new THREE.TorusGeometry(R * 1.9, 0.008, 6, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })); line.rotation.x = Math.PI / 2; orb.add(line);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.5) })); orb.add(moon);
      extras.push((t) => { moon.position.set(Math.cos(t * 0.8) * R * 1.9, 0, Math.sin(t * 0.8) * R * 1.9); });
    }
    return { group, update: (t, dt) => { sphere.rotation.y += dt * (name === 'Jupiter' ? 0.55 : name === 'Venus' ? -0.12 : 0.25); extras.forEach(f => f(t)); } };
  }

  /** The big viewer with a drag-to-spin planet. */
  function createView(el) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); camera.position.set(0, 0.4, 8.2); camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x6a6a99, 0.4));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.15); sun.position.set(-4, 2.5, 5); scene.add(sun);
    const rim = new THREE.PointLight(0x8b6bff, 1.2, 30); rim.position.set(5, -1, -4); scene.add(rim);
    const spin = new THREE.Group(); scene.add(spin);
    let cur = null, curName = '';
    const spinner = Util.makeSpinner(el, spin, { auto: 0.18, maxPitch: 0.5 });
    function setPlanet(name) {
      if (name === curName) return; curName = name;
      if (cur) spin.remove(cur.group);
      cur = buildPlanet(name); spin.add(cur.group);
      rim.color.set(GRAHAS[name].hex);
      sun.intensity = name === 'Sun' ? 0 : 1.15; spin.scale.setScalar(0.01);
    }
    const view = Stage.addView(el, scene, camera, (dt, t) => { spinner.step(dt); if (cur) cur.update(t, dt); const s = spin.scale.x; if (s < 1) spin.scale.setScalar(Math.min(1, s + dt * 2.2 + (1 - s) * 0.1)); });
    return { view, setPlanet };
  }

  /* ---------- birth-sky orrery ---------- */
  const ELEM_COL = { Fire: 0xff6b4a, Earth: 0x7bd88a, Air: 0xffd36b, Water: 0x6fb4ff };
  function textSprite(text, { size = 64, color = '#fff', w = 512, h = 128, font = 'Cinzel, serif', weight = 600, scale = 1 } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 8; g.fillText(text, w / 2, h / 2);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(w / h * scale, scale, 1); s.renderOrder = 10; return s;
  }

  function createSky(el, onPick) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 10.5, 11.5); camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x8888bb, 0.9)); const key = new THREE.PointLight(0xffffff, 1.6, 50); key.position.set(0, 8, 4); scene.add(key);
    const world = new THREE.Group(); scene.add(world);
    const zodiac = new THREE.Group(); world.add(zodiac);
    const planetsG = new THREE.Group(); world.add(planetsG);
    // zodiac wheel
    const R0 = 5.3, R1 = 6.3;
    SIGNS.forEach((s, i) => {
      const th0 = i * 30 * DEG, seg = new THREE.Mesh(new THREE.RingGeometry(R0, R1, 24, 1, th0, 30 * DEG - 0.012), new THREE.MeshBasicMaterial({ color: ELEM_COL[s.element], transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      seg.rotation.x = -Math.PI / 2; seg.userData.sign = i; zodiac.add(seg); s._seg = seg;
      const mid = (i * 30 + 15) * DEG, lab = textSprite(`${s.sym}︎ ${s.name}`, { size: 50, color: '#' + new THREE.Color(ELEM_COL[s.element]).lerp(new THREE.Color(0xffffff), 0.5).getHexString(), w: 512, h: 96, scale: 0.62 });
      lab.position.set(Math.cos(mid) * (R1 + 0.75), 0.02, -Math.sin(mid) * (R1 + 0.75)); zodiac.add(lab);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(th0) * 2.3, 0, -Math.sin(th0) * 2.3), new THREE.Vector3(Math.cos(th0) * R1, 0, -Math.sin(th0) * R1)]), new THREE.LineBasicMaterial({ color: 0xbeb0ff, transparent: true, opacity: 0.18 })); zodiac.add(ln);
    });
    [2.3, R0, R1].forEach((r, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, i === 0 ? 0.012 : 0.02, 6, 128), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x7a6cc8 : 0xffd36b, transparent: true, opacity: i === 0 ? 0.5 : 0.65 })); t.rotation.x = Math.PI / 2; zodiac.add(t); });
    // earth / "you" at the centre
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), new THREE.MeshStandardMaterial({ color: 0x4fa8ff, emissive: 0x1d5fbf, emissiveIntensity: 0.6, roughness: 0.6 })); world.add(earth);
    world.add(sprite(soft([[0, 'rgba(120,190,255,.9)'], [1, 'rgba(120,190,255,0)']]), 0xffffff, 2.4, 0.8));
    const you = textSprite('YOU', { size: 40, color: '#bfe3ff', w: 256, h: 64, scale: 0.34 }); you.position.set(0, 0.78, 0); world.add(you);

    const meshes = {}; let chart = null, hi = null;
    function setChart(c) {
      chart = c;
      while (planetsG.children.length) planetsG.remove(planetsG.children[0]);
      SIGNS.forEach((s, i) => { s._seg.material.opacity = i === c.moonSign ? 0.5 : i === c.sunSign ? 0.38 : 0.18; });
      c.planets.forEach((p, idx) => {
        const info = GRAHAS[p.name], th = p.lon * DEG, r = 3.7 + (idx % 3) * 0.5, pg = new THREE.Group(); pg.position.set(Math.cos(th) * r, 0, -Math.sin(th) * r); planetsG.add(pg);
        const big = p.name === 'Sun' || p.name === 'Moon' ? 0.34 : p.name === 'Jupiter' || p.name === 'Saturn' ? 0.3 : 0.22;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(big, 32, 24), p.name === 'Sun' ? new THREE.MeshBasicMaterial({ map: planetTexture('Sun') }) : new THREE.MeshStandardMaterial({ map: planetTexture(p.name), emissive: new THREE.Color(info.hex), emissiveIntensity: 0.25, roughness: 0.8 }));
        mesh.userData.planet = p.name; pg.add(mesh); meshes[p.name] = mesh;
        pg.add(sprite(soft([[0, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]), info.hex, big * 6, 0.75));
        if (p.name === 'Saturn') { const rr = new THREE.Mesh(new THREE.RingGeometry(big * 1.4, big * 2.2, 40), new THREE.MeshBasicMaterial({ color: 0xd9c8a0, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); rr.rotation.x = -Math.PI / 2 + 0.4; pg.add(rr); }
        const lab = textSprite(info.sk.split(' ')[0] + (p.retro && p.name !== 'Rahu' && p.name !== 'Ketu' ? ' ℞' : ''), { size: 44, color: '#fff', w: 320, h: 80, scale: 0.46 }); lab.position.y = big + 0.5; pg.add(lab);
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-pg.position.x, 0, -pg.position.z)]);
        pg.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(info.hex), transparent: true, opacity: 0.2 })));
        if (p.name === 'Moon') { const mr = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd36b })); mr.rotation.x = Math.PI / 2; pg.add(mr); hi = mr; }
      });
    }
    const spinner = Util.makeSpinner(el, world, { auto: 0.04, maxPitch: 0.0 });
    // tap to pick a planet
    const ray = new THREE.Raycaster(); let down = null;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; } down = null;
      const r = el.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(Object.values(meshes))[0]; if (hit && onPick) onPick(hit.object.userData.planet);
    });
    const view = Stage.addView(el, scene, camera, (dt, t) => {
      spinner.step(dt); earth.rotation.y += dt * 0.6;
      Object.values(meshes).forEach(m => { m.rotation.y += dt * 0.5; });
      if (hi) { hi.scale.setScalar(1 + Math.sin(t * 3) * 0.08); }
      const D = Math.max(19, 8.2 / (0.325 * camera.aspect)), el = 0.9;
      camera.position.set(0, D * Math.sin(el), D * Math.cos(el)); camera.lookAt(0, -0.4, 0);
    });
    return { view, setChart };
  }

  return { createView, createSky, buildPlanet };
})();
