// FocusForge — YouTube Content Script
// Blocks: Shorts shelf, Shorts player, non-whitelisted channels, 18+ content

(function() {
  'use strict';

  let sessionActive = false;
  let allowedChannels = [];
  let strictMode = false;

  // ── Init ──────────────────────────────────────────
  async function init() {
    const res = await chrome.storage.local.get(['sessionActive','allowedChannels','strictMode']);
    sessionActive = res.sessionActive || false;
    allowedChannels = res.allowedChannels || [];
    strictMode = res.strictMode || false;

    if (sessionActive) {
      blockShortsPage();
      observeDOM();
    }
  }

  // ── Block /shorts URL ──────────────────────────────
  function blockShortsPage() {
    const url = window.location.href;
    if (url.includes('/shorts')) {
      // Redirect to YouTube home
      window.location.replace('https://www.youtube.com/?focusforge_blocked=shorts');
      return;
    }
  }

  // ── DOM Observer ──────────────────────────────────
  function observeDOM() {
    const observer = new MutationObserver(() => {
      if (sessionActive) {
        removeShortsFromFeed();
        if (strictMode) filterNonWhitelistedChannels();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Initial run after page load
    document.addEventListener('DOMContentLoaded', () => {
      removeShortsFromFeed();
      if (strictMode) filterNonWhitelistedChannels();
    });
  }

  // ── Remove Shorts from Feed ────────────────────────
  function removeShortsFromFeed() {
    // Selectors for Shorts shelf/section
    const selectors = [
      'ytd-reel-shelf-renderer',           // Shorts shelf on homepage
      'ytd-rich-shelf-renderer[is-shorts]', // Rich shelf shorts
      'ytd-shorts',                          // Shorts player
      '#shorts-container',
      'ytd-guide-entry-renderer a[href="/shorts"]', // Sidebar link
      'a[href*="/shorts"]',                 // Any shorts link
      'ytd-rich-item-renderer:has(ytd-reel-item-renderer)', // Shorts in grid
      'ytd-video-renderer[is-shorts]',
    ];

    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          el.style.display = 'none';
          el.setAttribute('data-ff-hidden', 'shorts');
        });
      } catch(e) {}
    });

    // Also look for "Shorts" text in shelf titles
    document.querySelectorAll('yt-formatted-string, h2, span').forEach(el => {
      if (el.textContent.trim() === 'Shorts' && !el.getAttribute('data-ff-checked')) {
        el.setAttribute('data-ff-checked', '1');
        // Walk up to find the shelf container
        let parent = el;
        for (let i = 0; i < 6; i++) {
          parent = parent.parentElement;
          if (!parent) break;
          const tag = parent.tagName.toLowerCase();
          if (tag.includes('shelf') || tag.includes('section') || tag === 'ytd-rich-section-renderer') {
            parent.style.display = 'none';
            break;
          }
        }
      }
    });

    // Hide shorts sidebar navigation item
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(el => {
      const link = el.querySelector('a');
      if (link && link.href && link.href.includes('/shorts')) {
        el.style.display = 'none';
      }
    });
  }

  // ── Filter Non-Whitelisted Channels (Strict Mode) ──
  function filterNonWhitelistedChannels() {
    if (!allowedChannels.length) return;

    const lowerAllowed = allowedChannels.map(c => c.toLowerCase());
    const currentUrl = window.location.href;

    // If watching a video, check if the channel is allowed
    if (currentUrl.includes('/watch')) {
      const channelEl = document.querySelector(
        '#channel-name a, ytd-channel-name yt-formatted-string a, #owner-name a, .ytd-video-owner-renderer a'
      );
      if (channelEl) {
        const channelName = channelEl.textContent.trim().toLowerCase();
        const isAllowed = lowerAllowed.some(c => channelName.includes(c) || c.includes(channelName));
        if (!isAllowed && !document.getElementById('ff-channel-block')) {
          showChannelBlockOverlay(channelEl.textContent.trim());
        }
      }
    }

    // In feed: dim non-whitelisted channel videos
    document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer').forEach(item => {
      if (item.getAttribute('data-ff-checked')) return;
      item.setAttribute('data-ff-checked', '1');

      const channelEl = item.querySelector('#channel-name, ytd-channel-name, #byline-container');
      if (!channelEl) return;
      const name = channelEl.textContent.trim().toLowerCase();
      const isAllowed = lowerAllowed.some(c => name.includes(c) || c.includes(name));

      if (!isAllowed) {
        item.style.opacity = '0.25';
        item.style.filter = 'blur(2px)';
        item.style.pointerEvents = 'none';
        item.title = 'Blocked by FocusForge — not in your allowed channels';
      }
    });
  }

  // ── Channel Block Overlay ──────────────────────────
  function showChannelBlockOverlay(channelName) {
    const overlay = document.createElement('div');
    overlay.id = 'ff-channel-block';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(10,10,15,0.97);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',sans-serif;
    `;
    overlay.innerHTML = `
      <div style="text-align:center;max-width:480px;padding:40px;">
        <div style="font-size:64px;margin-bottom:20px">🔒</div>
        <div style="font-family:monospace;font-size:32px;font-weight:700;color:#f5a623;letter-spacing:3px;margin-bottom:12px">CHANNEL BLOCKED</div>
        <div style="font-size:16px;color:#6b6b7e;margin-bottom:8px">"${channelName}" is not in your allowed list</div>
        <div style="font-size:14px;color:#6b6b7e;margin-bottom:32px">FocusForge Strict Mode is active. Only your approved channels can be watched.</div>
        <button onclick="history.back()" style="background:#f5a623;color:#000;border:none;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-right:10px">← Go Back</button>
        <button onclick="document.getElementById('ff-channel-block').remove()" style="background:transparent;color:#6b6b7e;border:1px solid #2a2a3a;border-radius:8px;padding:12px 28px;font-size:15px;cursor:pointer">Dismiss</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ── Listen for state changes from background ───────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED') {
      sessionActive = msg.sessionActive;
      strictMode = msg.strictMode;
      if (sessionActive) {
        blockShortsPage();
        removeShortsFromFeed();
        if (strictMode) filterNonWhitelistedChannels();
      } else {
        // Remove all hidden elements
        document.querySelectorAll('[data-ff-hidden]').forEach(el => el.style.display = '');
        document.querySelectorAll('[data-ff-checked]').forEach(el => {
          el.removeAttribute('data-ff-checked');
          el.style.opacity = '';
          el.style.filter = '';
          el.style.pointerEvents = '';
        });
        const overlay = document.getElementById('ff-channel-block');
        if (overlay) overlay.remove();
      }
    }
    if (msg.type === 'CHANNELS_UPDATED') {
      allowedChannels = msg.channels;
    }
  });

  init();
})();
