// ============================================================
// THE FORGE — core app logic
// Storage: localStorage (per-device, private to this browser)
// ============================================================

const STORAGE_KEY = 'theforge_state_v1';

const EXERCISE_LABELS = {
  pushups: 'Push-ups',
  situps: 'Sit-ups',
  squats: 'Squats',
  run: 'Run / Walk',
  steps: 'Steps',
  distance: 'Distance',
  custom: 'Custom'
};

const RANK_THRESHOLDS = [
  { rank: 'E', minLevel: 1 },
  { rank: 'D', minLevel: 5 },
  { rank: 'C', minLevel: 10 },
  { rank: 'B', minLevel: 18 },
  { rank: 'A', minLevel: 28 },
  { rank: 'S', minLevel: 40 }
];

const WEEKDAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ---------- Default state ----------
function defaultState() {
  return {
    onboarded: false,
    profile: {
      name: '',
      height: null,
      weight: null,
      age: null,
      experience: null, // beginner | some | experienced
      goal: null // strength | endurance | weightloss | general
    },
    level: 1,
    xp: 0,
    streak: 0,
    lastActiveDate: null, // yyyy-mm-dd of last day a quest was completed
    restDays: [0, 6], // Sun, Sat by default — array of weekday indices (0=Sun)
    notificationsEnabled: true,
    quests: [], // today's quest list: {id, type, amount, done, feedback}
    questsDate: null, // yyyy-mm-dd these quests belong to
    history: [], // {date, type, amount, xpEarned}
    difficultyBias: {} // per exercise type: -1 (easier), 0 (neutral), 1 (harder), adjusted by feedback
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults in case of future field additions
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    console.error('Failed to load state, using defaults.', e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state.', e);
  }
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayWeekday() {
  return new Date().getDay(); // 0 = Sunday
}

// ============================================================
// SCREEN SWITCHING
// ============================================================
function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-screen="' + name + '"]').classList.add('active');

  if (name === 'home') renderHome();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
  if (name === 'settings') renderSettings();
  if (name === 'library') { renderLibraryFilters(); renderLibraryList(); }
}

// ============================================================
// PANEL SYSTEM (floating glass HUD panels)
// ============================================================
function openPanel(id) {
  document.querySelectorAll('.hud-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('panel-overlay').classList.add('active');
}

function closeAllPanels() {
  document.getElementById('panel-overlay').classList.remove('active');
  setTimeout(() => {
    document.querySelectorAll('.hud-panel').forEach(p => p.classList.add('hidden'));
  }, 200);
}

// pill group selection helper (single-select within a group)
function setupPillGroup(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
  });
}

function getSelectedPill(containerId) {
  const container = document.getElementById(containerId);
  const selected = container.querySelector('.pill.selected');
  return selected ? selected.dataset.val : null;
}

function setSelectedPill(containerId, value) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.val === value);
  });
}

// ============================================================
// LEVEL / RANK CALCULATION
// ============================================================
function xpForLevel(level) {
  // simple escalating curve, matching THE SYSTEM's 100xp-per-level-ish feel but scaling up
  return 100 + (level - 1) * 20;
}

function rankForLevel(level) {
  let current = 'E';
  for (const r of RANK_THRESHOLDS) {
    if (level >= r.minLevel) current = r.rank;
  }
  return current;
}

function addXP(amount) {
  state.xp += amount;
  let needed = xpForLevel(state.level);
  while (state.xp >= needed) {
    state.xp -= needed;
    state.level += 1;
    needed = xpForLevel(state.level);
  }
  saveState();
}

// ============================================================
// STREAK / REST DAY LOGIC (forgiving mode)
// ============================================================
function isRestDayToday() {
  return state.restDays.includes(todayWeekday());
}

