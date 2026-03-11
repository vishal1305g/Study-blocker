// FocusForge — Generic Site Blocker
// Shows block screen on TikTok, Twitter/X, Snapchat during sessions

(function() {
  'use strict';

  async function init() {
    const res = await chrome.storage.local.get('sessionActive');
    if (!res.sessionActive) return;
    showBlockScreen();
  }

  function getSiteName() {
    const host = window.location.hostname;
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('twitter') || host.includes('x.com')) return 'Twitter / X';
    if (host.includes('snapchat')) return 'Snapchat';
    return host;
  }

  function showBlockScreen() {
    document.documentElement.style.visibility = 'hidden';
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.visibility = 'visible';
      document.body.innerHTML = `
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body {
            background: #0a0a0f;
            font-family: 'DM Sans', system-ui, sans-serif;
            min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .block-wrap { text-align: center; max-width: 480px; padding: 40px; }
          .lock { font-size: 80px; margin-bottom: 24px; }
          h1 { font-size: 36px; font-weight: 800; color: #f5a623; letter-spacing: 3px; margin-bottom: 12px; font-family: monospace; }
          .site { font-size: 20px; color: #e8e8f0; margin-bottom: 8px; font-weight: 600; }
          .msg { font-size: 15px; color: #6b6b7e; line-height: 1.7; margin-bottom: 32px; }
          .quote { background: rgba(245,166,35,.08); border-left: 3px solid #f5a623; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; font-style: italic; color: #a0a0b0; font-size: 14px; }
          .btn { display: inline-block; background: #f5a623; color: #000; border: none; border-radius: 10px; padding: 14px 32px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }
          .btn:hover { background: #ffc145; }
          .timer { font-family: monospace; font-size: 48px; font-weight: 700; color: #e8435a; margin: 24px 0; }
        </style>
        <div class="block-wrap">
          <div class="lock">🔒</div>
          <h1>BLOCKED</h1>
          <div class="site">${getSiteName()} is blocked during your study session</div>
          <div class="msg">FocusForge is protecting your focus time.<br>Come back when your session is done.</div>
          <div class="quote" id="quote">Loading your daily motivation...</div>
          <button class="btn" onclick="history.back()">← Return to Work</button>
        </div>
      `;
      setBlockQuote();
    });
  }

  const quotes = [
    {t:"The secret of getting ahead is getting started.", a:"Mark Twain"},
    {t:"Hard work beats talent when talent doesn't work hard.", a:"Tim Notke"},
    {t:"Push yourself, because no one else is going to do it for you.", a:"Unknown"},
    {t:"Study while others are sleeping; work while others are loafing.", a:"W.A. Ward"},
    {t:"Don't watch the clock; do what it does. Keep going.", a:"Sam Levenson"},
    {t:"An investment in knowledge pays the best interest.", a:"Benjamin Franklin"},
    {t:"Wake up with determination. Go to bed with satisfaction.", a:"George Lorimer"},
    {t:"The expert in anything was once a beginner.", a:"Helen Hayes"},
  ];

  function setBlockQuote() {
    const q = quotes[new Date().getDate() % quotes.length];
    const el = document.getElementById('quote');
    if (el) el.innerHTML = `"${q.t}" <strong>— ${q.a}</strong>`;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED' && !msg.sessionActive) {
      window.location.reload();
    }
  });

  init();
})();
