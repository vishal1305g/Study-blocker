// FocusForge Background Service Worker
// Manages: session state, dynamic rules, alarms, notifications

let sessionActive = false;
let strictMode = false;
let allowedChannels = [];
let customBlockedSites = [];
let dynamicRuleId = 100;

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
    customBlockedSites: [],
    totalPomos: 0,
    totalFocusSecs: 0,
    streak: 0,
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
        reply(await getFullState());
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
        await saveStats(msg.data);
        reply({ ok: true });
        break;
      case 'NOTIFY':
        showNotification(msg.title, msg.body);
        reply({ ok: true });
        break;
    }
  })();
  return true; // async reply
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

async function getFullState() {
  return await chrome.storage.local.get(null);
}

// ── Session Control ───────────────────────────────────
async function setSession(active, strict) {
  sessionActive = active;
  strictMode = strict !== undefined ? strict : strictMode;
  await chrome.storage.local.set({ sessionActive, strictMode });
  await updateDynamicRules();
  broadcastState();

  if (active) {
    showNotification('🎯 FocusForge Session Started', 'Stay focused. Distractions are blocked.');
  } else {
    showNotification('✅ Session Ended', 'Great work! Blocks are lifted.');
  }
}

// ── Dynamic Blocking Rules ────────────────────────────
async function updateDynamicRules() {
  // Remove all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  
  const addRules = [];
  let id = 200;

  if (sessionActive) {
    // Always block YouTube Shorts (redirect to youtube.com homepage)
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { url: 'https://www.youtube.com/?focusforge=1' }},
      condition: { urlFilter: 'youtube.com/shorts', resourceTypes: ['main_frame'] }
    });

    // Block Instagram Reels
    addRules.push({
      id: id++, priority: 10,
      action: { type: 'redirect', redirect: { url: 'https://www.instagram.com/?focusforge=1' }},
      condition: { urlFilter: 'instagram.com/reels', resourceTypes: ['main_frame'] }
    });

    // Block Reddit (in strict mode)
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

    // Custom blocked sites
    for (const site of customBlockedSites) {
      const clean = site.replace(/^https?:\/\//, '').replace(/^www\./, '');
      addRules.push({
        id: id++, priority: 10,
        action: { type: 'redirect', redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(clean)}` }},
        condition: { urlFilter: clean, resourceTypes: ['main_frame'] }
      });
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules
  });
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

// ── Stats ─────────────────────────────────────────────
async function saveStats(data) {
  await chrome.storage.local.set(data);
}

// ── Notifications ─────────────────────────────────────
function showNotification(title, body) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.svg',
    title,
    message: body,
    priority: 2
  });
}

// ── Broadcast ─────────────────────────────────────────
function broadcastState() {
  broadcastToTabs({ type: 'STATE_CHANGED', sessionActive, strictMode });
}

async function broadcastToTabs(msg) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch(e) {}
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.sessionActive || changes.strictMode || changes.customBlockedSites) {
      syncState();
    }
  }
});
