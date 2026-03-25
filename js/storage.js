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

  return { getAll, save, remove, getByRange, calcStats, calcDistribution, exportCSV };
})();
