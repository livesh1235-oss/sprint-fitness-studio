# IronGate · Gym Attendance & Access Control Platform

A modern, high-performance, and user-friendly web application for gym attendance tracking and membership management. Built with Python 3.13 and modern ES6+ web technologies with zero external dependencies.

---

## 🚀 Quick Start

Run the server with standard Python 3:

```bash
cd /Users/m.s.liveshvetrivel/.gemini/antigravity/scratch/gym-access-system
python3 app.py
```

Then open your browser at:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🌟 Key Features

### 1. 📷 Staff Scan Station & Instant Attendance Logging
- **Auto In/Out Detection**:
  - When a member arrives and shows their QR code, the system automatically checks them **IN**, records the in-time, and adds them to the live gym occupancy board.
  - When the member leaves and shows their QR code again, the system automatically checks them **OUT**, records the out-time, and calculates their total workout duration (e.g. *1h 15m*).
  - Staff can also manually force **Check-In Only** or **Check-Out Only** via the top mode selector.
- **Immediate Expiry Warning**:
  - If a member with an expired or overdue subscription attempts to check in, the screen displays a prominent red warning with days overdue, plays an alert buzzer sound, and provides an instant 1-click **Renew Now** button.
- **Multiple Input Methods**:
  - Live webcam / device camera QR scanning.
  - Automatic support for USB laser barcode / QR scanner guns (keyboard wedge input).
  - Manual search by Phone number, Member ID, or Name.

### 2. ⚡ "Currently Inside" Live Occupancy Board
- Real-time live cards showing all members actively working out in the facility right now.
- Live ticking workout timer (e.g., *45 mins*, *1h 20m*).
- One-click **"Check Out Member"** button for staff in case a member forgets to scan when departing.

### 3. 👥 Members Directory & Membership Management
- Complete member profiles: Photo/Avatar, Name, Phone, Email, Plan, Start Date, Expiry Date, Days Remaining, Emergency Contact, and Notes.
- Search and filter by status: *Active*, *Expiring Soon*, *Expired*, and *Inside Now*.
- **Plan Renewals**: Extend membership by 1 month, 3 months, 6 months, or 1 year with one click.
- **Digital Pass Cards**: View and print individual member pass cards with high-resolution QR codes.

### 4. 📊 Attendance History & CSV Export
- Complete audit trail of all check-ins and check-outs.
- Columns: Member Name, ID, Phone, Plan, Date, In-Time, Out-Time, Total Duration, Status, and Scan Method.
- Filters: *Today*, *Yesterday*, *Last 7 Days*, and *All Time*.
- 1-click **Export to CSV** for record keeping, Excel reporting, or payroll.

### 5. 📱 Member Mobile Pass Demo
- Dedicated interactive view showing the exact smartphone digital gym card members carry on their phones.
- Features member avatar, plan tier, validity countdown, workout streak count, and a crisp QR code.
- Interactive **"Simulate Staff Scanning This Pass"** button to test the full flow instantly.

### 6. 🔊 Audio Feedback
- Built-in Web Audio API synthesizer (no external sound files required):
  - **Check-In Sound**: Pleasant melodic high chime (`C5 -> G5`).
  - **Check-Out Sound**: Smooth descending chord (`A5 -> E5 -> C5`).
  - **Expired / Alert Sound**: High-visibility double buzz.

---

## 🗄️ Database Architecture

The application uses an SQLite database (`gym.db`) with relational integrity and automatic schema migrations:
- `plans`: Membership tiers, pricing, and validity duration.
- `members`: Member personal information, plan associations, expiry dates, and unique QR tokens.
- `attendance_logs`: Session records with in-time, out-time, duration in minutes, and status (`inside` vs `completed`).

---

## 🛠️ Hardware Integration

- **USB Handheld Scanner Guns**: Plug-and-play. Handheld USB barcode/QR scanners type the scanned code and hit Enter. The app's global listener captures this automatically without needing to focus on an input box.
- **Front-Desk Tablets / Webcams**: Mount an iPad, Android tablet, or laptop at the reception desk and click **"Start Camera Scanner"** to scan member screens hands-free.
