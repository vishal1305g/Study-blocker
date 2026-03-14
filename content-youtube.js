// FocusForge — YouTube Content Script

(function() {
  'use strict';

  let sessionActive = false;
  let allowedChannels = [];
  let strictMode = false;

  async function init() {
    const res = await chrome.storage.local.get(['sessionActive','allowedChannels','strictMode']);
    sessionActive = res.sessionActive || false;
    allowedChannels = res.allowedChannels || [];
    strictMode = res.strictMode || false;
    applySession();
  }

  function applySession() {
    if (sessionActive) {
      // Bug 1 fix: activate CSS blocking via class on <html>
      document.documentElement.classList.add('ff-session-active');
      blockShortsPage();
      startObserver();
    } else {
      document.documentElement.classList.remove('ff-session-active');
      restoreAll();
    }
  }

  function blockShortsPage() {
    if (window.location.pathname.startsWith('/shorts')) {
      window.location.replace('https://www.youtube.com/?ff=blocked');
    }
  }

  function startObserver() {
    removeShortsFromFeed();
    if (strictMode) filterChannels();

    const observer = new MutationObserver(() => {
      if (!sessionActive) return;
      removeShortsFromFeed();
      if (strictMode) filterChannels();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function removeShortsFromFeed() {
    const selectors = [
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-shorts',
      '#shorts-container',
      'ytd-rich-item-renderer:has(ytd-reel-item-renderer)',
      'ytd-video-renderer[is-shorts]',
    ];
    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (!el.getAttribute('data-ff-hidden')) {
            el.style.display = 'none';
            el.setAttribute('data-ff-hidden', '1');
          }
        });
      } catch(e) {}
    });
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(el => {
      const link = el.querySelector('a');
      if (link && link.href && link.href.includes('/shorts')) {
        el.style.display = 'none';
        el.setAttribute('data-ff-hidden', '1');
      }
    });
  }

  function filterChannels() {
    if (!allowedChannels.length) return;
    const lowerAllowed = allowedChannels.map(c => c.toLowerCase().trim());

    if (window.location.pathname.startsWith('/watch')) {
      const channelEl = document.querySelector(
        '#channel-name a, ytd-channel-name yt-formatted-string a, #owner-name a'
      );
      if (channelEl) {
        const name = channelEl.textContent.trim().toLowerCase();
        // Bug 7 fix: only check if name contains an allowed channel, not reverse
        const isAllowed = lowerAllowed.some(a => name.includes(a) || a === name);
        if (!isAllowed && !document.getElementById('ff-channel-block')) {
          showChannelOverlay(channelEl.textContent.trim());
        }
      }
    }

    document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer').forEach(item => {
      if (item.getAttribute('data-ff-checked')) return;
      item.setAttribute('data-ff-checked', '1');
      const channelEl = item.querySelector('#channel-name, ytd-channel-name, #byline-container');
      if (!channelEl) return;
      const name = channelEl.textContent.trim().toLowerCase();
      const isAllowed = lowerAllowed.some(a => name.includes(a) || a === name);
      if (!isAllowed) {
        item.style.opacity = '0.2';
        item.style.filter = 'blur(3px)';
        item.style.pointerEvents = 'none';
        item.title = 'Blocked by FocusForge';
      }
    });
  }

  function showChannelOverlay(channelName) {
    const div = document.createElement('div');
    div.id = 'ff-channel-block';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,10,15,.97);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
    div.innerHTML = `
      <div style="text-align:center;max-width:460px;padding:40px">
        <div style="font-size:64px;margin-bottom:16px">🔒</div>
        <div style="font-family:monospace;font-size:28px;font-weight:700;color:#f5a623;letter-spacing:3px;margin-bottom:10px">CHANNEL BLOCKED</div>
        <div style="font-size:15px;color:#6b6b7e;margin-bottom:24px">"${channelName}" is not in your allowed channel list</div>
        <button onclick="history.back()" style="background:#f5a623;color:#000;border:none;border-radius:8px;padding:12px 26px;font-size:14px;font-weight:700;cursor:pointer;margin-right:8px">← Go Back</button>
        <button onclick="document.getElementById('ff-channel-block').remove()" style="background:transparent;color:#6b6b7e;border:1px solid #2a2a3a;border-radius:8px;padding:12px 26px;font-size:14px;cursor:pointer">Dismiss</button>
      </div>`;
    document.body.appendChild(div);
  }

  function restoreAll() {
    document.querySelectorAll('[data-ff-hidden]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-ff-hidden');
    });
    document.querySelectorAll('[data-ff-checked]').forEach(el => {
      el.removeAttribute('data-ff-checked');
      el.style.opacity = '';
      el.style.filter = '';
      el.style.pointerEvents = '';
    });
    const ov = document.getElementById('ff-channel-block');
    if (ov) ov.remove();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED') {
      sessionActive = msg.sessionActive;
      strictMode = msg.strictMode;
      applySession();
    }
    if (msg.type === 'CHANNELS_UPDATED') {
      allowedChannels = msg.channels;
    }
  });

  init();
})();
