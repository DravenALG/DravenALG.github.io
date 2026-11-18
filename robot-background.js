// Keep this bootstrap small: narrow screens never import Three.js or the model.
const viewport = window.matchMedia('(min-width: 960px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const host = document.getElementById('robot-background');
let scene;
let loading = false;
let failed = false;
let inView = true;

function fail(error) {
  failed = true;
  scene?.dispose();
  scene = null;
  host.hidden = true;
  console.warn('The optional robot background is unavailable.', error);
}

async function sync() {
  if (!host || failed) return;
  const visible = viewport.matches && inView && !document.hidden;
  if (!viewport.matches) host.hidden = true;
  if (scene) {
    host.hidden = !viewport.matches;
    scene.setVisible(visible);
    return;
  }
  if (!visible || loading) return;
  loading = true;
  try {
    const { createRobotScene } = await import('./assets/robot/scene.js?v=20261119-studio');
    scene = await createRobotScene(host, { reducedMotion: reducedMotion.matches, onFailure: fail });
    host.hidden = !viewport.matches;
    scene.setVisible(viewport.matches && inView && !document.hidden);
  } catch (error) {
    fail(error);
  } finally {
    loading = false;
  }
}

viewport.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);
window.addEventListener('pagehide', () => scene?.setVisible(false));
window.addEventListener('pageshow', sync);
reducedMotion.addEventListener('change', event => {
  scene?.setReducedMotion(event.matches);
});

// Observe the profile, which keeps its size even before the canvas loads.
// Offscreen scenes stop rendering without collapsing the profile layout.
if (host && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    sync();
  });
  observer.observe(host.closest('.profile-section'));
}

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(sync, { timeout: 2500 });
} else {
  window.setTimeout(sync, 1000);
}
