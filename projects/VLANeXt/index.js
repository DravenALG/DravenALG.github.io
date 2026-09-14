// The page, figures, and native tables work without JavaScript.
(() => {
  const status = document.querySelector('.copy-status');
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const code = document.getElementById(button.dataset.copy);
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent.trim());
        button.textContent = 'Copied!';
        status.textContent = 'BibTeX copied to clipboard.';
        window.setTimeout(() => { button.textContent = 'Copy BibTeX'; }, 2000);
      } catch {
        // Local-file previews may not expose the Clipboard API; select the citation.
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = 'BibTeX selected. Press Ctrl+C or ⌘C to copy.';
      }
    });
  });

  if (!('IntersectionObserver' in window)) return;

  // Play muted demos only while visible, respecting a visitor's pause choice.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const videoState = new WeakMap();
  const videos = document.querySelectorAll('video');
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target: video, isIntersecting }) => {
      const state = videoState.get(video);
      state.visible = isIntersecting;
      if (isIntersecting && !document.hidden) {
        if (state.resume && !reducedMotion.matches && !saveData) {
          video.play().catch(() => { /* Native controls remain available. */ });
        }
      } else if (!video.paused) {
        state.resume = true;
        video.pause();
      }
    });
  }, { threshold: 0.2 });

  videos.forEach((video) => {
    const state = { visible: false, resume: true };
    videoState.set(video, state);
    video.addEventListener('pause', () => {
      if (state.visible && !document.hidden) state.resume = false;
    });
    video.addEventListener('play', () => { state.resume = true; });
    videoObserver.observe(video);
  });

  document.addEventListener('visibilitychange', () => {
    videos.forEach((video) => {
      const state = videoState.get(video);
      if (document.hidden && !video.paused) {
        state.resume = true;
        video.pause();
      } else if (!document.hidden && state.visible && state.resume && !reducedMotion.matches && !saveData) {
        video.play().catch(() => {});
      }
    });
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) videos.forEach((video) => video.pause());
  });
})();
