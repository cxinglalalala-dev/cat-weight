// storage.js —— 数据层
// 负责把「猫咪、食物、进食记录、体重记录」读写到浏览器本地存储（localStorage）。
// 所有数据都只保存在你自己这台电脑的浏览器里，不会上传到任何地方。

const STORAGE_KEY = 'petfit_data_v1';

/**
 * 猫咪资料
 * @typedef {Object} Cat
 * @property {string} id
 * @property {string} name 名字
 * @property {'male'|'female'} sex 性别
 * @property {boolean} neutered 是否绝育
 * @property {number} currentWeight 当前体重(kg)
 * @property {number} targetWeight 目标体重(kg)
 * @property {number|null} age 年龄(岁)
 * @property {string} breed 品种
 * @property {'low'|'normal'|'high'} activityLevel 活动量
 * @property {number|null} bcs 体况评分(1-9)
 * @property {number|null} dailyCalorieTarget 每日热量目标(kcal)
 * @property {boolean} isTargetManuallySet 目标是否由用户手动设置
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 食物
 * @typedef {Object} Food
 * @property {string} id
 * @property {string} name
 * @property {string} brand 品牌（可选）
 * @property {string} unit 记录数量时用的单位，如 g / 罐 / 粒
 * @property {number} calorieValue 热量数值(kcal)
 * @property {number} calorieReferenceAmount 热量对应的参考数量
 * @property {string} calorieReferenceUnit 参考数量的单位
 * @property {boolean} isCommon 是否常用（置顶显示）
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 进食记录
 * @typedef {Object} FeedingRecord
 * @property {string} id
 * @property {string} catId
 * @property {string} date YYYY-MM-DD
 * @property {string} time HH:mm
 * @property {string} foodId
 * @property {number} amount 实际吃掉的量
 * @property {string} unit
 * @property {number} calories 自动计算的热量(kcal)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 体重记录
 * @typedef {Object} WeightRecord
 * @property {string} id
 * @property {string} catId
 * @property {string} date YYYY-MM-DD
 * @property {number} weight 体重(kg)
 * @property {string} createdAt
 */

function emptyState() {
  return { cats: [], foods: [], feedingRecords: [], weightRecords: [], lastCatId: null };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    console.error('读取本地数据失败：', e);
    return emptyState();
  }
}

function persist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return prefix ? prefix + '_' + rnd : rnd;
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayStr() {
  return toDateStr(new Date());
}

function nowTimeStr() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const db = {
  getState() { return state; },

  getCats() { return state.cats; },
  getCat(id) { return state.cats.find(c => c.id === id); },
  saveCat(cat) {
    const t = now();
    const i = state.cats.findIndex(c => c.id === cat.id);
    if (i >= 0) {
      state.cats[i] = { ...state.cats[i], ...cat, updatedAt: t };
      persist(state);
      return state.cats[i];
    }
    const created = { ...cat, createdAt: t, updatedAt: t };
    state.cats.push(created);
    persist(state);
    return created;
  },
  deleteCat(id) {
    state.cats = state.cats.filter(c => c.id !== id);
    state.feedingRecords = state.feedingRecords.filter(r => r.catId !== id);
    state.weightRecords = state.weightRecords.filter(r => r.catId !== id);
    if (state.lastCatId === id) state.lastCatId = state.cats[0] ? state.cats[0].id : null;
    persist(state);
  },

  getFoods() { return state.foods; },
  getFood(id) { return state.foods.find(f => f.id === id); },
  saveFood(food) {
    const t = now();
    const i = state.foods.findIndex(f => f.id === food.id);
    if (i >= 0) {
      state.foods[i] = { ...state.foods[i], ...food, updatedAt: t };
      persist(state);
      return state.foods[i];
    }
    const created = { ...food, createdAt: t, updatedAt: t };
    state.foods.push(created);
    persist(state);
    return created;
  },
  deleteFood(id) {
    state.foods = state.foods.filter(f => f.id !== id);
    persist(state);
  },

  getFeedingRecords() { return state.feedingRecords; },
  getFeedingByCatDate(catId, date) {
    return state.feedingRecords
      .filter(r => r.catId === catId && r.date === date)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  },
  saveFeedingRecord(rec) {
    const t = now();
    const i = state.feedingRecords.findIndex(r => r.id === rec.id);
    if (i >= 0) {
      state.feedingRecords[i] = { ...state.feedingRecords[i], ...rec, updatedAt: t };
      persist(state);
      return state.feedingRecords[i];
    }
    const created = { ...rec, createdAt: t, updatedAt: t };
    state.feedingRecords.push(created);
    persist(state);
    return created;
  },
  deleteFeedingRecord(id) {
    state.feedingRecords = state.feedingRecords.filter(r => r.id !== id);
    persist(state);
  },

  getWeightRecords() { return state.weightRecords; },
  getWeightByCat(catId) {
    return state.weightRecords
      .filter(r => r.catId === catId)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  },
  saveWeightRecord(rec) {
    const i = state.weightRecords.findIndex(r => r.id === rec.id);
    if (i >= 0) {
      state.weightRecords[i] = { ...state.weightRecords[i], ...rec };
      persist(state);
      return state.weightRecords[i];
    }
    const created = { ...rec, createdAt: now() };
    state.weightRecords.push(created);
    persist(state);
    return created;
  },
  deleteWeightRecord(id) {
    state.weightRecords = state.weightRecords.filter(r => r.id !== id);
    persist(state);
  },

  getLastCatId() { return state.lastCatId; },
  setLastCatId(id) { state.lastCatId = id; persist(state); },

  uid,
  toDateStr,
  todayStr,
  nowTimeStr,
};
