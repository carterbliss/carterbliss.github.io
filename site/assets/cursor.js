(function () {
  // Skip on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  // ── Trail canvas ───────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Arrow cursor element ───────────────────────────────────
  const arrow = document.createElement('div');
  arrow.className = 'cursor-arrow';
  document.body.appendChild(arrow);

  // ── State ──────────────────────────────────────────────────
  const TRAIL_LIFETIME = 450; // ms each trail point lives before fading out
  const trail          = [];  // [{ x, y, t }]
  let mouse            = { x: -200, y: -200 };
  let visible          = false;
  let isPointer        = false;

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    visible = true;
    trail.push({ x: e.clientX, y: e.clientY, t: Date.now() });
  });

  document.addEventListener('mouseleave', () => { visible = false; });

  // ── Pointer state (links / buttons) ───────────────────────
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = true;
      arrow.classList.add('cursor--pointer');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      isPointer = false;
      arrow.classList.remove('cursor--pointer');
    }
  });

  // ── Render loop ────────────────────────────────────────────
  function render() {
    const now = Date.now();

    // Evict expired trail points
    while (trail.length && now - trail[0].t > TRAIL_LIFETIME) trail.shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw trail: newest = light grey, fades to black then transparent as it ages
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const age       = (now - trail[i].t) / TRAIL_LIFETIME; // 0 = fresh, 1 = expired
        const freshness = 1 - age;
        const g         = Math.round(freshness * 200);          // 200 = light grey, 0 = black
        const alpha     = freshness * 0.75;
        const width     = 1 + freshness * 2.5;

        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x,     trail[i].y);
        ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, ${alpha})`;
        ctx.lineWidth   = width;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }
    }

    // Arrow tip is at div top-left (clip-path starts at 0%,0%), so translate directly
    arrow.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
    arrow.style.opacity   = visible ? '1' : '0';

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
      if (dist < MAG_RADIUS && dist < closestDist) {
        closestDist = dist;
        closest     = el;
      }
    });

    if (closest !== magnetTarget) {
      if (magnetTarget) {
        magnetTarget.style.transform  = '';
        magnetTarget.style.transition = 'transform 0.4s ease';
      }
      magnetTarget = closest;
    }

    if (magnetTarget) {
      const rect = magnetTarget.getBoundingClientRect();
      const dx   = (e.clientX - (rect.left + rect.width  / 2)) * 0.25;
      const dy   = (e.clientY - (rect.top  + rect.height / 2)) * 0.25;
      magnetTarget.style.transition = 'transform 0.15s ease';
      magnetTarget.style.transform  = `translate(${dx}px, ${dy}px) scale(1.06)`;
    }
  });

  document.addEventListener('mouseleave', () => {
    if (magnetTarget) {
      magnetTarget.style.transform  = '';
      magnetTarget.style.transition = 'transform 0.4s ease';
      magnetTarget = null;
    }
  });
})();
