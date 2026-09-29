// calorie.js —— 热量计算相关函数（数据逻辑与界面分开）

/** 基础静息能量需求 RER = 70 × 体重(kg)^0.75 */
function calcRER(kg) {
  return 70 * Math.pow(kg, 0.75);
}

/**
 * 根据猫咪资料计算每日建议热量目标（kcal/day）。
 * 资料不足（缺少当前体重或目标体重）时返回 null，不随便给数字。
 *
 * 说明：这里用的是兽医常用的简化估算方法，结果是一个合理参考值，
 * 以后如果需要更精确，可以再调整。
 */
function calcDailyTarget(cat) {
  const cw = Number(cat.currentWeight);
  const tw = Number(cat.targetWeight);
  if (!cw || cw <= 0 || !tw || tw <= 0) return null;

  const rer = calcRER(tw);
  // 绝育会降低能量需求；未绝育的成年猫需求更高
  let factor = cat.neutered ? 1.2 : 1.4;
  // 活动量调整
  if (cat.activityLevel === 'low') factor *= 0.85;
  else if (cat.activityLevel === 'high') factor *= 1.15;
  // 有减重目标（目标体重低于当前体重）时，制造约 20% 的热量缺口
  if (tw < cw - 0.05) factor *= 0.8;
  // 体况评分微调
  const bcs = Number(cat.bcs);
  if (bcs >= 6) factor *= 0.95;
  else if (bcs >= 1 && bcs <= 4) factor *= 1.05;

  const kcal = Math.round(rer * factor);
  return Math.max(50, kcal);
}

/**
 * 计算某种食物吃 amount 个单位对应的热量(kcal)。
 * 例如：主粮 380 kcal / 100g，吃 20g => 20 / 100 * 380 = 76 kcal
 */
function calcFoodCalories(food, amount) {
  const amt = Number(amount);
  if (!amt || amt <= 0) return 0;
  const ref = Number(food.calorieReferenceAmount) || 1;
  const kcalPerUnit = Number(food.calorieValue) / ref;
  return Math.round(amt * kcalPerUnit);
}
