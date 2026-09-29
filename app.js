// app.js —— 应用主程序：负责页面渲染、导航和交互

const $main = document.getElementById('main');
const $catName = document.getElementById('cat-name');
const $catSwitcher = document.getElementById('cat-switcher');
const $gearBtn = document.getElementById('gear-btn');
const $backBtn = document.getElementById('back-btn');
const $nav = document.querySelector('.bottom-nav');
const $catMenu = document.getElementById('cat-menu');
const $modalRoot = document.getElementById('modal-root');

let currentPage = 'home';
let feedingDate = db.todayStr();
let weightRange = 'all';
let pendingDelete = null;
let feedingEditId = null;
let feedingDraft = null;
let foodPicker = { foodId: null, search: '' };

// ---------- 小工具 ----------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtAmount(a, unit) {
  const n = Number(a) || 0;
  return (Math.round(n * 100) / 100) + (unit || '');
}

function formatDate(s) {
  const parts = (s || '').split('-');
  return parts.length === 3 ? parts[0] + '/' + parts[1] + '/' + parts[2] : s;
}

function formatFood(f) {
  return f.calorieValue + ' kcal / ' + f.calorieReferenceAmount + (f.calorieReferenceUnit || f.unit);
}

function foodEmoji(food) {
  const u = (food.unit || '').toLowerCase();
  if (u.includes('罐') || u.includes('盒') || u.includes('包') || u.includes('袋')) return '🥫';
  if (u.includes('粒') || u.includes('颗') || u.includes('条') || u.includes('块') || u.includes('片')) return '🐟';
  if (u.includes('ml') || u.includes('毫升') || u.includes('水')) return '💧';
  return '🥣';
}

function shiftDate(s, delta) {
  const parts = (s || '').split('-').map(Number);
  if (parts.length !== 3) return db.todayStr();
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + delta);
  return db.toDateStr(d);
}

function summarize(records) {
  const map = new Map();
  for (const r of records) {
    const f = db.getFood(r.foodId) || { name: '未知食物' };
    if (!map.has(r.foodId)) {
      map.set(r.foodId, { foodId: r.foodId, name: f.name, amount: 0, unit: r.unit || '', calories: 0 });
    }
    const s = map.get(r.foodId);
    s.amount += Number(r.amount) || 0;
    s.calories += Number(r.calories) || 0;
  }
  return [...map.values()];
}

function activeCat() {
  const last = db.getLastCatId();
  if (last && db.getCat(last)) return db.getCat(last);
  return db.getCats()[0] || null;
}

function toast(msg) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ---------- 弹窗（底部弹层） ----------

function showModal(contentHtml) {
  $modalRoot.innerHTML = '<div class="overlay" id="modal-overlay"><div class="sheet"><div class="sheet-handle"></div>' + contentHtml + '</div></div>';
  const first = $modalRoot.querySelector('input, select, button');
  if (first) setTimeout(() => first.focus(), 0);
}

function closeModal() {
  $modalRoot.innerHTML = '';
}

// ---------- 渲染 ----------

function render() {
  const cat = activeCat();
  $catName.textContent = cat ? cat.name : '';
  $catSwitcher.style.visibility = cat ? 'visible' : 'hidden';
  $gearBtn.classList.toggle('hidden', currentPage !== 'home');
  $backBtn.classList.toggle('hidden', currentPage !== 'settings');
  $nav.classList.toggle('hidden', currentPage === 'settings');
  $nav.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === currentPage);
  });

  if (currentPage === 'home') renderHome(cat);
  else if (currentPage === 'feeding') renderFeeding(cat);
  else if (currentPage === 'weight') renderWeight(cat);
  else if (currentPage === 'settings') renderSettings();
  closeCatMenu();
}

function renderNoCat() {
  $main.innerHTML = `
    <div class="page">
      <div class="empty-card">
        <div class="empty-emoji">🐱</div>
        <h2>还没有添加猫咪</h2>
        <p>添加第一只猫咪，开始记录它的健康数据</p>
        <button class="btn btn-primary" data-action="add-cat">＋ 添加猫咪</button>
      </div>
    </div>`;
}

