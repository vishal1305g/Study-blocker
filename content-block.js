// FocusForge — Generic Site Blocker (TikTok, Twitter, Snapchat)

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
    // Bug fix: DOMContentLoaded may have already fired by the time
    // async init() finishes — check readyState before adding listener
    const render = () => {
      document.documentElement.style.visibility = 'visible';
      document.body.innerHTML = `
        <style>
          *{margin:0;padding:0;box-sizing:border-box;}
          body{background:#0a0a0f;font-family:system-ui,sans-serif;min-height:100vh;
               display:flex;align-items:center;justify-content:center;}
          .w{text-align:center;max-width:480px;padding:40px;}
          h1{font-size:34px;font-weight:800;color:#f5a623;letter-spacing:3px;margin-bottom:10px;font-family:monospace;}
          .site{font-size:19px;color:#e8e8f0;margin-bottom:8px;font-weight:600;}
          .msg{font-size:14px;color:#6b6b7e;line-height:1.7;margin-bottom:28px;}
          .q{background:rgba(245,166,35,.08);border-left:3px solid #f5a623;border-radius:8px;
             padding:14px 18px;margin-bottom:28px;font-style:italic;color:#a0a0b0;font-size:13px;}
          .btn{background:#f5a623;color:#000;border:none;border-radius:9px;
               padding:13px 30px;font-size:14px;font-weight:700;cursor:pointer;}
          .btn:hover{background:#ffc145;}
        </style>
        <div class="w">
          <div style="font-size:72px;margin-bottom:20px">🔒</div>
          <h1>BLOCKED</h1>
          <div class="site">${getSiteName()} is blocked during your study session</div>
          <div class="msg">FocusForge is protecting your focus time.<br>Come back when your session is done.</div>
          <div class="q" id="qq">Loading motivation...</div>
          <button class="btn" onclick="history.back()">← Return to Work</button>
        </div>`;
      const quotes = [
        {t:"The secret of getting ahead is getting started.",a:"Mark Twain"},
        {t:"Hard work beats talent when talent doesn't work hard.",a:"Tim Notke"},
        {t:"Push yourself, because no one else is going to do it for you.",a:"Unknown"},
        {t:"Study while others are sleeping; work while others are loafing.",a:"W.A. Ward"},
        {t:"An investment in knowledge pays the best interest.",a:"Benjamin Franklin"},
        {t:"The expert in anything was once a beginner.",a:"Helen Hayes"},
      ];
      const q = quotes[new Date().getDate() % quotes.length];
      const el = document.getElementById('qq');
      if (el) el.innerHTML = `"${q.t}" <strong style="color:#f5a623">— ${q.a}</strong>`;
    };

    document.documentElement.style.visibility = 'hidden';
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    } else {
      // DOM already loaded — render immediately
      render();
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_CHANGED' && !msg.sessionActive) {
      window.location.reload();
    }
  });

  init();
})();