function updateStreakOnCompletion() {
  const today = todayStr();
  if (state.lastActiveDate === today) return; // already counted today

  if (state.lastActiveDate) {
    const last = new Date(state.lastActiveDate);
    const diffDays = Math.round((new Date(today) - last) / 86400000);

    if (diffDays === 1) {
      state.streak += 1;
    } else if (diffDays > 1) {
      // forgiving mode: check if the gap was fully covered by rest days
      let allRest = true;
      for (let i = 1; i < diffDays; i++) {
        const d = new Date(last);
        d.setDate(d.getDate() + i);
        if (!state.restDays.includes(d.getDay())) { allRest = false; break; }
      }
      state.streak = allRest ? state.streak + 1 : 1;
    }
  } else {
    state.streak = 1;
  }
  state.lastActiveDate = today;
  saveState();
}

// ============================================================
// QUEST GENERATION (adaptive difficulty via feedback bias)
// ============================================================
const BASE_TARGETS = {
  pushups: { beginner: 8, some: 15, experienced: 25 },
  situps: { beginner: 10, some: 20, experienced: 30 },
  squats: { beginner: 12, some: 20, experienced: 35 }
};

function getAdaptiveTarget(type) {
  const exp = state.profile.experience || 'beginner';
  let base = (BASE_TARGETS[type] && BASE_TARGETS[type][exp]) || 10;
  const bias = state.difficultyBias[type] || 0;
  // each positive bias point scales target up ~15%, negative scales down ~15%, clamped
  const factor = 1 + (bias * 0.15);
  return Math.max(3, Math.round(base * factor));
}

function generateDailyQuests() {
  const types = ['pushups', 'situps', 'squats'];
  return types.map((type, i) => ({
    id: 'q_' + Date.now() + '_' + i,
    type,
    amount: getAdaptiveTarget(type) + ' reps',
    done: false,
    feedback: null
  }));
}

function ensureTodayQuests() {
  const today = todayStr();
  if (state.questsDate !== today) {
    state.quests = generateDailyQuests();
    state.questsDate = today;
    saveState();
  }
}

// ============================================================
// LIVE COUNTDOWN CLOCK (time remaining today)
// ============================================================
function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return midnight - now;
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function renderCountdown() {
  // detect day rollover regardless of which screen is active, so quests
  // regenerate promptly at midnight even if the person isn't on Home
  const today = todayStr();
  if (state.questsDate && state.questsDate !== today) {
    ensureTodayQuests();
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-home') renderHome();
  }

  const clockEl = document.getElementById('clock-val');
  const stripEl = document.getElementById('countdown-strip');
  const labelEl = document.getElementById('countdown-label');
  if (!clockEl || !stripEl) return; // not on home screen right now

  clockEl.textContent = formatCountdown(msUntilMidnight());

  const allDone = state.quests.length > 0 && state.quests.every(q => q.done);
  const restToday = isRestDayToday();

  if (restToday) {
    stripEl.classList.add('rest-today');
    labelEl.textContent = allDone ? 'REST DAY · QUESTS CLEARED' : 'REST DAY · TIME REMAINING';
  } else {
    stripEl.classList.remove('rest-today');
    labelEl.textContent = allDone ? 'ALL QUESTS CLEARED · RESETS IN' : 'TIME REMAINING TODAY';
  }
}

let countdownIntervalId = null;
function startCountdownLoop() {
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  renderCountdown();
  countdownIntervalId = setInterval(renderCountdown, 1000);
}

// ============================================================
// RENDER: HOME SCREEN
// ============================================================
function renderHome() {
  ensureTodayQuests();
  renderCountdown();

  document.getElementById('home-streak').textContent = state.streak;
  document.getElementById('home-xp').textContent = state.xp + (state.level > 1 ? ' (L' + state.level + ')' : '');
  document.getElementById('home-rank').textContent = rankForLevel(state.level);
  document.getElementById('top-level-chip').textContent = 'LVL ' + state.level;

  const needed = xpForLevel(state.level);
  document.getElementById('home-xp-text').textContent = state.xp + ' / ' + needed;
  document.getElementById('home-xp-fill').style.width = Math.min(100, (state.xp / needed) * 100) + '%';

  const list = document.getElementById('quest-list');
  list.innerHTML = '';

  if (isRestDayToday() && state.quests.every(q => !q.done)) {
    const restCard = document.createElement('div');
    restCard.className = 'card';
    restCard.innerHTML = '<div class="card-title">Rest Day</div><div class="card-sub">Today is a planned rest day. Quests are optional — your streak is protected.</div>';
    list.appendChild(restCard);
  }

  state.quests.forEach(quest => {
    const card = document.createElement('div');
    card.className = 'quest-card' + (quest.done ? ' done' : '');
    card.innerHTML = `
      <div class="qname">${quest.typeLabel || EXERCISE_LABELS[quest.type] || quest.type}</div>
      <div class="qmeta">${quest.amount}</div>
      <div class="qactions">
        ${quest.done
          ? '<button class="btn ghost full" disabled>CLEARED</button>'
          : `<button class="btn primary full" onclick="completeQuest('${quest.id}')">MARK COMPLETE</button>`
        }
      </div>
    `;
    list.appendChild(card);
  });
}