function renderHome(cat) {
  if (!cat) { renderNoCat(); return; }

  const records = db.getFeedingByCatDate(cat.id, db.todayStr());
  const todayKcal = records.reduce((s, r) => s + (Number(r.calories) || 0), 0);
  const target = cat.dailyCalorieTarget;
  const over = target != null && todayKcal > target;
  const remaining = target != null ? target - todayKcal : null;
  const losing = Number(cat.targetWeight) < Number(cat.currentWeight) - 0.05;
  const breed = cat.breed ? cat.breed : '猫咪';

  // 猫咪资料卡
  const profileHtml = `
    <div class="profile-card">
      <div class="profile-left">
        <div class="avatar-wrap">
          <div class="avatar animate-gentle-float">🐱</div>
          <span class="avatar-badge">${losing ? '减重中' : '记录中'}</span>
        </div>
        <div>
          <div class="profile-name-row"><h1>${esc(cat.name)}</h1><span class="breed-badge">${esc(breed)}</span></div>
          <p class="profile-weight">目标: <b>${Number(cat.targetWeight).toFixed(2)} kg</b> · 当前: <b>${Number(cat.currentWeight).toFixed(2)} kg</b></p>
        </div>
      </div>
      <button class="icon-btn" data-action="gear" title="档案设置">⚙️</button>
    </div>`;

  // 弧形仪表盘
  const arcLen = 172.78;
  const pct = target ? Math.min(1, todayKcal / target) : 0;
  const offset = (arcLen - arcLen * pct).toFixed(1);
  const arcColor = over ? '#C05656' : '#5E836A';
  const gaugeBadge = over
    ? `<span class="gauge-badge over">⚠️ 已超出 <b>${todayKcal - target}</b> kcal</span>`
    : (remaining != null
      ? `<span class="gauge-badge">🐾 还可摄入 <b>${remaining}</b> kcal</span>`
      : `<span class="gauge-badge">🐾 尚未设置每日目标</span>`);

  const gaugeHtml = `
    <div class="gauge-card">
      <div class="gauge-title"><span class="gauge-dot"></span>今日能量指示</div>
      <div class="gauge-wrap">
        <svg class="gauge-svg" viewBox="0 0 160 100">
          <path d="M 25 85 A 55 55 0 0 1 135 85" fill="none" stroke="#EDF1EC" stroke-width="14" stroke-linecap="round"/>
          <path d="M 25 85 A 55 55 0 0 1 135 85" fill="none" stroke="${arcColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${arcLen}" stroke-dashoffset="${offset}" class="gauge-arc"/>
        </svg>
        <div class="gauge-center">
          <span class="gauge-center-label">已摄入热量</span>
          <div class="gauge-center-value ${over ? 'over' : ''}">${todayKcal}<span class="unit"> / ${target == null ? '—' : target} kcal</span></div>
        </div>
        ${gaugeBadge}
      </div>
      <div class="info-pills">
        <div class="info-pill">
          <div class="info-pill-icon">🎯</div>
          <div><div class="info-pill-label">每日目标</div><div class="info-pill-value">${target == null ? '未设置' : target + ' kcal'}</div></div>
        </div>
        <div class="info-pill ${over ? 'rouge' : ''}">
          <div class="info-pill-icon">⚖️</div>
          <div><div class="info-pill-label">今日已摄入</div><div class="info-pill-value">${todayKcal} kcal</div></div>
        </div>
      </div>
    </div>`;

  // 快速打卡
  const quickFoods = db.getFoods().slice().sort((a, b) => (b.isCommon ? 1 : 0) - (a.isCommon ? 1 : 0)).slice(0, 3);
  const quickHtml = quickFoods.length
    ? quickFoods.map(f => `
        <button class="quick-food" data-action="quick-add" data-id="${f.id}">
          <span class="q-emoji">${foodEmoji(f)}</span>
          <span class="q-name">${esc(f.name)}</span>
          <span class="q-hint">约 ${formatFood(f)}</span>
        </button>`).join('')
    : `<div class="quick-empty">先去「设置」添加食物，就能一键打卡了</div>`;

  // 今日进食日志
  const foodById = Object.fromEntries(db.getFoods().map(f => [f.id, f]));
  const logsHtml = records.length
    ? records.slice().reverse().map(r => {
        const f = foodById[r.foodId] || { name: '未知食物', unit: r.unit || '' };
        return `<div class="log-item">
          <div class="log-left">
            <div class="log-icon">${foodEmoji(f)}</div>
            <div><div class="log-name">${esc(f.name)}</div><div class="log-meta">${r.time} · ${fmtAmount(r.amount, r.unit)}</div></div>
          </div>
          <span class="log-kcal ${over ? 'over' : ''}">+${r.calories} kcal</span>
        </div>`;
      }).join('')
    : '<div class="muted">今天还没有记录，点「记一笔配餐记录」开始吧</div>';

  $main.innerHTML = `
    <div class="page">
      ${profileHtml}
      <div class="tip-strip"><span class="tip-text">🌿 细水长流，健康减重</span></div>
      ${gaugeHtml}
      <div class="card">
        <div class="card-title-row"><span class="card-title" style="margin:0">快速打卡</span><span class="muted">点击一键录入</span></div>
        <div class="quick-grid">${quickHtml}</div>
        <button class="btn btn-primary btn-block" data-action="add-feeding">🐾 记一笔配餐记录</button>
      </div>
      <div class="card">
        <div class="card-title-row">
          <span class="card-title" style="margin:0">今日进食日志 <span class="badge">${records.length} 项</span></span>
          <button class="btn btn-ghost btn-sm" data-action="nav" data-page="feeding">查看全部</button>
        </div>
        ${logsHtml}
      </div>
    </div>`;
}

