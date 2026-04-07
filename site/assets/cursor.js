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

  // ── Pointer hand element (image with blue filter) ──────────
  // CSS filter converts white pixels to blue while keeping black pixels black:
  //   sepia → warm tint on white, black stays black
  //   saturate → amplify color
  //   hue-rotate → shift warm yellow into blue range (~195deg)
  //   brightness → compensate lightness
  const pointerEl = document.createElement('img');
  pointerEl.src = '/assets/hand-cursor.png';
  pointerEl.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'pointer-events:none', 'z-index:99999',
    'will-change:transform',
    'transition:opacity 0.15s ease',
    'width:44px', 'height:54px',
    'object-fit:contain',
    'filter:sepia(1) saturate(400%) hue-rotate(195deg) brightness(1.15) drop-shadow(0 2px 5px rgba(13,71,161,0.6))',
    'opacity:0'
  ].join(';');
  document.body.appendChild(pointerEl);

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

    // Arrow cursor: tip at top-left (0,0)
    arrow.style.transform = `translate(${mouse.x}px,${mouse.y}px)`;
    arrow.style.opacity   = (visible && !isPointer) ? '1' : '0';

    // Pointer cursor: fingertip is roughly center-top of the image; offset left by ~half width
    pointerEl.style.transform = `translate(${mouse.x - 22}px,${mouse.y}px)`;
    pointerEl.style.opacity   = (visible && isPointer) ? '1' : '0';

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
