// Paste into Chrome DevTools (chrome://inspect → the phone's /map tab). Pan and tilt the map with a finger for 10 s.
(() => {
  let frames = 0, worst = 0, last = performance.now();
  const end = last + 10_000;
  const tick = (t) => {
    frames++; worst = Math.max(worst, t - last); last = t;
    if (t < end) requestAnimationFrame(tick);
    else console.log(`fps ${(frames / 10).toFixed(1)}, worst frame ${worst.toFixed(0)} ms`);
  };
  requestAnimationFrame(tick);
})();
