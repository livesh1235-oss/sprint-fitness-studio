/**
 * IronGate API Client
 */
const api = {
    async getNetworkInfo() {
        const res = await fetch('/api/network-info');
        return res.json();
    },

    async getStats() {
        const res = await fetch('/api/stats');
        return res.json();
    },

    async getPlans() {
        const res = await fetch('/api/plans');
        return res.json();
    },

    async getInside() {
        const res = await fetch('/api/inside');
        return res.json();
    },

    async getMembers(params = {}) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/api/members?${qs}`);
        return res.json();
    },

    async getMember(id) {
        const res = await fetch(`/api/members/${id}`);
        return res.json();
    },

    async createMember(data) {
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateMember(id, data) {
        const res = await fetch(`/api/members/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteMember(id) {
        const res = await fetch(`/api/members/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    async resetData() {
        const res = await fetch('/api/reset-data', {
            method: 'POST'
        });
        return res.json();
    },

    async renewMember(id, planId, extendDays = null) {
        const res = await fetch(`/api/members/${id}/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: planId, extend_days: extendDays })
        });
        return res.json();
    },

    async scan(token, mode = 'auto', method = 'qr_scan') {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, mode, method })
        });
        return res.json();
    },

    async manualCheckout(logId) {
        const res = await fetch('/api/manual-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_id: logId })
        });
        return res.json();
    },

    async getAttendance(params = {}) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/api/attendance?${qs}`);
        return res.json();
    }
};

window.api = api;
