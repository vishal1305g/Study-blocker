// FocusForge — Instagram Content Script

(function() {
  'use strict';

  async function init() {
    const res = await chrome.storage.local.get('sessionActive');
    const active = res.sessionActive || false;
    applySession(active);
  }

  function applySession(active) {
    if (active) {
      document.documentElement.classList.add('ff-session-active');
      blockReels();
      startObserver();
    } else {
      document.documentElement.classList.remove('ff-session-active');
      restoreAll();
    }
  }

  function blockReels() {
    if (window.location.pathname.startsWith('/reels')) {
      window.location.replace('https://www.instagram.com/?ff=1');
      return;
    }
    hideReelsElements();
  }

  function hideReelsElements() {
    document.querySelectorAll('a[href="/reels/"], a[href="/reels"]').forEach(el => {
      const parent = el.closest('div[role="listitem"], li, div');
      if (parent) { parent.style.display = 'none'; parent.setAttribute('data-ff-hidden','1'); }
      else { el.style.display = 'none'; el.setAttribute('data-ff-hidden','1'); }
    });

    document.querySelectorAll('article').forEach(article => {
      if (article.getAttribute('data-ff-hidden')) return;
      const isReel = article.querySelector('video[playsinline]') &&
                     article.querySelector('a[href*="/reel/"]');
      if (isReel) {
        article.style.display = 'none';
        article.setAttribute('data-ff-hidden', '1');
      }
    });
  }

  function startObserver() {
    const observer = new MutationObserver(hideReelsElements);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function restoreAll() {
    document.querySelectorAll('[data-ff-hidden]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-ff-hidden');
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED') {
      applySession(msg.sessionActive);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
