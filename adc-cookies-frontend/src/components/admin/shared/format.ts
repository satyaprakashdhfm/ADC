export const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const daysAgoStr = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
export const fmtDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
