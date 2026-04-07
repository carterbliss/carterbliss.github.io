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
  const ARROW_BASE = [
    'position:fixed', 'top:0', 'left:0', 'pointer-events:none', 'z-index:99999',
    'will-change:transform',
    'transition:opacity 0.15s ease',
    'filter:drop-shadow(0 2px 5px rgba(13,71,161,0.6))'
  ].join(';');

  // Arrow shape: tip at exact (0,0) top-left
  const ARROW_STYLE = [
    ARROW_BASE,
    'width:20px', 'height:26px',
    'background:linear-gradient(135deg,#90CAF9 0%,#2196F3 45%,#0D47A1 100%)',
    'clip-path:polygon(0% 0%,0% 62%,20% 46%,35% 73%,50% 67%,35% 40%,60% 40%)'
  ].join(';');

  // Pointer hand: index finger on the LEFT, other fingers as descending bumps to the right.
  // Index finger left edge is at 8% of 32px = ~3px → offsetX = -3 so tip aligns with mouse.
  const POINTER_STYLE = [
    ARROW_BASE,
    'width:32px', 'height:40px',
    'background:linear-gradient(135deg,#90CAF9 0%,#2196F3 45%,#0D47A1 100%)',
    'clip-path:polygon(' +
      '8% 0%,'  +   // index finger left tip
      '28% 0%,' +   // index finger right tip
      '28% 42%,'+   // index right base
      '40% 28%,'+   // middle finger peak
      '54% 28%,'+   // middle right
      '54% 43%,'+   // middle base
      '66% 33%,'+   // ring finger peak
      '77% 33%,'+   // ring right
      '77% 46%,'+   // ring base
      '86% 38%,'+   // pinky peak
      '94% 38%,'+   // pinky right
      '94% 100%,'+  // bottom right
      '4% 100%,' +  // bottom left
      '4% 52%,'  +  // left palm above thumb
      '0% 44%,'  +  // thumb tip
      '4% 36%,'  +  // thumb top
      '8% 40%,'  +  // index base left
      '8% 0%'    +  // close
    ')'
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

  // ── Pointer state ──────────────────────────────────────────
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = true;
      arrow.style.cssText = POINTER_STYLE;
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = false;
      arrow.style.cssText = ARROW_STYLE;
    }
  });

  // ── Render loop ────────────────────────────────────────────
  function render() {
    const now = Date.now();
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Evict expired points
    while (trail.length && now - trail[0].t > TRAIL_LIFETIME) trail.shift();

    // Smooth bezier trail through midpoints
    if (trail.length >= 3) {
      for (let i = 1; i < trail.length - 1; i++) {
        const p0 = trail[i - 1], p1 = trail[i], p2 = trail[i + 1];
        const mx0 = (p0.x + p1.x) / 2, my0 = (p0.y + p1.y) / 2;
        const mx1 = (p1.x + p2.x) / 2, my1 = (p1.y + p2.y) / 2;

        const freshness = 1 - (now - p1.t) / TRAIL_LIFETIME;
        const g         = Math.round(freshness * 200);

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

    const offsetX = isPointer ? -3 : 0;
    arrow.style.transform = `translate(${mouse.x + offsetX}px,${mouse.y}px)`;
    arrow.style.opacity = visible ? '1' : '0';

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
