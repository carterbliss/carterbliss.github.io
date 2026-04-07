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
  arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 22" width="20" height="27">
    <defs>
      <linearGradient id="cursorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#90CAF9"/>
        <stop offset="40%"  stop-color="#2196F3"/>
        <stop offset="100%" stop-color="#0D47A1"/>
      </linearGradient>
      <linearGradient id="cursorGloss" x1="0%" y1="0%" x2="70%" y2="70%">
        <stop offset="0%"   stop-color="white" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M1 1 L1 17 L5 13 L8 20 L11 18.5 L8 11.5 L13 11.5 Z"
      fill="url(#cursorGrad)" stroke="#0A3D91" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M1 1 L1 17 L5 13 L8 20 L11 18.5 L8 11.5 L13 11.5 Z"
      fill="url(#cursorGloss)"/>
  </svg>`;
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
