"""Iteration 3 backend tests: medical-record PDF with photos, admin banner CRUD +
role-targeted visibility, static QRIS asset, and payment flow regression."""
import io
import os

import pytest
import requests
from dotenv import dotenv_values
from PIL import Image

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@homecare.id", "admin123")
PATIENT = ("siti@pasien.id", "pasien123")
NAKES = ("budi@nakes.id", "nakes123")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login {email} failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return login(*ADMIN)


@pytest.fixture(scope="module")
def patient_token():
    return login(*PATIENT)


@pytest.fixture(scope="module")
def nakes_token():
    return login(*NAKES)


def png_bytes(color=(20, 160, 90), size=(240, 160)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def upload(tok, name="TEST_banner.png", data=None, ctype="image/png"):
    r = requests.post(f"{API}/upload", headers=hdr(tok),
                      files={"file": (name, data or png_bytes(), ctype)}, timeout=60)
    return r


# ---------------- Static QRIS asset ----------------
class TestQrisStatic:
    def test_qris_static_image_served(self):
        r = requests.get(f"{BASE_URL}/qris-static.jpeg", timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 1000
        # must be a decodable image
        Image.open(io.BytesIO(r.content)).load()


# ---------------- Banner CRUD (admin) + visibility ----------------
class TestBannerCRUD:
    created = []

    def test_upload_banner_image(self, admin_token):
        r = upload(admin_token, "TEST_banner_all.png")
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "path" in data or "url" in data, data
        TestBannerCRUD.img_path = data.get("path") or data.get("url")
        assert isinstance(TestBannerCRUD.img_path, str) and TestBannerCRUD.img_path

    def test_create_banner_and_persist(self, admin_token):
        payload = {"judul": "TEST_Banner Semua", "gambar_url": TestBannerCRUD.img_path,
                   "link_url": "https://example.com", "target": "all", "status_aktif": True}
        r = requests.post(f"{API}/admin/banners", headers=hdr(admin_token), json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        assert "_id" not in b
        assert b["judul"] == payload["judul"]
        assert b["target"] == "all"
        assert b["status_aktif"] is True
        assert isinstance(b["id"], str)
        TestBannerCRUD.created.append(b["id"])
        TestBannerCRUD.banner_all = b["id"]

        lst = requests.get(f"{API}/admin/banners", headers=hdr(admin_token), timeout=30)
        assert lst.status_code == 200
        ids = [x["id"] for x in lst.json()]
        assert b["id"] in ids

    def test_create_nakes_target_and_inactive_banners(self, admin_token):
        for judul, target, active, attr in [
            ("TEST_Banner Nakes", "nakes", True, "banner_nakes"),
            ("TEST_Banner Nonaktif", "all", False, "banner_inactive"),
            ("TEST_Banner Pasien", "patient", True, "banner_patient"),
        ]:
            r = requests.post(f"{API}/admin/banners", headers=hdr(admin_token), json={
                "judul": judul, "gambar_url": TestBannerCRUD.img_path,
                "target": target, "status_aktif": active}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            bid = r.json()["id"]
            TestBannerCRUD.created.append(bid)
            setattr(TestBannerCRUD, attr, bid)

    def test_patient_sees_only_active_all_or_patient(self, patient_token):
        r = requests.get(f"{API}/banners", headers=hdr(patient_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        items = r.json()
        juduls = [x["judul"] for x in items]
        assert "TEST_Banner Semua" in juduls
        assert "TEST_Banner Pasien" in juduls
        assert "TEST_Banner Nakes" not in juduls, "nakes-targeted banner leaked to patient"
        assert "TEST_Banner Nonaktif" not in juduls, "inactive banner visible to patient"
        for x in items:
            assert x["status_aktif"] is True
            assert x["target"] in ("all", "patient")
            assert "_id" not in x

    def test_nakes_sees_only_active_all_or_nakes(self, nakes_token):
        r = requests.get(f"{API}/banners", headers=hdr(nakes_token), timeout=30)
        assert r.status_code == 200
        juduls = [x["judul"] for x in r.json()]
        assert "TEST_Banner Nakes" in juduls
        assert "TEST_Banner Semua" in juduls
        assert "TEST_Banner Pasien" not in juduls, "patient banner leaked to nakes"
        assert "TEST_Banner Nonaktif" not in juduls

    def test_banners_requires_auth(self):
        r = requests.get(f"{API}/banners", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_non_admin_cannot_manage_banners(self, patient_token):
        assert requests.get(f"{API}/admin/banners", headers=hdr(patient_token), timeout=30).status_code == 403
        assert requests.post(f"{API}/admin/banners", headers=hdr(patient_token), json={
            "judul": "TEST_hack", "gambar_url": "x.png"}, timeout=30).status_code == 403
        assert requests.delete(f"{API}/admin/banners/{TestBannerCRUD.banner_all}",
                               headers=hdr(patient_token), timeout=30).status_code == 403

    def test_update_banner_toggle_and_persist(self, admin_token, patient_token):
        bid = TestBannerCRUD.banner_patient
        r = requests.put(f"{API}/admin/banners/{bid}", headers=hdr(admin_token), json={
            "judul": "TEST_Banner Pasien Edited", "gambar_url": TestBannerCRUD.img_path,
            "target": "patient", "status_aktif": False}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["judul"] == "TEST_Banner Pasien Edited"
        assert r.json()["status_aktif"] is False

        lst = requests.get(f"{API}/admin/banners", headers=hdr(admin_token), timeout=30).json()
        found = [x for x in lst if x["id"] == bid][0]
        assert found["judul"] == "TEST_Banner Pasien Edited"
        assert found["status_aktif"] is False

        # now hidden from patient
        juduls = [x["judul"] for x in requests.get(f"{API}/banners", headers=hdr(patient_token), timeout=30).json()]
        assert "TEST_Banner Pasien Edited" not in juduls

    def test_update_unknown_banner(self, admin_token):
        r = requests.put(f"{API}/admin/banners/ban_does_not_exist", headers=hdr(admin_token), json={
            "judul": "TEST_x", "gambar_url": "x.png"}, timeout=30)
        assert r.status_code == 404, f"expected 404 for unknown banner, got {r.status_code}: {r.text[:200]}"

    def test_delete_banner_and_verify_removal(self, admin_token):
        bid = TestBannerCRUD.banner_inactive
        r = requests.delete(f"{API}/admin/banners/{bid}", headers=hdr(admin_token), timeout=30)
        assert r.status_code in (200, 204), r.text[:200]
        lst = requests.get(f"{API}/admin/banners", headers=hdr(admin_token), timeout=30).json()
        assert bid not in [x["id"] for x in lst]
        TestBannerCRUD.created.remove(bid)

    def test_zz_cleanup(self, admin_token):
        for bid in list(TestBannerCRUD.created):
            requests.delete(f"{API}/admin/banners/{bid}", headers=hdr(admin_token), timeout=30)
        lst = requests.get(f"{API}/admin/banners", headers=hdr(admin_token), timeout=30).json()
        assert not [x for x in lst if x["judul"].startswith("TEST_")]


# ---------------- Medical record PDF with photos ----------------
class TestRecordPdf:
    def _completed_order_with_record(self, patient_token):
        r = requests.get(f"{API}/orders", headers=hdr(patient_token), timeout=30)
        assert r.status_code == 200, r.text[:200]
        for o in r.json():
            rec = requests.get(f"{API}/orders/{o['id']}/medical-record", headers=hdr(patient_token), timeout=30)
            if rec.status_code == 200 and (rec.json().get("attachments") or []):
                return o["id"], rec.json()
        return None, None

    def test_pdf_with_photo(self, patient_token):
        oid, rec = self._completed_order_with_record(patient_token)
        if not oid:
            pytest.skip("no order with medical record + attachment for siti@pasien.id")
        r = requests.get(f"{API}/orders/{oid}/medical-record/pdf", headers=hdr(patient_token), timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:5] == b"%PDF-"
        assert b"/Image" in r.content, "no image XObject embedded in PDF"
        assert len(r.content) > 20000, f"pdf suspiciously small: {len(r.content)}"

    def test_pdf_via_query_auth(self, patient_token):
        oid, _ = self._completed_order_with_record(patient_token)
        if not oid:
            pytest.skip("no record order")
        r = requests.get(f"{API}/orders/{oid}/medical-record/pdf?auth={patient_token}", timeout=120)
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"

    def test_pdf_no_token(self, patient_token):
        oid, _ = self._completed_order_with_record(patient_token)
        if not oid:
            pytest.skip("no record order")
        assert requests.get(f"{API}/orders/{oid}/medical-record/pdf", timeout=30).status_code == 401
        assert requests.get(f"{API}/orders/{oid}/medical-record/pdf?auth=garbage", timeout=30).status_code == 401

    def test_pdf_cross_patient_forbidden(self, patient_token, nakes_token, admin_token):
        oid, _ = self._completed_order_with_record(patient_token)
        if not oid:
            pytest.skip("no record order")
        # a foreign patient must not read it
        em = "TEST_pdfidor@example.com"
        requests.post(f"{API}/auth/register", json={
            "email": em, "password": "pass1234", "nama_lengkap": "TEST PDF IDOR",
            "nomor_hp": "081200000111", "role": "patient"}, timeout=30)
        tok = login(em, "pass1234")
        r = requests.get(f"{API}/orders/{oid}/medical-record/pdf", headers=hdr(tok), timeout=60)
        assert r.status_code in (403, 404), f"IDOR: foreign patient got {r.status_code}"

    def test_pdf_unknown_order(self, patient_token):
        r = requests.get(f"{API}/orders/ord_nope/medical-record/pdf", headers=hdr(patient_token), timeout=30)
        assert r.status_code in (403, 404), r.status_code


# ---------------- Broken image resilience ----------------
class TestBrokenPhoto:
    def test_pdf_skips_corrupt_image(self, nakes_token, patient_token, admin_token):
        """Attach a corrupt .png to an existing record and ensure PDF still renders."""
        import pymongo
        mongo_url = dotenv_values("/app/backend/.env").get("MONGO_URL")
        db_name = dotenv_values("/app/backend/.env").get("DB_NAME")
        if not mongo_url:
            pytest.skip("MONGO_URL unavailable")
        cli = pymongo.MongoClient(mongo_url)
        db = cli[db_name]
        orders = requests.get(f"{API}/orders", headers=hdr(patient_token), timeout=30).json()
        target = None
        for o in orders:
            if db.medical_records.find_one({"order_id": o["id"]}):
                target = o["id"]
                break
        if not target:
            pytest.skip("no medical record found")
        rec = db.medical_records.find_one({"order_id": target})
        orig = rec.get("attachments") or []
        # upload a "corrupt" png (valid extension, garbage bytes)
        up = requests.post(f"{API}/upload", headers=hdr(nakes_token),
                           files={"file": ("TEST_corrupt.png", b"not-an-image-at-all" * 20, "image/png")}, timeout=60)
        assert up.status_code == 200, up.text[:200]
        bad_path = up.json().get("path") or up.json().get("url")
        db.medical_records.update_one({"order_id": target}, {"$set": {"attachments": orig + [bad_path]}})
        try:
            r = requests.get(f"{API}/orders/{target}/medical-record/pdf", headers=hdr(patient_token), timeout=120)
            assert r.status_code == 200, f"corrupt image caused {r.status_code}: {r.text[:200]}"
            assert r.content[:5] == b"%PDF-"
        finally:
            db.medical_records.update_one({"order_id": target}, {"$set": {"attachments": orig}})
            cli.close()
