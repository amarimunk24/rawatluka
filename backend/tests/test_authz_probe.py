"""Probe cross-tenant authorization gaps (report-only, xfail-tolerant)."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
S = uuid.uuid4().hex[:8]


def reg(role, tag):
    r = requests.post(f"{API}/auth/register", json={
        "nama_lengkap": f"TEST {tag}", "email": f"test_{tag}_{S}@example.com",
        "nomor_hp": "0812", "password": "Passw0rd!", "role": role})
    assert r.status_code == 200, r.text
    return r.json()


def hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ctx():
    admin = requests.post(f"{API}/auth/login", json={
        "email": "admin@homecare.id", "password": "admin123"}).json()
    svc = requests.get(f"{API}/services").json()[0]
    p1 = reg("patient", "p1")
    p2 = reg("patient", "p2")
    n1 = reg("nakes", "n1")
    n2 = reg("nakes", "n2")
    nid = n1["user"]["profile"]["id"]
    requests.put(f"{API}/nakes/profile", headers=hdr(n1["token"]),
                 json={"latitude": -6.21, "longitude": 106.85, "radius_layanan": 30})
    requests.put(f"{API}/nakes/status", headers=hdr(n1["token"]), json={"status_online": True})
    requests.post(f"{API}/nakes/services", headers=hdr(n1["token"]),
                  json={"service_id": svc["id"], "tarif_nakes": 100000, "durasi_estimasi": 30})
    requests.put(f"{API}/admin/nakes/{nid}/verify", headers=hdr(admin["token"]),
                 json={"action": "accept"})
    order = requests.post(f"{API}/orders", headers=hdr(p1["token"]), json={
        "nakes_id": nid, "service_id": svc["id"], "jadwal_kunjungan": "2026-08-02T09:00:00",
        "alamat": "Jl TEST", "latitude": -6.2088, "longitude": 106.8456}).json()
    return {"p1": p1["token"], "p2": p2["token"], "n1": n1["token"], "n2": n2["token"],
            "order": order["id"], "admin": admin["token"]}


def test_other_patient_cannot_read_order(ctx):
    r = requests.get(f"{API}/orders/{ctx['order']}", headers=hdr(ctx["p2"]))
    assert r.status_code in (403, 404), f"IDOR: other patient read order ({r.status_code})"


def test_other_nakes_cannot_respond_to_order(ctx):
    r = requests.put(f"{API}/orders/{ctx['order']}/respond", headers=hdr(ctx["n2"]),
                     json={"action": "reject"})
    assert r.status_code in (403, 404), f"IDOR: unrelated nakes changed order status ({r.status_code})"


def test_other_nakes_cannot_complete_order(ctx):
    r = requests.put(f"{API}/orders/{ctx['order']}/complete", headers=hdr(ctx["n2"]))
    assert r.status_code in (403, 404), f"IDOR: unrelated nakes completed order ({r.status_code})"


def test_other_nakes_cannot_write_medical_record(ctx):
    r = requests.post(f"{API}/orders/{ctx['order']}/medical-record", headers=hdr(ctx["n2"]),
                      json={"soap": {"keluhan": "TEST idor"}})
    assert r.status_code in (403, 404), f"IDOR: unrelated nakes wrote medical record ({r.status_code})"


def test_outsider_cannot_read_chat(ctx):
    requests.post(f"{API}/orders/{ctx['order']}/chat", headers=hdr(ctx["p1"]),
                  json={"pesan": "TEST private"})
    r = requests.get(f"{API}/orders/{ctx['order']}/chat", headers=hdr(ctx["p2"]))
    assert r.status_code in (403, 404) or r.json() == [], "IDOR: outsider read private chat"


def test_other_patient_cannot_pay_order(ctx):
    r = requests.post(f"{API}/orders/{ctx['order']}/payment", headers=hdr(ctx["p2"]),
                      json={"metode_pembayaran": "cash"})
    assert r.status_code in (403, 404), f"IDOR: other patient paid someone's order ({r.status_code})"


def test_brute_force_lockout():
    codes = []
    for _ in range(7):
        codes.append(requests.post(f"{API}/auth/login", json={
            "email": "admin@homecare.id", "password": "bad-pass"}).status_code)
    assert 429 in codes, f"No brute-force lockout; codes={codes}"
