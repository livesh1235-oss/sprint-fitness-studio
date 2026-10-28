/**
 * Staff Check-In & Check-Out Scanner Station Controller
 * Uses jsQR engine for real-time video stream scanning from webcam/mobile camera.
 * Also supports USB laser barcode/QR guns and manual member lookup.
 */
class ScannerController {
    constructor() {
        this.scanMode = 'auto'; // 'auto', 'in', 'out'
        this.cameraStream = null;
        this.isScanning = false;
        this.scanCooldown = false;
        this.canvasElement = document.createElement('canvas');
        this.canvasCtx = this.canvasElement.getContext('2d', { willReadFrequently: true });
        this.animationFrameId = null;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mode buttons
        document.querySelectorAll('.scan-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.scan-mode-btn').forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                    b.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                });
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
                btn.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
                this.scanMode = btn.dataset.mode;
            });
        });

        // Camera toggle button
        const camBtn = document.getElementById('toggle-camera-btn');
        if (camBtn) {
            camBtn.addEventListener('click', () => this.toggleCamera());
        }

        // Manual scan input
        const manualInput = document.getElementById('manual-scan-input');
        const manualBtn = document.getElementById('manual-scan-submit');
        if (manualInput && manualBtn) {
            manualBtn.addEventListener('click', () => {
                const val = manualInput.value.trim();
                if (val) {
                    this.executeScan(val, 'manual_search');
                    manualInput.value = '';
                }
            });
            manualInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = manualInput.value.trim();
                    if (val) {
                        this.executeScan(val, 'manual_search');
                        manualInput.value = '';
                    }
                }
            });
        }

        // Global USB scanner / barcode gun listener (wedge keyboard input)
        let barcodeBuffer = '';
        let lastKeyTime = 0;
        window.addEventListener('keydown', (e) => {
            // Ignore if user is intentionally typing in an input
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

    async toggleCamera() {
        const video = document.getElementById('scanner-video');
        const camBtn = document.getElementById('toggle-camera-btn');
        const placeholder = document.getElementById('scanner-placeholder');

        if (this.isScanning) {
            this.stopCamera();
            if (camBtn) camBtn.innerHTML = `
                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span>Start Camera Scanner</span>
            `;
            if (placeholder) placeholder.classList.remove('hidden');
            if (video) video.classList.add('hidden');
        } else {
            try {
                // Support both mobile rear camera and laptop webcams seamlessly
                this.cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                video.srcObject = this.cameraStream;
                video.setAttribute('playsinline', true);
                await video.play();

                this.isScanning = true;
                if (placeholder) placeholder.classList.add('hidden');
                if (video) video.classList.remove('hidden');
                if (camBtn) camBtn.innerHTML = `
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>
                    <span>Turn Off Camera</span>
                `;

                // Initialize native BarcodeDetector if supported
                if ('BarcodeDetector' in window && !this.barcodeDetector) {
                    try {
                        this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    } catch (e) {
                        this.barcodeDetector = null;
                    }
                }

                this.startRealCameraScanLoop();
            } catch (err) {
                console.warn('Camera access issue:', err);
                window.app.showToast('Please allow camera permissions in your browser to scan QR passes.', 'warning');
            }
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isScanning = false;
    }

    async startRealCameraScanLoop() {
        if (!this.isScanning) return;
        const video = document.getElementById('scanner-video');

        if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
            // Priority 1: Hardware-accelerated native BarcodeDetector (instant scan)
            if (this.barcodeDetector && !this.scanCooldown) {
                try {
                    const barcodes = await this.barcodeDetector.detect(video);
                    if (barcodes.length > 0 && barcodes[0].rawValue) {
                        this.executeScan(barcodes[0].rawValue, 'camera_live_qr');
                        this.animationFrameId = requestAnimationFrame(() => this.startRealCameraScanLoop());
                        return;
                    }
                } catch (e) {}
            }

            // Priority 2: jsQR Canvas Fallback Engine
            if (window.jsQR && !this.scanCooldown) {
                try {
                    this.canvasElement.height = video.videoHeight || 480;
                    this.canvasElement.width = video.videoWidth || 640;
                    this.canvasCtx.drawImage(video, 0, 0, this.canvasElement.width, this.canvasElement.height);
                    const imageData = this.canvasCtx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);

                    const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "attemptBoth",
                    });

                    if (code && code.data) {
                        this.executeScan(code.data, 'camera_live_qr');
                    }
                } catch (e) {}
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.startRealCameraScanLoop());
    }

    async executeScan(token, method = 'qr_scan') {
        if (method !== 'manual_search' && this.scanCooldown) return;
        this.scanCooldown = true;
        setTimeout(() => { this.scanCooldown = false; }, 1200);

        try {
            const res = await api.scan(token, this.scanMode, method);
            if (!res.success) {
                if (window.soundFx) window.soundFx.playAlert();
                window.app.showToast(res.error || 'Member not found.', 'error');
                return;
            }

            // Audio cues
            if (window.soundFx) {
                if (res.action === 'in') {
                    if (res.is_expired) {
                        window.soundFx.playAlert();
                    } else {
                        window.soundFx.playCheckIn();
                    }
                } else if (res.action === 'out') {
                    window.soundFx.playCheckOut();
                } else {
                    window.soundFx.playAlert();
                }
            }

            // Display entrant profile card
            this.displayScanResult(res);

            // Success feedback toast
            const actionText = res.action === 'in' ? 'Checked IN' : 'Checked OUT';
            window.app.showToast(`✅ ${actionText}: ${res.member.name} (${res.member.id})`, 'success');

            // Refresh live board and stats
            window.app.refreshDashboardData();

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

        let actionBadge = '';
        let bannerBg = '';
        if (action === 'in') {
            actionBadge = `
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-500 text-white shadow-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                    <span>CHECKED IN</span>
                </div>
            `;
            bannerBg = 'from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30';
        } else if (action === 'out') {
            actionBadge = `
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-blue-500 text-white shadow-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    <span>CHECKED OUT</span>
                </div>
            `;
            bannerBg = 'from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/30';
        } else {
            actionBadge = `
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-500 text-white shadow-sm">
                    <span>ALREADY INSIDE</span>
                </div>
            `;
            bannerBg = 'from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30';
        }

        let expiryAlert = '';
        if (isExpired) {
            expiryAlert = `
                <div class="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </span>
                        <div>
                            <div class="text-sm font-bold text-red-800 dark:text-red-200">MEMBERSHIP EXPIRED</div>
                            <div class="text-xs text-red-600 dark:text-red-400">Plan expired on ${m.expiry_date} (${Math.abs(m.days_left)} days overdue)</div>
                        </div>
                    </div>
                    <button type="button" onclick="window.membersCtrl.openRenewModal('${m.id}')"
                        class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition whitespace-nowrap">
                        Renew Membership
                    </button>
                </div>
            `;
        }

        resultCard.innerHTML = `
            <div class="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b ${bannerBg}">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-4">
                        <img src="${m.photo_url}" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-700 shadow-md">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">${m.name}</h3>
                                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">${m.id}</span>
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${m.phone} ${m.email ? `· ${m.email}` : ''}</p>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    ${m.plan_name}
                                </span>
                                <span class="text-xs font-medium px-2 py-0.5 rounded-md ${isExpired ? 'badge-expired' : (m.days_left <= 5 ? 'badge-expiring' : 'badge-active')}">
                                    ${isExpired ? 'Expired' : `${m.days_left} days left`}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>${actionBadge}</div>
                </div>
            </div>

            <div class="p-5 space-y-4">
                ${expiryAlert}

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In-Time</div>
                        <div class="text-lg font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">${data.in_time || '--'}</div>
                    </div>

                    <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Out-Time</div>
                        <div class="text-lg font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">${data.out_time || '<span class="text-amber-500 font-semibold text-base">In Progress</span>'}</div>
                    </div>

                    <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 col-span-2 sm:col-span-1">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workout Duration</div>
                        <div class="text-lg font-extrabold font-mono ${data.duration_formatted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} mt-0.5">
                            ${data.duration_formatted || 'Active Session'}
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Emergency Contact: <strong class="text-slate-700 dark:text-slate-300">${m.emergency_contact || 'None listed'}</strong></span>
                    <button type="button" onclick="window.membersCtrl.openPassModal('${m.id}')"
                        class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                        <span>View Pass Card</span>
                        <span>→</span>
                    </button>
                </div>
            </div>
        `;
    }
}

window.scannerCtrl = new ScannerController();
