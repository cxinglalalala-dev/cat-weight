// chart.js —— 用 SVG 画体重折线图（不依赖任何第三方库）

/**
 * 渲染体重折线图
 * @param {HTMLElement} container 容器元素
 * @param {Array<{date:string, weight:number}>} records 按日期升序的体重记录
 * @param {number|null} targetWeight 目标体重
 * @param {number} rangeDays 7|30|90|0（0 表示全部）
 */
function renderWeightChart(container, records, targetWeight, rangeDays) {
  container.innerHTML = '';
  if (!records || records.length === 0) {
    container.innerHTML = '<div class="chart-empty">还没有体重记录，先记录一次体重吧</div>';
    return;
  }

  const data = filterByRange(records, rangeDays);
  if (data.length === 0) {
    container.innerHTML = '<div class="chart-empty">这个时间范围内没有记录</div>';
    return;
  }

  const width = Math.max(container.clientWidth || 320, 280);
  const height = 220;
  const pad = { top: 18, right: 16, bottom: 32, left: 44 };

  const weights = data.map(d => Number(d.weight));
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (targetWeight) { min = Math.min(min, targetWeight); max = Math.max(max, targetWeight); }
  const span = (max - min) || 1;
  min -= span * 0.15;
  max += span * 0.15;

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = i => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = w => pad.top + (1 - (w - min) / (max - min)) * innerH;

  const pts = data.map((d, i) => ({ x: x(i), y: y(Number(d.weight)), d }));

  const ticks = 4;
  let grid = '';
  let yLabels = '';
  for (let t = 0; t <= ticks; t++) {
    const val = min + (max - min) * (t / ticks);
    const yy = pad.top + innerH * (t / ticks);
    grid += `<line x1="${pad.left}" y1="${yy.toFixed(1)}" x2="${width - pad.right}" y2="${yy.toFixed(1)}" class="grid-line"></line>`;
    yLabels += `<text x="${pad.left - 6}" y="${(yy + 4).toFixed(1)}" class="axis-label" text-anchor="end">${val.toFixed(2)}</text>`;
  }

  const labelCount = Math.min(data.length, 5);
  let xLabels = '';
  for (let k = 0; k < labelCount; k++) {
    const idx = Math.round((k / Math.max(labelCount - 1, 1)) * (data.length - 1));
    const p = pts[idx];
    xLabels += `<text x="${p.x.toFixed(1)}" y="${height - pad.bottom + 16}" class="axis-label" text-anchor="middle">${shortDate(p.d.date)}</text>`;
  }

  let targetLine = '';
  if (targetWeight) {
    const ty = y(targetWeight);
    targetLine = `<line x1="${pad.left}" y1="${ty.toFixed(1)}" x2="${width - pad.right}" y2="${ty.toFixed(1)}" class="target-line" stroke-dasharray="5 4"></line>
      <text x="${width - pad.right}" y="${(ty - 6).toFixed(1)}" class="target-label" text-anchor="end">目标 ${targetWeight} kg</text>`;
  }

  const linePoints = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" class="dot"></circle>`).join('');

  container.innerHTML = `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${grid}
      ${targetLine}
      <polyline points="${linePoints}" class="line"></polyline>
      ${dots}
      ${yLabels}
      ${xLabels}
    </svg>`;
}

function filterByRange(records, rangeDays) {
  if (!rangeDays) return records;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (rangeDays - 1));
  const startStr = toStr(start);
  return records.filter(r => (r.date || '') >= startStr);
}

function toStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function shortDate(s) {
  const parts = (s || '').split('-');
  return parts.length === 3 ? parts[1] + '/' + parts[2] : s;
}
