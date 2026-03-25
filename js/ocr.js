/**
 * ocr.js - 血压仪照片 OCR 识别（优化版）
 *
 * 针对常见血压仪（欧姆龙、鱼跃等）的屏幕特点做了专项优化：
 * - 数值为竖排堆叠：高压（大字）/ 低压 / 脉搏，无斜杠分隔
 * - 7段LCD数码管字体，灰底深色数字
 * - 用 Canvas 做预处理：灰度化 → 高对比度二值化 → 放大
 * - 多策略解析：优先按数量级区分三个数值
 */

const OCR = (() => {
  let worker = null;

  // ===== 初始化 Tesseract Worker（懒加载）=====
  async function ensureWorker() {
    if (worker) return;
    worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {},
    });
    console.log('[OCR] Worker 初始化完成');
  }

  /**
   * 识别入口：图片预处理 → OCR → 解析
   * @param {HTMLImageElement} imgEl
   * @returns {Promise<{sys, dia, pulse}|null>}
   */
  async function recognize(imgEl) {
    try {
      await ensureWorker();

      // 多次尝试，用不同预处理策略
      const strategies = [
        () => preprocessImage(imgEl, { threshold: 140, invert: false, scale: 2 }),
        () => preprocessImage(imgEl, { threshold: 160, invert: false, scale: 3 }),
        () => preprocessImage(imgEl, { threshold: 120, invert: true,  scale: 2 }),
      ];

      for (const getCanvas of strategies) {
        const canvas = getCanvas();
        const result = await runOCR(canvas);
        console.log('[OCR] 识别文本:', JSON.stringify(result));

        const parsed = parseNumbers(result);
        if (parsed) return parsed;
      }

      console.warn('[OCR] 多次识别均未提取到有效血压数据');
      return null;
    } catch (e) {
      console.error('[OCR] 识别异常:', e);
      return null;
    }
  }

  // ===== Canvas 图像预处理 =====
  // 灰度化 → 高对比度二值化 → 放大，提升数码管字体识别率
  function preprocessImage(imgEl, { threshold = 140, invert = false, scale = 2 } = {}) {
    const w = imgEl.naturalWidth  || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;

    const canvas = document.createElement('canvas');
    canvas.width  = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');

    // 放大绘制（双线性插值，提升小字清晰度）
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      // 加权灰度（人眼对绿色最敏感）
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // 二值化：超过阈值为白，否则为黑
      let val = gray > threshold ? 255 : 0;
      if (invert) val = 255 - val;
      d[i] = d[i + 1] = d[i + 2] = val;
      d[i + 3] = 255; // alpha 不透明
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // ===== 执行 Tesseract OCR =====
  async function runOCR(canvas) {
    // PSM 11：稀疏文本模式，适合在整张图中找分散的数字
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789 ',
      tessedit_pageseg_mode: '11',
    });
    const { data: { text } } = await worker.recognize(canvas);
    return text || '';
  }

  // ===== 从识别文本中解析血压三项数值 =====
  function parseNumbers(text) {
    if (!text.trim()) return null;

    // 提取所有连续数字串（长度 2~3 位）
    const nums = [...text.matchAll(/\d{2,3}/g)]
      .map(m => parseInt(m[0]))
      .filter(n => n >= 40 && n <= 250); // 过滤明显无效值

    if (nums.length === 0) return null;
    console.log('[OCR] 候选数字:', nums);

    // === 策略1：三个数字都在合理范围内，按血压规律分配 ===
    // 收缩压（高压）：90~220，通常最大
    // 舒张压（低压）：50~130，第二大，且 < 收缩压
    // 脉搏：50~130
    let sys = null, dia = null, pulse = null;

    // 找收缩压候选（90~220 中最大的）
    const sysCandidates = nums.filter(n => n >= 90 && n <= 220);
    if (sysCandidates.length === 0) return null;
    sys = Math.max(...sysCandidates);

    // 找舒张压候选（50~130 中最大的，且必须 < sys）
    const diaCandidates = nums.filter(n => n >= 50 && n <= 130 && n < sys);
    if (diaCandidates.length === 0) return null;
    dia = Math.max(...diaCandidates);

    // 找脉搏候选（50~130 中，排除已用的 sys/dia）
    const pulseCandidates = nums.filter(n =>
      n >= 50 && n <= 130 && n !== sys && n !== dia
    );
    pulse = pulseCandidates.length > 0
      ? pulseCandidates.reduce((a, b) => Math.abs(a - 75) < Math.abs(b - 75) ? a : b) // 取最接近75的
      : null;

    // 最终合理性验证
    if (sys > dia && sys >= 90 && dia >= 50) {
      console.log(`[OCR] 解析结果 → 收缩压:${sys} 舒张压:${dia} 脉搏:${pulse}`);
      return { sys, dia, pulse };
    }

    return null;
  }

  return { recognize };
})();
