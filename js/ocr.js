/**
 * ocr.js - 血压仪 OCR 识别（v3：分区识别 + 图像增强）
 *
 * 核心改进：
 * 1. 分区识别：血压仪固定布局（高压上、低压中、脉搏下），
 *    将图像切成3个水平区域，每区只跑一个数字，精度远高于全图识别
 * 2. 图像增强：锐化 + Otsu自适应阈值 + 2x放大
 * 3. PSM 8（单词模式）：专门针对单个孤立数字的识别模式
 * 4. 多套分区比例尝试：兼容不同血压仪的屏幕布局
 */

const OCR = (() => {
  let worker = null;

  // ===== 初始化 Worker =====
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

      // 策略1：分区识别（主策略，准确率最高）
      const regionResult = await recognizeByRegions(imgEl);
      if (regionResult) {
        console.log('[OCR] 分区识别成功:', regionResult);
        return regionResult;
      }

      // 策略2：全图识别兜底
      console.log('[OCR] 分区识别失败，尝试全图识别...');
      const fullResult = await recognizeFullImage(imgEl);
      if (fullResult) console.log('[OCR] 全图识别成功:', fullResult);
      return fullResult;

    } catch (e) {
      console.error('[OCR] 异常:', e);
      return null;
    }
  }

  // =========================================================
  // 策略1：分区识别
  // 血压仪固定布局：收缩压（高压）在上半部，舒张压（低压）居中，脉搏在下
  // 将图像纵向切成3个区域，每区只识别一个2~3位数字
  // =========================================================
  async function recognizeByRegions(imgEl) {
    // 多套分区比例，兼容不同品牌血压仪（欧姆龙/鱼跃等）
    // 格式：每项为 [topPercent, heightPercent]，表示区域的纵向起点和高度占比
    const layouts = [
      // 欧姆龙手腕式：三个数字均匀分布在屏幕中上部
      { sys: [0.08, 0.35], dia: [0.38, 0.30], pulse: [0.65, 0.28] },
      // 欧姆龙上臂式：高压占比更大
      { sys: [0.05, 0.40], dia: [0.42, 0.28], pulse: [0.68, 0.25] },
      // 鱼跃/其他：数字布局偏下
      { sys: [0.15, 0.33], dia: [0.45, 0.28], pulse: [0.70, 0.25] },
      // 宽松版：每区更大，容错更高
      { sys: [0.05, 0.45], dia: [0.35, 0.35], pulse: [0.60, 0.35] },
    ];

    for (const layout of layouts) {
      const sys   = await recognizeRegion(imgEl, layout.sys[0],   layout.sys[1]);
      const dia   = await recognizeRegion(imgEl, layout.dia[0],   layout.dia[1]);
      const pulse = await recognizeRegion(imgEl, layout.pulse[0], layout.pulse[1]);

      console.log(`[OCR] 分区候选 sys=${sys} dia=${dia} pulse=${pulse}`);

      if (isSysValid(sys) && isDiaValid(dia) && sys > dia) {
        return {
          sys,
          dia,
          pulse: isPulseValid(pulse) ? pulse : null,
        };
      }
    }
    return null;
  }

  // 识别图像的一个水平区域，返回最佳的 2~3 位数字
  async function recognizeRegion(imgEl, topPct, heightPct) {
    const canvas = cropAndPreprocess(imgEl, topPct, heightPct);

    // PSM 8 = 单个词语模式（最适合识别一个孤立数字）
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '8',
    });

    const { data: { text } } = await worker.recognize(canvas);
    return extractBestNumber(text, 40, 250);
  }

  // 裁剪图像水平区域 + 预处理（放大+锐化+二值化）
  function cropAndPreprocess(imgEl, topPct, heightPct) {
    const srcW = imgEl.naturalWidth  || imgEl.width;
    const srcH = imgEl.naturalHeight || imgEl.height;

    // 横向稍微留边，避免裁掉数字
    const paddingX = 0.05;
    const sx = srcW * paddingX;
    const sy = srcH * topPct;
    const sw = srcW * (1 - paddingX * 2);
    const sh = srcH * heightPct;

    // 放大2倍输出
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width  = sw * scale;
    canvas.height = sh * scale;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // 锐化（增强数码管边缘清晰度）
    sharpen(ctx, canvas.width, canvas.height);

    // Otsu 自适应阈值二值化
    const threshold = calcOtsuThreshold(ctx, canvas.width, canvas.height);
    binarize(ctx, canvas.width, canvas.height, threshold, false);

    return canvas;
  }

  // =========================================================
  // 策略2：全图识别兜底
  // =========================================================
  async function recognizeFullImage(imgEl) {
    const otsu = calcOtsuFromImage(imgEl);

    const strategies = [
      { threshold: otsu,  invert: false, scale: 2, psm: '11' },
      { threshold: otsu,  invert: true,  scale: 2, psm: '11' },
      { threshold: 140,   invert: false, scale: 3, psm: '11' },
      { threshold: 100,   invert: true,  scale: 2, psm: '11' },
    ];

    for (const s of strategies) {
      const canvas = buildFullCanvas(imgEl, s);
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789 ',
        tessedit_pageseg_mode: s.psm,
      });
      const { data: { text } } = await worker.recognize(canvas);
      console.log(`[OCR] 全图策略(thresh=${s.threshold},inv=${s.invert}):`, JSON.stringify(text));
      const result = parseNumbersFromText(text);
      if (result) return result;
    }
    return null;
  }

  function buildFullCanvas(imgEl, { threshold, invert, scale }) {
    const w = (imgEl.naturalWidth  || imgEl.width)  * scale;
    const h = (imgEl.naturalHeight || imgEl.height) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, w, h);
    sharpen(ctx, w, h);
    binarize(ctx, w, h, threshold, invert);
    return canvas;
  }

  // =========================================================
  // 图像处理工具函数
  // =========================================================

  // 锐化：使用 unsharp mask 卷积核
  function sharpen(ctx, w, h) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imgData.data);
    const d   = imgData.data;

    // 锐化核：[-1,-1,-1, -1,9,-1, -1,-1,-1]
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const i = (y * w + x) * 4 + c;
          d[i] = clamp(
            9 * src[i]
            - src[((y-1)*w + (x-1))*4+c] - src[((y-1)*w + x)*4+c] - src[((y-1)*w + (x+1))*4+c]
            - src[(y*w     + (x-1))*4+c]                            - src[(y*w     + (x+1))*4+c]
            - src[((y+1)*w + (x-1))*4+c] - src[((y+1)*w + x)*4+c] - src[((y+1)*w + (x+1))*4+c]
          );
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 灰度二值化
  function binarize(ctx, w, h, threshold, invert) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      let val = gray > threshold ? 255 : 0;
      if (invert) val = 255 - val;
      d[i] = d[i+1] = d[i+2] = val;
      d[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Otsu 自动阈值（从 canvas ctx）
  function calcOtsuThreshold(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    const hist = new Array(256).fill(0);
    const total = w * h;
    for (let i = 0; i < d.length; i += 4) {
      hist[Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2])]++;
    }
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];
    let sumB = 0, wB = 0, maxVar = 0, best = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const v = wB * wF * (mB - mF) ** 2;
      if (v > maxVar) { maxVar = v; best = t; }
    }
    return best;
  }

  // Otsu 自动阈值（从 img element）
  function calcOtsuFromImage(imgEl) {
    const canvas = document.createElement('canvas');
    canvas.width  = Math.min(256, imgEl.naturalWidth  || imgEl.width);
    canvas.height = Math.min(256, imgEl.naturalHeight || imgEl.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    return calcOtsuThreshold(ctx, canvas.width, canvas.height);
  }

  const clamp = n => Math.min(255, Math.max(0, n));

  // =========================================================
  // 数字提取工具
  // =========================================================

  // 从文本中提取最合理的单个数字（在给定范围内）
  function extractBestNumber(text, min, max) {
    const nums = [...(text || '').matchAll(/\d{2,3}/g)]
      .map(m => parseInt(m[0]))
      .filter(n => n >= min && n <= max);
    if (nums.length === 0) return null;
    // 返回最常出现的（多次识别同一数字时）
    const freq = {};
    nums.forEach(n => freq[n] = (freq[n] || 0) + 1);
    return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  // 从全图文本中解析血压三项（兜底逻辑）
  function parseNumbersFromText(text) {
    const nums = [...(text || '').matchAll(/\d{2,3}/g)]
      .map(m => parseInt(m[0]))
      .filter(n => n >= 40 && n <= 250);
    if (nums.length < 2) return null;

    let best = null, bestScore = -Infinity;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const s = nums[i], d = nums[j];
        if (!isSysValid(s) || !isDiaValid(d) || s <= d) continue;
        for (let k = 0; k < nums.length; k++) {
          if (k === i || k === j) continue;
          const p = nums[k];
          if (!isPulseValid(p)) continue;
          const score = scoreTriple(s, d, p);
          if (score > bestScore) { bestScore = score; best = { sys: s, dia: d, pulse: p }; }
        }
        const score = scoreTriple(s, d, null);
        if (score > bestScore) { bestScore = score; best = { sys: s, dia: d, pulse: null }; }
      }
    }
    return best;
  }

  const isSysValid   = n => n != null && n >= 90  && n <= 200;
  const isDiaValid   = n => n != null && n >= 50  && n <= 130;
  const isPulseValid = n => n != null && n >= 45  && n <= 130;

  function scoreTriple(sys, dia, pulse) {
    let s = 0;
    const pp = sys - dia;
    if (pp >= 20 && pp <= 80) s += 10; // 脉压差合理
    s -= Math.abs(sys  - 130) * 0.08;
    s -= Math.abs(dia  -  80) * 0.08;
    if (pulse != null) { s += 5; s -= Math.abs(pulse - 75) * 0.05; }
    return s;
  }

  return { recognize };
})();
