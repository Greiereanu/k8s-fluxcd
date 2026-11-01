import os
import time
import uuid

import httpx

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8000")


def test_full_pipeline():
    print("=" * 60)
    print("Running EMS Backend End-to-End Verification")
    print(f"Target Gateway URL: {GATEWAY_URL}")
    print("=" * 60)

    with httpx.Client(base_url=GATEWAY_URL, timeout=10.0, verify=False) as client:
        # 1. Health check
        print("\n[Step 1] Checking Gateway Health...")
        r = client.get("/health")
        assert r.status_code == 200, f"Gateway health failed: {r.text}"
        print("Gateway is healthy:", r.json())

        # 2. Login as Admin
        print("\n[Step 2] Logging in as Admin...")
        r = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin123!"},
        )
        assert r.status_code == 200, f"Admin login failed: {r.text}"
        admin_auth = r.json()
        admin_token = admin_auth["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"Admin logged in. User ID: {admin_auth['user_id']} (Role: {admin_auth['role']})")
        uuid.UUID(admin_auth["user_id"])

        # 3. Admin creates a new Client user
        client_username = f"client_{int(time.time())}"
        print(f"\n[Step 3] Admin creating new Client user '{client_username}'...")
        r = client.post(
            "/api/v1/users",
            headers=admin_headers,
            json={
                "username": client_username,
                "password": "ClientPassword123!",
                "email": f"{client_username}@energy.local",
                "full_name": "John Doe",
                "address": "Baker Street 221B",
                "role": "CLIENT",
            },
        )
        assert r.status_code == 201, f"Failed to create user: {r.text}"
        client_user = r.json()
        client_user_id = client_user["id"]
        print(f"User created. UUID: {client_user_id}")
        uuid.UUID(client_user_id)

        # 4. Client logs in
        print(f"\n[Step 4] Logging in as Client '{client_username}'...")
        r = client.post(
            "/api/v1/auth/login",
            json={"username": client_username, "password": "ClientPassword123!"},
        )
        assert r.status_code == 200, f"Client login failed: {r.text}"
        client_auth = r.json()
        client_token = client_auth["access_token"]
        client_headers = {"Authorization": f"Bearer {client_token}"}
        print(f"Client logged in. Role: {client_auth['role']}")

        # 5. Security test: Client attempts Admin-restricted action
        print("\n[Step 5] Security Check: Client attempts to list all users (Admin only)...")
        r = client.get("/api/v1/users", headers=client_headers)
        assert r.status_code == 403, f"Expected 403 Forbidden, got {r.status_code}: {r.text}"
        print(f"Blocked successfully with status 403 Forbidden: {r.json()['detail']}")

        # 6. Client views own profile
        print("\n[Step 6] Client viewing own profile (/users/me)...")
        r = client.get("/api/v1/users/me", headers=client_headers)
        assert r.status_code == 200, f"Failed to get profile: {r.text}"
        profile = r.json()
        assert profile["username"] == client_username
        print(f"Client profile retrieved: {profile['full_name']} ({profile['address']})")

        # 7. Admin creates devices
        print("\n[Step 7] Admin registering metering devices...")
        r1 = client.post(
            "/api/v1/devices",
            headers=admin_headers,
            json={
                "name": "Smart Meter Kitchen",
                "description": "Kitchen Main Circuit",
                "address": "Floor 1, Kitchen",
                "max_consumption": 4.5,
            },
        )
        assert r1.status_code == 201, f"Failed to create device 1: {r1.text}"
        dev1 = r1.json()
        dev1_id = dev1["id"]
        uuid.UUID(dev1_id)
        print(f"Device 1 created: '{dev1['name']}' UUID: {dev1_id}")

        r2 = client.post(
            "/api/v1/devices",
            headers=admin_headers,
            json={
                "name": "Smart Meter HVAC",
                "description": "HVAC Central Unit",
                "address": "Rooftop Unit 3",
                "max_consumption": 15.0,
            },
        )
        assert r2.status_code == 201, f"Failed to create device 2: {r2.text}"
        dev2 = r2.json()
        dev2_id = dev2["id"]
        uuid.UUID(dev2_id)
        print(f"Device 2 created: '{dev2['name']}' UUID: {dev2_id}")

        # 8. Admin assigns Device 1 to Client
        print(f"\n[Step 8] Admin assigning Device 1 to Client '{client_username}'...")
        r = client.post(
            f"/api/v1/devices/{dev1_id}/assign",
            headers=admin_headers,
            json={"user_id": client_user_id},
        )
        assert r.status_code == 200, f"Failed to assign device: {r.text}"
        assigned_dev = r.json()
        assert assigned_dev["assigned_user_id"] == client_user_id
        print(f"Device '{assigned_dev['name']}' assigned to user {client_user_id}")

        # 9. Client checks assigned devices
        print("\n[Step 9] Client checks assigned devices (/devices/my-devices)...")
        r = client.get("/api/v1/devices/my-devices", headers=client_headers)
        assert r.status_code == 200, f"Failed to fetch my-devices: {r.text}"
        my_devices = r.json()
        print(f"Client sees {len(my_devices)} device(s): {[d['name'] for d in my_devices]}")
        assert len(my_devices) == 1
        assert my_devices[0]["id"] == dev1_id
        assert my_devices[0]["max_consumption"] == 4.5

        # 10. Admin impersonation test
        print(f"\n[Step 10] Admin impersonating Client '{client_username}'...")
        r = client.post(f"/api/v1/auth/impersonate/{client_user_id}", headers=admin_headers)
        assert r.status_code == 200, f"Admin impersonation failed: {r.text}"
        impersonation_auth = r.json()
        assert impersonation_auth["user_id"] == client_user_id
        assert impersonation_auth["role"] == "CLIENT"
        impersonated_headers = {"Authorization": f"Bearer {impersonation_auth['access_token']}"}
        print(f"Impersonation token received for user {impersonation_auth['username']}")

        # Impersonated session views client's devices
        r = client.get("/api/v1/devices/my-devices", headers=impersonated_headers)
        assert r.status_code == 200, f"Impersonated device view failed: {r.text}"
        assert len(r.json()) == 1
        print("Impersonated session successfully accessed client devices")

        # Security check: Client attempts impersonation
        print("\n[Step 10b] Security Check: Client attempts to impersonate Admin...")
        r = client.post(f"/api/v1/auth/impersonate/{admin_auth['user_id']}", headers=client_headers)
        assert r.status_code == 403, f"Expected 403 Forbidden, got {r.status_code}: {r.text}"
        print("Impersonation by non-admin blocked with 403 Forbidden")

        # 11. Admin updates Device 1
        print("\n[Step 11] Admin updating Device 1 max consumption...")
        r = client.put(
            f"/api/v1/devices/{dev1_id}",
            headers=admin_headers,
            json={"max_consumption": 5.0},
        )
        assert r.status_code == 200, f"Failed to update device: {r.text}"
        assert r.json()["max_consumption"] == 5.0
        print("Device 1 max_consumption updated to 5.0 kWh")

        # 12. Admin deletes User and verifies unassignment
        print(f"\n[Step 12] Admin deleting Client user {client_user_id}...")
        r = client.delete(f"/api/v1/users/{client_user_id}", headers=admin_headers)
        assert r.status_code == 200, f"Failed to delete user: {r.text}"
        print(f"User deleted: {r.json()['message']}")

        # Verify device 1 was unassigned
        r = client.get(f"/api/v1/devices/{dev1_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["assigned_user_id"] is None
        print("Device 1 automatically unassigned (assigned_user_id: None)")

        # Verify deleted client cannot login
        r = client.post(
            "/api/v1/auth/login",
            json={
                "username": client_username,
                "password": "ClientPassword123!",
            },
        )
        assert r.status_code == 401
        print("Deleted client cannot login (401 Unauthorized)")

        print("\n" + "=" * 60)
        print("All tests passed successfully.")
        print("=" * 60)


if __name__ == "__main__":
    test_full_pipeline()