function renderFeeding(cat) {
  if (!cat) { renderNoCat(); return; }

  const records = db.getFeedingByCatDate(cat.id, feedingDate);
  const totalKcal = records.reduce((s, r) => s + (Number(r.calories) || 0), 0);
  const summary = summarize(records);
  const foodById = Object.fromEntries(db.getFoods().map(f => [f.id, f]));
  const isToday = feedingDate === db.todayStr();

  const summaryHtml = summary.length === 0
    ? '<div class="muted">这一天没有进食记录</div>'
    : summary.map(s => `<div class="row"><span>${esc(s.name)}</span><span class="muted">${fmtAmount(s.amount, s.unit)} · ${s.calories} kcal</span></div>`).join('');

  const timelineHtml = records.length === 0
    ? '<div class="muted">暂无记录</div>'
    : records.map(r => {
        const f = foodById[r.foodId] || { name: '未知食物' };
        return `<div class="timeline-item">
          <div class="timeline-time">${r.time}</div>
          <div class="timeline-body">
            <div class="timeline-main"><span class="food-name">${foodEmoji(f)} ${esc(f.name)}</span><span class="muted">${fmtAmount(r.amount, r.unit)} · ${r.calories} kcal</span></div>
          </div>
          <div class="timeline-actions">
            <button class="icon-btn" data-action="edit-feeding" data-id="${r.id}">✏️</button>
            <button class="icon-btn" data-action="delete-feeding" data-id="${r.id}">🗑️</button>
          </div>
        </div>`;
      }).join('');

  $main.innerHTML = `
    <div class="page">
      <div class="date-bar">
        <button class="icon-btn" data-action="feeding-prev">←</button>
        <div class="date-display">
          <div>${formatDate(feedingDate)}${isToday ? '（今天）' : ''}</div>
          <input type="date" id="feeding-date-input" value="${feedingDate}">
        </div>
        <button class="icon-btn" data-action="feeding-next">→</button>
      </div>
      <div class="card">
        <div class="card-title">${isToday ? '今日摄入' : '当日摄入'} <span style="color:var(--matcha);font-weight:800">${totalKcal} kcal</span></div>
        ${summaryHtml}
      </div>
      <button class="btn btn-primary btn-block" data-action="add-feeding">🐾 添加进食</button>
      <div class="card">
        <div class="card-title">时间线</div>
        ${timelineHtml}
      </div>
    </div>`;
}

function renderWeight(cat) {
  if (!cat) { renderNoCat(); return; }

  const records = db.getWeightByCat(cat.id);
  const latest = records.length ? Number(records[records.length - 1].weight) : null;
  const shownWeight = latest != null ? latest : Number(cat.currentWeight);
  const target = Number(cat.targetWeight);

  let distanceHtml = '—';
  if (target && shownWeight != null) {
    const diff = shownWeight - target;
    distanceHtml = diff > 0
      ? '还差 ' + diff.toFixed(2) + ' kg'
      : (diff < 0 ? '已低于目标 ' + Math.abs(diff).toFixed(2) + ' kg' : '已达到目标');
  }

  const ranges = [['7', '7天'], ['30', '30天'], ['90', '90天'], ['all', '全部']];
  const rangeButtons = ranges.map(([v, label]) =>
    `<button class="chip ${weightRange === v ? 'active' : ''}" data-action="weight-range" data-range="${v}">${label}</button>`
  ).join('');

  $main.innerHTML = `
    <div class="page">
      <div class="weight-summary">
        <div class="weight-box">
          <div class="weight-num">${shownWeight != null ? shownWeight.toFixed(2) : '—'}<span class="unit">kg</span></div>
          <div class="weight-label">当前体重</div>
        </div>
        <div class="weight-box">
          <div class="weight-num">${target ? target.toFixed(2) : '—'}<span class="unit">kg</span></div>
          <div class="weight-label">目标体重</div>
        </div>
        <div class="weight-box">
          <div class="weight-num small">${distanceHtml}</div>
          <div class="weight-label">距离目标</div>
        </div>
      </div>
      <div class="card">
        <div class="range-row">${rangeButtons}</div>
        <div id="weight-chart"></div>
      </div>
      <button class="btn btn-primary btn-block" data-action="add-weight">🐾 记录体重</button>
      <div class="card">
        <div class="card-title">体重记录</div>
        ${records.length
          ? records.slice().reverse().map(r => `
            <div class="row">
              <span>${formatDate(r.date)}</span>
              <span class="muted">${Number(r.weight).toFixed(2)} kg</span>
              <button class="icon-btn" data-action="delete-weight" data-id="${r.id}">🗑️</button>
            </div>`).join('')
          : '<div class="muted">暂无记录</div>'}
      </div>
    </div>`;

  const chartEl = document.getElementById('weight-chart');
  renderWeightChart(chartEl, records, target || null, weightRange === 'all' ? 0 : Number(weightRange));
}

