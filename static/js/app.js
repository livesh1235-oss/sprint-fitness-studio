/**
 * Main Application Orchestrator
 * Controls navigation, theme toggle, global dashboard stats, and toast notifications.
 */
class GymApp {
    constructor() {
        this.activeTab = 'scan';
        this.isDark = localStorage.getItem('gym_theme') === 'dark';
    }

    init() {
        this.applyTheme();
        this.setupNavigation();
        this.refreshDashboardData();

        // Initialize sub-controllers
        window.scannerCtrl.init();
        window.membersCtrl.init();
        window.attendanceCtrl.init();

        // Refresh stats periodically
        setInterval(() => this.refreshDashboardData(), 15000);
    }

    applyTheme() {
        if (this.isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.innerHTML = this.isDark
                ? `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
                : `<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
        }
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        localStorage.setItem('gym_theme', this.isDark ? 'dark' : 'light');
        this.applyTheme();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update nav buttons
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
                btn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'dark:text-slate-300', 'dark:hover:bg-slate-800');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                btn.classList.add('text-slate-600', 'hover:bg-slate-100', 'dark:text-slate-300', 'dark:hover:bg-slate-800');
            }
        });

        // Hide all tabs, show active
        document.querySelectorAll('.tab-view-container').forEach(view => {
            if (view.id === `tab-${tabName}`) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });

        // Specific tab load triggers
        if (tabName === 'inside') {
            window.attendanceCtrl.loadCurrentlyInside();
        } else if (tabName === 'attendance') {
            window.attendanceCtrl.loadAttendanceLogs();
        } else if (tabName === 'members') {
            window.membersCtrl.loadMembers();
        } else if (tabName === 'pass-demo') {
            this.initMemberPassDemo();
        }
    }

    async refreshDashboardData() {
        try {
            const stats = await api.getStats();
            document.querySelectorAll('.stat-inside-count').forEach(el => el.innerText = stats.inside_count);
            document.querySelectorAll('.stat-today-checkins').forEach(el => el.innerText = stats.today_checkins);
            document.querySelectorAll('.stat-total-members').forEach(el => el.innerText = stats.total_members);
            document.querySelectorAll('.stat-expired-members').forEach(el => el.innerText = stats.expired_members);
            document.querySelectorAll('.stat-avg-duration').forEach(el => el.innerText = `${stats.avg_workout_minutes}m`);
        } catch (err) {
            console.error('Failed to refresh stats:', err);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        let bg = 'bg-slate-900 text-white';
        if (type === 'success') bg = 'bg-emerald-600 text-white';
        if (type === 'error') bg = 'bg-red-600 text-white';
        if (type === 'warning') bg = 'bg-amber-600 text-white';

        toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all duration-300 transform translate-y-2 opacity-0 ${bg}`;
        toast.innerHTML = `
            <span>${message}</span>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    async initMemberPassDemo() {
        const select = document.getElementById('demo-member-select');
        if (!select) return;

        const members = await api.getMembers();
        select.innerHTML = members.map(m => `
            <option value="${m.id}">${m.name} (${m.id} · ${m.computed_status.toUpperCase()})</option>
        `).join('');

        const updateDemoCard = async (memberId) => {
            const member = await api.getMember(memberId);
            if (!member) return;

            document.getElementById('demo-pass-name').innerText = member.name;
            document.getElementById('demo-pass-id').innerText = member.id;
            document.getElementById('demo-pass-plan').innerText = member.plan_name;
            document.getElementById('demo-pass-phone').innerText = member.phone;
            document.getElementById('demo-pass-expiry').innerText = `Valid Thru: ${member.expiry_date}`;
            document.getElementById('demo-pass-photo').src = member.photo_url;
            document.getElementById('demo-pass-visits').innerText = member.total_completed_workouts;

            const badge = document.getElementById('demo-pass-status-badge');
            if (member.computed_status === 'active') {
                badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                badge.innerText = 'ACTIVE MEMBER';
            } else if (member.computed_status === 'expiring_soon') {
                badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30';
                badge.innerText = `EXPIRING (${member.days_left}d)`;
            } else {
                badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30';
                badge.innerText = 'MEMBERSHIP EXPIRED';
            }

            // Render QR Code onto Demo Canvas
            const canvas = document.getElementById('demo-qr-canvas');
            if (canvas && window.QRCodeLib) {
                window.QRCodeLib.renderCanvas(canvas, member.qr_code_token, {
                    size: 190,
                    darkColor: '#0f172a',
                    lightColor: '#ffffff'
                });
            }

            // Setup Simulate Staff Scan button
            const scanBtn = document.getElementById('demo-simulate-staff-scan');
            if (scanBtn) {
                scanBtn.onclick = () => {
                    this.switchTab('scan');
                    window.scannerCtrl.executeScan(member.qr_code_token, 'member_mobile_pass');
                };
            }
        };

        select.onchange = () => updateDemoCard(select.value);
        if (members.length > 0) {
            updateDemoCard(members[0].id);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new GymApp();
    window.app.init();
});
