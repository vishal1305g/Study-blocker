// FocusForge — Instagram Content Script
// Blocks Reels tab, Reels feed items, Reels explore section

(function() {
  'use strict';

  async function init() {
    const res = await chrome.storage.local.get('sessionActive');
    if (!res.sessionActive) return;
    blockReels();
    observeDOM();
  }

  function blockReels() {
    const url = window.location.href;
    // Redirect /reels to home
    if (url.includes('/reels')) {
      window.location.replace('https://www.instagram.com/?focusforge_blocked=reels');
      return;
    }
    hideReelsElements();
  }

  function hideReelsElements() {
    // Hide Reels navigation tab
    document.querySelectorAll('a[href="/reels/"]').forEach(el => {
      const parent = el.closest('div[role="listitem"], li, div');
      if (parent) parent.style.display = 'none';
      else el.style.display = 'none';
    });

    // Hide Reels items in feed (they use video with specific aria)
    document.querySelectorAll('article').forEach(article => {
      const isReel = article.querySelector('video[playsinline]') &&
                     article.querySelector('a[href*="/reel/"]');
      if (isReel) {
        article.style.display = 'none';
        article.setAttribute('data-ff-hidden', 'reel');
      }
    });

    // Hide stories if strict mode
  }

  function observeDOM() {
    const observer = new MutationObserver(hideReelsElements);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED') {
      if (msg.sessionActive) blockReels();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
