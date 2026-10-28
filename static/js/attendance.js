/**
 * Attendance Controller
 * Manages "Currently Inside" live board with ticking workout timers, and the Historical Attendance Log with CSV export.
 */
class AttendanceController {
    constructor() {
        this.currentDateFilter = 'today';
        this.timerInterval = null;
    }

    init() {
        this.setupEventListeners();
        this.loadCurrentlyInside();
        this.loadAttendanceLogs();

        // Refresh timers every 30 seconds
        this.timerInterval = setInterval(() => {
            this.loadCurrentlyInside();
        }, 30000);
    }

    setupEventListeners() {
        // Date filter pills for logs
        document.querySelectorAll('.attendance-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.attendance-filter-btn').forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white');
                    b.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                });
                btn.classList.add('bg-indigo-600', 'text-white');
                btn.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                this.currentDateFilter = btn.dataset.filter;
                this.loadAttendanceLogs();
            });
        });

        // Export CSV button
        const exportBtn = document.getElementById('export-attendance-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                let url = '/api/attendance/export';
                if (this.currentDateFilter === 'today') {
                    url += `?date=${new Date().toISOString().split('T')[0]}`;
                }
                window.location.href = url;
            });
        }
    }

    async loadCurrentlyInside() {
        try {
            const membersInside = await api.getInside();
            const container = document.getElementById('inside-members-grid');
            const emptyState = document.getElementById('inside-empty-state');
            const insideCountEl = document.getElementById('inside-header-count');

            if (insideCountEl) insideCountEl.innerText = `${membersInside.length} Members`;

            if (!container) return;

            if (membersInside.length === 0) {
                if (emptyState) emptyState.classList.remove('hidden');
                container.innerHTML = '';
                return;
            }

            if (emptyState) emptyState.classList.add('hidden');

            container.innerHTML = membersInside.map(m => `
                <div class="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition flex flex-col justify-between">
                    <div>
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <img src="${m.photo_url}" class="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-500/30">
                                <div>
                                    <h4 class="font-bold text-slate-900 dark:text-white leading-snug">${m.name}</h4>
                                    <div class="text-xs text-slate-500 dark:text-slate-400 font-mono">${m.member_id} · ${m.phone}</div>
                                </div>
                            </div>
                            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                ACTIVE
                            </span>
                        </div>

                        <div class="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                            <div>
                                <span class="text-slate-400 text-[10px] uppercase font-semibold">Checked In At</span>
                                <div class="font-mono font-bold text-slate-800 dark:text-slate-200">${m.in_time}</div>
                            </div>
                            <div>
                                <span class="text-slate-400 text-[10px] uppercase font-semibold">Workout Time</span>
                                <div class="font-mono font-bold text-indigo-600 dark:text-indigo-400">${m.elapsed_formatted}</div>
                            </div>
                        </div>

                        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            Plan: <strong class="text-slate-700 dark:text-slate-300">${m.plan_name}</strong>
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <button type="button" onclick="window.attendanceCtrl.checkoutMember(${m.id}, '${m.name}')"
                            class="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            <span>Check Out Member</span>
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Failed to load currently inside:', err);
        }
    }

    async checkoutMember(logId, memberName) {
        try {
            const res = await api.manualCheckout(logId);
            if (res.success) {
                window.soundFx.playCheckOut();
                window.app.showToast(`Checked out ${memberName} · Workout: ${res.duration_formatted}`, 'success');
                await this.loadCurrentlyInside();
                await this.loadAttendanceLogs();
                window.app.refreshDashboardData();
            } else {
                window.app.showToast(res.error || 'Failed to check out.', 'error');
            }
        } catch (err) {
            console.error(err);
            window.app.showToast('Error during checkout.', 'error');
        }
    }

    async loadAttendanceLogs() {
        try {
            const params = {};
            const todayStr = new Date().toISOString().split('T')[0];

            if (this.currentDateFilter === 'today') {
                params.date = todayStr;
            } else if (this.currentDateFilter === 'yesterday') {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                params.date = y.toISOString().split('T')[0];
            } else if (this.currentDateFilter === '7days') {
                const start = new Date();
                start.setDate(start.getDate() - 7);
                params.start_date = start.toISOString().split('T')[0];
                params.end_date = todayStr;
            }

            const logs = await api.getAttendance(params);
            const tbody = document.getElementById('attendance-table-body');
            if (!tbody) return;

            if (logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-12 text-center text-slate-400">
                            No attendance logs recorded for this timeframe.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = logs.map(l => {
                const isInside = l.status === 'inside';
                const statusPill = isInside
                    ? `<span class="badge-inside px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> In Gym</span>`
                    : `<span class="badge-active px-2.5 py-1 rounded-full text-xs font-semibold">Completed</span>`;

                return `
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <img src="${l.photo_url}" class="w-9 h-9 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                                <div>
                                    <div class="font-bold text-slate-900 dark:text-white">${l.member_name}</div>
                                    <div class="text-xs font-mono text-slate-400">${l.member_id} · ${l.plan_name}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-300">
                            ${l.date}
                        </td>
                        <td class="px-6 py-4 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            ${l.in_time}
                        </td>
                        <td class="px-6 py-4 font-mono text-sm ${l.out_time ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400'}">
                            ${l.out_time || '--:--:--'}
                        </td>
                        <td class="px-6 py-4 font-mono text-sm font-bold text-slate-900 dark:text-white">
                            ${l.duration_formatted}
                        </td>
                        <td class="px-6 py-4">
                            ${statusPill}
                        </td>
                        <td class="px-6 py-4 text-xs font-mono text-slate-400">
                            ${l.scan_method}
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('Failed to load attendance logs:', err);
        }
    }
}

window.attendanceCtrl = new AttendanceController();
