// FocusForge Background Service Worker

let sessionActive = false;
let strictMode = false;
let allowedChannels = [];
let customBlockedSites = [];

// ── Init ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    sessionActive: false,
    strictMode: false,
    allowedChannels: [
      'Khan Academy','MIT OpenCourseWare','3Blue1Brown','CrashCourse',
      'Kurzgesagt','TED-Ed','Physics Wallah','Unacademy','Veritasium',
      'Mark Rober','NileRed','Numberphile'
    ],
    // Bug 4+8 fix: unified key name — everything uses 'customBlockedSites'
    customBlockedSites: [],
    totalPomos: 0,
    totalFocusSecs: 0,
    streak: 0,
    xp: 0,
    lastActiveDate: null,
  };
  const existing = await chrome.storage.local.get(null);
  const toSet = {};
  for (const [k,v] of Object.entries(defaults)) {
    if (existing[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length) await chrome.storage.local.set(toSet);
  await syncState();
});

// ── Message Handler ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'GET_STATE':
        reply(await chrome.storage.local.get(null));
        break;
      case 'SET_SESSION':
        await setSession(msg.active, msg.strict);
        reply({ ok: true });
        break;
      case 'ADD_CHANNEL':
        await addAllowedChannel(msg.channel);
        reply({ ok: true });
        break;
      case 'REMOVE_CHANNEL':
        await removeAllowedChannel(msg.channel);
        reply({ ok: true });
        break;
      case 'ADD_BLOCK':
        await addCustomBlock(msg.site);
        reply({ ok: true });
        break;
      case 'REMOVE_BLOCK':
        await removeCustomBlock(msg.site);
        reply({ ok: true });
        break;
      case 'SAVE_STATS':
        await chrome.storage.local.set(msg.data);
        reply({ ok: true });
        break;
      // Bug 5 fix: NOTIFY handler restored
      case 'NOTIFY':
        try {
          chrome.notifications.create({
            type: 'basic',
            title: msg.title || '🍅 FocusForge',
            message: msg.body || 'Keep going!',
            priority: 2
          });
        } catch(e) {}
        reply({ ok: true });
        break;
      // Bug 3 fix: OPEN_DASHBOARD handler added
      case 'OPEN_DASHBOARD':
        openDashboard();
        reply({ ok: true });
        break;
      default:
        reply({});
    }
  })();
  return true; // keep channel open for async reply
});

// ── State Sync ────────────────────────────────────────
async function syncState() {
  const data = await chrome.storage.local.get([
    'sessionActive','strictMode','allowedChannels','customBlockedSites'
  ]);
  sessionActive = data.sessionActive || false;
  strictMode = data.strictMode || false;
  allowedChannels = data.allowedChannels || [];
  customBlockedSites = data.customBlockedSites || [];
  await updateDynamicRules();
  broadcastState();
}

// ── Session Control ───────────────────────────────────
async function setSession(active, strict) {
  sessionActive = active;
  strictMode = strict !== undefined ? strict : strictMode;
  await chrome.storage.local.set({ sessionActive, strictMode });
  await updateDynamicRules();
  broadcastState();
}

// ── Dynamic Blocking Rules ────────────────────────────
// All rules are dynamic — nothing blocked unless session is ON
async function updateDynamicRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  const addRules = [];
  let id = 200;

  if (sessionActive) {
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { url: 'https://www.youtube.com/?ff=1' }},
      condition: { urlFilter: 'youtube.com/shorts', resourceTypes: ['main_frame'] }
    });
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { url: 'https://www.instagram.com/?ff=1' }},
      condition: { urlFilter: 'instagram.com/reels', resourceTypes: ['main_frame'] }
    });
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=TikTok' }},
      condition: { urlFilter: 'tiktok.com', resourceTypes: ['main_frame'] }
    });
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Twitter%2FX' }},
      condition: { urlFilter: 'twitter.com', resourceTypes: ['main_frame'] }
    });
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Twitter%2FX' }},
      condition: { urlFilter: '||x.com/', resourceTypes: ['main_frame'] }
    });
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Snapchat' }},
      condition: { urlFilter: 'snapchat.com', resourceTypes: ['main_frame'] }
    });

    if (strictMode) {
      addRules.push({
        id: id++, priority: 10,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Reddit' }},
        condition: { urlFilter: 'reddit.com', resourceTypes: ['main_frame'] }
      });
      addRules.push({
        id: id++, priority: 10,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Facebook' }},
        condition: { urlFilter: 'facebook.com', resourceTypes: ['main_frame'] }
      });
      addRules.push({
        id: id++, priority: 10,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=Twitch' }},
        condition: { urlFilter: 'twitch.tv', resourceTypes: ['main_frame'] }
      });
    }

    for (const site of customBlockedSites) {
      const clean = site.replace(/^https?:\/\//, '').replace(/^www\./, '');
      addRules.push({
        id: id++, priority: 10,
        action: { type: 'redirect', redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(clean)}` }},
        condition: { urlFilter: clean, resourceTypes: ['main_frame'] }
      });
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}

// ── Channel Management ────────────────────────────────
async function addAllowedChannel(channel) {
  const data = await chrome.storage.local.get('allowedChannels');
  const list = data.allowedChannels || [];
  if (!list.includes(channel)) {
    list.push(channel);
    await chrome.storage.local.set({ allowedChannels: list });
    allowedChannels = list;
    broadcastToTabs({ type: 'CHANNELS_UPDATED', channels: list });
  }
}

async function removeAllowedChannel(channel) {
  const data = await chrome.storage.local.get('allowedChannels');
  const list = (data.allowedChannels || []).filter(c => c !== channel);
  await chrome.storage.local.set({ allowedChannels: list });
  allowedChannels = list;
  broadcastToTabs({ type: 'CHANNELS_UPDATED', channels: list });
}

// ── Custom Blocks ─────────────────────────────────────
async function addCustomBlock(site) {
  const data = await chrome.storage.local.get('customBlockedSites');
  const list = data.customBlockedSites || [];
  if (!list.includes(site)) {
    list.push(site);
    await chrome.storage.local.set({ customBlockedSites: list });
    customBlockedSites = list;
    await updateDynamicRules();
  }
}

async function removeCustomBlock(site) {
  const data = await chrome.storage.local.get('customBlockedSites');
  const list = (data.customBlockedSites || []).filter(s => s !== site);
  await chrome.storage.local.set({ customBlockedSites: list });
  customBlockedSites = list;
  await updateDynamicRules();
}

// ── Broadcast ─────────────────────────────────────────
function broadcastState() {
  broadcastToTabs({ type: 'STATE_CHANGED', sessionActive, strictMode });
}

async function broadcastToTabs(msg) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try { await chrome.tabs.sendMessage(tab.id, msg); } catch(e) {}
  }
}

// ── Open Dashboard ────────────────────────────────────
function openDashboard() {
  const dashUrl = chrome.runtime.getURL('dashboard.html');
  chrome.tabs.query({}, (tabs) => {
    const existing = tabs.find(t => t.url === dashUrl);
    if (existing) {
      chrome.tabs.update(existing.id, { active: true });
      chrome.windows.update(existing.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: dashUrl });
    }
  });
}

chrome.action.onClicked.addListener(openDashboard);

// ── Storage change listener ───────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.sessionActive || changes.strictMode || changes.customBlockedSites) {
      syncState();
    }
  }
});
