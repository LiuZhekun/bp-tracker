/**
 * storage.js - 血压数据的本地存储管理
 * 使用 localStorage 将数据保存在手机本地，不上传任何服务器
 */

const Storage = (() => {
  const KEY = 'bp_records'; // localStorage 键名

  // 获取所有记录（按时间倒序）
  function getAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[Storage] 读取失败:', e);
      return [];
    }
  }

  // 保存一条新记录
  function save(record) {
    const records = getAll();
    const newRecord = {
      id: Date.now().toString(),
      time: record.time,
      sys: Number(record.sys),
      dia: Number(record.dia),
      pulse: record.pulse ? Number(record.pulse) : null,
      note: record.note || '',
    };
    records.unshift(newRecord); // 最新的排在最前面
    localStorage.setItem(KEY, JSON.stringify(records));
    return newRecord;
  }

  // 删除指定 id 的记录
  function remove(id) {
    const records = getAll().filter(r => r.id !== id);
    localStorage.setItem(KEY, JSON.stringify(records));
  }

  // 获取近 N 天的记录（days=0 表示全部）
  function getByDays(days) {
    const all = getAll();
    if (!days || days === 0) return all;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return all.filter(r => new Date(r.time) >= cutoff);
  }

  // 导出为 CSV 文件并触发下载
  function exportCSV() {
    const records = getAll();
    if (records.length === 0) return false;

    const headers = ['时间', '收缩压(mmHg)', '舒张压(mmHg)', '心率(次/分)', '备注'];
    const rows = records.map(r => [
      r.time,
      r.sys,
      r.dia,
      r.pulse ?? '',
      r.note,
    ]);

    // 加 BOM，让 Excel 正确识别 UTF-8 中文
    const csv = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `血压记录_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  return { getAll, save, remove, getByDays, exportCSV };
})();
