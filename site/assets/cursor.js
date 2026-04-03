(function () {
  // Skip on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  // ── DOM setup ──────────────────────────────────────────────
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  // ── State ──────────────────────────────────────────────────
  let mouse  = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let dotPos = { x: mouse.x, y: mouse.y };
  let ringPos= { x: mouse.x, y: mouse.y };
  let magnetTarget = null;  // button being attracted to
  let magnetCenter = null;

  const DOT_SPEED  = 1.0;   // dot follows exactly
  const RING_SPEED = 0.10;  // ring lags behind (lower = more lag)
  const MAG_RADIUS = 80;    // px — magnetic pull threshold
  const MAG_PULL   = 0.35;  // strength: 0 = no pull, 1 = snap to center

  // ── Mouse tracking ─────────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    checkMagnets(e);
  });

  // ── Cursor state classes ───────────────────────────────────
  document.addEventListener('mousedown', () => {
    dot.classList.add('cursor--click');
    ring.classList.add('cursor--click');
  });
  document.addEventListener('mouseup', () => {
    dot.classList.remove('cursor--click');
    ring.classList.remove('cursor--click');
  });

  // Hover on links / buttons → shrink dot, expand ring
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      dot.classList.add('cursor--hover');
      ring.classList.add('cursor--hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, [role="button"], .c-button')) {
      dot.classList.remove('cursor--hover');
      ring.classList.remove('cursor--hover');
    }
  });

  // ── Magnetic effect ────────────────────────────────────────
  const magnetEls = () => document.querySelectorAll('.c-button, button, a.cta-button, a.works-button');

  function checkMagnets(e) {
    let closest = null;
    let closestDist = Infinity;

    magnetEls().forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

      if (dist < MAG_RADIUS && dist < closestDist) {
        closestDist = dist;
        closest = el;
        magnetCenter = { x: cx, y: cy };
      }
    });

    if (closest !== magnetTarget) {
      // leaving old magnet
      if (magnetTarget) {
        magnetTarget.style.transform = '';
        magnetTarget.style.transition = 'transform 0.4s ease';
      }
      magnetTarget = closest;
    }

    if (magnetTarget) {
      const rect = magnetTarget.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) * 0.25;
      const dy = (e.clientY - cy) * 0.25;
      magnetTarget.style.transition = 'transform 0.15s ease';
      magnetTarget.style.transform  = `translate(${dx}px, ${dy}px) scale(1.06)`;
    }
  }

  // Reset magnet on leave
  document.addEventListener('mouseleave', () => {
    if (magnetTarget) {
      magnetTarget.style.transform = '';
      magnetTarget.style.transition = 'transform 0.4s ease';
      magnetTarget = null;
    }
  });

  // ── Lerp helper ────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Render loop ────────────────────────────────────────────
  function render() {
    // Dot snaps instantly, ring trails
    dotPos.x  = lerp(dotPos.x,  mouse.x, DOT_SPEED);
    dotPos.y  = lerp(dotPos.y,  mouse.y, DOT_SPEED);
    ringPos.x = lerp(ringPos.x, mouse.x, RING_SPEED);
    ringPos.y = lerp(ringPos.y, mouse.y, RING_SPEED);

    dot.style.transform  = `translate(${dotPos.x}px, ${dotPos.y}px)`;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