function completeQuest(id) {
  const quest = state.quests.find(q => q.id === id);
  if (!quest || quest.done) return;
  quest.done = true;

  const xpEarned = 30;
  addXP(xpEarned);
  updateStreakOnCompletion();

  state.history.push({
    date: todayStr(),
    type: quest.type,
    typeLabel: quest.typeLabel || null,
    amount: quest.amount,
    xpEarned
  });
  saveState();
  renderHome();

  // ask for difficulty feedback
  pendingFeedbackType = quest.type;
  openPanel('panel-quest-feedback');
}

let pendingFeedbackType = null;
function submitFeedback(level) {
  if (pendingFeedbackType) {
    const delta = level === 'easy' ? 1 : level === 'hard' ? -1 : 0;
    const current = state.difficultyBias[pendingFeedbackType] || 0;
    // clamp bias between -2 and +2 so difficulty doesn't run away
    state.difficultyBias[pendingFeedbackType] = Math.max(-2, Math.min(2, current + delta));
    saveState();
  }
  pendingFeedbackType = null;
  closeAllPanels();
}

function addQuest() {
  const type = document.getElementById('new-quest-type').value;
  const amount = document.getElementById('new-quest-amount').value.trim();
  if (!amount) return;

  ensureTodayQuests();
  state.quests.push({
    id: 'q_' + Date.now(),
    type,
    amount,
    done: false,
    feedback: null
  });
  saveState();
  document.getElementById('new-quest-amount').value = '';
  closeAllPanels();
  renderHome();
}

// ============================================================
// MANUAL ENTRY
// ============================================================
function submitManualEntry() {
  const type = document.getElementById('manual-entry-type').value;
  const amount = document.getElementById('manual-entry-amount').value;
  if (!amount || isNaN(amount) || Number(amount) <= 0) return;

  const xpEarned = 20;
  addXP(xpEarned);
  updateStreakOnCompletion();

  state.history.push({
    date: todayStr(),
    type,
    amount: amount + (type === 'distance' ? ' km' : type === 'steps' ? ' steps' : ' reps'),
    xpEarned
  });
  saveState();

  document.getElementById('manual-entry-amount').value = '';
  closeAllPanels();
  renderHome();
}