function renderSettings() {
  const cats = db.getCats();
  const foods = db.getFoods();
  const activeId = activeCat() ? activeCat().id : null;

  $main.innerHTML = `
    <div class="page">
      <div class="section-title">🐱 猫咪管理</div>
      <div class="card">
        ${cats.length
          ? cats.map(c => `
            <div class="row">
              <span>🐱 ${esc(c.name)}${c.id === activeId ? ' <span class="badge">当前</span>' : ''}</span>
              <span class="muted">${c.currentWeight ? c.currentWeight + ' kg' : ''}</span>
              <button class="icon-btn" data-action="edit-cat" data-id="${c.id}">✏️</button>
              <button class="icon-btn" data-action="delete-cat" data-id="${c.id}">🗑️</button>
            </div>`).join('')
          : '<div class="muted">还没有猫咪</div>'}
        <button class="btn btn-secondary btn-block" data-action="add-cat">＋ 添加猫咪</button>
      </div>

      <div class="section-title">🍚 食物管理</div>
      <div class="card">
        ${foods.length
          ? foods.map(f => `
            <div class="row">
              <span>${foodEmoji(f)} ${esc(f.name)}${f.isCommon ? ' <span class="badge">常用</span>' : ''}</span>
              <span class="muted">${formatFood(f)}</span>
              <button class="icon-btn" data-action="edit-food" data-id="${f.id}">✏️</button>
              <button class="icon-btn" data-action="delete-food" data-id="${f.id}">🗑️</button>
            </div>`).join('')
          : '<div class="muted">还没有食物</div>'}
        <button class="btn btn-secondary btn-block" data-action="add-food">＋ 添加食物</button>
      </div>
    </div>`;
}

// ---------- 猫咪菜单 ----------

function openCatMenu() {
  const cats = db.getCats();
  const activeId = activeCat() ? activeCat().id : null;
  $catMenu.innerHTML = `<div class="cat-menu-inner">
    ${cats.map(c => `
      <button class="cat-menu-item ${c.id === activeId ? 'selected' : ''}" data-action="select-cat" data-id="${c.id}">
        <span>🐱 ${esc(c.name)}</span>${c.id === activeId ? '<span>✓</span>' : ''}
      </button>`).join('')}
    <button class="cat-menu-item add" data-action="add-cat">＋ 添加猫咪</button>
  </div>`;
  $catMenu.classList.remove('hidden');
}

function closeCatMenu() {
  $catMenu.classList.add('hidden');
}

// ---------- 表单弹窗 ----------

