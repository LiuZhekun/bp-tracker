/**
 * storage.js - 血压数据本地存储 + 统计计算
 */

const Storage = (() => {
  const KEY = 'bp_records';

  function getAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function save(record) {
    const records = getAll();
    const r = {
      id:    Date.now().toString(),
      time:  record.time,
      sys:   Number(record.sys),
      dia:   Number(record.dia),
      pulse: record.pulse ? Number(record.pulse) : null,
      note:  record.note || '',
    };
    records.unshift(r);
    localStorage.setItem(KEY, JSON.stringify(records));
    return r;
  }

  function remove(id) {
    localStorage.setItem(KEY, JSON.stringify(getAll().filter(r => r.id !== id)));
  }

  /**
   * 按时间范围筛选
   * range: 'week7' | 'month30' | 'month90' | 'all'
   */
  function getByRange(range) {
    const all = getAll();
    const now = new Date();
    const daysAgo = d => { const c = new Date(now); c.setDate(c.getDate() - d); return c; };
    if (range === 'week7')  return all.filter(r => new Date(r.time) >= daysAgo(7));
    if (range === 'month30') return all.filter(r => new Date(r.time) >= daysAgo(30));
    if (range === 'month90') return all.filter(r => new Date(r.time) >= daysAgo(90));
    return all; // 'all'
  }

  /**
   * 计算统计摘要
   * @returns {{ count, avgSys, avgDia, avgPulse, maxSys, minSys, targetRate, highCount, pp } | null}
   */
  function calcStats(records) {
    if (!records.length) return null;
    const avg = a => Math.round(a.reduce((s, v) => s + v, 0) / a.length);

    const sysList   = records.map(r => r.sys);
    const diaList   = records.map(r => r.dia);
    const pulseList = records.filter(r => r.pulse).map(r => r.pulse);

    const avgSys = avg(sysList);
    const avgDia = avg(diaList);

    // 达标率：家庭自测标准 SYS<135 且 DIA<85
    const targetCount = records.filter(r => r.sys < 135 && r.dia < 85).length;

    // 峰值预警次数：SYS≥140 或 DIA≥90
    const highCount = records.filter(r => r.sys >= 140 || r.dia >= 90).length;

    return {
      count:      records.length,
      avgSys,
      avgDia,
      avgPulse:   pulseList.length ? avg(pulseList) : null,
      maxSys:     Math.max(...sysList),
      minSys:     Math.min(...sysList),
      targetRate: Math.round(targetCount / records.length * 100),
      highCount,
      pp:         avgSys - avgDia,  // 脉压差
    };
  }

  /**
   * 计算血压分布（按中国高血压指南分级）
   * @returns {{ normal, elevated, high1, high2, low }}
   */
  function calcDistribution(records) {
    const dist = { low: 0, normal: 0, elevated: 0, high1: 0, high2: 0 };
    records.forEach(r => {
      if (r.sys < 90  || r.dia < 60)  dist.low++;
      else if (r.sys < 130 && r.dia < 85) dist.normal++;
      else if (r.sys < 140 && r.dia < 90) dist.elevated++;
      else if (r.sys < 160 && r.dia < 100) dist.high1++;
      else dist.high2++;
    });
    return dist;
  }

  /**
   * 导入记录：相同时间的覆盖，新时间的追加
   * @param {Array} incoming - 解析后的记录数组
   * @returns {{ added: number, updated: number }}
   */
  function importRecords(incoming) {
    const existing = getAll();

    // 以 time 字段为唯一键建立索引
    const byTime = {};
    existing.forEach(r => { byTime[r.time] = r; });

    let added = 0, updated = 0;

    incoming.forEach(r => {
      if (!r.time || !r.sys || !r.dia) return; // 跳过无效行
      if (byTime[r.time]) {
        // 相同时间 → 覆盖字段
        Object.assign(byTime[r.time], {
          sys:   Number(r.sys),
          dia:   Number(r.dia),
          pulse: r.pulse ? Number(r.pulse) : null,
          note:  r.note || '',
        });
        updated++;
      } else {
        // 新记录 → 生成 id 后追加
        byTime[r.time] = {
          id:    String(Date.now()) + Math.random().toString(36).slice(2),
          time:  r.time,
          sys:   Number(r.sys),
          dia:   Number(r.dia),
          pulse: r.pulse ? Number(r.pulse) : null,
          note:  r.note || '',
        };
        added++;
      }
    });

    // 按时间倒序保存
    const sorted = Object.values(byTime).sort((a, b) => new Date(b.time) - new Date(a.time));
    localStorage.setItem(KEY, JSON.stringify(sorted));
    return { added, updated };
  }

  function exportCSV() {
    const records = getAll();
    if (!records.length) return false;
    const headers = ['时间', '收缩压(mmHg)', '舒张压(mmHg)', '心率(次/分)', '备注'];
    const rows = records.map(r => [r.time, r.sys, r.dia, r.pulse ?? '', r.note]);
    const csv = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `血压记录_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    return true;
  }

  /**
   * 按自定义起止日期筛选（start/end 为 'YYYY-MM-DD' 字符串，可为空）
   */
  function getByDateRange(start, end) {
    const all = getAll();
    const s = start ? new Date(start) : null;
    const e = end   ? new Date(end + 'T23:59:59') : null; // 包含结束当天全天
    return all.filter(r => {
      const t = new Date(r.time);
      if (s && t < s) return false;
      if (e && t > e) return false;
      return true;
    });
  }

  return { getAll, save, remove, getByRange, getByDateRange, calcStats, calcDistribution, exportCSV, importRecords };
})();