// ============================================================
// RENDER: STATS SCREEN
// ============================================================
function renderStats() {
  const log = document.getElementById('stats-log');
  const recent = state.history.slice(-20).reverse();

  if (recent.length === 0) {
    log.innerHTML = '<div class="empty-state">No activity logged yet.<br>Complete a quest to see your history here.</div>';
    return;
  }

  log.innerHTML = '';
  recent.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'card';
    row.style.marginBottom = '8px';
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="card-title" style="font-size:12px;">${entry.typeLabel || EXERCISE_LABELS[entry.type] || entry.type}</div>
          <div class="card-sub">${entry.amount} · ${entry.date}</div>
        </div>
        <div style="color:#ffd875; font-size:12px;">+${entry.xpEarned} XP</div>
      </div>
    `;
    log.appendChild(row);
  });
}

// ============================================================
// RENDER: PROFILE SCREEN
// ============================================================
function renderProfile() {
  const p = state.profile;
  document.getElementById('profile-name-display').textContent = (p.name || 'HUNTER').toUpperCase();
  document.getElementById('profile-rank-display').textContent = rankForLevel(state.level) + '-RANK · LEVEL ' + state.level;

  const card = document.getElementById('profile-data-card');
  card.innerHTML = `
    <div class="toggle-row"><div class="toggle-row-label">Height</div><div class="card-sub">${p.height ? p.height + ' cm' : '—'}</div></div>
    <div class="toggle-row"><div class="toggle-row-label">Weight</div><div class="card-sub">${p.weight ? p.weight + ' kg' : '—'}</div></div>
    <div class="toggle-row"><div class="toggle-row-label">Age</div><div class="card-sub">${p.age || '—'}</div></div>
    <div class="toggle-row"><div class="toggle-row-label">Experience</div><div class="card-sub">${p.experience || '—'}</div></div>
    <div class="toggle-row"><div class="toggle-row-label">Goal</div><div class="card-sub">${p.goal || '—'}</div></div>
  `;
}

function openEditProfile() {
  const p = state.profile;
  document.getElementById('edit-name').value = p.name || '';
  document.getElementById('edit-height').value = p.height || '';
  document.getElementById('edit-weight').value = p.weight || '';
  document.getElementById('edit-age').value = p.age || '';
  setSelectedPill('experience-pills', p.experience);
  setSelectedPill('goal-pills', p.goal);
  openPanel('panel-edit-profile');
}

function saveProfile() {
  state.profile.name = document.getElementById('edit-name').value.trim();
  state.profile.height = Number(document.getElementById('edit-height').value) || null;
  state.profile.weight = Number(document.getElementById('edit-weight').value) || null;
  state.profile.age = Number(document.getElementById('edit-age').value) || null;
  state.profile.experience = getSelectedPill('experience-pills');
  state.profile.goal = getSelectedPill('goal-pills');
  saveState();
  closeAllPanels();
  renderProfile();
}

// ============================================================
// RENDER: SETTINGS SCREEN
// ============================================================
function renderSettings() {
  document.getElementById('toggle-notifications').classList.toggle('on', state.notificationsEnabled);

  const pillWrap = document.getElementById('rest-day-pills');
  pillWrap.innerHTML = '';
  WEEKDAY_LABELS.forEach((label, idx) => {
    const pill = document.createElement('div');
    pill.className = 'pill' + (state.restDays.includes(idx) ? ' selected' : '');
    pill.textContent = label;
    pill.onclick = () => {
      const pos = state.restDays.indexOf(idx);
      if (pos === -1) state.restDays.push(idx);
      else state.restDays.splice(pos, 1);
      saveState();
      renderSettings();
    };
    pillWrap.appendChild(pill);
  });
}

function toggleSwitch(el, key) {
  const newVal = !el.classList.contains('on');
  el.classList.toggle('on', newVal);
  if (key === 'notifications') state.notificationsEnabled = newVal;
  saveState();
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  closeAllPanels();
  switchScreen('home');
  renderHome();
  checkOnboarding();
}

// ============================================================
// ONBOARDING
// ============================================================
function checkOnboarding() {
  if (!state.onboarded) {
    openPanel('panel-onboarding');
  }
}

function completeOnboarding() {
  state.profile.name = document.getElementById('onboard-name').value.trim();
  state.profile.height = Number(document.getElementById('onboard-height').value) || null;
  state.profile.weight = Number(document.getElementById('onboard-weight').value) || null;
  state.profile.age = Number(document.getElementById('onboard-age').value) || null;
  state.profile.experience = getSelectedPill('onboard-experience-pills') || 'beginner';
  state.profile.goal = getSelectedPill('onboard-goal-pills') || 'general';
  state.onboarded = true;
  saveState();
  closeAllPanels();
  renderHome();
}

// ============================================================
// EXERCISE LIBRARY SCREEN
// ============================================================
let libraryMuscleFilter = 'all';
let libraryTypeFilter = 'all';
let selectedLibraryExercise = null;

function renderLibraryFilters() {
  const muscleRow = document.getElementById('muscle-filter-row');
  const typeRow = document.getElementById('type-filter-row');

  const muscles = ['all', ...Object.keys(MUSCLE_LABELS)];
  muscleRow.innerHTML = muscles.map(m =>
    `<div class="filter-chip${libraryMuscleFilter === m ? ' selected' : ''}" onclick="setLibraryFilter('muscle','${m}')">${m === 'all' ? 'All' : MUSCLE_LABELS[m]}</div>`
  ).join('');

  const types = ['all', ...Object.keys(TYPE_LABELS)];
  typeRow.innerHTML = types.map(t =>
    `<div class="filter-chip${libraryTypeFilter === t ? ' selected' : ''}" onclick="setLibraryFilter('type','${t}')">${t === 'all' ? 'All' : TYPE_LABELS[t]}</div>`
  ).join('');
}

function setLibraryFilter(kind, value) {
  if (kind === 'muscle') libraryMuscleFilter = value;
  if (kind === 'type') libraryTypeFilter = value;
  renderLibraryFilters();
  renderLibraryList();
}

function renderLibraryList() {
  const filtered = EXERCISE_LIBRARY.filter(ex => {
    const muscleMatch = libraryMuscleFilter === 'all' || ex.muscle === libraryMuscleFilter;
    const typeMatch = libraryTypeFilter === 'all' || ex.type === libraryTypeFilter;
    return muscleMatch && typeMatch;
  });

  document.getElementById('library-count-label').textContent = filtered.length + ' EXERCISE' + (filtered.length === 1 ? '' : 'S');

  const list = document.getElementById('library-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No exercises match these filters.</div>';
    return;
  }

  list.innerHTML = filtered.map(ex => `
    <div class="exercise-card" onclick="openExerciseDetail('${ex.id}')">
      <div class="exercise-card-info">
        <div class="ename">${ex.name}</div>
        <div class="etags">
          <span class="etag">${MUSCLE_LABELS[ex.muscle]}</span>
          <span class="etag">${TYPE_LABELS[ex.type]}</span>
          <span class="etag difficulty-${ex.difficulty}">${DIFFICULTY_LABELS[ex.difficulty]}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function openExerciseDetail(id) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === id);
  if (!ex) return;
  selectedLibraryExercise = ex;

  document.getElementById('exercise-detail-name').textContent = ex.name.toUpperCase();
  document.getElementById('exercise-detail-tags').innerHTML = `
    <span class="etag">${MUSCLE_LABELS[ex.muscle]}</span>
    <span class="etag">${TYPE_LABELS[ex.type]}</span>
    <span class="etag difficulty-${ex.difficulty}">${DIFFICULTY_LABELS[ex.difficulty]}</span>
  `;
  document.getElementById('exercise-detail-guidelines').innerHTML = ex.guidelines.map(g => `<li>${g}</li>`).join('');
  document.getElementById('exercise-detail-target').textContent = ex.defaultTarget;

  openPanel('panel-exercise-detail');
}

function addLibraryExerciseToQuests() {
  if (!selectedLibraryExercise) return;
  ensureTodayQuests();
  state.quests.push({
    id: 'q_' + Date.now(),
    type: selectedLibraryExercise.id,
    typeLabel: selectedLibraryExercise.name,
    amount: selectedLibraryExercise.defaultTarget,
    done: false,
    feedback: null
  });
  saveState();
  closeAllPanels();
  switchScreen('home');
}

// ============================================================
// INIT
// ============================================================
function init() {
  setupPillGroup('experience-pills');
  setupPillGroup('goal-pills');
  setupPillGroup('onboard-experience-pills');
  setupPillGroup('onboard-goal-pills');

  // override edit-profile button to prefill before opening
  document.querySelectorAll('[onclick="openPanel(\'panel-edit-profile\')"]').forEach(btn => {
    btn.setAttribute('onclick', 'openEditProfile()');
  });

  if (!state.onboarded) {
    checkOnboarding();
  } else {
    renderHome();
  }
  startCountdownLoop();
}

document.addEventListener('DOMContentLoaded', init);
