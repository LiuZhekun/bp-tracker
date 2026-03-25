/**
 * ocr.js - 血压仪照片 OCR 识别
 * 使用 Tesseract.js 在本地识别图片中的血压数值
 * 识别失败时返回 null，由用户手动输入
 */

const OCR = (() => {
  let worker = null;
  let isInitializing = false;

  // 初始化 Tesseract Worker（懒加载，首次识别时才创建）
  async function ensureWorker() {
    if (worker) return;
    if (isInitializing) {
      // 等待初始化完成
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!isInitializing) { clearInterval(check); resolve(); }
        }, 100);
      });
      return;
    }

    isInitializing = true;
    try {
      // 仅识别英文数字，加快速度
      worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {}, // 静默日志
      });
      console.log('[OCR] Worker 初始化完成');
    } finally {
      isInitializing = false;
    }
  }

  /**
   * 识别图片中的血压数值
   * @param {HTMLImageElement|HTMLCanvasElement|string} image - 图片元素或 dataURL
   * @returns {Promise<{sys:number, dia:number, pulse:number|null}|null>}
   */
  async function recognize(image) {
    try {
      await ensureWorker();

      // 限制识别字符：只识别数字和斜杠，大幅提升速度和准确率
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789/',
      });

      const { data: { text } } = await worker.recognize(image);
      console.log('[OCR] 原始识别结果:', JSON.stringify(text));

      return parseBloodPressure(text);
    } catch (e) {
      console.error('[OCR] 识别失败:', e);
      return null;
    }
  }

  /**
   * 从 OCR 文本中提取血压数据
   * 血压仪通常显示格式：大数字"收缩压/舒张压"，心率单独显示
   */
  function parseBloodPressure(text) {
    if (!text) return null;

    // 提取所有 2-3 位的数字
    const allNumbers = [...text.matchAll(/\d{2,3}/g)].map(m => parseInt(m[0]));
    if (allNumbers.length === 0) return null;

    let sys = null, dia = null, pulse = null;

    // 尝试匹配 "120/80" 或 "120-80" 格式
    const slashMatch = text.match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
    if (slashMatch) {
      sys = parseInt(slashMatch[1]);
      dia = parseInt(slashMatch[2]);

      // 心率是除收缩压/舒张压外的第三个数字（通常在 50~130 之间）
      const remaining = allNumbers.filter(n => n !== sys && n !== dia);
      pulse = remaining.find(n => n >= 50 && n <= 130) ?? null;

    } else if (allNumbers.length >= 2) {
      // 没有斜杠格式：按血压值的大小范围推断
      // 收缩压：90-200，舒张压：50-130，且收缩压 > 舒张压
      const sorted = [...allNumbers].sort((a, b) => b - a);
      for (let i = 0; i < sorted.length - 1; i++) {
        const s = sorted[i];
        const d = sorted[i + 1];
        if (s >= 90 && s <= 200 && d >= 50 && d <= 130 && s > d) {
          sys = s;
          dia = d;
          // 剩余数字中找心率
          const rest = sorted.filter((_, idx) => idx !== i && idx !== i + 1);
          pulse = rest.find(n => n >= 50 && n <= 130) ?? null;
          break;
        }
      }
    }

    // 验证数据合理性
    if (sys && dia && sys > dia && sys >= 80 && sys <= 220 && dia >= 40 && dia <= 130) {
      return { sys, dia, pulse };
    }

    return null;
  }

  return { recognize };
})();
