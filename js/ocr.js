/**
 * ocr.js - 血压仪照片 OCR 识别（优化版 v2）
 *
 * 针对7段LCD数码管字体常见误读（1→2, 4→0, 8→5）做专项优化：
 * - Otsu自动阈值算法：根据图像直方图自动找最佳二值化阈值
 * - 多套预处理策略轮流尝试，任意一套成功即停止
 * - PSM 6/11 两种模式分别尝试
 * - 结果校验：优先选最符合血压规律的候选组合
 */

const OCR = (() => {
  let worker = null;

  // ===== 初始化 Tesseract Worker（懒加载）=====
  async function ensureWorker() {
    if (worker) return;
    worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
    console.log('[OCR] Worker 初始化完成');
  }

  /**
   * 识别入口
   * @param {HTMLImageElement} imgEl
   * @returns {Promise<{sys, dia, pulse}|null>}
   */
  async function recognize(imgEl) {
    try {
      await ensureWorker();

      const otsuThresh = calcOtsuThreshold(imgEl);
      console.log('[OCR] Otsu阈值:', otsuThresh);

      // 预处理策略列表（按成功率排序）
      const strategies = [
        // Otsu自动阈值，正常方向，2倍放大
        { threshold: otsuThresh, invert: false, scale: 2, psm: '6' },
        // Otsu自动阈值，反色（适合深色背景浅色数字）
        { threshold: otsuThresh, invert: true,  scale: 2, psm: '6' },
        // 固定高阈值（偏亮屏幕）
        { threshold: 160,        invert: false, scale: 3, psm: '11' },
        // 固定低阈值（偏暗屏幕）
        { threshold: 100,        invert: false, scale: 3, psm: '11' },
        // 反色 + 低阈值
        { threshold: 100,        invert: true,  scale: 3, psm: '11' },
      ];

      for (const s of strategies) {
        const canvas = preprocessImage(imgEl, s);
        const text = await runOCR(canvas, s.psm);
        console.log(`[OCR] 策略(thresh=${s.threshold},inv=${s.invert},psm=${s.psm}) 结果:`, JSON.stringify(text));

        const result = parseNumbers(text);
        if (result) {
          console.log('[OCR] 解析成功:', result);
          return result;
        }
      }

      console.warn('[OCR] 所有策略均未识别到有效血压数据');
      return null;
    } catch (e) {
      console.error('[OCR] 异常:', e);
      return null;
    }
  }

  // ===== Otsu 自动阈值算法 =====
  // 分析图像灰度直方图，找到前景（数字）与背景的最优分割阈值
  function calcOtsuThreshold(imgEl) {
    const canvas = document.createElement('canvas');
    // 缩小到256px宽，加快计算
    const scale = Math.min(1, 256 / (imgEl.naturalWidth || imgEl.width));
    canvas.width  = (imgEl.naturalWidth  || imgEl.width)  * scale;
    canvas.height = (imgEl.naturalHeight || imgEl.height) * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hist = new Array(256).fill(0);
    const total = canvas.width * canvas.height;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[gray]++;
    }

    // Otsu方差最大化
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    let sumB = 0, wB = 0, maxVar = 0, bestThresh = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const variance = wB * wF * (mB - mF) ** 2;
      if (variance > maxVar) { maxVar = variance; bestThresh = t; }
    }

    return bestThresh;
  }

  // ===== Canvas 图像预处理 =====
  function preprocessImage(imgEl, { threshold = 128, invert = false, scale = 2 } = {}) {
    const w = imgEl.naturalWidth  || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;
    const canvas = document.createElement('canvas');
    canvas.width  = w * scale;
    canvas.height = h * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let val = gray > threshold ? 255 : 0;
      if (invert) val = 255 - val;
      d[i] = d[i + 1] = d[i + 2] = val;
      d[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // ===== 执行 Tesseract OCR =====
  async function runOCR(canvas, psm = '11') {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789 ',
      tessedit_pageseg_mode: psm,
    });
    const { data: { text } } = await worker.recognize(canvas);
    return text || '';
  }

  // ===== 从识别文本中解析血压三项数值 =====
  function parseNumbers(text) {
    if (!text.trim()) return null;

    // 提取所有 2~3 位数字
    const nums = [...text.matchAll(/\d{2,3}/g)]
      .map(m => parseInt(m[0]))
      .filter(n => n >= 40 && n <= 250);

    if (nums.length === 0) return null;
    console.log('[OCR] 候选数字:', nums);

    // 生成所有可能的 (sys, dia, pulse) 三元组并打分，取最高分
    let bestResult = null;
    let bestScore = -Infinity;

    const candidates = nums.length > 6 ? nums.slice(0, 8) : nums; // 限制组合数量

    for (let i = 0; i < candidates.length; i++) {
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        const s = candidates[i]; // 候选收缩压
        const d = candidates[j]; // 候选舒张压
        if (!isSysValid(s) || !isDiaValid(d) || s <= d) continue;

        for (let k = 0; k < candidates.length; k++) {
          if (k === i || k === j) continue;
          const p = candidates[k]; // 候选脉搏
          if (!isPulseValid(p)) continue;
          const score = calcScore(s, d, p);
          if (score > bestScore) {
            bestScore = score;
            bestResult = { sys: s, dia: d, pulse: p };
          }
        }

        // 没有脉搏的情况
        const score = calcScore(s, d, null);
        if (score > bestScore) {
          bestScore = score;
          bestResult = { sys: s, dia: d, pulse: null };
        }
      }
    }

    return bestResult;
  }

  // ===== 数值合理性判断 =====
  const isSysValid   = n => n >= 90  && n <= 200;
  const isDiaValid   = n => n >= 50  && n <= 130;
  const isPulseValid = n => n >= 45  && n <= 130;

  // 打分：越符合正常血压分布越高分
  function calcScore(sys, dia, pulse) {
    let score = 0;
    // 脉压差合理范围 20~80
    const pp = sys - dia;
    if (pp >= 20 && pp <= 80) score += 10;
    // 收缩压接近典型值 120~150
    score -= Math.abs(sys - 130) * 0.1;
    // 舒张压接近典型值 70~90
    score -= Math.abs(dia - 80) * 0.1;
    // 有脉搏加分
    if (pulse !== null) {
      score += 5;
      score -= Math.abs(pulse - 75) * 0.05;
    }
    return score;
  }

  return { recognize };
})();
