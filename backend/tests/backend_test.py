"""End-to-end backend API tests for Home Care Indonesia."""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

SUFFIX = uuid.uuid4().hex[:8]


def admin_credentials():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*[-*]\s*Email:\s*`?([^`\s]+)', content).group(1)
    password = re.search(r'(?im)^\s*[-*]\s*Password:\s*`?([^`\s]+)', content).group(1)
    return {"email": email, "password": password}


@pytest.fixture(scope="session")
def state():
    return {}


def client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- Health / public ----------------
class TestHealth:
    def test_root(self):
        r = client().get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_services_seeded(self, state):
        r = client().get(f"{API}/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 8
        assert all("_id" not in s for s in data)
        assert all({"id", "nama_layanan", "tarif_dasar"} <= set(s) for s in data)
        state["service"] = data[0]


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login(self, state):
        creds = admin_credentials()
        r = client().post(f"{API}/auth/login", json=creds)
        if r.status_code != 200:
            pytest.fail(f"Admin login failed: {r.status_code} {r.text[:300]}")
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert isinstance(d["token"], str) and d["token"]
        state["admin_token"] = d["token"]

    def test_login_wrong_password(self):
        r = client().post(f"{API}/auth/login", json={"email": admin_credentials()["email"], "password": "wrong-x"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_register_patient(self, state):
        payload = {"nama_lengkap": "TEST Pasien", "email": f"test_pat_{SUFFIX}@example.com",
                   "nomor_hp": "08123456789", "password": "Passw0rd!", "role": "patient"}
        r = client().post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "patient"
        assert d["user"]["email"] == payload["email"]
        assert "password_hash" not in d["user"]
        assert d["user"]["profile"] is not None
        state["pat_token"] = d["token"]
        state["pat_email"] = payload["email"]

    def test_register_duplicate_email(self, state):
        r = client().post(f"{API}/auth/register", json={
            "nama_lengkap": "dup", "email": state["pat_email"], "nomor_hp": "0812",
            "password": "Passw0rd!", "role": "patient"})
        assert r.status_code == 400

    def test_register_invalid_role(self):
        r = client().post(f"{API}/auth/register", json={
            "nama_lengkap": "x", "email": f"test_role_{SUFFIX}@example.com", "nomor_hp": "08",
            "password": "Passw0rd!", "role": "admin"})
        assert r.status_code == 400

    def test_register_invalid_email_422(self):
        r = client().post(f"{API}/auth/register", json={
            "nama_lengkap": "x", "email": "not-an-email", "nomor_hp": "08",
            "password": "p", "role": "patient"})
        assert r.status_code == 422

    def test_register_nakes(self, state):
        payload = {"nama_lengkap": "TEST Nakes", "email": f"test_nak_{SUFFIX}@example.com",
                   "nomor_hp": "08129999999", "password": "Passw0rd!", "role": "nakes"}
        r = client().post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "nakes"
        prof = d["user"]["profile"]
        assert prof["status_verifikasi"] == "pending"
        assert prof["status_online"] is False
        state["nak_token"] = d["token"]
        state["nakes_id"] = prof["id"]

    def test_me_requires_auth(self):
        r = client().get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self):
        r = client("garbage.token.value").get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_patient(self, state):
        r = client(state["pat_token"]).get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == state["pat_email"]


# ---------------- RBAC ----------------
class TestRBAC:
    def test_patient_cannot_access_admin_stats(self, state):
        r = client(state["pat_token"]).get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_nakes_cannot_search_providers(self, state):
        r = client(state["nak_token"]).get(
            f"{API}/providers/search", params={"service_id": state["service"]["id"], "lat": -6.2, "lng": 106.8})
        assert r.status_code == 403

    def test_patient_cannot_toggle_nakes_status(self, state):
        r = client(state["pat_token"]).put(f"{API}/nakes/status", json={"status_online": True})
        assert r.status_code == 403


# ---------------- Nakes setup ----------------
class TestNakesSetup:
    def test_update_profile(self, state):
        r = client(state["nak_token"]).put(f"{API}/nakes/profile", json={
            "gelar": "S.Kep., Ners", "spesialisasi": "Perawat Luka", "pengalaman_tahun": 5,
            "deskripsi_bio": "TEST bio", "alamat": "Jakarta", "latitude": -6.21,
            "longitude": 106.85, "radius_layanan": 25})
        assert r.status_code == 200, r.text
        prof = r.json()["profile"]
        assert prof["spesialisasi"] == "Perawat Luka"
        assert prof["latitude"] == -6.21 and prof["longitude"] == 106.85
        assert prof["radius_layanan"] == 25
        # verify persistence
        prof2 = client(state["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        assert prof2["latitude"] == -6.21
        assert prof2["pengalaman_tahun"] == 5

    def test_toggle_online(self, state):
        r = client(state["nak_token"]).put(f"{API}/nakes/status", json={"status_online": True})
        assert r.status_code == 200 and r.json()["status_online"] is True
        assert client(state["nak_token"]).get(f"{API}/auth/me").json()["profile"]["status_online"] is True

    def test_add_service(self, state):
        svc = state["service"]
        r = client(state["nak_token"]).post(f"{API}/nakes/services", json={
            "service_id": svc["id"], "tarif_nakes": 200000, "durasi_estimasi": 60})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["tarif_nakes"] == 200000
        assert d["nama_layanan"] == svc["nama_layanan"]
        prof = client(state["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        assert any(s["id"] == d["id"] for s in prof["services"])

    def test_add_service_invalid_id(self, state):
        r = client(state["nak_token"]).post(f"{API}/nakes/services", json={
            "service_id": "svc_does_not_exist", "tarif_nakes": 1000, "durasi_estimasi": 10})
        assert r.status_code == 404

    def test_add_document(self, state):
        r = client(state["nak_token"]).post(f"{API}/nakes/documents", json={
            "jenis_dokumen": "STR", "nomor_dokumen": f"TEST-STR-{SUFFIX}", "tanggal_valid": "2030-01-01"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status_verifikasi_admin"] == "pending"
        state["doc_id"] = d["id"]

    def test_search_excludes_unverified(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/search", params={
            "service_id": state["service"]["id"], "lat": -6.2088, "lng": 106.8456})
        assert r.status_code == 200
        assert not any(p["nakes_id"] == state["nakes_id"] for p in r.json()), \
            "Unverified nakes should not appear in search"


# ---------------- Admin verification ----------------
class TestAdminVerify:
    def test_admin_lists_nakes(self, state):
        r = client(state["admin_token"]).get(f"{API}/admin/nakes")
        assert r.status_code == 200
        target = [n for n in r.json() if n["id"] == state["nakes_id"]]
        assert target, "registered nakes missing from admin list"
        assert target[0]["status_verifikasi"] == "pending"
        assert len(target[0]["documents"]) >= 1

    def test_verify_document(self, state):
        r = client(state["admin_token"]).put(
            f"{API}/admin/documents/{state['doc_id']}/verify", json={"action": "accept"})
        assert r.status_code == 200
        assert r.json()["status_verifikasi_admin"] == "verified"

    def test_verify_nakes(self, state):
        r = client(state["admin_token"]).put(
            f"{API}/admin/nakes/{state['nakes_id']}/verify", json={"action": "accept"})
        assert r.status_code == 200
        assert r.json()["status_verifikasi"] == "verified"
        prof = client(state["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        assert prof["status_verifikasi"] == "verified"

    def test_nakes_notified_of_verification(self, state):
        notifs = client(state["nak_token"]).get(f"{API}/notifications").json()
        assert any(n["tipe_notifikasi"] == "verifikasi" for n in notifs)


# ---------------- Patient search & booking ----------------
class TestBookingFlow:
    def test_search_finds_verified_online_nakes(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/search", params={
            "service_id": state["service"]["id"], "lat": -6.2088, "lng": 106.8456})
        assert r.status_code == 200, r.text
        found = [p for p in r.json() if p["nakes_id"] == state["nakes_id"]]
        assert found, "verified+online nakes not returned by search"
        p = found[0]
        assert p["tarif_nakes"] == 200000
        assert isinstance(p["jarak_km"], (int, float)) and p["jarak_km"] < 5
        assert p["spesialisasi"] == "Perawat Luka"

    def test_search_min_rating_filter(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/search", params={
            "service_id": state["service"]["id"], "lat": -6.2088, "lng": 106.8456, "min_rating": 4.5})
        assert r.status_code == 200
        assert not any(p["nakes_id"] == state["nakes_id"] for p in r.json())

    def test_search_max_distance_filter(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/search", params={
            "service_id": state["service"]["id"], "lat": -8.0, "lng": 110.0, "max_distance": 5})
        assert r.status_code == 200
        assert not any(p["nakes_id"] == state["nakes_id"] for p in r.json())

    def test_provider_detail(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/{state['nakes_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["nama"] == "TEST Nakes"
        assert len(d["services"]) >= 1
        assert isinstance(d["reviews"], list)

    def test_provider_detail_404(self, state):
        r = client(state["pat_token"]).get(f"{API}/providers/nak_missing")
        assert r.status_code == 404

    def test_create_order(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders", json={
            "nakes_id": state["nakes_id"], "service_id": state["service"]["id"],
            "jadwal_kunjungan": "2026-08-01T10:00:00", "catatan_pasien": "TEST catatan",
            "alamat": "Jl. Test No 1", "latitude": -6.2088, "longitude": 106.8456})
        assert r.status_code == 200, r.text
        o = r.json()
        assert "_id" not in o
        assert o["status_order"] == "pending"
        assert o["estimasi_biaya"] == 200000
        assert o["total_biaya"] == o["estimasi_biaya"] + o["biaya_transport"]
        state["order_id"] = o["id"]
        state["total"] = o["total_biaya"]

    def test_create_order_service_not_offered(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders", json={
            "nakes_id": state["nakes_id"], "service_id": "svc_nope",
            "jadwal_kunjungan": "2026-08-01T10:00:00", "alamat": "x",
            "latitude": -6.2, "longitude": 106.8})
        assert r.status_code == 404

    def test_order_visible_to_both(self, state):
        po = client(state["pat_token"]).get(f"{API}/orders").json()
        no = client(state["nak_token"]).get(f"{API}/orders").json()
        assert any(o["id"] == state["order_id"] for o in po)
        mine = [o for o in no if o["id"] == state["order_id"]]
        assert mine and mine[0]["patient_nama"] == "TEST Pasien"

    def test_nakes_notified_new_order(self, state):
        notifs = client(state["nak_token"]).get(f"{API}/notifications").json()
        assert any(n["tipe_notifikasi"] == "order" for n in notifs)
        state["notif_id"] = notifs[0]["id"]

    def test_mark_notification_read(self, state):
        r = client(state["nak_token"]).put(f"{API}/notifications/{state['notif_id']}/read")
        assert r.status_code == 200
        notifs = client(state["nak_token"]).get(f"{API}/notifications").json()
        assert [n for n in notifs if n["id"] == state["notif_id"]][0]["status_baca"] is True

    def test_accept_order(self, state):
        r = client(state["nak_token"]).put(
            f"{API}/orders/{state['order_id']}/respond", json={"action": "accept"})
        assert r.status_code == 200, r.text
        assert r.json()["status_order"] == "accepted"
        assert client(state["pat_token"]).get(
            f"{API}/orders/{state['order_id']}").json()["status_order"] == "accepted"

    def test_respond_order_404(self, state):
        r = client(state["nak_token"]).put(f"{API}/orders/ord_missing/respond", json={"action": "accept"})
        assert r.status_code == 404


# ---------------- Chat ----------------
class TestChat:
    def test_patient_sends_message(self, state):
        r = client(state["pat_token"]).post(
            f"{API}/orders/{state['order_id']}/chat", json={"pesan": "TEST halo"})
        assert r.status_code == 200
        assert r.json()["sender_role"] == "patient"

    def test_nakes_replies_and_thread_ordered(self, state):
        r = client(state["nak_token"]).post(
            f"{API}/orders/{state['order_id']}/chat", json={"pesan": "TEST siap"})
        assert r.status_code == 200
        msgs = client(state["pat_token"]).get(f"{API}/orders/{state['order_id']}/chat").json()
        assert len(msgs) >= 2
        assert msgs[0]["pesan"] == "TEST halo"
        assert msgs[-1]["sender_role"] == "nakes"


# ---------------- Medical record ----------------
class TestMedicalRecord:
    def test_record_not_yet_available(self, state):
        r = client(state["pat_token"]).get(f"{API}/orders/{state['order_id']}/medical-record")
        assert r.status_code == 404

    def test_create_record_completes_order(self, state):
        r = client(state["nak_token"]).post(f"{API}/orders/{state['order_id']}/medical-record", json={
            "diagnosis": "TEST diagnosis", "tindakan": "TEST tindakan",
            "catatan_tambahan": "TEST catatan",
            "soap": {"keluhan": "nyeri", "tekanan_darah": "120/80", "nadi": "80", "suhu": "36.7"},
            "attachments": []})
        assert r.status_code == 200, r.text
        rec = r.json()
        assert "_id" not in rec
        assert rec["soap"]["tekanan_darah"] == "120/80"
        o = client(state["nak_token"]).get(f"{API}/orders/{state['order_id']}").json()
        assert o["status_order"] == "completed"
        assert o["has_record"] is True

    def test_duplicate_record_rejected(self, state):
        r = client(state["nak_token"]).post(f"{API}/orders/{state['order_id']}/medical-record", json={
            "soap": {"keluhan": "again"}})
        assert r.status_code == 400

    def test_patient_can_read_record(self, state):
        r = client(state["pat_token"]).get(f"{API}/orders/{state['order_id']}/medical-record")
        assert r.status_code == 200
        assert r.json()["diagnosis"] == "TEST diagnosis"
        lst = client(state["pat_token"]).get(f"{API}/patient/medical-records").json()
        assert any(x["order_id"] == state["order_id"] and x["nakes_nama"] == "TEST Nakes" for x in lst)


# ---------------- Payment / review / income ----------------
class TestPaymentReviewIncome:
    def test_create_qris_payment(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders/{state['order_id']}/payment",
                                            json={"metode_pembayaran": "qris"})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status_pembayaran"] == "menunggu_verifikasi"
        assert p["jumlah"] == state["total"]
        state["payment_id"] = p["id"]

    def test_duplicate_payment_rejected(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders/{state['order_id']}/payment",
                                            json={"metode_pembayaran": "cash"})
        assert r.status_code == 400

    def test_admin_sees_transaction(self, state):
        txs = client(state["admin_token"]).get(f"{API}/admin/transactions").json()
        mine = [t for t in txs if t["id"] == state["payment_id"]]
        assert mine and mine[0]["nama_layanan"] == state["service"]["nama_layanan"]

    def test_nakes_income_zero_before_verify(self, state):
        r = client(state["nak_token"]).get(f"{API}/nakes/income")
        assert r.status_code == 200
        assert r.json()["total_pendapatan"] == 0

    def test_admin_verify_payment(self, state):
        stats_before = client(state["admin_token"]).get(f"{API}/admin/stats").json()
        r = client(state["admin_token"]).put(f"{API}/payments/{state['payment_id']}/verify")
        assert r.status_code == 200, r.text
        txs = client(state["admin_token"]).get(f"{API}/admin/transactions").json()
        assert [t for t in txs if t["id"] == state["payment_id"]][0]["status_pembayaran"] == "sukses"
        stats_after = client(state["admin_token"]).get(f"{API}/admin/stats").json()
        assert stats_after["total_omzet"] == stats_before["total_omzet"] + state["total"]
        assert stats_after["pendapatan_platform"] > stats_before["pendapatan_platform"]

    def test_verify_payment_idempotent_no_double_transaction(self, state):
        before = client(state["nak_token"]).get(f"{API}/nakes/income").json()
        r = client(state["admin_token"]).put(f"{API}/payments/{state['payment_id']}/verify")
        assert r.status_code == 200
        after = client(state["nak_token"]).get(f"{API}/nakes/income").json()
        assert after["jumlah_transaksi"] == before["jumlah_transaksi"]

    def test_verify_payment_404(self, state):
        r = client(state["admin_token"]).put(f"{API}/payments/pay_missing/verify")
        assert r.status_code == 404

    def test_nakes_income_after_verify(self, state):
        d = client(state["nak_token"]).get(f"{API}/nakes/income").json()
        assert d["jumlah_transaksi"] == 1
        expected = state["total"] - round(state["total"] * 0.15)
        assert d["total_pendapatan"] == expected

    def test_add_review_updates_rating(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders/{state['order_id']}/review",
                                            json={"rating": 5, "komentar": "TEST bagus"})
        assert r.status_code == 200, r.text
        assert r.json()["rating"] == 5
        prof = client(state["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        assert prof["rating_rata_rata"] == 5
        assert prof["jumlah_review"] == 1
        o = client(state["pat_token"]).get(f"{API}/orders/{state['order_id']}").json()
        assert o["has_review"] is True

    def test_duplicate_review_rejected(self, state):
        r = client(state["pat_token"]).post(f"{API}/orders/{state['order_id']}/review",
                                            json={"rating": 3})
        assert r.status_code == 400

    def test_patient_payment_notification(self, state):
        notifs = client(state["pat_token"]).get(f"{API}/notifications").json()
        assert any(n["tipe_notifikasi"] == "payment" for n in notifs)


# ---------------- Admin misc ----------------
class TestAdminMisc:
    def test_stats_shape(self, state):
        d = client(state["admin_token"]).get(f"{API}/admin/stats").json()
        for k in ("total_nakes", "pending_nakes", "total_pasien", "total_order",
                  "pendapatan_platform", "total_omzet"):
            assert k in d
        assert d["total_pasien"] >= 1 and d["total_order"] >= 1

    def test_admin_patients(self, state):
        d = client(state["admin_token"]).get(f"{API}/admin/patients").json()
        assert any(p.get("email") == state["pat_email"] for p in d)

    def test_admin_create_service(self, state):
        r = client(state["admin_token"]).post(f"{API}/admin/services", json={
            "nama_layanan": f"TEST Layanan {SUFFIX}", "kategori": "Perawatan",
            "deskripsi": "TEST", "tarif_dasar": 50000})
        assert r.status_code == 200
        sid = r.json()["id"]
        lst = client().get(f"{API}/services").json()
        assert any(s["id"] == sid for s in lst)
