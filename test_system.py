import sys
import os
import json
import urllib.request
import urllib.parse
import threading
import time

# Add project root to sys.path
sys.path.append(os.path.dirname(__file__))

import database
import app

def run_tests():
    print("=== STARTING IRONGATE ATTENDANCE SYSTEM TESTS ===")

    # 1. Test database directly
    database.init_db()
    stats = database.get_dashboard_stats()
    print(f"✓ Database initialized. Total members: {stats['total_members']}, Inside: {stats['inside_count']}")

    # 2. Test Check-In Scan for Emma Watson-Lee (GYM-1005)
    scan_in = database.process_scan('QR-GYM-1005', mode='in')
    assert scan_in['success'] is True, f"Scan in failed: {scan_in}"
    assert scan_in['action'] == 'in', f"Expected action 'in', got: {scan_in['action']}"
    assert scan_in['in_time'] is not None, "In-time should be recorded"
    print(f"✓ Check-In verified: {scan_in['member']['name']} at {scan_in['in_time']}")

    # 3. Test Check-Out Scan for Emma Watson-Lee
    scan_out = database.process_scan('QR-GYM-1005', mode='out')
    assert scan_out['success'] is True, f"Scan out failed: {scan_out}"
    assert scan_out['action'] == 'out', f"Expected action 'out', got: {scan_out['action']}"
    assert scan_out['out_time'] is not None, "Out-time should be recorded"
    print(f"✓ Check-Out verified: {scan_out['member']['name']} at {scan_out['out_time']} (Duration: {scan_out['duration_formatted']})")

    # 4. Test Expired Member Scan for David Kim (GYM-1004)
    scan_expired = database.process_scan('QR-GYM-1004', mode='auto')
    assert scan_expired['success'] is True, "Scan should resolve member"
    assert scan_expired['is_expired'] is True, "David Kim should be flagged as expired"
    print(f"✓ Expired membership warning verified for: {scan_expired['member']['name']} (is_expired={scan_expired['is_expired']})")

    # 5. Test Membership Renewal for David Kim
    renew_res = database.renew_membership('GYM-1004', plan_id=2, extend_days=90)
    assert renew_res['success'] is True, f"Renewal failed: {renew_res}"
    member_after = database.get_member('GYM-1004')
    assert member_after['computed_status'] == 'active', f"Member should be active after renewal, got: {member_after['computed_status']}"
    print(f"✓ Renewal verified: New expiry date is {renew_res['new_expiry']} (Status: {member_after['computed_status']})")

    # 6. Test New Member Registration
    new_member = database.create_member({
        'name': 'Test Athlete',
        'phone': '+1 (555) 999-0000',
        'email': 'athlete@example.com',
        'plan_id': 1,
        'emergency_contact': 'Coach Dan (555-111-2222)'
    })
    assert new_member['id'].startswith('GYM-'), f"Invalid member ID format: {new_member['id']}"
    assert new_member['qr_code_token'] == f"QR-{new_member['id']}", f"Invalid QR token: {new_member['qr_code_token']}"
    print(f"✓ Member registration verified: Created {new_member['name']} with ID {new_member['id']} and QR {new_member['qr_code_token']}")

    # 7. Test Attendance Query
    logs = database.get_attendance_logs(limit=10)
    assert len(logs) > 0, "Attendance logs should contain records"
    print(f"✓ Attendance logs retrieved: {len(logs)} records found")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The IronGate Attendance Engine is 100% operational.")

if __name__ == '__main__':
    run_tests()