function openCatForm(cat) {
  const isEdit = !!cat;
  const c = cat || { name: '', sex: 'female', neutered: true, currentWeight: '', targetWeight: '', age: '', breed: '', activityLevel: 'normal', bcs: '' };
  const advanced = isEdit
    ? `
      <label>年龄（岁，可选）<input type="number" name="age" min="0" step="0.5" value="${c.age ?? ''}"></label>
      <label>品种（可选）<input type="text" name="breed" value="${esc(c.breed || '')}"></label>
      <label>活动量
        <select name="activityLevel">
          <option value="low" ${c.activityLevel === 'low' ? 'selected' : ''}>低（不太爱动）</option>
          <option value="normal" ${c.activityLevel === 'normal' ? 'selected' : ''}>正常</option>
          <option value="high" ${c.activityLevel === 'high' ? 'selected' : ''}>高（很爱动）</option>
        </select>
      </label>
      <label>BCS 体况评分（1–9，可选）<input type="number" name="bcs" min="1" max="9" step="1" value="${c.bcs ?? ''}"></label>
      <p class="muted">1–3 偏瘦 · 4–5 理想 · 6–9 偏胖</p>`
    : '<p class="muted">年龄、品种、活动量、BCS 等，稍后可在「设置 → 猫咪管理」中完善。</p>';

  showModal(`
    <div class="sheet-header"><h3>${isEdit ? '编辑猫咪' : '添加猫咪'}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <form data-form="${isEdit ? 'cat-edit' : 'cat-add'}">
      ${isEdit ? `<input type="hidden" name="id" value="${c.id}">` : ''}
      <label>名字<input type="text" name="name" value="${esc(c.name)}" required></label>
      <label>性别
        <select name="sex">
          <option value="female" ${c.sex === 'female' ? 'selected' : ''}>母猫</option>
          <option value="male" ${c.sex === 'male' ? 'selected' : ''}>公猫</option>
        </select>
      </label>
      <label class="check-row"><input type="checkbox" name="neutered" ${c.neutered ? 'checked' : ''}> 已绝育</label>
      <label>当前体重（kg）<input type="number" name="currentWeight" min="0.1" step="0.01" value="${c.currentWeight ?? ''}" required></label>
      <label>目标体重（kg）<input type="number" name="targetWeight" min="0.1" step="0.01" value="${c.targetWeight ?? ''}" required></label>
      ${advanced}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>`);
}

function openFoodForm(food) {
  const isEdit = !!food;
  const f = food || { name: '', brand: '', unit: 'g', calorieReferenceAmount: '100', calorieValue: '', isCommon: false };
  showModal(`
    <div class="sheet-header"><h3>${isEdit ? '编辑食物' : '添加食物'}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <form data-form="${isEdit ? 'food-edit' : 'food-add'}">
      ${isEdit ? `<input type="hidden" name="id" value="${f.id}">` : ''}
      <label>食物名称<input type="text" name="name" value="${esc(f.name)}" required></label>
      <label>品牌（可选）<input type="text" name="brand" value="${esc(f.brand || '')}"></label>
      <label>单位（比如 g / 罐 / 粒）<input type="text" name="unit" value="${esc(f.unit || '')}" required></label>
      <div class="two-col">
        <label>每多少单位<input type="number" name="calorieReferenceAmount" min="0.01" step="0.01" value="${f.calorieReferenceAmount}" required></label>
        <label>热量（kcal）<input type="number" name="calorieValue" min="0" step="0.01" value="${f.calorieValue}" required></label>
      </div>
      <label class="check-row"><input type="checkbox" name="isCommon" ${f.isCommon ? 'checked' : ''}> 设为常用食物（首页置顶）</label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>`);
}

function openFeedingForm(rec, presetFoodId) {
  const isEdit = !!rec;
  feedingEditId = isEdit ? rec.id : null;
  const date = isEdit ? rec.date : (currentPage === 'feeding' ? feedingDate : db.todayStr());
  const time = isEdit ? rec.time : db.nowTimeStr();
  foodPicker = { foodId: isEdit ? rec.foodId : (presetFoodId || null), search: '' };

  showModal(`
    <div class="sheet-header"><h3>🐾 ${isEdit ? '编辑进食记录' : '记录今日配餐'}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <form data-form="${isEdit ? 'feeding-edit' : 'feeding-add'}">
      <div class="two-col">
        <label>日期<input type="date" name="date" id="feeding-date" value="${date}" required></label>
        <label>时间<input type="time" name="time" id="feeding-time" value="${time}" required></label>
      </div>
      <div class="picker-label">选择食物</div>
      <div class="food-pills" id="food-pills"></div>
      <input type="search" id="food-search" placeholder="🔍 搜索食物" autocomplete="off">
      <div id="food-list" class="food-list"></div>
      <button type="button" class="btn btn-secondary btn-block" data-action="add-food-from-picker">＋ 新建食物</button>
      <label>实际吃了多少（<span id="food-unit">单位</span>）
        <input type="number" name="amount" id="feeding-amount" min="0" step="any" value="${isEdit ? rec.amount : ''}">
      </label>
      <div class="kcal-preview" id="kcal-preview"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>`);

  renderFoodPills();
  renderFoodPickerList();
  updateKcalPreview();
}

