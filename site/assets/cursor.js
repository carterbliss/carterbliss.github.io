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

  // Pointer hand: download.png image used as mask over blue gradient.
  // Fingertip is near top-center of the image; offsetX centers it on the mouse.
  const HAND_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANcAAADqCAMAAAAGRyD0AAAAhFBMVEX///8AAADl5eXk5OTm5ubj4+Pz8/P19fXw8PDr6+vu7u76+vr4+Pjg4OAwMDAsLCw+Pj7X19eampqioqK7u7tiYmLR0dHDw8OBgYE8PDy/v7+MjIxRUVG0tLR8fHwjIyMXFxdHR0dbW1tra2tnZ2eoqKgQEBAcHByRkZFycnI1NTVERETTKhpxAAAWnUlEQVR4nNVd62KjvA404ICNyXZzadJb2u0lbdPv/d/vGEhiyRJgCGT38IfdZqpqYhiMPZaFECKLZWKEMLGMC/vfRMapPUkZ5/akpdT2pCwmHKqF3D+/fUXRy+3dbq7MOFF7QKWYIGw+//4TgeNp/Zd4JXH5K8aeSuwsTipsXGPjuASpJJ4FQrO7yD/+PIj4wqj9oLHIsixVStlT5k4pOimH6YaKxSehZY83nV0StTe0/B5VxTgpmzBPKsZp/eUU9mTqbyWrT51QtedYlcf8gqj9oeWlqdylmdeXZlpfzIW9isuL2V7FWX0xd0HFYxOtKNqYoVEHQEWS1N9BcvwOkrjEzpLqO7Cn6jtIZtXX1Q1dNtOyxPTAqAOgwhiRSS3tqbCnzP7fnlJhhNZS2VOutbYnZX8quqD5QxutKLLZDIg6BKoF0M5EJox2xjEjsyw0n7fTin4PiToIetZ547TTqiTWzhpb6Wsr1LxiGv+9PXnEVgOiDoLGti1NZpuvMKawp8z+157S+qTsSWmd1yfdARVbSOHtoSjsn5x/I2JF3jfqQOhZ5/G9eNTO2Uk7Z1BmeWiS/gIEtmlWfY/28n8HP/7uG3UodDyd16C5/mgNoKD/8Xk1nffbK2a/g4T7ujBUP7v0lURQQGzTM+pQqCiKIsvzPDufCntK65OyJ1WfUvvfdqgA8pBhqPg5f3SX9Ys6FHrSQwE1JmE1hul2Qqh0F5tKMNTo82f3ql/UgdC44nV+JnB9/4bHB4Guz7m/KwK9dZdov6gDofXzS9a3nJSyxNqf1lgJ32ksph26O6f+mBOo4zXvF3UgVNr+4Sy8e9YCla4j/0ig2vFa9Io6GDqazmvX5V0SaI54XVXn60uTvNMk3OsPB9XuDWVFoLi9ekQdDBXpSIdxD6ldQT50vDbZWH+x9RC1ds6Adp7HDBJ2eKEJCnhpAnW81rJX1IFQpPOXDQe57sZaE+gtIH298ahaUYw9FbWilNg4qb+DJKm+gxrTAnW8dpJAHa+97BV1IDTx9VCeNCYGGhPXGhO3QUH3cEugQA/3vaIOhjpeMaudCSezHBTz8qA+r+Cog6FW52vsUTvjk3ZW2KN2JieZbYFiXh5UI149og6GimOPWIV3nnlo5ng9GB+aOV4r0SfqYGilG0fttG8wQDvjGN2LWGYZKNANCHW8lrpX1IHQ6+v88po6z34HCfd1NUMP4NFLoB3tNUoCuL2OQzk5GvVJmwZ/mqGp47UVPjRF91ePqIOhZ53HGnPUzuQ8CAllloXmkJcPzSGvPlEHQwN5xd28Pvrz6o46GHq8DstTLo5DilXbSte2RlZtK2QbFFxqlpcHVcx1GBR1KNTUuhHQ50q6umeAV1v/0NON8E5fL2gyns4DXlTnP3xeV5pfPmon907T8Fgk0De/vSCU8AqNOhAai7EmfA3gZXxo4XitzJjTyI1Qf3wj5sYMEnZ4AUOVmxPa0PENwKtX1MHQ0d5TMC//PQXxutJ7SsjcCzvsj6B8e53GDw+QV4+og6GVbjRo5yz8NdxCHS9G590cGNaNzqgDoSPq/KtrLwo9+Lz+po+IH+Zqgv4HeBEo4RUadSDU9xGl5JQ2iaoHFb8dr8yHGnB/ZX2iDoaO5iNSjteCQLFu/F/5iFLEy4NiXnFtG8lVCfnXfURee2GovgO8hN5+P32V//58vdspJSfxEYlqrkyacgqrmisrp8zS+lspg+RgrqwVeu/uL02gbvBjuXVtVx1vmwpzeQI+dCQbD+BFoc9Ry/EU6+v4iPi5aNbG46CEF4S28oqitRohgSYfUYa9OW2OHwYKeSkf2sUreiwuTmAiHxGv81Q3mohl/6iPqF3nW2ykx+NO8Z30sXxEg/vzre3VzSta5qP25+2FneW5diP3hc7z1BSm9ObYk7Jne0otxrRBgVeovL8wtM32637NnKYXlCo1QfVLAEFH9BE5lx7T7yW8bp5X+7vf+GfltVNGzTfr/X63WWR52ieBFh/RJY8PyItAPV7vi6zq1mukJyt744j5o2v421120fOrfoafvDmy0ZvTCr1xvDSBYtfotgxXRk3V4gX8XKXr/yJ8HGQRmsA0PiLl2mtBfUSI11yDqMZ9H9Gzd2FWx11gAhP5iFLEy9d5yOtBo6hdJu7oay4u8RHx7zSsjYd9/8Lt5b1/gfUCB4Gj6lUXsWihg96/kI+ofL8sj/Mp6zrxUKgbmQ81oL1mmRdVMEy8Y2O6E/DSEWPZeIBuSAJ1bfJZkKjvHBV8JH/PRwR5EajjdZuTqAEP7c/TbXR9HxFpLwh1vD7o+GHrYp3j8W6OCRzXnuj6+dXtI7p0upDXw9P4vEv9QKJqsmTsdvWw3T2+oJ9tqwTs+8fu+f3t/bDcmkLL5lxHG59v0HnC65FE1WtEIPqu3vNts2zuwU9/lQ2xeAQLN592SjfmetJ54s1pns7goazOM+31TaLqHUg/+lwoFxU+9pZiB3lWx6ox12r+q8iKck7JnVKlKlPO8ZTXmLwNagAv40MzaP71o6aovfIURBVdz7avjWBzzaDOX2bjadL5CuryY+Yr4TqkjRe18xnwKLhcr6/zzLwD4HUr/AS6eEVvl+l853R8oM4zfgDAa2v8BNCiMvZ4Yv0AR2+ObvHmGGzj4aEZ1A0fqtz95fwbp6g5uL+Un0C+6OQVPWc019F8RKHPL+ojgjpvlJ/ApptXtKO5TsFrPpjXF00ghFeUUV7/wHXoVge/CJIAuQ7vdpvNZrtEL9bPglyH/5RuvCiSgPfauc/ySut0uoU1I+bxZD4ix2sxWOd/pSQBxOszF+eoOgOjBnea03n2Ydth4yFQyGvoc/lHkQQQLw2jGgFaLOV9RMceT3Y8sd6cohWK+1EeNHO8fB9RoVJ3f/0WJAF4f+0LFDUFn20L3kc0Zr93Tvu9gBft9zo9vCcJSJD7TeYlkLuwjyKZxkfE67zkeDW/p/ymCQBeK+0noM6fPQnynjLOcgO/veIh7fVKEoC8FtJLQObuQ7+9WsS7n42H6AaEuldixkfkdONJkQTcEuGqr+8lAHihqNfSecKL1/maF0rAXWoRk4D7sGjW+bHG2RZ0nI3wglFJe8EEUpd6ThNwH6Yo6tFHlKrjqTLl1Kc0PXlzUozhoWBcdJ75UON4rQo/agF4GZIAaC9DEijchxpFTcfzEXE6fx7HBrxIVOl044kmAO6vUhNwAuBDe9VO4yPidf447+CGZlYkqka8/ASg5MV+AuBDKX0f0ejzRDMClYiXF9VrLy8BcB3SBAAv204NPiI6Vwa+nK5pNQV1g87rudSXmkQF91dKE3CpK5oA4EVyHWketknnK6hL/ayHnM6/UZ0Hqec0AY8X9REB7Rw4b87ovIM28sI6f+SFEvB44QTch3MU9egjymtvTl6+ahb2VHlzSu+Aqb0D5QtsrluhkJciUPc2v0xJVMCr8BOAZVgykgDkhaLm4/mIsG5gqHSpr0hUoBtvtMpR5lKn9W2Uq903lxP5iNp0HvPydR60F00APHqpziNeQ3xEk7YX4jVWexHvW8F63/AIFQOF91dOoOT+glHdh7cFSYDcXzABAXjhqFfSQ/cWxegh4NVXD90Ih6+H13l+OV4r+vwivMKfXw282nxEbbZhDtra3wC8chLV8ToomoDjxfQ33Fzt3It6nf6hk4Y97R8CXjQBpBukfwh4xZP7iBidd6nvaVTXmAeaQOZSZ3Qe8GrQ+RHfv2YECnjt6PuX4/VME0idbY++fyFe+P0rYC0LXf3CrbsB46KpDy1c6uuMRHWV3Z4LkgBYV2ZIAgbwwlEZnR+4TKlV513qD7QekRvCeNY0gfP64U9FE8C6MbGPiBmPcm+HW0miOl53miZw5nWvaALuj85R1Nb55RHHD51ab2k9Iid535ImcOb1pGkCHi8wfjiB/zChUAX+Poman3tDO2bc5rxU4okmAAeLJPYfTjA+rynU8WKiZudv/YEm4KZwn2kCyoml1fmpfUSaQJP01CQvTNT83f0mScANZe1pAjnkRX1Ebm26InLeuIzdg4L5r7gg0PNC+jtBo2an1G8Ek8B5jFAWJIEC8PLmv8RYZQfALUzrHojstfrol71aaNSTNiwkk0B6nIvZ50wCgBeK2q7zZaObmrztbwbr/JyD5vvf0eu64emRbj+im1Uh2QeNXljpuJvnXFSPV4jOS51ulrevn9Gf17fDapsoRmZ5P8Cc0XnbXar6AA0ugyqfJkOCrJ173IPmnm+vFh9Rmj/iDQ3u9yoN82/oPq6Qi6DAEjAP8hFJdmXT3dxQKNX5dKoiQwSqnDvF6XyLj8hs/jC07HGY/7/w4mpNtdk0nxYWxFwxheOlgipYee6kQdAM8Or2EaXthvbXTXVr13d4wulGzHYl2YpjfK8zGAruL083GEX+5tjA436b6hadn01UfIKBerxafURrjorPbK2OnUzG3+s/l8cq/sdAG9qr8hHhWolKczzo8evBpHVZRVWVVQT9qLxcIulFhdD85Jyua6wPh+YG8FIISvq9yndA//phN+axH5SrBDlfStrcRWbdLsOhSA9bfUTYn3nYVp2EdLG/iZjj5qFL58ctMkTfUzidZ9dxqA+Q90bp49iVFht/z5DqeFkbPYAXO3o3AIp5oXE2rJ0GTMtE9ajr8V6U2eYtYo6Xh1Cdv7jYcLDOUx8RqI4fbYgHc86uPrjZ2mb9l3W+vFfdZXhQzDibZAsz3OxU2qjzl7mTOqAeLzDO5pU3d8nOuYLqmVFsaYaXNRgX1QPqqg87IC+crjce5R5en6JpPIovOvHjhiizXitXL4EyOs/7iJxL+LVZjnLZ3oHMpioyRKAteojniRyvd9E8T2Rv67Y1kabXyvBLoJBXq4/I8bpTrfUBVN7MTPdbyX8JlNdD4iOSyRn3X9qxLYtofEvLPehYRYYYKNHDBh8R0MON7J43X3Fdxy/Vp1LGZdAGXlbnj8VHjifx6hrMnKuhm7oaukHQslxJanaU2Y3hoHWNdQN2SGqMGg6FvAyCer4UuFfod9A2VWb/4vF6aYJevPkV9aUgnW/xiyr4UrkVIYqs1e4X4nVzoXiPo/Oej0jBDBc6yEckxfYH/NZtC7SvO6kDyrYX6yMSaJG0FmHltlSxda8xK9UC1eFFvAKg4P6aefW+jhpjzhoD37O+itBtFtW5s39bTLV5IwMFvDw9JM8E+AYWfZk8/EkzK0VnOd1mm63PL84HW+5NKo57k0Jbjz1+Un18hh/NQRBab2PqLEcqX4RCZXjUFqjHy0E1V68SLYUu+7+z8HKRyZSb2RIo0A3fZ875iFDX700MKAd0fZ2fhfiIHjGxJOhNafoir23vX7MQH5FANUDfzJSVdi+BwvurQBgheHMQGnu67fQRXWUz9tZ+r0TQ5vnlJ0xsskrWY41HSQRtmV9GxD5M+3rz4ZXHL4N6vMD4YVNd4kS8QmLv4mriPUznZZPO02Hke4/YlQanh41j++u/2vZ3+MHEkhboVTZtIFDAS7f6iJCaFhl6sXo3k+yccQkUzH/pHj4iZb4gsUOn5YgbcZ4U6ngpBO3yixYesX9X55UI1Pl6mga32LNIxt5J6DKo317YRyROezSJeo8mcdqjqdzAySMmGqGy3s5JnnZ+aok6FhT4N+z/ALS7HpHIkPXm0OmMmXBTrza/DRixbfYRobA+sanNQcN8RG4q2vcRqQYbj1Bo7PPZNEOZnfAmhYLr0GBorRusLeR82+oCEbtrgUJFHn2TQwbqdEMgaOC6gMwj9g/qvGB0vtvGg++xO9tbmdAcNMhH5LcX2XM15/ZcVblHrBnK7+Q6DRT4sYW3P2xgfRvjX4qj7bx7CRSskxpcj8gnNpk5qI+PCC16855fsGzDaQ9q6e1BXQ5CesRMC9T+kdCoF0HdE+hTYGilG2E2HumLx1TmoB7QczYvBkH71SMixP66zp+T+W1Eo85323io3E9hDuoBPefyViCo7yPqOLLcE48xTUFDjnMq7wZ/4I9vdNh4UtKl6nD8BEUdCpVu2ea7V62/9/pl/1L8q/MOcIUw2desp42H3GNjm4PCoWAZ+1LMOB9RDDQmbrDxxDVUK0TssQXaI+owqHMvrFIE9XxEnMzGvsySnkcztEfUQVC3gmGnENT3EYXZeAqvxUY2B4VDwd6tCkHPPiLaawY2Hr+DbfCleGeaoT2i9ofCGhYphpL6NkE2npz0PEY0BwVDodef7JM1sE6FT+xv6DzeNWLQvmbUxsO8QY9kDgqGgq2Rd2QfOnbUp8vGY6G5d4+JZmiPqH2gBSilMiP7BlYaw9pdYs7u4qCGdKkaoT2i9oACK9d9yu7/xdt42LAQ6l+KQeagzqjBUKDyS014HUfB7ak4Dm1LexnUo+DlYHheD5iXw9/Cg4oUj92bZmiPqKFQDRaqLXwo6yMKnt7VBfKKHlqgE8wvOzX8odAL6xH582PXtBy5v7uk0EvrEfkzmtezHLkq6OWGEmRf6QvnfVOFLsV3ca2JZ+OGRJ+YSfJa5y9w/MBaR/b4uJKPSILmeqDQgHkH9jUBQrF4BFqOOqN2QEEFmIiBds4vh8wEG7So9MPE088vQ3v1kt3vxhsHmIW/hp+hsUA+j7cWaI+orVBoh9cxAx2p7pxPbGKdz4Hx81tz0FYfUbjjx/xgYtNajuAmAlEuOahQo/g4iwLtP/Nk0gmNpKkBjrRvw0KFGMfxowTa2/VtUh8RLDihWeiIdecwsafz3NXo8w4aGvz3moWOovMn6Cu+FONpdB4MXkfRb8VDSx/Raa6s/OS0L3K9qqCy8YhqAUJ5wcp2qMbW2f/GiUqh8E6eN0GJ36Zlr0vf7kKhyMX9Y0aKiqFwLf9jI7Rh3jyG09bmqJ1JNxQRezEjRQVQtBbjRTVCO31EWbjjp7ScoUvxU6pRojpogTfeVo3QWjdGc/xo3GKf85F9RGhp8b4ZOqbOH6GwMEkUrcWYOo9ofbRAQ31EfRw/aG1L9JjJsXxEKVrnVC5PbYSefEQG2HiMP8hf1CcTCBW43sO9FmNEzYx3JeRpS9RgH1Evx49XWGtdyMujGoP6M9GiPddxn18nqFcT4bZeQ3hJVOXtY7npyLXRR1SeClc8IesH9bfA3mcXRdV+ybiHrgQq3ZjA8eNvV/u6UfHgqOn8B0fbiY4E+vmI+kDJ/qfvczEsqiaFZ9aB+9G32njYN6UAKK3z9qyGRDVkW/dNdwI9fUR9jqx4JcwOtv/BlTlqjJGJhy8/yMJ0/2JfH1E/KFO46HVXfbuBUWkRjOgmDUpgtH0QWOiOErOX41ZV11dHVC3mzPdyCExgtH0rWGg+p9eiPT4PD1n5jTZHNdliec/85l4EJtCthxeOOLNNZo9fj2tZ7tMsQdSkegTZV9+HR3L9Vb8jQxMY4iPqBxWSLQ9WH0+H5W5hv+byRi+/erVYrFfvDTV2o+/wBMJ9ROzMRxBULW4bEu11PC10eAKVjyh1VTwzUMVTYRuPygdCc9VQFLLP8bk2fRJQw3xEvR0/DUUhg4/lqfxsaALT6ryDajFjSyeGsdK6bwINfoAGE+iF0CWrch3H166jWgmbwMlHZJpsPDmx8QyG2r+3aBFH9vjY4HLcoQnUejix4wdAc7Xln03c8bYzAxOQ1+ZVvfbJ3XtDrWN3fB52UqVDE5Ah16E+te1YUHs3pPPdY6P4/zzv5qW/8JIELvERXQbVyvYv1vvH9/fXm6/P6PPPzevH4XG1Lbf7LiQ3adwjgf8Bsnc4QXcj+4AAAAAASUVORK5CYII=';
  const POINTER_STYLE = [
    ARROW_BASE,
    'width:40px', 'height:42px',
    'background:linear-gradient(135deg,#90CAF9 0%,#2196F3 45%,#0D47A1 100%)',
    '-webkit-mask-image:url("' + HAND_PNG + '")',
    '-webkit-mask-size:contain',
    '-webkit-mask-repeat:no-repeat',
    'mask-image:url("' + HAND_PNG + '")',
    'mask-size:contain',
    'mask-repeat:no-repeat'
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

    const offsetX = isPointer ? -20 : 0;
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
