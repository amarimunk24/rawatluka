"""Iteration 2 backend tests: file upload/serving, document file_url, SOAP photo attachments,
provider search lat/lng exposure, and chat polling semantics."""
import base64
import io
import os
import re
import time
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

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


def admin_credentials():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*[-*]\s*Email:\s*`?([^`\s]+)', content).group(1)
    password = re.search(r'(?im)^\s*[-*]\s*Password:\s*`?([^`\s]+)', content).group(1)
    return {"email": email, "password": password}


def client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def upload(token, filename, data, content_type="image/png"):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s.post(f"{API}/upload", files={"file": (filename, io.BytesIO(data), content_type)}, timeout=120)


@pytest.fixture(scope="class")
def st():
    """Session state: fresh nakes + patient + admin tokens and a seeded service."""
    state = {}
    services = client().get(f"{API}/services").json()
    state["service"] = services[0]

    ac = admin_credentials()
    r = client().post(f"{API}/auth/login", json=ac)
    assert r.status_code == 200, r.text
    state["admin_token"] = r.json()["token"]

    r = client().post(f"{API}/auth/register", json={
        "nama_lengkap": "TEST Nakes Upload", "email": f"test_nak_up_{SUFFIX}@example.com",
        "nomor_hp": "08120000001", "password": "Passw0rd!", "role": "nakes"})
    assert r.status_code == 200, r.text
    state["nak_token"] = r.json()["token"]
    state["nakes_id"] = r.json()["user"]["profile"]["id"]

    r = client().post(f"{API}/auth/register", json={
        "nama_lengkap": "TEST Pasien Upload", "email": f"test_pat_up_{SUFFIX}@example.com",
        "nomor_hp": "08120000002", "password": "Passw0rd!", "role": "patient"})
    assert r.status_code == 200, r.text
    state["pat_token"] = r.json()["token"]
    return state


# ---------------- POST /api/upload & GET /api/files ----------------
class TestFileUploadAPI:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/upload", files={"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")})
        assert r.status_code == 401, r.text

    def test_upload_png_returns_path(self, st):
        r = upload(st["nak_token"], "wound.png", PNG_BYTES)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d and isinstance(d["path"], str) and d["path"]
        assert d["path"].endswith(".png")
        assert "homecare-id/uploads/" in d["path"]
        assert d["content_type"] == "image/png"
        st["png_path"] = d["path"]

    def test_upload_rejects_bad_extension(self, st):
        r = upload(st["nak_token"], "evil.exe", b"MZbinary", "application/octet-stream")
        assert r.status_code == 400, r.text
        assert "detail" in r.json()

    def test_upload_rejects_oversize(self, st):
        big = b"\x00" * (8 * 1024 * 1024 + 1024)
        r = upload(st["nak_token"], "big.png", big)
        assert r.status_code == 400, r.text
        assert "8MB" in str(r.json()["detail"])

    def test_serve_file_without_auth_401(self, st):
        r = requests.get(f"{BASE_URL}/api/files/{st['png_path']}")
        assert r.status_code == 401, r.text

    def test_serve_file_with_invalid_token_401(self, st):
        r = requests.get(f"{BASE_URL}/api/files/{st['png_path']}", params={"auth": "garbage.token.value"})
        assert r.status_code == 401, r.text

    def test_serve_file_with_query_token(self, st):
        r = requests.get(f"{BASE_URL}/api/files/{st['png_path']}", params={"auth": st["nak_token"]})
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("image/png")
        assert r.content == PNG_BYTES

    def test_serve_file_with_bearer_header(self, st):
        r = client(st["nak_token"]).get(f"{BASE_URL}/api/files/{st['png_path']}")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/png")

    def test_serve_unknown_path_404(self, st):
        r = requests.get(f"{BASE_URL}/api/files/homecare-id/uploads/none/{uuid.uuid4().hex}.png",
                         params={"auth": st["nak_token"]})
        assert r.status_code == 404, r.text