function renderFoodPills() {
  const el = document.getElementById('food-pills');
  if (!el) return;
  const common = db.getFoods().filter(f => f.isCommon).slice(0, 4);
  if (common.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = common.map(f => `
    <button type="button" class="food-pill ${f.id === foodPicker.foodId ? 'selected' : ''}" data-action="select-food" data-id="${f.id}">
      ${foodEmoji(f)} ${esc(f.name)}
    </button>`).join('');
}

function renderFoodPickerList() {
  const listEl = document.getElementById('food-list');
  if (!listEl) return;
  const q = foodPicker.search.trim().toLowerCase();
  let foods = db.getFoods();
  if (q) {
    foods = foods.filter(f => (f.name || '').toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q));
  }
  foods = foods.slice().sort((a, b) => (b.isCommon ? 1 : 0) - (a.isCommon ? 1 : 0));
  if (foods.length === 0) {
    listEl.innerHTML = '<div class="muted list-empty">没有匹配的食物，点下方「新建食物」添加</div>';
    return;
  }
  listEl.innerHTML = foods.map(f => `
    <button type="button" class="food-option ${f.id === foodPicker.foodId ? 'selected' : ''}" data-action="select-food" data-id="${f.id}">
      <span>${foodEmoji(f)} ${esc(f.name)}${f.isCommon ? ' <span class="badge">常用</span>' : ''}</span>
      <span class="muted">${formatFood(f)}</span>
    </button>`).join('');
}

function selectFood(id) {
  foodPicker.foodId = id;
  renderFoodPills();
  renderFoodPickerList();
  updateKcalPreview();
}

function updateKcalPreview() {
  const el = document.getElementById('kcal-preview');
  if (!el) return;
  const f = foodPicker.foodId ? db.getFood(foodPicker.foodId) : null;
  const unitEl = document.getElementById('food-unit');
  if (unitEl) unitEl.textContent = f ? f.unit : '单位';
  const amount = parseFloat(document.getElementById('feeding-amount')?.value);
  if (f && amount > 0) {
    el.innerHTML = '预计摄入 <strong>+' + calcFoodCalories(f, amount) + ' kcal</strong>';
  } else if (f) {
    el.textContent = '每 ' + f.calorieReferenceAmount + (f.calorieReferenceUnit || f.unit) + ' = ' + f.calorieValue + ' kcal';
  } else {
    el.textContent = '请先选择食物';
  }
}

function openFoodFormFromPicker() {
  const date = document.getElementById('feeding-date')?.value || feedingDate;
  const time = document.getElementById('feeding-time')?.value || db.nowTimeStr();
  const amount = document.getElementById('feeding-amount')?.value || '';
  feedingDraft = { date, time, amount };
  openFoodForm(null);
}

function openWeightForm() {
  showModal(`
    <div class="sheet-header"><h3>记录体重</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <form data-form="weight-add">
      <label>日期<input type="date" name="date" value="${db.todayStr()}" required></label>
      <label>体重（kg）<input type="number" name="weight" min="0.1" step="0.01" required></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>`);
}

function openTargetEdit() {
  const cat = activeCat();
  const sys = calcDailyTarget(cat);
  showModal(`
    <div class="sheet-header"><h3>修改每日目标</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <form data-form="target-edit">
      <label>每日热量目标（kcal）<input type="number" name="target" min="1" step="1" value="${cat.dailyCalorieTarget ?? ''}" required></label>
      ${sys != null ? `<p class="muted">系统推荐值：${sys} kcal</p>` : ''}
      <div class="modal-actions">
        ${sys != null ? '<button type="button" class="btn btn-ghost" data-action="restore-target">恢复系统推荐值</button>' : ''}
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>`);
}

function confirmDelete(message, onConfirm) {
  pendingDelete = onConfirm;
  showModal(`
    <div class="sheet-header"><h3>确认删除</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
    <p class="confirm-text">${message}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
      <button type="button" class="btn btn-danger" data-action="confirm-delete">删除</button>
    </div>`);
}

// ---------- 表单提交 ----------

function formData(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  return out;
}

function handleCatSubmit(form) {
  const d = formData(form);
  const name = (d.name || '').trim();
  const cw = parseFloat(d.currentWeight);
  const tw = parseFloat(d.targetWeight);
  if (!name || !(cw > 0) || !(tw > 0)) { toast('请填写名字、当前体重和目标体重'); return; }

  const existing = d.id ? db.getCat(d.id) : null;
  const cat = {
    id: d.id || db.uid('cat'),
    name,
    sex: d.sex || 'female',
    neutered: !!d.neutered,
    currentWeight: cw,
    targetWeight: tw,
    age: d.age === '' || d.age == null ? null : parseFloat(d.age),
    breed: d.breed || '',
    activityLevel: d.activityLevel || 'normal',
    bcs: d.bcs === '' || d.bcs == null ? null : Number(d.bcs),
  };
  if (existing) {
    cat.dailyCalorieTarget = existing.dailyCalorieTarget;
    cat.isTargetManuallySet = existing.isTargetManuallySet;
  } else {
    cat.dailyCalorieTarget = null;
    cat.isTargetManuallySet = false;
  }
  const saved = db.saveCat(cat);
  db.setLastCatId(saved.id);
  closeModal();
  toast(existing ? '猫咪资料已更新' : '猫咪已添加');
  render();
}

