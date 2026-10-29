// Fragments are only visible to the browser, so GitHub Pages cannot redirect them.
// Old diary links intentionally lead to the home page, without selecting a post.
(() => {
  const returnHome = () => {
    if (/^#daily-/i.test(window.location.hash)) {
      window.location.replace(new URL('./', document.baseURI).href);
    }
  };
  returnHome();
  window.addEventListener('hashchange', returnHome);
})();
