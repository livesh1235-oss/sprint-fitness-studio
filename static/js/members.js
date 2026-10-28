/**
 * Member Management Controller
 * Handles Member Directory, Search/Filter, Add Member with Photo Upload/Webcam, Plan Renewals, Deletion, and Pass Distribution.
 */
class MembersController {
    constructor() {
        this.currentFilter = '';
        this.searchQuery = '';
        this.plans = [];
        this.debounceTimer = null;
        this.currentPhotoBase64 = '';
    }

    async init() {
        await this.loadPlans();
        this.setupEventListeners();
        await this.loadMembers();
    }

    async loadPlans() {
        try {
            this.plans = await api.getPlans();
            const selectEls = document.querySelectorAll('.plan-select-dropdown');
            selectEls.forEach(sel => {
                sel.innerHTML = this.plans.map(p => `
                    <option value="${p.id}" data-days="${p.duration_days}">${p.name} (${p.duration_days} days · $${p.price})</option>
                `).join('');
            });
        } catch (err) {
            console.error('Failed to load plans:', err);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('member-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.loadMembers();
                }, 200);
            });
        }

        document.querySelectorAll('.member-filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.member-filter-pill').forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white');
                    b.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                });
                btn.classList.add('bg-indigo-600', 'text-white');
                btn.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                this.currentFilter = btn.dataset.status;
                this.loadMembers();
            });
        });

        // Photo file upload reader
        const photoFile = document.getElementById('add-photo-file');
        if (photoFile) {
            photoFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.currentPhotoBase64 = event.target.result;
                        const preview = document.getElementById('add-photo-preview');
                        if (preview) preview.src = this.currentPhotoBase64;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Add Member Form
        const addForm = document.getElementById('add-member-form');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitAddMember(new FormData(addForm));
            });
        }

        // Renew Form
        const renewForm = document.getElementById('renew-member-form');
        if (renewForm) {
            renewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitRenewMember(new FormData(renewForm));
            });
        }
    }

    async loadMembers() {
        try {
            const params = {};
            if (this.searchQuery) params.search = this.searchQuery;
            if (this.currentFilter) params.status = this.currentFilter;

            const members = await api.getMembers(params);
            const tbody = document.getElementById('members-table-body');
            const countEl = document.getElementById('members-filtered-count');

            if (countEl) countEl.innerText = `${members.length} members`;
            if (!tbody) return;

            if (members.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                            No members found. Click "+ Register New Member" above to add your first member.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = members.map(m => {
                let statusBadge = '';
                if (m.computed_status === 'active') {
                    statusBadge = `<span class="badge-active px-2.5 py-1 rounded-full text-xs font-bold">Active</span>`;
                } else if (m.computed_status === 'expiring_soon') {
                    statusBadge = `<span class="badge-expiring px-2.5 py-1 rounded-full text-xs font-bold">Expiring (${m.days_left}d)</span>`;
                } else if (m.computed_status === 'expired') {
                    statusBadge = `<span class="badge-expired px-2.5 py-1 rounded-full text-xs font-bold">Expired</span>`;
                } else {
                    statusBadge = `<span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">${m.status}</span>`;
                }

                const insidePill = m.is_inside_now
                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> INSIDE
                       </span>`
                    : '';

                return `
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <img src="${m.photo_url}" class="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <div class="font-bold text-slate-900 dark:text-white">${m.name}</div>
                                        ${insidePill}
                                    </div>
                                    <div class="text-xs font-mono text-slate-400 dark:text-slate-500">${m.id} · ${m.phone}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">${m.plan_name}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">Total Visits: ${m.total_visits}</div>
                        </td>
                        <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            <div class="font-mono font-semibold">${m.expiry_date}</div>
                            <div class="text-xs ${m.days_left < 0 ? 'text-red-500 font-bold' : (m.days_left <= 5 ? 'text-amber-500 font-semibold' : 'text-slate-400')}">
                                ${m.days_left < 0 ? `${Math.abs(m.days_left)} days overdue` : `${m.days_left} days left`}
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            ${statusBadge}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <div class="flex items-center justify-end gap-2">
                                <button type="button" onclick="window.membersCtrl.openPassModal('${m.id}')"
                                    class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5" title="View Digital Pass">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                                    <span>Pass</span>
                                </button>
                                <button type="button" onclick="window.membersCtrl.openRenewModal('${m.id}')"
                                    class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition">
                                    Renew
                                </button>
                                <button type="button" onclick="window.membersCtrl.confirmDeleteMember('${m.id}', '${m.name}')"
                                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition" title="Delete Member">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('Failed to load members:', err);
        }
    }

    openAddModal() {
        const modal = document.getElementById('add-member-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const todayStr = new Date().toISOString().split('T')[0];
            const startInput = document.getElementById('add-start-date');
            if (startInput) startInput.value = todayStr;
            this.currentPhotoBase64 = '';
            const preview = document.getElementById('add-photo-preview');
            if (preview) preview.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=new';
        }
    }

    closeAddModal() {
        const modal = document.getElementById('add-member-modal');
        if (modal) modal.classList.add('hidden');
    }

    async submitAddMember(formData) {
        const payload = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            plan_id: parseInt(formData.get('plan_id')),
            start_date: formData.get('start_date'),
            photo_url: this.currentPhotoBase64 || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.get('name'))}`,
            emergency_contact: formData.get('emergency_contact'),
            notes: formData.get('notes')
        };

        try {
            const res = await api.createMember(payload);
            if (res.error) {
                window.app.showToast(res.error, 'error');
                return;
            }
            window.app.showToast(`Member ${res.name} registered successfully!`, 'success');
            this.closeAddModal();
            document.getElementById('add-member-form').reset();
            await this.loadMembers();
            window.app.refreshDashboardData();
            // Automatically open pass card with link
            this.openPassModal(res.id);
        } catch (err) {
            console.error('Failed to create member:', err);
            window.app.showToast('Network error creating member.', 'error');
        }
    }

    async confirmDeleteMember(memberId, name) {
        if (!confirm(`Are you sure you want to delete member ${name} (${memberId})? This will permanently remove their records.`)) {
            return;
        }

        try {
            const res = await api.deleteMember(memberId);
            if (res.success) {
                window.app.showToast(`Member ${name} deleted.`, 'info');
                await this.loadMembers();
                window.app.refreshDashboardData();
            }
        } catch (err) {
            console.error(err);
            window.app.showToast('Failed to delete member.', 'error');
        }
    }

    async openRenewModal(memberId) {
        try {
            const member = await api.getMember(memberId);
            if (!member) return;

            document.getElementById('renew-member-id').value = member.id;
            document.getElementById('renew-member-name').innerText = `${member.name} (${member.id})`;
            document.getElementById('renew-current-expiry').innerText = `Current Expiry: ${member.expiry_date} (${member.days_left >= 0 ? `${member.days_left} days left` : `${Math.abs(member.days_left)} days overdue`})`;

            const planSelect = document.getElementById('renew-plan-select');
            if (planSelect) planSelect.value = member.plan_id;

            const modal = document.getElementById('renew-member-modal');
            if (modal) modal.classList.remove('hidden');
        } catch (err) {
            console.error(err);
        }
    }

    closeRenewModal() {
        const modal = document.getElementById('renew-member-modal');
        if (modal) modal.classList.add('hidden');
    }

    async submitRenewMember(formData) {
        const memberId = formData.get('member_id');
        const planId = parseInt(formData.get('plan_id'));
        const customDays = formData.get('custom_days') ? parseInt(formData.get('custom_days')) : null;

        try {
            const res = await api.renewMember(memberId, planId, customDays);
            if (!res.success) {
                window.app.showToast(res.error || 'Failed to renew.', 'error');
                return;
            }
            window.app.showToast(`Membership extended to ${res.new_expiry}!`, 'success');
            this.closeRenewModal();
            await this.loadMembers();
            window.app.refreshDashboardData();
        } catch (err) {
            console.error(err);
            window.app.showToast('Error renewing membership.', 'error');
        }
    }

    async openPassModal(memberId) {
        try {
            const member = await api.getMember(memberId);
            if (!member) return;

            const modal = document.getElementById('member-pass-modal');
            if (!modal) return;

            document.getElementById('pass-member-name').innerText = member.name;
            document.getElementById('pass-member-id').innerText = member.id;
            document.getElementById('pass-member-plan').innerText = member.plan_name;
            document.getElementById('pass-member-phone').innerText = member.phone;
            document.getElementById('pass-member-expiry').innerText = `Valid Thru: ${member.expiry_date}`;
            document.getElementById('pass-member-photo').src = member.photo_url;

            // If accessing via cloud or tunnel domain, preserve the public HTTPS origin
            let passUrl = `${window.location.origin}/pass?id=${member.id}`;
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocal) {
                try {
                    const net = await api.getNetworkInfo();
                    if (net && net.lan_ip) {
                        passUrl = `http://${net.lan_ip}:${net.port || 8080}/pass?id=${member.id}`;
                    }
                } catch (e) {}
            }
            const passLinkInput = document.getElementById('pass-share-link');
            if (passLinkInput) passLinkInput.value = passUrl;

            // Render QR Code onto Canvas
            const canvas = document.getElementById('pass-qr-canvas');
            if (canvas && window.QRCodeLib) {
                window.QRCodeLib.renderCanvas(canvas, member.qr_code_token, {
                    size: 160,
                    darkColor: '#0f172a',
                    lightColor: '#ffffff'
                });
            }

            modal.classList.remove('hidden');
        } catch (err) {
            console.error('Error opening pass modal:', err);
        }
    }

    closePassModal() {
        const modal = document.getElementById('member-pass-modal');
        if (modal) modal.classList.add('hidden');
    }

    copyPassLink() {
        const passLinkInput = document.getElementById('pass-share-link');
        if (passLinkInput) {
            passLinkInput.select();
            navigator.clipboard.writeText(passLinkInput.value).then(() => {
                window.app.showToast('Member pass link copied! You can send it via WhatsApp or SMS.', 'success');
            }).catch(() => {
                window.app.showToast('Link ready in input box.', 'info');
            });
        }
    }

    printCurrentPass() {
        window.print();
    }
}

window.membersCtrl = new MembersController();