function handleFoodSubmit(form) {
  const d = formData(form);
  const name = (d.name || '').trim();
  const unit = (d.unit || '').trim();
  const ref = parseFloat(d.calorieReferenceAmount);
  const kcal = parseFloat(d.calorieValue);
  if (!name || !unit || !(ref > 0) || !(kcal >= 0)) { toast('请完整填写名称、单位、热量信息'); return; }

  const food = db.saveFood({
    id: d.id || db.uid('food'),
    name,
    brand: d.brand || '',
    unit,
    calorieReferenceAmount: ref,
    calorieValue: kcal,
    calorieReferenceUnit: unit,
    isCommon: !!d.isCommon,
  });

  closeModal();
  if (feedingDraft) {
    const draft = feedingDraft;
    feedingDraft = null;
    openFeedingForm(null, food.id);
    const dateEl = document.getElementById('feeding-date');
    const timeEl = document.getElementById('feeding-time');
    const amountEl = document.getElementById('feeding-amount');
    if (dateEl) dateEl.value = draft.date;
    if (timeEl) timeEl.value = draft.time;
    if (amountEl) amountEl.value = draft.amount;
    renderFoodPills();
    renderFoodPickerList();
    updateKcalPreview();
  } else {
    toast('食物已保存');
    render();
  }
}

function handleFeedingSubmit(form, isEdit) {
  const d = formData(form);
  const food = db.getFood(foodPicker.foodId);
  const amount = parseFloat(d.amount);
  if (!food || !(amount > 0)) { toast('请选择食物并填写实际吃掉的量'); return; }
  if (!d.date || !d.time) { toast('请填写日期和时间'); return; }

  db.saveFeedingRecord({
    id: isEdit ? feedingEditId : db.uid('rec'),
    catId: activeCat().id,
    date: d.date,
    time: d.time,
    foodId: food.id,
    amount,
    unit: food.unit,
    calories: calcFoodCalories(food, amount),
  });
  closeModal();
  toast('已保存 🐾');
  render();
}

function handleWeightSubmit(form) {
  const d = formData(form);
  const w = parseFloat(d.weight);
  if (!d.date || !(w > 0)) { toast('请填写日期和体重'); return; }
  db.saveWeightRecord({ id: db.uid('w'), catId: activeCat().id, date: d.date, weight: w });
  const cat = activeCat();
  db.saveCat({ ...cat, currentWeight: w });
  closeModal();
  toast('体重已记录 🐾');
  render();
}

function handleTargetSubmit(form) {
  const d = formData(form);
  const val = Math.round(parseFloat(d.target));
  if (!(val > 0)) { toast('请输入有效的热量值'); return; }
  const cat = activeCat();
  db.saveCat({ ...cat, dailyCalorieTarget: val, isTargetManuallySet: true });
  closeModal();
  toast('每日目标已更新');
  render();
}

function recomputeTarget() {
  const cat = activeCat();
  const val = calcDailyTarget(cat);
  if (val == null) { toast('资料不足：请先填写当前体重和目标体重'); return; }
  db.saveCat({ ...cat, dailyCalorieTarget: val, isTargetManuallySet: false });
  toast('已生成建议目标：' + val + ' kcal');
  render();
}

function restoreTarget() {
  const cat = activeCat();
  const val = calcDailyTarget(cat);
  if (val == null) { toast('资料不足，无法计算推荐值'); return; }
  db.saveCat({ ...cat, dailyCalorieTarget: val, isTargetManuallySet: false });
  closeModal();
  toast('已恢复系统推荐值');
  render();
}

// ---------- 删除确认 ----------

function askDeleteCat(id) {
  const c = db.getCat(id);
  confirmDelete('确定要删除「' + esc(c.name) + '」吗？它的进食记录和体重记录也会一起删除。', () => {
    db.deleteCat(id);
    toast('已删除');
    render();
  });
}

function askDeleteFood(id) {
  const f = db.getFood(id);
  confirmDelete('确定要删除食物「' + esc(f.name) + '」吗？', () => {
    db.deleteFood(id);
    toast('已删除');
    render();
  });
}

