(() => {
  let saved;
  try { saved = localStorage.getItem('archive-theme'); } catch { /* Use the device theme. */ }
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved === 'light' || saved === 'dark' ? saved : (dark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1115' : '#f5f6f8');
})();