# ---------------- Nakes documents with file_url ----------------

    def test_add_document_with_file_url(self, st):
        up = upload(st["nak_token"], "str.png", PNG_BYTES)
        assert up.status_code == 200, up.text
        st["doc_file"] = up.json()["path"]
        r = client(st["nak_token"]).post(f"{API}/nakes/documents", json={
            "jenis_dokumen": "STR", "nomor_dokumen": f"TEST-STR-{SUFFIX}",
            "tanggal_valid": "2030-01-01", "file_url": st["doc_file"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["file_url"] == st["doc_file"]
        assert d["status_verifikasi_admin"] == "pending"
        st["doc_id"] = d["id"]

    def test_document_file_url_persisted_in_profile(self, st):
        prof = client(st["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        doc = next(d for d in prof["documents"] if d["id"] == st["doc_id"])
        assert doc["file_url"] == st["doc_file"]

    def test_admin_sees_document_file_url(self, st):
        r = client(st["admin_token"]).get(f"{API}/admin/nakes")
        assert r.status_code == 200, r.text
        nak = next(n for n in r.json() if n["id"] == st["nakes_id"])
        docs = nak["documents"]
        doc = next(d for d in docs if d["id"] == st["doc_id"])
        assert doc["file_url"] == st["doc_file"]

    def test_admin_can_fetch_document_image(self, st):
        r = requests.get(f"{BASE_URL}/api/files/{st['doc_file']}", params={"auth": st["admin_token"]})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/")

    def test_admin_verifies_document_then_nakes(self, st):
        r = client(st["admin_token"]).put(
            f"{API}/admin/documents/{st['doc_id']}/verify", json={"action": "accept"})
        assert r.status_code == 200, r.text
        r = client(st["admin_token"]).put(
            f"{API}/admin/nakes/{st['nakes_id']}/verify", json={"action": "accept"})
        assert r.status_code == 200, r.text
        prof = client(st["nak_token"]).get(f"{API}/auth/me").json()["profile"]
        assert prof["status_verifikasi"] == "verified"
        doc = next(d for d in prof["documents"] if d["id"] == st["doc_id"])
        assert doc["status_verifikasi_admin"] == "verified"


# ---------------- Provider search returns coordinates ----------------

    def test_nakes_setup_and_search_exposes_lat_lng(self, st):
        nk = client(st["nak_token"])
        assert nk.put(f"{API}/nakes/profile", json={
            "spesialisasi": "Perawat Luka", "alamat": "Jakarta", "latitude": -6.21,
            "longitude": 106.85, "radius_layanan": 25}).status_code == 200
        assert nk.put(f"{API}/nakes/status", json={"status_online": True}).status_code == 200
        r = nk.post(f"{API}/nakes/services", json={
            "service_id": st["service"]["id"], "tarif_nakes": 150000, "durasi_estimasi": 60})
        assert r.status_code == 200, r.text

        r = client(st["pat_token"]).get(f"{API}/providers/search", params={
            "service_id": st["service"]["id"], "lat": -6.2088, "lng": 106.8456})
        assert r.status_code == 200, r.text
        results = r.json()
        mine = [p for p in results if p["nakes_id"] == st["nakes_id"]]
        assert mine, f"nakes not found in search: {results}"
        p = mine[0]
        assert p["latitude"] == -6.21 and p["longitude"] == 106.85
        assert isinstance(p["jarak_km"], (int, float))
        assert "_id" not in p


# ---------------- SOAP medical record with photo attachment ----------------

    def test_create_order_and_accept(self, st):
        r = client(st["pat_token"]).post(f"{API}/orders", json={
            "nakes_id": st["nakes_id"], "service_id": st["service"]["id"],
            "jadwal_kunjungan": "2030-05-01T10:00:00", "alamat": "Jl TEST 1",
            "latitude": -6.2088, "longitude": 106.8456, "catatan_pasien": "TEST"})
        assert r.status_code == 200, r.text
        st["order_id"] = r.json()["id"]
        r = client(st["nak_token"]).put(f"{API}/orders/{st['order_id']}/respond", json={"action": "accept"})
        assert r.status_code == 200, r.text
        assert r.json()["status_order"] == "accepted"

    def test_submit_record_with_photo(self, st):
        up = upload(st["nak_token"], "luka.png", PNG_BYTES)
        assert up.status_code == 200, up.text
        st["wound_path"] = up.json()["path"]
        r = client(st["nak_token"]).post(f"{API}/orders/{st['order_id']}/medical-record", json={
            "diagnosis": "TEST luka", "tindakan": "Perawatan luka",
            "soap": {"keluhan": "Nyeri", "tekanan_darah": "120/80", "nadi": "80",
                     "respirasi": "18", "suhu": "36.6", "spo2": "98", "kondisi_luka": "membaik"},
            "attachments": [st["wound_path"]]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert st["wound_path"] in d["attachments"]

    def test_patient_reads_record_attachment(self, st):
        r = client(st["pat_token"]).get(f"{API}/orders/{st['order_id']}/medical-record")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["attachments"] == [st["wound_path"]]
        assert d["soap"]["tekanan_darah"] == "120/80"
        img = requests.get(f"{BASE_URL}/api/files/{st['wound_path']}", params={"auth": st["pat_token"]})
        assert img.status_code == 200
        assert img.headers["content-type"].startswith("image/")

    def test_other_patient_cannot_read_record(self, st):
        r = client().post(f"{API}/auth/register", json={
            "nama_lengkap": "TEST Intruder", "email": f"test_intr_{SUFFIX}@example.com",
            "nomor_hp": "08120000003", "password": "Passw0rd!", "role": "patient"})
        assert r.status_code == 200
        tok = r.json()["token"]
        rec = client(tok).get(f"{API}/orders/{st['order_id']}/medical-record")
        assert rec.status_code in (403, 404), rec.text


# ---------------- Chat (polling source of truth) ----------------

    def test_patient_and_nakes_exchange(self, st):
        r = client(st["pat_token"]).post(f"{API}/orders/{st['order_id']}/chat", json={"pesan": "TEST halo"})
        assert r.status_code == 200, r.text
        r = client(st["nak_token"]).post(f"{API}/orders/{st['order_id']}/chat", json={"pesan": "TEST balas"})
        assert r.status_code == 200, r.text

    def test_poll_returns_new_messages_ordered(self, st):
        before = client(st["pat_token"]).get(f"{API}/orders/{st['order_id']}/chat").json()
        assert len(before) >= 2
        assert before[0]["pesan"] == "TEST halo"
        client(st["nak_token"]).post(f"{API}/orders/{st['order_id']}/chat", json={"pesan": "TEST poll"})
        time.sleep(2.6)
        after = client(st["pat_token"]).get(f"{API}/orders/{st['order_id']}/chat").json()
        assert len(after) == len(before) + 1
        assert after[-1]["pesan"] == "TEST poll"
        assert all("_id" not in m for m in after)

    def test_outsider_patient_cannot_read_chat(self, st):
        r = client().post(f"{API}/auth/register", json={
            "nama_lengkap": "TEST Chat Intruder", "email": f"test_chatintr_{SUFFIX}@example.com",
            "nomor_hp": "08120000004", "password": "Passw0rd!", "role": "patient"})
        tok = r.json()["token"]
        r = client(tok).get(f"{API}/orders/{st['order_id']}/chat")
        assert r.status_code in (403, 404), r.text
        r = client(tok).post(f"{API}/orders/{st['order_id']}/chat", json={"pesan": "TEST intrusion"})
        assert r.status_code in (403, 404), r.text
