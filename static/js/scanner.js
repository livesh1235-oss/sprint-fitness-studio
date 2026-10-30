/**
 * Sprint Fitness Studio · High-Performance Staff Scan Station
 * Powered by Html5Qrcode engine (optimized for mobile rear camera & webcams).
 * Features:
 *  - 100% Reliable QR scanning on gym mobile phones & tablets
 *  - Front Desk Express for members who forgot their phone (Search by Reg #, Phone, Name)
 *  - Camera device selector (Front / Back / Wide lens switcher)
 *  - Live audio feedback (Web Audio synthesizer chimes)
 *  - USB Laser scanner gun auto-listener
 */

class ScannerController {
    constructor() {
        this.scanMode = 'auto'; // 'auto', 'in', 'out'
        this.html5QrCode = null;
        this.isScanning = false;
        this.scanCooldown = false;
        this.availableCameras = [];
        this.selectedCameraId = null;
        this.searchDebounceTimer = null;
    }

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        this.setupModeSelector();
        this.setupQuickDesk();
        this.setupUsbGunListener();
        await this.setupCameraScanner();
        this.loadQuickMemberChips();
    }

    /* ------------------------------------------------------------- */
    /* 1. Mode Selector (Auto In/Out, Check-In Only, Check-Out Only) */
    /* ------------------------------------------------------------- */
    setupModeSelector() {
        document.querySelectorAll('.scan-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.scan-mode-btn').forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
                    b.classList.add('text-slate-600', 'dark:text-slate-300');
                });
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
                btn.classList.remove('text-slate-600', 'dark:text-slate-300');
                this.scanMode = btn.dataset.mode;
            });
        });
    }

    /* ------------------------------------------------------------- */
    /* 2. Front Desk Express (Forgot Phone / Reg Number / Phone Search) */
    /* ------------------------------------------------------------- */
    setupQuickDesk() {
        const input = document.getElementById('quick-member-input');
        const dropdown = document.getElementById('quick-search-dropdown');
        const btnIn = document.getElementById('btn-quick-in');
        const btnOut = document.getElementById('btn-quick-out');
        const btnAuto = document.getElementById('btn-quick-auto');

        if (!input) return;

        // Enter key triggers scan with currently selected mode
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeManualCheck(this.scanMode);
                if (dropdown) dropdown.classList.add('hidden');
            } else if (e.key === 'Escape') {
                if (dropdown) dropdown.classList.add('hidden');
            }
        });

        // Dedicated In / Out / Auto buttons
        if (btnIn) btnIn.addEventListener('click', () => this.executeManualCheck('in'));
        if (btnOut) btnOut.addEventListener('click', () => this.executeManualCheck('out'));
        if (btnAuto) btnAuto.addEventListener('click', () => this.executeManualCheck('auto'));

        // Live autocomplete search as staff types
        input.addEventListener('input', () => {
            clearTimeout(this.searchDebounceTimer);
            const val = input.value.trim();
            if (val.length < 1) {
                if (dropdown) dropdown.classList.add('hidden');
                return;
            }
            this.searchDebounceTimer = setTimeout(() => this.searchMembersAutocomplete(val), 150);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
                dropdown.classList.add('hidden');
            }
        });
    }

    async searchMembersAutocomplete(query) {
        const dropdown = document.getElementById('quick-search-dropdown');
        if (!dropdown) return;

        try {
            const members = await api.getMembers({ search: query, limit: 6 });
            if (!members || members.length === 0) {
                dropdown.innerHTML = `
                    <div class="p-3 text-xs text-slate-400 text-center">
                        No members matching "<strong>${this.escapeHtml(query)}</strong>".
                    </div>
                `;
                dropdown.classList.remove('hidden');
                return;
            }

            dropdown.innerHTML = members.map(m => {
                const isOverdue = m.days_left < 0;
                return `
                    <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition flex items-center justify-between gap-3 cursor-pointer"
                        onclick="window.scannerCtrl.selectMemberFromSearch('${m.id}')">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <img src="${m.photo_url}" class="w-9 h-9 rounded-xl object-cover bg-slate-200 dark:bg-slate-700 shrink-0">
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>${m.name}</span>
                                    <span class="px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-mono text-[10px] font-bold">${m.id}</span>
                                </div>
                                <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <span>${m.phone}</span>
                                    <span>·</span>
                                    <span>${m.plan_name}</span>
                                    <span>·</span>
                                    <span class="${isOverdue ? 'text-red-500 font-bold' : 'text-emerald-500 font-semibold'}">${isOverdue ? `${Math.abs(m.days_left)}d overdue` : `${m.days_left}d left`}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                            <button type="button" onclick="window.scannerCtrl.executeScanWithMode('${m.id}', 'in')"
                                class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition flex items-center gap-1">
                                <span>In</span>
                            </button>
                            <button type="button" onclick="window.scannerCtrl.executeScanWithMode('${m.id}', 'out')"
                                class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold transition flex items-center gap-1">
                                <span>Out</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            dropdown.classList.remove('hidden');
        } catch (e) {
            console.error('Autocomplete error:', e);
        }
    }

    selectMemberFromSearch(memberId) {
        const input = document.getElementById('quick-member-input');
        if (input) input.value = memberId;
        const dropdown = document.getElementById('quick-search-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        this.executeScan(memberId, 'manual_search');
    }

    executeScanWithMode(memberId, mode) {
        const dropdown = document.getElementById('quick-search-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        const input = document.getElementById('quick-member-input');
        if (input) input.value = '';
        this.executeScan(memberId, 'manual_search', mode);
    }

    executeManualCheck(mode) {
        const input = document.getElementById('quick-member-input');
        if (!input) return;
        const val = input.value.trim();
        if (!val) {
            window.app.showToast('Please type a Registration # (e.g. 1009) or phone number.', 'warning');
            input.focus();
            return;
        }
        this.executeScan(val, 'manual_search', mode);
        input.value = '';
        const dropdown = document.getElementById('quick-search-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    async loadQuickMemberChips() {
        const container = document.getElementById('quick-member-chips');
        if (!container) return;

        try {
            const members = await api.getMembers({ limit: 10 });
            if (!members || members.length === 0) {
                container.innerHTML = '<span class="text-[11px] text-slate-400">No members registered yet.</span>';
                return;
            }

            container.innerHTML = members.map(m => `
                <button type="button" onclick="window.scannerCtrl.executeScan('${m.id}', 'quick_chip')"
                    class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                    title="Tap to Check In / Out ${m.name}">
                    <span class="w-2 h-2 rounded-full ${m.days_left < 0 ? 'bg-red-500' : 'bg-emerald-500'}"></span>
                    <span>${m.name.split(' ')[0]}</span>
                    <span class="font-mono text-[10px] text-slate-400 dark:text-slate-500">#${m.id.replace('GYM-', '')}</span>
                </button>
            `).join('');
        } catch (e) {
            console.error('Failed to load quick chips:', e);
        }
    }

    /* ------------------------------------------------------------- */
    /* 3. Html5Qrcode Scanner Engine (For Gym Phone, Tablet & Laptop) */
    /* ------------------------------------------------------------- */
    async setupCameraScanner() {
        const toggleBtn = document.getElementById('toggle-camera-btn');
        const uploadBtn = document.getElementById('upload-qr-btn');
        const fileInput = document.getElementById('qr-file-input');
        const cameraSelect = document.getElementById('camera-select');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCamera());
        }

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        if (cameraSelect) {
            cameraSelect.addEventListener('change', () => {
                this.selectedCameraId = cameraSelect.value || null;
                if (this.isScanning) {
                    this.stopCamera().then(() => this.startCamera());
                }
            });
        }

        // Enumerate video cameras
        if (window.Html5Qrcode) {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    this.availableCameras = devices;
                    if (cameraSelect) {
                        cameraSelect.innerHTML = devices.map((d, idx) => {
                            const isBack = d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('rear');
                            return `<option value="${d.id}" ${isBack || idx === 0 ? 'selected' : ''}>${d.label || `Camera ${idx + 1}`}</option>`;
                        }).join('');
                        this.selectedCameraId = cameraSelect.value;
                    }
                }
            } catch (err) {
                console.warn('Unable to enumerate cameras prior to permission:', err);
            }
        }
    }

    async toggleCamera() {
        if (this.isScanning) {
            await this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        if (this.isScanning) return;

        const readerBox = document.getElementById('qr-reader');
        const placeholder = document.getElementById('qr-reader-placeholder');
        const btnText = document.getElementById('toggle-camera-text');
        const toggleBtn = document.getElementById('toggle-camera-btn');
        const statusIndicator = document.getElementById('camera-status-indicator');

        if (!window.Html5Qrcode) {
            window.app.showToast('QR Scanner engine not loaded. Please refresh.', 'error');
            return;
        }

        try {
            if (!this.html5QrCode) {
                this.html5QrCode = new Html5Qrcode("qr-reader");
            }

            if (placeholder) placeholder.classList.add('hidden');
            if (readerBox) readerBox.classList.remove('hidden');

            const cameraConfig = this.selectedCameraId ? { deviceId: { exact: this.selectedCameraId } } : { facingMode: "environment" };

            const scanConfig = {
                fps: 20,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.72);
                    return { width: Math.max(220, qrboxSize), height: Math.max(220, qrboxSize) };
                },
                aspectRatio: 1.0,
                disableFlip: false
            };

            await this.html5QrCode.start(
                cameraConfig,
                scanConfig,
                (decodedText, decodedResult) => {
                    this.onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Frame scan failed to find QR (normal stream loop)
                }
            );

            this.isScanning = true;
            if (btnText) btnText.innerText = 'Stop Camera';
            if (toggleBtn) {
                toggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                toggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            }
            if (statusIndicator) {
                statusIndicator.innerText = 'SCANNING LIVE';
                statusIndicator.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-mono animate-pulse';
            }

            // Populate camera list if not done yet
            if (this.availableCameras.length === 0) {
                try {
                    const devices = await Html5Qrcode.getCameras();
                    const cameraSelect = document.getElementById('camera-select');
                    if (devices && devices.length > 0 && cameraSelect) {
                        this.availableCameras = devices;
                        cameraSelect.innerHTML = devices.map(d => `<option value="${d.id}" ${d.id === this.selectedCameraId ? 'selected' : ''}>${d.label || 'Camera'}</option>`).join('');
                    }
                } catch (e) {}
            }

            window.app.showToast('Camera active! Point at member QR code.', 'info');

        } catch (err) {
            console.error('Camera start error:', err);
            if (placeholder) placeholder.classList.remove('hidden');
            if (btnText) btnText.innerText = 'Start Camera';
            if (statusIndicator) {
                statusIndicator.innerText = 'CAMERA BLOCKED';
                statusIndicator.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 font-mono';
            }
            window.app.showToast('Please grant camera permission in your phone/browser settings.', 'warning');
        }
    }

    async stopCamera() {
        if (this.html5QrCode && this.isScanning) {
            try {
                await this.html5QrCode.stop();
            } catch (e) {
                console.warn('Error stopping camera:', e);
            }
        }
        this.isScanning = false;

        const placeholder = document.getElementById('qr-reader-placeholder');
        const btnText = document.getElementById('toggle-camera-text');
        const toggleBtn = document.getElementById('toggle-camera-btn');
        const statusIndicator = document.getElementById('camera-status-indicator');

        if (placeholder) placeholder.classList.remove('hidden');
        if (btnText) btnText.innerText = 'Start Camera';
        if (toggleBtn) {
            toggleBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            toggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        }
        if (statusIndicator) {
            statusIndicator.innerText = 'STANDBY';
            statusIndicator.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono';
        }
    }

    onScanSuccess(decodedText) {
        if (this.scanCooldown) return;
        this.scanCooldown = true;
        setTimeout(() => { this.scanCooldown = false; }, 1800);
        this.executeScan(decodedText, 'camera_live_qr');
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (!this.html5QrCode) {
                this.html5QrCode = new Html5Qrcode("qr-reader");
            }
            const decodedText = await this.html5QrCode.scanFile(file, true);
            if (decodedText) {
                this.executeScan(decodedText, 'image_upload');
            }
        } catch (err) {
            console.error('File scan failed:', err);
            window.app.showToast('No clear QR code detected in that photo.', 'warning');
        } finally {
            e.target.value = '';
        }
    }

    /* ------------------------------------------------------------- */
    /* 4. USB Barcode / QR Scanner Gun Listener                      */
    /* ------------------------------------------------------------- */
    setupUsbGunListener() {
        let barcodeBuffer = '';
        let lastKeyTime = 0;

        window.addEventListener('keydown', (e) => {
            // Ignore if receptionist is actively typing in a form input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const now = Date.now();
            if (now - lastKeyTime > 120) {
                barcodeBuffer = '';
            }
            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    this.executeScan(barcodeBuffer, 'usb_gun');
                    barcodeBuffer = '';
                }
            } else if (e.key.length === 1) {
                barcodeBuffer += e.key;
            }
        });
    }

    /* ------------------------------------------------------------- */
    /* 5. Core Scan Execution & Result Display                      */
    /* ------------------------------------------------------------- */
    async executeScan(token, method = 'qr_scan', forcedMode = null) {
        if (!token) return;
        const mode = forcedMode || this.scanMode;

        try {
            const res = await api.scan(token, mode, method);
            if (!res.success) {
                if (window.soundFx) window.soundFx.playAlert();
                window.app.showToast(res.error || 'Member not found. Check Registration # or Phone.', 'error');
                return;
            }

            // Audio Feedback Chime
            if (window.soundFx) {
                if (res.is_expired) {
                    window.soundFx.playAlert();
                } else if (res.action === 'out') {
                    window.soundFx.playCheckOut();
                } else {
                    window.soundFx.playCheckIn();
                }
            }

            // Display Entrant Profile Card
            this.displayScanResult(res);

            // Toast feedback
            if (res.action === 'in') {
                window.app.showToast(`✅ Checked IN: ${res.member.name} (${res.member.id})`, 'success');
            } else if (res.action === 'out') {
                window.app.showToast(`🚪 Checked OUT: ${res.member.name} · Workout: ${res.duration_formatted || 'Done'}`, 'info');
            } else {
                window.app.showToast(`ℹ️ ${res.message}`, 'info');
            }

            // Refresh Live Board & Stats
            window.app.refreshDashboardData();
            this.loadQuickMemberChips();

        } catch (err) {
            console.error('Scan execution error:', err);
            window.app.showToast('Network error processing scan.', 'error');
        }
    }

    displayScanResult(data) {
        const resultCard = document.getElementById('scan-result-card');
        const emptyState = document.getElementById('scan-empty-state');
        if (!resultCard) return;

        if (emptyState) emptyState.classList.add('hidden');
        resultCard.classList.remove('hidden');

        const m = data.member;
        const isExpired = data.is_expired;
        const action = data.action;

        let actionBanner = '';
        if (action === 'in') {
            actionBanner = `
                <div class="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-white animate-ping"></span>
                        <span class="font-extrabold uppercase tracking-wider text-xs">ENTRY GRANTED · CHECKED IN</span>
                    </div>
                    <span class="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">${data.in_time || 'Just now'}</span>
                </div>
            `;
        } else if (action === 'out') {
            actionBanner = `
                <div class="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        <span class="font-extrabold uppercase tracking-wider text-xs">EXIT RECORDED · WORKOUT COMPLETE</span>
                    </div>
                    <span class="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">${data.duration_formatted || '0 mins'}</span>
                </div>
            `;
        } else {
            actionBanner = `
                <div class="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
                    <span class="font-extrabold uppercase tracking-wider text-xs">ALREADY CHECKED IN TODAY</span>
                    <span class="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">In: ${data.in_time || '--'}</span>
                </div>
            `;
        }

        resultCard.innerHTML = `
            ${actionBanner}

            <div class="p-6 space-y-5">
                <!-- Member Header -->
                <div class="flex items-start gap-4">
                    <img src="${m.photo_url}" class="w-20 h-20 rounded-2xl object-cover ring-4 ${isExpired ? 'ring-red-500' : 'ring-emerald-500'} shadow-lg bg-slate-200 dark:bg-slate-700 shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">${m.name}</h3>
                            <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs">${m.id}</span>
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>📞 ${m.phone}</span>
                            <span>·</span>
                            <span class="font-semibold text-slate-700 dark:text-slate-300">${m.plan_name}</span>
                        </div>
                        <div class="mt-2.5 flex items-center gap-2 flex-wrap">
                            ${isExpired ? `
                                <span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span>EXPIRED (${Math.abs(m.days_left)} DAYS OVERDUE)</span>
                                </span>
                                <button type="button" onclick="window.membersCtrl.openRenewModal('${m.id}')"
                                    class="px-3 py-1 rounded-full text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition">
                                    Renew Plan Now
                                </button>
                            ` : `
                                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>ACTIVE MEMBER (${m.days_left} DAYS LEFT)</span>
                                </span>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Session Details Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                        <span class="text-slate-400 font-semibold uppercase text-[10px]">Session Status</span>
                        <div class="font-bold text-slate-800 dark:text-white mt-0.5 capitalize">${action === 'in' ? 'Inside Gym' : 'Workout Done'}</div>
                    </div>
                    <div>
                        <span class="text-slate-400 font-semibold uppercase text-[10px]">In-Time</span>
                        <div class="font-mono font-bold text-slate-800 dark:text-white mt-0.5">${data.in_time || '--'}</div>
                    </div>
                    <div>
                        <span class="text-slate-400 font-semibold uppercase text-[10px]">Out-Time</span>
                        <div class="font-mono font-bold text-slate-800 dark:text-white mt-0.5">${data.out_time || 'Working out'}</div>
                    </div>
                    <div>
                        <span class="text-slate-400 font-semibold uppercase text-[10px]">Workout Time</span>
                        <div class="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">${data.duration_formatted || 'In progress'}</div>
                    </div>
                </div>

                <!-- Quick Action Buttons -->
                <div class="flex items-center justify-between pt-1">
                    <button type="button" onclick="window.membersCtrl.openPassModal('${m.id}')"
                        class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        <span>View Pass Card</span>
                    </button>

                    <button type="button" onclick="window.scannerCtrl.clearScanResult()"
                        class="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                        Clear Result ✕
                    </button>
                </div>
            </div>
        `;
    }

    clearScanResult() {
        const resultCard = document.getElementById('scan-result-card');
        const emptyState = document.getElementById('scan-empty-state');
        if (resultCard) resultCard.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.scannerCtrl = new ScannerController();
