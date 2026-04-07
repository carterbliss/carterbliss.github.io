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
  const TRAIL_MAX = 22;
  const trail     = [];
  let mouse       = { x: -200, y: -200 };
  let visible     = false;

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    visible = true;
    trail.push({ x: e.clientX, y: e.clientY });
    if (trail.length > TRAIL_MAX) trail.shift();
  });

  document.addEventListener('mouseleave', () => { visible = false; });
  document.addEventListener('mouseenter', () => { visible = true; });

  // ── Render loop ────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw trail: black at tail → light grey near cursor tip
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const t     = i / (trail.length - 1); // 0 = oldest (black), 1 = newest (light grey)
        const g     = Math.round(t * 200);     // grey channel: 0 → 200
        const alpha = t * 0.72;
        const width = 1 + t * 2.5;

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

    // Position arrow tip at exact cursor coords
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
