/* ============================================================
   STAGE — one shared WebGL renderer drawing many "views"
   (each view is a transparent <div> on the page; the renderer
   scissors a viewport over it). Avoids the browser's limit on
   WebGL contexts and keeps everything on a single canvas.
   ============================================================ */
'use strict';

const Stage = (() => {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const views = [];
  let W = innerWidth, H = innerHeight;
  const hooks = [];

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
  }
  addEventListener('resize', resize);
  resize();

  /** el: DOM placeholder · scene/camera: three objects · update(dt, t, rect): per-frame logic */
  function addView(el, scene, camera, update) {
    const v = { el, scene, camera, update, enabled: true, onScreen: false };
    views.push(v);
    return v;
  }

  function removeView(v) { const i = views.indexOf(v); if (i >= 0) views.splice(i, 1); }
  function onFrame(fn) { hooks.push(fn); }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt, now / 1000);
  }
  function tick(dt, t) {
    hooks.forEach(h => h(dt, t));

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const v of views) {
      if (!v.enabled || !v.el.isConnected) continue;
      const r = v.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 4 || r.height < 4) { v.onScreen = false; continue; }
      v.onScreen = true;
      const x = r.left, y = H - r.bottom;
      renderer.setViewport(x, y, r.width, r.height);
      renderer.setScissor(x, y, r.width, r.height);
      v.camera.aspect = r.width / r.height;
      v.camera.updateProjectionMatrix();
      if (v.update) v.update(dt, t, r);
      renderer.clearDepth();
      renderer.render(v.scene, v.camera);
    }
  }
  requestAnimationFrame(frame);

  /** Advance n frames manually (used for testing when the tab is throttled). */
  function advance(n, dt = 1 / 30) { let t = performance.now() / 1000; for (let i = 0; i < n; i++) { t += dt; tick(dt, t); } }
  return { renderer, addView, removeView, onFrame, advance, get W() { return W; }, get H() { return H; } };
})();

/* Shared helpers ------------------------------------------------ */
const Util = {
  softTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c); return tex;
  },
  /** Drag-to-rotate with inertia and idle auto-spin for a given element + object. */
  makeSpinner(el, obj, opts = {}) {
    const st = { vy: 0, vx: 0, down: false, lx: 0, ly: 0, idleAt: 0, pitch: 0 };
    const auto = opts.auto ?? 0.35, maxPitch = opts.maxPitch ?? 0.5;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', e => { st.down = true; st.lx = e.clientX; st.ly = e.clientY; st.vy = 0; try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    el.addEventListener('pointermove', e => {
      if (!st.down) return;
      const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY;
      obj.rotation.y += dx * 0.011; st.vy = dx * 0.011 * 60;
      st.pitch = Math.max(-maxPitch, Math.min(maxPitch, st.pitch + dy * 0.006));
    });
    const up = () => { st.down = false; st.idleAt = performance.now() + 1500; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return {
      step(dt) {
        if (!st.down) {
          if (Math.abs(st.vy) > 0.05) { obj.rotation.y += st.vy * dt; st.vy *= Math.exp(-2.4 * dt); }
          else if (performance.now() > st.idleAt) obj.rotation.y += auto * dt;
          st.pitch *= Math.exp(-0.6 * dt);
        }
        obj.rotation.x = st.pitch;
      },
    };
  },
};
