(function () {
  // Skip on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  // ── Inject cursor: none so the OS cursor hides ─────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = [
    '*, *::before, *::after { cursor: none !important; }',
    '@media (hover: none) { *, *::before, *::after { cursor: auto !important; } }'
  ].join('');
  document.head.appendChild(styleEl);

  // ── Trail canvas ───────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:99998;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const dpr         = window.devicePixelRatio || 1;
    canvas.width      = window.innerWidth  * dpr;
    canvas.height     = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Arrow cursor element ───────────────────────────────────
  const arrow = document.createElement('div');
  const ARROW_STYLE = [
    'position:fixed', 'top:0', 'left:0', 'pointer-events:none', 'z-index:99999',
    'will-change:transform',
    'transition:opacity 0.15s ease',
    'filter:drop-shadow(0 2px 5px rgba(13,71,161,0.6))',
    'width:20px', 'height:26px',
    'background:linear-gradient(135deg,#90CAF9 0%,#2196F3 45%,#0D47A1 100%)',
    'clip-path:polygon(0% 0%,0% 62%,20% 46%,35% 73%,50% 67%,35% 40%,60% 40%)'
  ].join(';');

  arrow.style.cssText = ARROW_STYLE;
  document.body.appendChild(arrow);

  // ── State ──────────────────────────────────────────────────
  const TRAIL_LIFETIME = 450;
  const MIN_DIST       = 3;
  const trail          = [];
  let mouse            = { x: -200, y: -200 };
  let visible          = false;
  let isPointer        = false;

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    visible = true;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) >= MIN_DIST) {
      trail.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    }
  });

  document.addEventListener('mouseleave', () => { visible = false; });

  // ── Pointer cursor: load hand image, colorize white fill to blue ──
  // Uses canvas pixel manipulation:
  //   1. Flood-fill from corners → mark background white pixels
  //   2. Remaining white pixels are interior fill → colorize to blue gradient
  //   3. Background → transparent; output as CSS cursor data URL
  const pointerStyleEl = document.createElement('style');
  document.head.appendChild(pointerStyleEl);

  const handImg = new Image();
  handImg.onload = function () {
    const W = 44, H = 54;
    const offscreen = document.createElement('canvas');
    offscreen.width = W; offscreen.height = H;
    const cx = offscreen.getContext('2d');
    cx.drawImage(handImg, 0, 0, W, H);

    const imageData = cx.getImageData(0, 0, W, H);
    const d = imageData.data;

    // Flood-fill from corners through light pixels to mark background
    const visited = new Uint8Array(W * H);
    const stack = [0, W - 1, (H - 1) * W, H * W - 1];
    while (stack.length) {
      const idx = stack.pop();
      if (idx < 0 || idx >= W * H || visited[idx]) continue;
      visited[idx] = 1;
      const r = d[idx * 4], g = d[idx * 4 + 1], b = d[idx * 4 + 2];
      if (r < 160 || g < 160 || b < 160) continue; // stop at dark outline
      const x = idx % W, y = Math.floor(idx / W);
      if (x > 0)   stack.push(idx - 1);
      if (x < W-1) stack.push(idx + 1);
      if (y > 0)   stack.push(idx - W);
      if (y < H-1) stack.push(idx + W);
    }

    // Recolor pixels
    for (let i = 0; i < W * H; i++) {
      const pi = i * 4;
      if (visited[i]) {
        // Background → transparent
        d[pi] = d[pi+1] = d[pi+2] = d[pi+3] = 0;
      } else {
        const brightness = (d[pi] + d[pi+1] + d[pi+2]) / (3 * 255);
        if (brightness > 0.55) {
          // White fill → blue gradient (135deg: top-left #90CAF9, bottom-right #0D47A1)
          const t = ((i % W) / W + Math.floor(i / W) / H) / 2;
          d[pi]   = Math.round(144 + (13  - 144) * t); // R: 144→13
          d[pi+1] = Math.round(202 + (71  - 202) * t); // G: 202→71
          d[pi+2] = Math.round(249 + (161 - 249) * t); // B: 249→161
          d[pi+3] = 255;
        }
        // else: dark pixels (black outline) stay unchanged
      }
    }

    cx.putImageData(imageData, 0, 0);
    const url = offscreen.toDataURL();
    // Hotspot: fingertip is roughly center-top of the hand image
    const hx = Math.round(W / 2), hy = 2;
    pointerStyleEl.textContent =
      'a,button,[role="button"],.c-button{cursor:url("' + url + '") ' + hx + ' ' + hy + ',pointer!important;}';
  };
  handImg.src = '/assets/hand-cursor.png';

  // ── Pointer state ──────────────────────────────────────────
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = true;
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = false;
    }
  });

  // ── Render loop ────────────────────────────────────────────
  function render() {
    const now = Date.now();
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    while (trail.length && now - trail[0].t > TRAIL_LIFETIME) trail.shift();

    if (trail.length >= 3) {
      for (let i = 1; i < trail.length - 1; i++) {
        const p0 = trail[i - 1], p1 = trail[i], p2 = trail[i + 1];
        const mx0 = (p0.x + p1.x) / 2, my0 = (p0.y + p1.y) / 2;
        const mx1 = (p1.x + p2.x) / 2, my1 = (p1.y + p2.y) / 2;
        const freshness = 1 - (now - p1.t) / TRAIL_LIFETIME;
        const g = Math.round(freshness * 200);
        ctx.beginPath();
        ctx.moveTo(mx0, my0);
        ctx.quadraticCurveTo(p1.x, p1.y, mx1, my1);
        ctx.strokeStyle = `rgba(${g},${g},${g},${freshness * 0.75})`;
        ctx.lineWidth   = 1 + freshness * 2.5;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }
    }

    arrow.style.transform = `translate(${mouse.x}px,${mouse.y}px)`;
    arrow.style.opacity   = (visible && !isPointer) ? '1' : '0';

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  // ── Magnetic effect ────────────────────────────────────────
  const MAG_RADIUS = 80;
  const magnetEls  = () => document.querySelectorAll('.c-button, button, a.cta-button, a.works-button');
  let magnetTarget = null;

  document.addEventListener('mousemove', (e) => {
    let closest = null, closestDist = Infinity;
    magnetEls().forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < MAG_RADIUS && dist < closestDist) { closestDist = dist; closest = el; }
    });
    if (closest !== magnetTarget) {
      if (magnetTarget) { magnetTarget.style.transform = ''; magnetTarget.style.transition = 'transform 0.4s ease'; }
      magnetTarget = closest;
    }
    if (magnetTarget) {
      const rect = magnetTarget.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + rect.width  / 2)) * 0.25;
      const dy = (e.clientY - (rect.top  + rect.height / 2)) * 0.25;
      magnetTarget.style.transition = 'transform 0.15s ease';
      magnetTarget.style.transform  = `translate(${dx}px,${dy}px) scale(1.06)`;
    }
  });

  document.addEventListener('mouseleave', () => {
    if (magnetTarget) { magnetTarget.style.transform = ''; magnetTarget.style.transition = 'transform 0.4s ease'; magnetTarget = null; }
  });
})();
