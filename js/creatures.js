/* ============================================================
   CREATURES — twelve procedural, gilded low-poly 3D symbols,
   one for every rashi. Built from icosahedra, tapered limbs
   and cones; each has its own idle animation.
   Facing +z, standing on y = 0.
   ============================================================ */
'use strict';

const Creatures = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, flatShading: true, roughness: 0.52, metalness: 0.22, emissive: hex, emissiveIntensity: 0.16 }, o));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.22 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
  const goldMat = () => mat(0xe3b04b, { metalness: 0.7, roughness: 0.3, emissiveIntensity: 0.25 });
  const edges = m => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 1), edgeMat)); return m; };

  function E(parent, m, s, p = [0, 0, 0], det = 1) {
    const me = new THREE.Mesh(new THREE.IcosahedronGeometry(1, det), m);
    me.scale.set(s[0], s[1], s[2]); me.position.set(p[0], p[1], p[2]); edges(me); parent.add(me); return me;
  }
  function limb(parent, m, a, b, r1, r2, seg = 6) {
    const A = V(...a), B = V(...b), len = A.distanceTo(B);
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, Math.max(len, 0.001), seg, 1), m);
    me.position.copy(A).add(B).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize());
    edges(me); parent.add(me); return me;
  }
  function cone(parent, m, r, h, p = [0, 0, 0], rot = [0, 0, 0], seg = 6) {
    const me = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), m);
    me.position.set(...p); me.rotation.set(...rot); edges(me); parent.add(me); return me;
  }
  function box(parent, m, s, p = [0, 0, 0], rot = [0, 0, 0]) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m);
    me.position.set(...p); me.rotation.set(...rot); edges(me); parent.add(me); return me;
  }
  function chain(parent, m, pts, r0, r1, seg = 6) {
    for (let i = 0; i < pts.length - 1; i++) {
      const k0 = i / (pts.length - 1), k1 = (i + 1) / (pts.length - 1);
      limb(parent, m, pts[i], pts[i + 1], r0 + (r1 - r0) * k0, r0 + (r1 - r0) * k1, seg);
    }
  }
  function eyes(parent, x, y, z, r = 0.05) { [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), eyeMat); e.position.set(s * x, y, z); parent.add(e); }); }

  /* ---------- humanoid ---------- */
  function human(o) {
    const g = new THREE.Group(), P = { arm: {} };
    const skin = mat(o.skin ?? 0xf0c9a0, { roughness: 0.7 }), cloth = mat(o.cloth), cloth2 = mat(o.cloth2 ?? o.cloth), hair = mat(o.hair ?? 0x2b1a14);
    if (!o.upper) {
      if (o.dress) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 1.08, 9, 1), cloth); sk.position.y = 0.58; edges(sk); g.add(sk); }
      else [-1, 1].forEach(s => { limb(g, cloth2, [s * 0.12, 1.02, 0], [s * 0.13, 0.52, 0.02], 0.13, 0.09); limb(g, cloth2, [s * 0.13, 0.52, 0.02], [s * 0.13, 0.1, 0.03], 0.09, 0.07); E(g, mat(0x2a1c16), [0.09, 0.05, 0.15], [s * 0.13, 0.05, 0.08]); });
    }
    E(g, cloth, [0.3, 0.46, 0.2], [0, 1.5, 0]); E(g, cloth2, [0.27, 0.08, 0.19], [0, 1.1, 0]);
    limb(g, skin, [0, 1.85, 0], [0, 2.02, 0], 0.07, 0.065);
    P.head = new THREE.Group(); P.head.position.set(0, 2.2, 0); g.add(P.head);
    E(P.head, skin, [0.19, 0.23, 0.2], [0, 0, 0.01]); E(P.head, hair, [0.21, 0.24, 0.21], [0, 0.05, -0.04]);
    if (o.longHair) E(P.head, hair, [0.2, 0.5, 0.11], [0, -0.3, -0.15]);
    if (o.crown) cone(P.head, goldMat(), 0.17, 0.22, [0, 0.3, 0], [0, 0, 0], 5);
    eyes(P.head, 0.075, 0.03, 0.18, 0.025);
    [-1, 1].forEach(s => {
      const a = new THREE.Group(); a.position.set(s * 0.34, 1.8, 0); g.add(a); P.arm[s] = a;
      limb(a, cloth, [0, 0, 0], [0, -0.38, 0], 0.095, 0.075); limb(a, skin, [0, -0.38, 0], [0, -0.74, 0.04], 0.07, 0.055); E(a, skin, [0.06, 0.06, 0.06], [0, -0.78, 0.05]);
    });
    return { g, P };
  }

  /* ---------- quadruped ---------- */
  function quad(o) {
    const g = new THREE.Group(), P = {};
    const body = mat(o.body, o.bodyOpt), dark = mat(o.dark), hoof = mat(o.hoof ?? 0x2a1c16), legM = o.leg ? mat(o.leg) : body;
    const lh = o.legH, bh = o.bodyH, bl = o.bodyL, by = lh + bh * 0.55, det = o.wool ? 2 : 1;
    P.torso = E(g, body, [bh * 0.62, bh * 0.58, bl * 0.5], [0, by, 0], det);
    E(g, body, [bh * 0.6, bh * 0.6, bl * 0.3], [0, by + bh * 0.04, bl * 0.3], det);
    E(g, body, [bh * 0.58, bh * 0.56, bl * 0.3], [0, by, -bl * 0.32], det);
    P.legs = [];
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      const hipY = by - bh * 0.2, lg = new THREE.Group(); lg.position.set(sx * bh * 0.38, hipY, sz * bl * 0.3); g.add(lg);
      const kz = sz > 0 ? 0.04 : -0.13;
      limb(lg, legM, [0, 0, 0], [0, -hipY * 0.5, kz], bh * 0.2, bh * 0.13);
      limb(lg, legM, [0, -hipY * 0.5, kz], [0, -hipY + 0.05, sz > 0 ? 0.02 : -0.02], bh * 0.13, bh * 0.09);
      E(lg, hoof, [bh * 0.11, 0.06, bh * 0.15], [0, -hipY + 0.04, sz > 0 ? 0.05 : 0.0], 0);
      P.legs.push(lg);
    });
    const nb = [0, by + bh * 0.25, bl * 0.38], nt = [0, by + bh * 0.25 + o.neckUp, bl * 0.38 + o.neckFwd];
    limb(g, body, nb, nt, bh * 0.4, bh * 0.28);
    P.head = new THREE.Group(); P.head.position.set(...nt); g.add(P.head);
    E(P.head, o.headDark ? dark : body, [o.hw, o.hh, o.hl], [0, 0, 0]);
    E(P.head, mat(o.snout ?? o.dark), [o.hw * 0.72, o.hh * 0.62, o.hl * 0.85], [0, -o.hh * 0.3, o.hl * 0.78]);
    eyes(P.head, o.hw * 0.86, o.hh * 0.28, o.hl * 0.35, 0.045);
    P.ears = [-1, 1].map(s => { const e = new THREE.Group(); e.position.set(s * o.hw * 0.8, o.hh * 0.55, -o.hl * 0.2); P.head.add(e); if (o.ear !== 'none') cone(e, dark, o.earR ?? 0.09, o.earL ?? 0.3, [s * 0.1, 0.1, 0], [0, 0, -s * 1.1], 5); return e; });
    P.tail = new THREE.Group(); P.tail.position.set(0, by + bh * 0.15, -bl * 0.55); g.add(P.tail);
    if (o.tail !== 'none') { limb(P.tail, body, [0, 0, 0], [0, -0.3, -0.18], 0.06, 0.04); if (o.tuft) E(P.tail, dark, [0.09, 0.2, 0.09], [0, -0.45, -0.22]); }
    return { g, P, by, bh, bl };
  }
  function idleQuad(P, t) {
    P.head.rotation.y = Math.sin(t * 0.8) * 0.22; P.head.rotation.x = Math.sin(t * 1.3) * 0.06;
    P.tail.rotation.z = Math.sin(t * 2.4) * 0.35; P.tail.rotation.x = Math.sin(t * 1.7) * 0.1;
    P.ears.forEach((e, i) => { e.rotation.z = Math.sin(t * 3 + i * 2) * 0.12 * (Math.sin(t * 0.7) > 0.7 ? 1.6 : 0.4); });
    P.torso.scale.y = 0.58 * P.torso.userData.bh * (1 + Math.sin(t * 1.6) * 0.018);
    P.legs[0].rotation.x = Math.max(0, Math.sin(t * 0.55)) * -0.5;     // occasional paw
  }
  function trackBreath(P, bh) { P.torso.userData.bh = bh; }

  /* ---------- 1 · MESHA — Ram ---------- */
  function ram() {
    const q = quad({ body: 0xf3e8d2, dark: 0x4a3a30, leg: 0x4a3a30, legH: 0.8, bodyH: 0.9, bodyL: 1.5, neckUp: 0.55, neckFwd: 0.32, hw: 0.2, hh: 0.26, hl: 0.3, snout: 0x5b463a, wool: true, headDark: true, earR: 0.1, earL: 0.34, tuft: false });
    const g = q.g, P = q.P, hornM = goldMat();
    [-1, 1].forEach(s => {
      const pts = []; const c = V(s * 0.3, 0.1, 0), r0 = 0.25;
      for (let i = 0; i <= 12; i++) { const f = (i / 12) * 1.75 * Math.PI, r = r0 * (1 - 0.2 * i / 12); pts.push([c.x + s * (-r * Math.cos(f)), c.y + r * Math.sin(f), -0.04 - 0.07 * f]); }
      chain(P.head, hornM, pts, 0.09, 0.025, 6);
    });
    trackBreath(P, q.bh);
    return { g, update: (t) => idleQuad(P, t) };
  }

  /* ---------- 2 · VRISHABHA — Bull ---------- */
  function bull() {
    const q = quad({ body: 0xf0e3cf, dark: 0x6b4a3a, leg: 0xe4d3bb, legH: 0.7, bodyH: 1.1, bodyL: 1.5, neckUp: 0.18, neckFwd: 0.55, hw: 0.28, hh: 0.3, hl: 0.38, snout: 0xf4b6c8, earR: 0.1, earL: 0.34, tuft: true });
    const g = q.g, P = q.P, hornM = mat(0xfff0d0, { emissiveIntensity: 0.3 });
    E(g, mat(0xe9d6bf), [0.5, 0.42, 0.45], [0, q.by + q.bh * 0.62, q.bl * 0.2]);       // shoulder hump
    E(g, mat(0xe9d6bf), [0.22, 0.4, 0.3], [0, q.by - q.bh * 0.4, q.bl * 0.42]);          // dewlap
    [-1, 1].forEach(s => {
      const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push([s * (0.22 + 0.45 * Math.sin(k * 1.25)), 0.18 + 0.62 * Math.pow(k, 1.7), 0.04 + 0.12 * k]); }
      chain(P.head, hornM, pts, 0.1, 0.02, 6);
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), goldMat()); ring.position.set(0, -0.3, 0.7); ring.rotation.x = Math.PI / 2; edges(ring); P.head.add(ring);
    trackBreath(P, q.bh);
    return { g, update: (t) => { idleQuad(P, t); P.head.rotation.x += Math.sin(t * 0.5) * 0.08; } };
  }

  /* ---------- 5 · SIMHA — Lion ---------- */
  function lion() {
    const q = quad({ body: 0xe9ab4b, dark: 0x8a4a1c, leg: 0xe9ab4b, legH: 0.62, bodyH: 0.95, bodyL: 1.7, neckUp: 0.42, neckFwd: 0.42, hw: 0.27, hh: 0.27, hl: 0.3, snout: 0xf3d098, ear: 'none', tuft: true });
    const g = q.g, P = q.P, maneM = mat(0x9b4a1d, { emissiveIntensity: 0.25 }), maneL = mat(0xc9722c);
    E(P.head, maneM, [0.5, 0.52, 0.34], [0, 0, -0.18], 1);
    const N = 70;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      const d = V(Math.cos(th) * r, y, Math.sin(th) * r * 0.6 - 0.35).normalize();
      if (d.z > 0.45 && Math.abs(d.x) < 0.5) continue;                                    // keep the face clear
      const c = cone(P.head, i % 3 ? maneM : maneL, 0.13, 0.5, [d.x * 0.52, d.y * 0.5, d.z * 0.34 - 0.12], [0, 0, 0], 5);
      c.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    }
    [-1, 1].forEach(s => E(P.head, mat(0xe9ab4b), [0.09, 0.09, 0.05], [s * 0.2, 0.28, -0.05], 0));
    cone(P.head, mat(0x3a1c10), 0.06, 0.06, [0, -0.1, 0.62], [Math.PI / 2, 0, 0], 3);
    trackBreath(P, q.bh);
    return { g, update: (t) => { idleQuad(P, t); P.head.rotation.x += 0.1; } };
  }

  /* ---------- 9 · DHANU — Archer / centaur ---------- */
  function archer() {
    const q = quad({ body: 0x8a5a3c, dark: 0x3b2418, leg: 0x6e4630, legH: 0.85, bodyH: 0.85, bodyL: 1.6, neckUp: 0, neckFwd: 0, hw: 0.01, hh: 0.01, hl: 0.01, snout: 0x3b2418, ear: 'none', tail: 'x' });
    const g = q.g, P = q.P;
    P.head.visible = false;
    // flowing tail
    const tailM = mat(0x2d1a10); P.tail.clear(); chain(P.tail, tailM, [[0, 0, 0], [0, -0.2, -0.3], [0, -0.55, -0.42], [0, -0.9, -0.38]], 0.12, 0.04);
    // human upper body
    const h = human({ upper: true, cloth: 0xf2c14e, cloth2: 0x8b3f2a, hair: 0x3a2417, crown: true });
    h.g.scale.setScalar(0.75); h.g.position.set(0, q.by + q.bh * 0.35 - 1.0 * 0.75 + 0.05, q.bl * 0.4); g.add(h.g);
    h.P.arm[-1].rotation.set(-1.45, 0, -0.1);   // bow arm out front
    h.P.arm[1].rotation.set(-1.1, 0.0, 0.7);    // drawing arm back
    // bow, string, arrow (held by the bow arm)
    const bowM = goldMat(), pts = [];
    for (let i = 0; i <= 10; i++) { const a = -1.15 + (i / 10) * 2.3; pts.push([0, 0.62 * Math.sin(a), 0.2 - 0.3 * Math.cos(a)]); }
    const bow = new THREE.Group(); bow.position.set(-0.27, q.by + q.bh * 0.35 - 0.75 + 0.05 + 1.58 * 0.75, q.bl * 0.4 + 0.55); g.add(bow);
    chain(bow, bowM, pts, 0.035, 0.035);
    limb(bow, mat(0xfff0d0), pts[0], pts[10], 0.008, 0.008, 3);
    limb(bow, mat(0xc9a05a), [0, 0, -0.05], [0, 0, 0.95], 0.012, 0.012, 4); cone(bow, goldMat(), 0.04, 0.12, [0, 0, 1.0], [Math.PI / 2, 0, 0], 4);
    return { g, update: (t) => { P.torso.rotation.z = Math.sin(t * 1.2) * 0.012; h.g.rotation.y = Math.sin(t * 0.7) * 0.18; bow.rotation.y = h.g.rotation.y * 0.6; P.tail.rotation.z = Math.sin(t * 2.2) * 0.3; P.legs[1].rotation.x = Math.max(0, Math.sin(t * 0.6)) * -0.45; h.P.head.rotation.x = Math.sin(t * 1.1) * 0.05; } };
  }

  /* ---------- 10 · MAKARA — Sea-goat ---------- */
  function seagoat() {
    const g = new THREE.Group(), body = mat(0xd9c3a0), dark = mat(0x4a3a30), scale = mat(0x3fa6b8, { emissiveIntensity: 0.3 }), scale2 = mat(0x7fe0cf);
    const front = new THREE.Group(); g.add(front);
    E(front, body, [0.55, 0.5, 0.75], [0, 0.95, 0.1], 1); E(front, body, [0.5, 0.52, 0.4], [0, 1.02, 0.55], 1);
    [-1, 1].forEach(s => {                                  // folded forelegs
      limb(front, body, [s * 0.28, 0.9, 0.55], [s * 0.3, 0.45, 0.85], 0.15, 0.1); limb(front, body, [s * 0.3, 0.45, 0.85], [s * 0.3, 0.12, 0.75], 0.1, 0.07); E(front, mat(0x2a1c16), [0.09, 0.05, 0.13], [s * 0.3, 0.08, 0.82], 0);
    });
    limb(front, body, [0, 1.15, 0.7], [0, 1.65, 0.95], 0.34, 0.24);
    const head = new THREE.Group(); head.position.set(0, 1.72, 1.0); front.add(head);
    E(head, body, [0.22, 0.26, 0.32]); E(head, dark, [0.15, 0.17, 0.28], [0, -0.14, 0.32]); eyes(head, 0.18, 0.08, 0.2, 0.04);
    [-1, 1].forEach(s => {
      cone(head, dark, 0.07, 0.3, [s * 0.18, 0.18, -0.12], [0, 0, -s * 0.9], 5);
      const pts = []; for (let i = 0; i <= 9; i++) { const k = i / 9; pts.push([s * (0.12 + 0.28 * Math.sin(k * 1.7)), 0.2 + 0.55 * k, -0.08 - 0.5 * k * k]); }
      chain(head, goldMat(), pts, 0.075, 0.02);
    });
    cone(head, mat(0xf3eadb), 0.07, 0.34, [0, -0.38, 0.28], [Math.PI, 0, 0], 4);          // beard
    // fish tail: a spiral of scale-plated segments
    const C = V(0, 1.0, -1.35), r0 = 0.82, phi0 = -0.36, segs = 17, tailPts = [];
    for (let i = 0; i <= segs; i++) {
      const s = i / segs, r = r0 * (1 - 0.7 * s), phi = phi0 - s * 1.65 * Math.PI;
      const p = V(0, C.y + r * Math.sin(phi), C.z + r * Math.cos(phi)); tailPts.push(p);
      const rad = 0.42 * (1 - 0.82 * s) + 0.05;
      E(g, i % 2 ? scale : scale2, [rad * 0.92, rad, rad * 1.1], [0, p.y, p.z], 1);
    }
    const end = tailPts[segs], fin = new THREE.Group(); fin.position.copy(end); g.add(fin);
    [-1, 1].forEach(s => cone(fin, scale2, 0.12, 0.7, [0, s * 0.32, 0.05], [0, 0, s * -0.9], 4)); cone(fin, scale, 0.1, 0.5, [0, 0, 0.18], [Math.PI / 2, 0, 0], 4);
    [0.3, 0.55].forEach(k => { const p = tailPts[(segs * k) | 0]; cone(g, scale2, 0.1, 0.4, [0, p.y + 0.35, p.z], [0, 0, 0], 4); });
    // little wave ring
    return { g, update: (t) => { head.rotation.y = Math.sin(t * 0.8) * 0.25; head.rotation.x = Math.sin(t * 1.2) * 0.08; fin.rotation.x = Math.sin(t * 2.4) * 0.35; front.rotation.z = Math.sin(t * 0.9) * 0.02; } };
  }

  /* ---------- 3 · MITHUNA — Twins ---------- */
  function twins() {
    const g = new THREE.Group();
    const a = human({ cloth: 0x59c488, cloth2: 0xf2c14e, hair: 0x2b1a14 }), b = human({ cloth: 0xf2c14e, cloth2: 0x59c488, hair: 0x7a4a24, skin: 0xe9b88a });
    a.g.position.x = -0.55; b.g.position.x = 0.55; a.g.rotation.y = 0.25; b.g.rotation.y = -0.25; g.add(a.g, b.g);
    // joined hands
    a.P.arm[1].rotation.z = -1.15; b.P.arm[-1].rotation.z = 1.15;
    // free arms: mace and veena
    a.P.arm[-1].rotation.set(-0.9, 0, 0.35);
    const mace = new THREE.Group(); mace.position.set(0, -0.78, 0.2); a.P.arm[-1].add(mace);
    limb(mace, goldMat(), [0, -0.3, 0], [0, 0.65, 0], 0.035, 0.035); E(mace, mat(0xd2453a), [0.14, 0.14, 0.14], [0, 0.78, 0], 1);
    b.P.arm[1].rotation.set(-1.0, 0, -0.5);
    const veena = new THREE.Group(); veena.position.set(0.05, -0.8, 0.25); veena.rotation.set(0.2, 0, 0.9); b.P.arm[1].add(veena);
    E(veena, mat(0xb9772f), [0.17, 0.25, 0.1], [0, 0.05, 0], 1); limb(veena, goldMat(), [0, 0.22, 0], [0, 0.95, 0], 0.03, 0.03); E(veena, goldMat(), [0.07, 0.07, 0.07], [0, 0.98, 0], 0);
    return { g, update: (t) => {
      a.g.position.y = Math.max(0, Math.sin(t * 2)) * 0.05; b.g.position.y = Math.max(0, Math.sin(t * 2 + 1.2)) * 0.05;
      a.P.head.rotation.y = Math.sin(t * 0.9) * 0.3 + 0.25; b.P.head.rotation.y = -Math.sin(t * 0.9 + 1) * 0.3 - 0.25;
      a.P.arm[-1].rotation.z = 0.35 + Math.sin(t * 1.6) * 0.1; b.P.arm[1].rotation.z = -0.5 + Math.sin(t * 1.9) * 0.08;
    } };
  }

  /* ---------- 6 · KANYA — Maiden with wheat ---------- */
  function maiden() {
    const g = new THREE.Group();
    const h = human({ dress: true, longHair: true, cloth: 0x6bbf74, cloth2: 0xf2c14e, hair: 0x5a3220 }); g.add(h.g);
    h.P.arm[1].rotation.set(-0.75, 0, -0.35);
    const sheaf = new THREE.Group(); sheaf.position.set(0, -0.76, 0.1); h.P.arm[1].add(sheaf);
    const stem = mat(0xc9b25a), grain = mat(0xf2c14e, { emissiveIntensity: 0.35 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, tilt = 0.35 + (i % 3) * 0.08, tip = [Math.sin(a) * tilt * 0.9, 0.95 + (i % 2) * 0.1, Math.cos(a) * tilt * 0.9];
      limb(sheaf, stem, [0, -0.2, 0], tip, 0.018, 0.012, 4);
      for (let k = 0; k < 4; k++) E(sheaf, grain, [0.04, 0.07, 0.04], [tip[0], tip[1] - k * 0.09, tip[2]], 0);
    }
    h.P.arm[-1].rotation.set(-0.5, 0, 0.5);
    const lamp = E(h.P.arm[-1], mat(0xfff0b0, { emissiveIntensity: 1 }), [0.12, 0.12, 0.12], [0, -0.95, 0.1], 1);
    // wings of light
    [-1, 1].forEach(s => { const w = cone(h.g, mat(0xdaf5ff, { transparent: true, opacity: 0.55, emissiveIntensity: 0.5 }), 0.22, 1.2, [s * 0.22, 1.7, -0.3], [0.2, 0, -s * 0.9], 4); w.scale.z = 0.25; });
    return { g, update: (t) => { h.g.position.y = Math.sin(t * 1.4) * 0.03; h.P.head.rotation.y = Math.sin(t * 0.8) * 0.3; h.P.arm[-1].rotation.z = 0.5 + Math.sin(t * 1.3) * 0.08; lamp.scale.setScalar(0.12 * (1 + Math.sin(t * 4) * 0.12)); } };
  }

  /* ---------- 11 · KUMBHA — Water-bearer ---------- */
  function waterbearer() {
    const g = new THREE.Group();
    const h = human({ cloth: 0x4fb7ff, cloth2: 0xf2f2ff, hair: 0x2b1a14 }); g.add(h.g); h.g.rotation.y = -0.3;
    h.P.arm[1].rotation.set(-0.6, 0, -1.4);                // arm raised to steady the urn
    const urn = new THREE.Group(); urn.position.set(0.5, 1.95, 0.3); urn.rotation.z = -0.75; g.add(urn);
    E(urn, goldMat(), [0.36, 0.42, 0.36], [0, 0, 0], 1); limb(urn, goldMat(), [0, 0.3, 0], [0, 0.55, 0], 0.17, 0.22); E(urn, mat(0x8fd8ff, { emissiveIntensity: 0.6 }), [0.22, 0.05, 0.22], [0, 0.58, 0], 1);
    const mouth = V(0.5 + Math.sin(0.75) * 0.58 * 0.0 + 0.2, 1.7, 0.3);
    const N = 110, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.09, map: Util.softTexture(), color: 0x8fdcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.frustumCulled = false; g.add(pts);
    const seed = Array.from({ length: N }, () => Math.random());
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 28), mat(0x4fb7ff, { transparent: true, opacity: 0.55, emissiveIntensity: 0.6 })); pool.position.set(0.95, 0.03, 0.4); g.add(pool);
    return { g, update: (t) => {
      h.g.position.y = Math.sin(t * 1.3) * 0.02; h.P.head.rotation.y = Math.sin(t * 0.8) * 0.3;
      urn.rotation.z = -0.75 - Math.sin(t * 0.9) * 0.06;
      for (let i = 0; i < N; i++) {
        const k = (t * 0.55 + seed[i]) % 1, x0 = 0.98, y0 = 2.0;
        pos[i * 3] = x0 + 0.1 + k * 0.45 + Math.sin(seed[i] * 40) * 0.04; pos[i * 3 + 1] = y0 - k * k * 2.0; pos[i * 3 + 2] = 0.3 + Math.cos(seed[i] * 40) * 0.04;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pool.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    } };
  }

  /* ---------- 7 · TULA — Scales ---------- */
  function scales() {
    const g = new THREE.Group(), gold = goldMat(), rose = mat(0xf3a6cf);
    E(g, gold, [0.7, 0.12, 0.7], [0, 0.06, 0], 1); limb(g, gold, [0, 0.1, 0], [0, 2.25, 0], 0.14, 0.06, 8); E(g, mat(0xff8ec2, { emissiveIntensity: 0.9 }), [0.14, 0.14, 0.14], [0, 2.38, 0], 1);
    const beam = new THREE.Group(); beam.position.y = 2.2; g.add(beam);
    limb(beam, gold, [-1.2, 0, 0], [1.2, 0, 0], 0.05, 0.05, 6); [-1, 1].forEach(s => E(beam, gold, [0.08, 0.08, 0.08], [s * 1.22, 0, 0], 1));
    const pans = [-1, 1].map(s => {
      const p = new THREE.Group(); g.add(p);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.14, 14, 1), rose); edges(dish); dish.position.y = -0.95; p.add(dish);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; limb(p, gold, [Math.cos(a) * 0.58, -0.9, Math.sin(a) * 0.58], [0, 0, 0], 0.012, 0.012, 3); }
      E(p, mat(s < 0 ? 0xffe39a : 0x9fd8ff, { emissiveIntensity: 0.9 }), [0.17, 0.17, 0.17], [0, -0.75, 0], 1);
      return p;
    });
    return { g, update: (t) => {
      const a = Math.sin(t * 0.9) * 0.14; beam.rotation.z = a;
      pans.forEach((p, i) => { const s = i ? 1 : -1; p.position.set(s * 1.22 * Math.cos(a), 2.2 + s * 1.22 * Math.sin(a), 0); p.rotation.z = -a * 0.3; });
    } };
  }

  /* ---------- 4 · KARKA — Crab ---------- */
  function crab() {
    const g = new THREE.Group(), shell = mat(0xe8604a, { emissiveIntensity: 0.2 }), light = mat(0xf59a7c), dark = mat(0xa3321f);
    E(g, shell, [1.0, 0.45, 0.78], [0, 0.7, 0], 2); E(g, light, [0.7, 0.2, 0.5], [0, 0.98, 0.05], 1);
    for (let i = 0; i < 5; i++) E(g, dark, [0.06, 0.05, 0.06], [(i - 2) * 0.2, 1.08, 0.2], 0);
    const eyesG = [-1, 1].map(s => { const e = new THREE.Group(); e.position.set(s * 0.3, 1.0, 0.6); g.add(e); limb(e, light, [0, 0, 0], [0, 0.28, 0.08], 0.05, 0.04); const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xfff6df, { emissiveIntensity: 0.7 })); b.position.set(0, 0.32, 0.09); e.add(b); E(e, mat(0x111111), [0.05, 0.05, 0.05], [0, 0.33, 0.17], 0); return e; });
    const legs = [];
    [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) {
      const lg = new THREE.Group(); lg.position.set(s * 0.82, 0.62, -0.38 + i * 0.28); lg.rotation.y = s * (0.15 - i * 0.12); g.add(lg);
      limb(lg, shell, [0, 0, 0], [s * 0.5, 0.35, 0.05], 0.09, 0.07); limb(lg, shell, [s * 0.5, 0.35, 0.05], [s * 0.85, -0.2, 0.1], 0.07, 0.05); limb(lg, dark, [s * 0.85, -0.2, 0.1], [s * 0.95, -0.55, 0.12], 0.05, 0.02);
      legs.push({ lg, s, i });
    } });
    const claws = [-1, 1].map(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.72, 0.8, 0.55); g.add(arm);
      limb(arm, shell, [0, 0, 0], [s * 0.35, 0.15, 0.4], 0.12, 0.1); limb(arm, shell, [s * 0.35, 0.15, 0.4], [s * 0.3, 0.45, 0.85], 0.1, 0.09);
      const hand = new THREE.Group(); hand.position.set(s * 0.3, 0.5, 0.9); arm.add(hand);
      E(hand, shell, [0.3, 0.24, 0.3], [0, 0, 0.1], 1);
      const top = new THREE.Group(), bot = new THREE.Group(); hand.add(top, bot); top.position.set(0, 0.06, 0.28); bot.position.set(0, -0.06, 0.28);
      cone(top, dark, 0.12, 0.5, [0, 0, 0.22], [Math.PI / 2, 0, 0], 5); cone(bot, dark, 0.1, 0.45, [0, 0, 0.2], [Math.PI / 2, 0, 0], 5);
      return { arm, hand, top, bot, s };
    });
    return { g, update: (t) => {
      legs.forEach(({ lg, s, i }) => { lg.rotation.z = s * Math.sin(t * 4 + i * 1.3 + (s > 0 ? 0 : 3)) * 0.08; lg.rotation.y = s * (0.15 - i * 0.12) + Math.sin(t * 4 + i) * 0.05; });
      claws.forEach(c => { const o = (Math.sin(t * 2.2 + (c.s > 0 ? 0 : 1.5)) * 0.5 + 0.5); c.top.rotation.x = -o * 0.5; c.bot.rotation.x = o * 0.35; c.arm.rotation.x = Math.sin(t * 1.4 + c.s) * 0.08; });
      eyesG.forEach((e, k) => { e.rotation.z = Math.sin(t * 1.5 + k) * 0.08; });
      g.position.y = Math.sin(t * 2) * 0.02;
    } };
  }

  /* ---------- 8 · VRISHCHIKA — Scorpion ---------- */
  function scorpion() {
    const g = new THREE.Group(), shell = mat(0x8a1f35, { emissiveIntensity: 0.22 }), amber = mat(0xe09040, { emissiveIntensity: 0.4 }), dark = mat(0x4a0f20);
    E(g, shell, [0.45, 0.26, 0.55], [0, 0.45, 0.35], 1); eyes(g, 0.14, 0.62, 0.7, 0.04);
    const bodySegs = [[0.4, 0.24, 0.42, -0.1], [0.37, 0.22, 0.36, -0.5], [0.33, 0.2, 0.3, -0.85], [0.28, 0.18, 0.26, -1.15]];
    bodySegs.forEach(([rx, ry, rz, z], i) => E(g, i % 2 ? dark : shell, [rx, ry, rz], [0, 0.44, z], 1));
    const legs = [];
    [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) {
      const lg = new THREE.Group(); lg.position.set(s * 0.32, 0.42, 0.55 - i * 0.32); g.add(lg);
      limb(lg, amber, [0, 0, 0], [s * 0.45, 0.2, 0.1 - i * 0.04], 0.06, 0.05); limb(lg, amber, [s * 0.45, 0.2, 0.1 - i * 0.04], [s * 0.85, -0.15, 0.15 - i * 0.06], 0.05, 0.035); limb(lg, dark, [s * 0.85, -0.15, 0.15 - i * 0.06], [s * 0.95, -0.42, 0.2 - i * 0.07], 0.035, 0.015);
      legs.push({ lg, s, i });
    } });
    const claws = [-1, 1].map(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.3, 0.5, 0.82); g.add(arm);
      limb(arm, shell, [0, 0, 0], [s * 0.3, 0.1, 0.35], 0.09, 0.08); limb(arm, shell, [s * 0.3, 0.1, 0.35], [s * 0.18, 0.2, 0.75], 0.08, 0.07);
      const hand = new THREE.Group(); hand.position.set(s * 0.15, 0.22, 0.8); arm.add(hand);
      E(hand, shell, [0.2, 0.16, 0.24], [0, 0, 0.05], 1);
      const a = new THREE.Group(), b = new THREE.Group(); hand.add(a, b); a.position.set(s * 0.06, 0.04, 0.2); b.position.set(s * -0.06, -0.02, 0.2);
      cone(a, amber, 0.09, 0.4, [0, 0, 0.18], [Math.PI / 2, 0, 0], 5); cone(b, amber, 0.08, 0.36, [0, 0, 0.16], [Math.PI / 2, 0, 0], 5);
      return { arm, a, b, s };
    });
    // curled tail
    const tail = new THREE.Group(); tail.position.set(0, 0.5, -1.25); g.add(tail);
    const segsN = 8, tailSegs = [];
    for (let i = 0; i < segsN; i++) {
      const k = i / (segsN - 1), ang = -0.35 + k * 2.5, r = 0.95;
      const p = [0, 0.15 + (1 - Math.cos(ang)) * 0.55 * 1.1 + k * 0.1, -0.15 - Math.sin(ang) * 0.75 * (1 - k * 0.45)];
      const s = E(tail, i % 2 ? amber : shell, [0.17 * (1 - k * 0.45), 0.17 * (1 - k * 0.45), 0.2 * (1 - k * 0.35)], p, 1);
      tailSegs.push(p);
    }
    const tip = tailSegs[segsN - 1]; cone(tail, mat(0xff4f6a, { emissiveIntensity: 0.8 }), 0.075, 0.34, [tip[0], tip[1] - 0.12, tip[2] + 0.12], [2.3, 0, 0], 5);
    return { g, update: (t) => {
      legs.forEach(({ lg, s, i }) => { lg.rotation.z = s * Math.sin(t * 5 + i * 1.4 + (s > 0 ? 0 : 3)) * 0.07; });
      claws.forEach(c => { const o = Math.sin(t * 2.4 + (c.s > 0 ? 0 : 1)) * 0.5 + 0.5; c.a.rotation.y = c.s * o * 0.4; c.b.rotation.y = -c.s * o * 0.4; c.arm.rotation.x = Math.sin(t * 1.3 + c.s) * 0.07; });
      tail.rotation.x = Math.sin(t * 1.6) * 0.07; tail.rotation.z = Math.sin(t * 1.1) * 0.06;
      g.rotation.z = 0;
    } };
  }

  /* ---------- 12 · MEENA — Two fish ---------- */
  function fishes() {
    const g = new THREE.Group();
    function fish(c1, c2) {
      const f = new THREE.Group(), body = mat(c1), fin = mat(c2, { emissiveIntensity: 0.35 });
      E(f, body, [0.62, 0.3, 0.26], [0, 0, 0], 1); E(f, body, [0.35, 0.24, 0.2], [0.55, 0, 0], 1);
      E(f, mat(0xfff6e0, { emissiveIntensity: 0.4 }), [0.34, 0.12, 0.2], [0.02, -0.12, 0], 1);
      eyes(f, 0.05, 0.06, 0.2, 0.04); f.children[f.children.length - 2].position.set(0.62, 0.08, 0.17); f.children[f.children.length - 1].position.set(0.62, 0.08, -0.17);
      cone(f, fin, 0.2, 0.55, [0, 0.4, 0], [0, 0, 0.25], 4).scale.z = 0.3;
      const tail = new THREE.Group(); tail.position.set(-0.78, 0, 0); f.add(tail);
      [-1, 1].forEach(s => { const c = cone(tail, fin, 0.22, 0.7, [-0.3, s * 0.22, 0], [0, 0, s * 0.0 + Math.PI / 2 + s * 0.45], 4); c.scale.z = 0.25; });
      [-1, 1].forEach(s => { const c = cone(f, fin, 0.12, 0.4, [0.1, -0.12, s * 0.28], [s * 0.9, 0, 0.9], 4); c.scale.y = 1; });
      f.userData.tail = tail; return f;
    }
    const A = fish(0xffc94a, 0xff8a3d), B = fish(0x5fd0c2, 0x4f8cff);
    g.add(A, B);
    const orbit = (f, ph, t) => {
      const a = t * 0.9 + ph, rx = 1.05, rz = 0.8;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz, y = 1.15 + Math.sin(a * 2) * 0.35 * Math.cos(ph);
      const dx = -Math.sin(a) * rx, dz = Math.cos(a) * rz;
      f.position.set(x, y, z); f.rotation.y = Math.atan2(-dz, dx) + Math.PI;
      f.rotation.z = Math.sin(a * 2) * 0.25 * Math.cos(ph);
      f.userData.tail.rotation.y = Math.sin(t * 7 + ph) * 0.45;
    };
    const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.35, 0.012, 6, 40), mat(0x8fe8ff, { transparent: true, opacity: 0.4, emissiveIntensity: 0.8 })); r.rotation.x = Math.PI / 2; r.position.y = 0.05; g.add(r); return r; });
    const bn = 40, bpos = new Float32Array(bn * 3), bs = Array.from({ length: bn }, () => [Math.random(), Math.random() * 6.28, Math.random()]);
    const bub = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.08, map: Util.softTexture(), color: 0xbdf0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); bub.geometry.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bub.frustumCulled = false; g.add(bub);
    return { g, update: (t) => {
      orbit(A, 0, t); orbit(B, Math.PI, t);
      rings.forEach((r, i) => { const k = ((t * 0.4 + i / 3) % 1); r.scale.setScalar(0.6 + k * 1.2); r.material.opacity = 0.5 * (1 - k); });
      for (let i = 0; i < bn; i++) { const k = (t * 0.25 + bs[i][0]) % 1; bpos[i * 3] = Math.cos(bs[i][1]) * (0.4 + bs[i][2] * 1.0); bpos[i * 3 + 1] = k * 2.6; bpos[i * 3 + 2] = Math.sin(bs[i][1]) * (0.4 + bs[i][2] * 0.8); }
      bub.geometry.attributes.position.needsUpdate = true;
    } };
  }

  const BUILDERS = [ram, bull, twins, crab, lion, maiden, scales, scorpion, archer, seagoat, waterbearer, fishes];

  /** Builds sign #i fitted into a ~3-unit box, sitting on y = 0. */
  function build(i) {
    const c = BUILDERS[i](); c.update(0, 0);
    const box = new THREE.Box3().setFromObject(c.g), size = box.getSize(V(0, 0, 0)), ctr = box.getCenter(V(0, 0, 0));
    const k = Math.min(3.0 / size.y, 3.7 / size.z, 3.7 / size.x);
    const root = new THREE.Group(); root.add(c.g);
    c.g.position.set(-ctr.x, -box.min.y, -ctr.z);
    const fit = new THREE.Group(); fit.add(root); fit.scale.setScalar(k);
    c.g.position.multiplyScalar(1);
    return { group: fit, update: c.update, height: size.y * k };
  }

  /* ---------- a ready-made view: pedestal + lights + particles ---------- */
  function createView(el, opts = {}) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.2, opts.dist ?? 7.4); camera.lookAt(0, 1.3, 0);
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a6a, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.3); key.position.set(3, 6, 5); scene.add(key);
    const rim = new THREE.PointLight(0x8b6bff, 1.6, 20); rim.position.set(-4, 3, -3); scene.add(rim);
    const warm = new THREE.PointLight(0xffa050, 1.1, 16); warm.position.set(3, 0.6, 3); scene.add(warm);

    const spin = new THREE.Group(); scene.add(spin);
    const stage = new THREE.Group(); scene.add(stage);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.12, 48), mat(0x1a1240, { metalness: 0.6, roughness: 0.35, emissiveIntensity: 0.08 })); disc.position.y = -0.07; stage.add(disc);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.025, 8, 96), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; stage.add(ring);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.012, 6, 12), ringMat); rune.rotation.x = Math.PI / 2; rune.position.y = 0.01; stage.add(rune);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ map: Util.softTexture(128, [[0, 'rgba(255,255,255,.55)'], [0.6, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]), color: 0xffd36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; stage.add(glow);

    const N = 90, pp = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [Math.random() * 6.28, 0.8 + Math.random() * 1.7, Math.random(), 0.2 + Math.random() * 0.6]);
    const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.09, map: Util.softTexture(), color: 0xffe2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    dust.geometry.setAttribute('position', new THREE.BufferAttribute(pp, 3)); dust.frustumCulled = false; scene.add(dust);

    let cur = null, curIdx = -1;
    const spinner = Util.makeSpinner(el, spin, { auto: 0.35, maxPitch: 0.35 });
    function setSign(i) {
      if (i === curIdx) return; curIdx = i;
      if (cur) spin.remove(cur.group);
      cur = build(i); spin.add(cur.group);
      const col = new THREE.Color(SIGNS[i].hex); ringMat.color.copy(col).lerp(new THREE.Color(0xffd36b), 0.35); glow.material.color.copy(col); rim.color.copy(col);
    }
    const view = Stage.addView(el, scene, camera, (dt, t) => {
      spinner.step(dt); if (cur) cur.update(t, dt);
      rune.rotation.z += dt * 0.4; ring.scale.setScalar(1 + Math.sin(t * 1.5) * 0.008);
      for (let i = 0; i < N; i++) { const s = seeds[i], a = s[0] + t * s[3] * 0.5, k = (t * 0.12 * s[3] + s[2]) % 1; pp[i * 3] = Math.cos(a) * s[1]; pp[i * 3 + 1] = k * 3.4; pp[i * 3 + 2] = Math.sin(a) * s[1]; }
      dust.geometry.attributes.position.needsUpdate = true;
    });
    return { view, setSign, scene };
  }

  return { build, createView };
})();
