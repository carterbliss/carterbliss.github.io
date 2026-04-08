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
    // Final cursor display size
    const W = 22, H = 30;
    // Process at 4× for fidelity — preserves thin lines between fingers
    const SCALE = 4;
    const PW = W * SCALE, PH = H * SCALE;

    // Step 1: draw at high resolution
    const hi = document.createElement('canvas');
    hi.width = PW; hi.height = PH;
    const hx2 = hi.getContext('2d');
    hx2.drawImage(handImg, 0, 0, PW, PH);

    const imageData = hx2.getImageData(0, 0, PW, PH);
    const d = imageData.data;

    // Step 2: flood-fill from corners to mark background (stop at any non-pure-white pixel)
    const visited = new Uint8Array(PW * PH);
    const stack = [0, PW - 1, (PH - 1) * PW, PH * PW - 1];
    while (stack.length) {
      const idx = stack.pop();
      if (idx < 0 || idx >= PW * PH || visited[idx]) continue;
      visited[idx] = 1;
      const r = d[idx * 4], g = d[idx * 4 + 1], b = d[idx * 4 + 2];
      if (r < 220 || g < 220 || b < 220) continue; // stop at outlines and finger-gap lines
      const x = idx % PW, y = Math.floor(idx / PW);
      if (x > 0)    stack.push(idx - 1);
      if (x < PW-1) stack.push(idx + 1);
      if (y > 0)    stack.push(idx - PW);
      if (y < PH-1) stack.push(idx + PW);
    }

    // Step 3: recolor pixels
    for (let i = 0; i < PW * PH; i++) {
      const pi = i * 4;
      if (visited[i]) {
        d[pi] = d[pi+1] = d[pi+2] = d[pi+3] = 0; // background → transparent
      } else {
        const brightness = (d[pi] + d[pi+1] + d[pi+2]) / (3 * 255);
        if (brightness > 0.55) {
          // White fill → blue gradient
          const t = ((i % PW) / PW + Math.floor(i / PW) / PH) / 2;
          d[pi]   = Math.round(144 + (13  - 144) * t);
          d[pi+1] = Math.round(202 + (71  - 202) * t);
          d[pi+2] = Math.round(249 + (161 - 249) * t);
          d[pi+3] = 255;
        }
        // Dark pixels (black outline) stay unchanged
      }
    }
    hx2.putImageData(imageData, 0, 0);

    // Step 4: downscale to final cursor size (browser anti-aliases, preserving detail)
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(hi, 0, 0, W, H);

    const url = out.toDataURL();
    const hotX = Math.round(W / 2), hotY = 2;
    pointerStyleEl.textContent =
      'a,button,[role="button"],.c-button{cursor:url("' + url + '") ' + hotX + ' ' + hotY + ',pointer!important;}';
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