function askDeleteFeeding(id) {
  const r = db.getFeedingRecords().find(x => x.id === id);
  const f = r ? db.getFood(r.foodId) : null;
  const line = r ? (r.time + ' · ' + (f ? f.name : '未知食物') + ' · ' + fmtAmount(r.amount, r.unit) + ' · ' + r.calories + ' kcal') : '';
  confirmDelete('确定要删除这条记录吗？<br>' + esc(line), () => {
    db.deleteFeedingRecord(id);
    toast('已删除');
    render();
  });
}

function askDeleteWeight(id) {
  const r = db.getWeightRecords().find(x => x.id === id);
  const line = r ? (formatDate(r.date) + ' · ' + Number(r.weight).toFixed(2) + ' kg') : '';
  confirmDelete('确定要删除这条体重记录吗？<br>' + esc(line), () => {
    db.deleteWeightRecord(id);
    toast('已删除');
    render();
  });
}

// ---------- 事件处理 ----------

function handleAction(action, id, btn) {
  switch (action) {
    case 'toggle-cat-menu':
      if ($catMenu.classList.contains('hidden')) openCatMenu();
      else closeCatMenu();
      break;
    case 'select-cat':
      db.setLastCatId(id);
      render();
      break;
    case 'add-cat':
      openCatForm(null);
      break;
    case 'edit-cat':
      openCatForm(db.getCat(id));
      break;
    case 'delete-cat':
      askDeleteCat(id);
      break;
    case 'gear':
      currentPage = 'settings';
      render();
      break;
    case 'back':
      currentPage = 'home';
      render();
      break;
    case 'nav':
      currentPage = btn.dataset.page;
      render();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'add-feeding':
      openFeedingForm(null);
      break;
    case 'quick-add':
      openFeedingForm(null, id);
      break;
    case 'edit-feeding': {
      const r = db.getFeedingRecords().find(x => x.id === id);
      if (r) openFeedingForm(r);
      break;
    }
    case 'delete-feeding':
      askDeleteFeeding(id);
      break;
    case 'add-food':
      openFoodForm(null);
      break;
    case 'add-food-from-picker':
      openFoodFormFromPicker();
      break;
    case 'edit-food':
      openFoodForm(db.getFood(id));
      break;
    case 'delete-food':
      askDeleteFood(id);
      break;
    case 'add-weight':
      openWeightForm();
      break;
    case 'delete-weight':
      askDeleteWeight(id);
      break;
    case 'generate-target':
    case 'recalc-target':
      recomputeTarget();
      break;
    case 'edit-target':
      openTargetEdit();
      break;
    case 'restore-target':
      restoreTarget();
      break;
    case 'weight-range':
      weightRange = btn.dataset.range;
      render();
      break;
    case 'feeding-prev':
      feedingDate = shiftDate(feedingDate, -1);
      render();
      break;
    case 'feeding-next':
      feedingDate = shiftDate(feedingDate, 1);
      render();
      break;
    case 'select-food':
      selectFood(id);
      break;
    case 'confirm-delete':
      if (pendingDelete) {
        const fn = pendingDelete;
        pendingDelete = null;
        fn();
      }
      break;
  }
}

function onDocumentClick(e) {
  if (e.target && e.target.id === 'modal-overlay') { closeModal(); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn) {
    if (!e.target.closest('#cat-menu') && !e.target.closest('#cat-switcher')) closeCatMenu();
    return;
  }
  handleAction(btn.dataset.action, btn.dataset.id, btn);
}

function onDocumentSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const type = form.dataset.form;
  if (type === 'cat-add' || type === 'cat-edit') handleCatSubmit(form);
  else if (type === 'food-add' || type === 'food-edit') handleFoodSubmit(form);
  else if (type === 'feeding-add') handleFeedingSubmit(form, false);
  else if (type === 'feeding-edit') handleFeedingSubmit(form, true);
  else if (type === 'weight-add') handleWeightSubmit(form);
  else if (type === 'target-edit') handleTargetSubmit(form);
}

function onDocumentInput(e) {
  if (e.target.id === 'food-search') {
    foodPicker.search = e.target.value;
    renderFoodPickerList();
  } else if (e.target.id === 'feeding-amount') {
    updateKcalPreview();
  }
}

function onDocumentChange(e) {
  if (e.target.id === 'feeding-date-input') {
    feedingDate = e.target.value || db.todayStr();
    render();
  }
}

function onKeydown(e) {
  if (e.key !== 'Escape') return;
  if ($modalRoot.childElementCount > 0) closeModal();
  else closeCatMenu();
}

// ---------- 启动 ----------

document.addEventListener('click', onDocumentClick);
document.addEventListener('submit', onDocumentSubmit);
document.addEventListener('input', onDocumentInput);
document.addEventListener('change', onDocumentChange);
document.addEventListener('keydown', onKeydown);

render();
