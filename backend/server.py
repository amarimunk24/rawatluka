from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import math
import logging
import bcrypt
import jwt
import requests

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
PLATFORM_COMMISSION = 0.15
TRANSPORT_RATE_PER_KM = 3000  # Rupiah per km
LOGIN_ATTEMPTS = {}
LOCKOUT_SECONDS = 300

app = FastAPI(title="Home Care Indonesia API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("homecare")


# ---------------- Helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def clean(doc):
    if doc:
        doc.pop("_id", None)
    return doc


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Pengguna tidak ditemukan")
    user.pop("password_hash", None)
    return user


def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Akses ditolak untuk peran ini")
        return user
    return checker


async def notify(user_id, judul, isi, tipe="info"):
    await db.notifications.insert_one({
        "id": new_id("notif"), "user_id": user_id, "judul": judul,
        "isi_pesan": isi, "tipe_notifikasi": tipe, "status_baca": False,
        "waktu_kirim": now_iso(),
    })


async def build_user(user: dict) -> dict:
    """Attach role-specific profile."""
    user = clean(dict(user))
    user.pop("password_hash", None)
    if user["role"] == "patient":
        user["profile"] = clean(await db.patients.find_one({"user_id": user["id"]}))
    elif user["role"] == "nakes":
        n = clean(await db.nakes.find_one({"user_id": user["id"]}))
        if n:
            n["services"] = await db.nakes_services.find({"nakes_id": n["id"]}, {"_id": 0}).to_list(100)
            n["documents"] = await db.nakes_documents.find({"nakes_id": n["id"]}, {"_id": 0}).to_list(100)
        user["profile"] = n
    return user


# ---------------- Models ----------------
class RegisterReq(BaseModel):
    nama_lengkap: str
    email: EmailStr
    nomor_hp: str
    password: str
    role: str  # patient | nakes


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class GoogleReq(BaseModel):
    session_id: str


class PatientProfileReq(BaseModel):
    tanggal_lahir: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alamat: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    kontak_darurat: Optional[str] = None
    riwayat_penyakit: Optional[str] = None
    alergi: Optional[str] = None
    obat_rutin: Optional[str] = None
    foto_profil: Optional[str] = None


class NakesProfileReq(BaseModel):
    gelar: Optional[str] = None
    spesialisasi: Optional[str] = None
    pengalaman_tahun: Optional[int] = None
    deskripsi_bio: Optional[str] = None
    alamat: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_layanan: Optional[int] = None
    foto_profil: Optional[str] = None


class StatusReq(BaseModel):
    status_online: bool


class NakesServiceReq(BaseModel):
    service_id: str
    tarif_nakes: float
    durasi_estimasi: int


class DocumentReq(BaseModel):
    jenis_dokumen: str  # STR | SIP | Sertifikat
    nomor_dokumen: str
    tanggal_valid: str
    file_url: Optional[str] = None


class OrderReq(BaseModel):
    nakes_id: str
    service_id: str
    jadwal_kunjungan: str
    catatan_pasien: Optional[str] = None
    alamat: str
    latitude: float
    longitude: float


class RespondReq(BaseModel):
    action: str  # accept | reject


class SOAP(BaseModel):
    keluhan: Optional[str] = None
    tekanan_darah: Optional[str] = None
    nadi: Optional[str] = None
    respirasi: Optional[str] = None
    suhu: Optional[str] = None
    spo2: Optional[str] = None
    kondisi_luka: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None


class MedicalRecordReq(BaseModel):
    diagnosis: Optional[str] = None
    tindakan: Optional[str] = None
    catatan_tambahan: Optional[str] = None
    soap: SOAP
    attachments: List[str] = []


class PaymentReq(BaseModel):
    metode_pembayaran: str  # qris | cash
    bukti_transfer: Optional[str] = None


class ReviewReq(BaseModel):
    rating: int
    komentar: Optional[str] = None


class ChatReq(BaseModel):
    pesan: str


class ServiceReq(BaseModel):
    nama_layanan: str
    kategori: str
    deskripsi: str
    tarif_dasar: float


# ---------------- Auth ----------------
@api.post("/auth/register")
async def register(req: RegisterReq):
    if req.role not in ("patient", "nakes"):
        raise HTTPException(400, "Peran tidak valid")
    if len(req.password) < 6:
        raise HTTPException(400, "Kata sandi minimal 6 karakter")
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    uid = new_id("user")
    await db.users.insert_one({
        "id": uid, "nama_lengkap": req.nama_lengkap, "email": email,
        "nomor_hp": req.nomor_hp, "password_hash": hash_password(req.password),
        "role": req.role, "foto_profil": None, "status_akun": "aktif",
        "auth_provider": "email", "created_at": now_iso(), "updated_at": now_iso(),
    })
    if req.role == "patient":
        await db.patients.insert_one({"id": new_id("pat"), "user_id": uid})
    else:
        await db.nakes.insert_one({
            "id": new_id("nak"), "user_id": uid, "spesialisasi": "",
            "status_verifikasi": "pending", "status_online": False,
            "rating_rata_rata": 0, "jumlah_review": 0, "radius_layanan": 10,
            "latitude": None, "longitude": None,
        })
    token = create_token(uid, req.role)
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    return {"token": token, "user": await build_user(user)}


@api.post("/auth/login")
async def login(req: LoginReq):
    email = req.email.lower()
    now = datetime.now(timezone.utc)
    rec = LOGIN_ATTEMPTS.get(email)
    if rec and rec["count"] >= 5 and (now - rec["last"]).total_seconds() < LOCKOUT_SECONDS:
        raise HTTPException(429, "Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        prev = LOGIN_ATTEMPTS.get(email, {"count": 0})
        LOGIN_ATTEMPTS[email] = {"count": prev["count"] + 1, "last": now}
        raise HTTPException(401, "Email atau kata sandi salah")
    LOGIN_ATTEMPTS.pop(email, None)
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": await build_user(user)}


@api.post("/auth/google")
async def google_auth(req: GoogleReq):
    try:
        r = requests.get(os.environ["EMERGENT_AUTH_URL"],
                         headers={"X-Session-ID": req.session_id}, timeout=15)
    except Exception:
        raise HTTPException(502, "Gagal menghubungi layanan autentikasi")
    if r.status_code != 200:
        raise HTTPException(401, "Sesi Google tidak valid")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        uid = new_id("user")
        await db.users.insert_one({
            "id": uid, "nama_lengkap": data.get("name", email), "email": email,
            "nomor_hp": "", "password_hash": None, "role": "patient",
            "foto_profil": data.get("picture"), "status_akun": "aktif",
            "auth_provider": "google", "created_at": now_iso(), "updated_at": now_iso(),
        })
        await db.patients.insert_one({"id": new_id("pat"), "user_id": uid})
        user = await db.users.find_one({"id": uid})
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": await build_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return await build_user(user)


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------- Profiles ----------------
@api.put("/patient/profile")
async def update_patient(req: PatientProfileReq, user: dict = Depends(require_role("patient"))):
    data = {k: v for k, v in req.dict().items() if v is not None}
    upd = {k: v for k, v in data.items() if k != "foto_profil"}
    await db.patients.update_one({"user_id": user["id"]}, {"$set": upd}, upsert=True)
    if data.get("foto_profil"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"foto_profil": data["foto_profil"]}})
    fresh = await db.users.find_one({"id": user["id"]})
    return await build_user(fresh)


@api.put("/nakes/profile")
async def update_nakes(req: NakesProfileReq, user: dict = Depends(require_role("nakes"))):
    data = {k: v for k, v in req.dict().items() if v is not None}
    upd = {k: v for k, v in data.items() if k != "foto_profil"}
    await db.nakes.update_one({"user_id": user["id"]}, {"$set": upd}, upsert=True)
    if data.get("foto_profil"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"foto_profil": data["foto_profil"]}})
    fresh = await db.users.find_one({"id": user["id"]})
    return await build_user(fresh)


@api.put("/nakes/status")
async def toggle_status(req: StatusReq, user: dict = Depends(require_role("nakes"))):
    await db.nakes.update_one({"user_id": user["id"]}, {"$set": {"status_online": req.status_online}})
    return {"status_online": req.status_online}


@api.post("/nakes/services")
async def add_service(req: NakesServiceReq, user: dict = Depends(require_role("nakes"))):
    nak = await db.nakes.find_one({"user_id": user["id"]})
    if not nak:
        raise HTTPException(404, "Profil nakes tidak ditemukan")
    svc = await db.services.find_one({"id": req.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    if await db.nakes_services.find_one({"nakes_id": nak["id"], "service_id": req.service_id}):
        raise HTTPException(400, "Layanan ini sudah Anda tawarkan")
    doc = {"id": new_id("ns"), "nakes_id": nak["id"], "service_id": req.service_id,
           "nama_layanan": svc["nama_layanan"], "kategori": svc["kategori"],
           "tarif_nakes": req.tarif_nakes, "durasi_estimasi": req.durasi_estimasi}
    await db.nakes_services.insert_one(doc)
    return clean(doc)


@api.delete("/nakes/services/{ns_id}")
async def del_service(ns_id: str, user: dict = Depends(require_role("nakes"))):
    await db.nakes_services.delete_one({"id": ns_id})
    return {"ok": True}


@api.post("/nakes/documents")
async def add_document(req: DocumentReq, user: dict = Depends(require_role("nakes"))):
    nak = await db.nakes.find_one({"user_id": user["id"]})
    if not nak:
        raise HTTPException(404, "Profil nakes tidak ditemukan")
    doc = {"id": new_id("doc"), "nakes_id": nak["id"], "jenis_dokumen": req.jenis_dokumen,
           "nomor_dokumen": req.nomor_dokumen, "tanggal_valid": req.tanggal_valid,
           "file_url": req.file_url, "status_verifikasi_admin": "pending", "created_at": now_iso()}
    await db.nakes_documents.insert_one(doc)
    return clean(doc)


@api.get("/nakes/income")
async def nakes_income(user: dict = Depends(require_role("nakes"))):
    nak = await db.nakes.find_one({"user_id": user["id"]})
    txs = await db.transactions.find({"nakes_id": nak["id"]}, {"_id": 0}).to_list(1000)
    total = sum(t["pendapatan_nakes"] for t in txs)
    return {"total_pendapatan": total, "jumlah_transaksi": len(txs), "transaksi": txs}


# ---------------- Services ----------------
@api.get("/services")
async def list_services():
    return await db.services.find({"status_aktif": True}, {"_id": 0}).to_list(200)


# ---------------- Provider search ----------------
@api.get("/providers/search")
async def search_providers(service_id: str, lat: float, lng: float,
                           max_distance: float = 50, min_rating: float = 0,
                           user: dict = Depends(require_role("patient"))):
    offerings = await db.nakes_services.find({"service_id": service_id}, {"_id": 0}).to_list(500)
    result = []
    for off in offerings:
        nak = await db.nakes.find_one({"id": off["nakes_id"]}, {"_id": 0})
        if not nak or nak.get("status_verifikasi") != "verified" or not nak.get("status_online"):
            continue
        if nak.get("latitude") is None or nak.get("longitude") is None:
            continue
        dist = haversine(lat, lng, nak["latitude"], nak["longitude"])
        if dist > max_distance or dist > nak.get("radius_layanan", 50):
            continue
        if nak.get("rating_rata_rata", 0) < min_rating:
            continue
        u = await db.users.find_one({"id": nak["user_id"]}, {"_id": 0})
        result.append({
            "nakes_id": nak["id"], "nama": u["nama_lengkap"], "foto_profil": u.get("foto_profil"),
            "gelar": nak.get("gelar"), "spesialisasi": nak.get("spesialisasi"),
            "pengalaman_tahun": nak.get("pengalaman_tahun"), "deskripsi_bio": nak.get("deskripsi_bio"),
            "rating_rata_rata": nak.get("rating_rata_rata", 0), "jumlah_review": nak.get("jumlah_review", 0),
            "jarak_km": dist, "tarif_nakes": off["tarif_nakes"], "durasi_estimasi": off["durasi_estimasi"],
            "nama_layanan": off["nama_layanan"],
        })
    result.sort(key=lambda x: (x["jarak_km"], -x["rating_rata_rata"]))
    return result


@api.get("/providers/{nakes_id}")
async def provider_detail(nakes_id: str, user: dict = Depends(get_current_user)):
    nak = await db.nakes.find_one({"id": nakes_id}, {"_id": 0})
    if not nak:
        raise HTTPException(404, "Nakes tidak ditemukan")
    u = await db.users.find_one({"id": nak["user_id"]}, {"_id": 0})
    nak["nama"] = u["nama_lengkap"]
    nak["foto_profil"] = u.get("foto_profil")
    nak["services"] = await db.nakes_services.find({"nakes_id": nakes_id}, {"_id": 0}).to_list(100)
    nak["reviews"] = await db.reviews.find({"nakes_id": nakes_id}, {"_id": 0}).sort("tanggal_review", -1).to_list(50)
    return nak


# ---------------- Orders ----------------
async def enrich_order(o):
    o = clean(dict(o))
    pat_user = None
    pat = await db.patients.find_one({"id": o["patient_id"]}, {"_id": 0})
    if pat:
        pat_user = await db.users.find_one({"id": pat["user_id"]}, {"_id": 0})
    o["patient_nama"] = pat_user["nama_lengkap"] if pat_user else "-"
    o["patient_hp"] = pat_user.get("nomor_hp") if pat_user else ""
    nak = await db.nakes.find_one({"id": o.get("nakes_id")}, {"_id": 0})
    if nak:
        nu = await db.users.find_one({"id": nak["user_id"]}, {"_id": 0})
        o["nakes_nama"] = nu["nama_lengkap"] if nu else "-"
        o["nakes_foto"] = nu.get("foto_profil") if nu else None
    o["payment"] = clean(await db.payments.find_one({"order_id": o["id"]}))
    o["has_record"] = await db.medical_records.count_documents({"order_id": o["id"]}) > 0
    o["has_review"] = await db.reviews.count_documents({"order_id": o["id"]}) > 0
    return o


async def get_order_for_user(oid: str, user: dict):
    """Fetch an order and enforce that the caller owns it (patient/nakes) or is admin."""
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if user["role"] == "admin":
        return o
    if user["role"] == "patient":
        pat = await db.patients.find_one({"user_id": user["id"]})
        if not pat or o.get("patient_id") != pat["id"]:
            raise HTTPException(403, "Akses ditolak: bukan pesanan Anda")
    elif user["role"] == "nakes":
        nak = await db.nakes.find_one({"user_id": user["id"]})
        if not nak or o.get("nakes_id") != nak["id"]:
            raise HTTPException(403, "Akses ditolak: bukan pesanan Anda")
    return o


@api.post("/orders")
async def create_order(req: OrderReq, user: dict = Depends(require_role("patient"))):
    pat = await db.patients.find_one({"user_id": user["id"]})
    nak = await db.nakes.find_one({"id": req.nakes_id})
    off = await db.nakes_services.find_one({"nakes_id": req.nakes_id, "service_id": req.service_id}, {"_id": 0})
    if not off:
        raise HTTPException(404, "Nakes tidak menyediakan layanan ini")
    dist = 0
    if nak.get("latitude") is not None:
        dist = haversine(req.latitude, req.longitude, nak["latitude"], nak["longitude"])
    transport = round(dist * TRANSPORT_RATE_PER_KM)
    total = off["tarif_nakes"] + transport
    oid = new_id("ord")
    order = {
        "id": oid, "patient_id": pat["id"], "nakes_id": req.nakes_id, "service_id": req.service_id,
        "nama_layanan": off["nama_layanan"], "tanggal_order": now_iso(),
        "jadwal_kunjungan": req.jadwal_kunjungan, "status_order": "pending",
        "catatan_pasien": req.catatan_pasien, "alamat": req.alamat,
        "latitude": req.latitude, "longitude": req.longitude, "jarak_km": dist,
        "estimasi_biaya": off["tarif_nakes"], "biaya_transport": transport, "total_biaya": total,
    }
    await db.orders.insert_one(order)
    await notify(nak["user_id"], "Pesanan Baru", f"Anda menerima pesanan {off['nama_layanan']} baru.", "order")
    return await enrich_order(order)


@api.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "patient":
        pat = await db.patients.find_one({"user_id": user["id"]})
        q = {"patient_id": pat["id"]}
    elif user["role"] == "nakes":
        nak = await db.nakes.find_one({"user_id": user["id"]})
        q = {"nakes_id": nak["id"]}
    else:
        q = {}
    orders = await db.orders.find(q, {"_id": 0}).sort("tanggal_order", -1).to_list(500)
    return [await enrich_order(o) for o in orders]


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    o = await get_order_for_user(oid, user)
    return await enrich_order(o)


@api.put("/orders/{oid}/respond")
async def respond_order(oid: str, req: RespondReq, user: dict = Depends(require_role("nakes"))):
    o = await get_order_for_user(oid, user)
    status = "accepted" if req.action == "accept" else "rejected"
    await db.orders.update_one({"id": oid}, {"$set": {"status_order": status}})
    pat = await db.patients.find_one({"id": o["patient_id"]})
    msg = "diterima" if status == "accepted" else "ditolak"
    await notify(pat["user_id"], "Status Pesanan", f"Pesanan {o['nama_layanan']} Anda {msg}.", "order")
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    return await enrich_order(o)


@api.put("/orders/{oid}/complete")
async def complete_order(oid: str, user: dict = Depends(require_role("nakes"))):
    await get_order_for_user(oid, user)
    await db.orders.update_one({"id": oid}, {"$set": {"status_order": "completed"}})
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    pat = await db.patients.find_one({"id": o["patient_id"]})
    await notify(pat["user_id"], "Layanan Selesai", f"Layanan {o['nama_layanan']} telah selesai. Silakan lakukan pembayaran & beri ulasan.", "order")
    return await enrich_order(o)


# ---------------- Medical records ----------------
@api.post("/orders/{oid}/medical-record")
async def create_record(oid: str, req: MedicalRecordReq, user: dict = Depends(require_role("nakes"))):
    o = await get_order_for_user(oid, user)
    if await db.medical_records.find_one({"order_id": oid}):
        raise HTTPException(400, "Rekam medis sudah dibuat")
    nak = await db.nakes.find_one({"id": o["nakes_id"]})
    rec = {
        "id": new_id("mr"), "order_id": oid, "patient_id": o["patient_id"], "nakes_id": o["nakes_id"],
        "nama_layanan": o["nama_layanan"], "tanggal_pelayanan": now_iso(),
        "diagnosis": req.diagnosis, "tindakan": req.tindakan, "catatan_tambahan": req.catatan_tambahan,
        "soap": req.soap.dict(), "attachments": req.attachments,
    }
    await db.medical_records.insert_one(rec)
    await db.orders.update_one({"id": oid}, {"$set": {"status_order": "completed"}})
    pat = await db.patients.find_one({"id": o["patient_id"]})
    await notify(pat["user_id"], "Rekam Medis Baru", f"Rekam medis untuk {o['nama_layanan']} telah tersedia.", "medical")
    return clean(rec)


@api.get("/orders/{oid}/medical-record")
async def get_record(oid: str, user: dict = Depends(get_current_user)):
    await get_order_for_user(oid, user)
    rec = await db.medical_records.find_one({"order_id": oid}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Rekam medis belum tersedia")
    return rec


@api.get("/patient/medical-records")
async def patient_records(user: dict = Depends(require_role("patient"))):
    pat = await db.patients.find_one({"user_id": user["id"]})
    recs = await db.medical_records.find({"patient_id": pat["id"]}, {"_id": 0}).sort("tanggal_pelayanan", -1).to_list(500)
    for r in recs:
        nak = await db.nakes.find_one({"id": r["nakes_id"]}, {"_id": 0})
        nu = await db.users.find_one({"id": nak["user_id"]}, {"_id": 0}) if nak else None
        r["nakes_nama"] = nu["nama_lengkap"] if nu else "-"
    return recs


# ---------------- Payments ----------------
@api.post("/orders/{oid}/payment")
async def pay(oid: str, req: PaymentReq, user: dict = Depends(require_role("patient"))):
    o = await get_order_for_user(oid, user)
    if await db.payments.find_one({"order_id": oid}):
        raise HTTPException(400, "Pembayaran sudah dibuat")
    status = "menunggu_verifikasi" if req.metode_pembayaran == "qris" else "pending"
    pay = {
        "id": new_id("pay"), "order_id": oid, "metode_pembayaran": req.metode_pembayaran,
        "jumlah": o["total_biaya"], "bukti_transfer": req.bukti_transfer,
        "status_pembayaran": status, "tanggal_bayar": now_iso(),
    }
    await db.payments.insert_one(pay)
    await notify(user["id"], "Pembayaran Dibuat", f"Pembayaran {req.metode_pembayaran.upper()} sedang menunggu verifikasi admin.", "payment")
    return clean(pay)


@api.put("/payments/{pid}/verify")
async def verify_payment(pid: str, user: dict = Depends(require_role("admin"))):
    p = await db.payments.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    await db.payments.update_one({"id": pid}, {"$set": {"status_pembayaran": "sukses"}})
    o = await db.orders.find_one({"id": p["order_id"]})
    if not o:
        return {"ok": True}
    if not await db.transactions.find_one({"order_id": o["id"]}):
        komisi = round(p["jumlah"] * PLATFORM_COMMISSION)
        await db.transactions.insert_one({
            "id": new_id("trx"), "order_id": o["id"], "nakes_id": o["nakes_id"],
            "total": p["jumlah"], "komisi_platform": komisi,
            "pendapatan_nakes": p["jumlah"] - komisi, "tanggal_transaksi": now_iso(),
        })
    pat = await db.patients.find_one({"id": o["patient_id"]})
    await notify(pat["user_id"], "Pembayaran Terverifikasi", "Pembayaran Anda telah dikonfirmasi. Terima kasih!", "payment")
    return {"ok": True}


# ---------------- Reviews ----------------
@api.post("/orders/{oid}/review")
async def add_review(oid: str, req: ReviewReq, user: dict = Depends(require_role("patient"))):
    o = await get_order_for_user(oid, user)
    if o.get("status_order") != "completed":
        raise HTTPException(400, "Ulasan hanya untuk pesanan yang telah selesai")
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(400, "Rating harus 1-5")
    if await db.reviews.find_one({"order_id": oid}):
        raise HTTPException(400, "Ulasan sudah diberikan")
    pat = await db.patients.find_one({"id": o["patient_id"]})
    pu = await db.users.find_one({"id": pat["user_id"]}, {"_id": 0})
    rev = {"id": new_id("rev"), "order_id": oid, "patient_id": o["patient_id"], "nakes_id": o["nakes_id"],
           "patient_nama": pu["nama_lengkap"], "rating": req.rating, "komentar": req.komentar,
           "tanggal_review": now_iso()}
    await db.reviews.insert_one(rev)
    all_rev = await db.reviews.find({"nakes_id": o["nakes_id"]}, {"_id": 0}).to_list(1000)
    avg = round(sum(r["rating"] for r in all_rev) / len(all_rev), 1)
    await db.nakes.update_one({"id": o["nakes_id"]}, {"$set": {"rating_rata_rata": avg, "jumlah_review": len(all_rev)}})
    nak = await db.nakes.find_one({"id": o["nakes_id"]})
    await notify(nak["user_id"], "Ulasan Baru", f"Anda menerima ulasan {req.rating} bintang.", "review")
    return clean(rev)


# ---------------- Chat ----------------
@api.get("/orders/{oid}/chat")
async def get_chat(oid: str, user: dict = Depends(get_current_user)):
    await get_order_for_user(oid, user)
    msgs = await db.chat_messages.find({"order_id": oid}, {"_id": 0}).sort("waktu_kirim", 1).to_list(500)
    return msgs


@api.post("/orders/{oid}/chat")
async def send_chat(oid: str, req: ChatReq, user: dict = Depends(get_current_user)):
    await get_order_for_user(oid, user)
    msg = {"id": new_id("chat"), "order_id": oid, "sender_id": user["id"],
           "sender_nama": user["nama_lengkap"], "sender_role": user["role"],
           "pesan": req.pesan, "waktu_kirim": now_iso()}
    await db.chat_messages.insert_one(msg)
    return clean(msg)


# ---------------- Notifications ----------------
@api.get("/notifications")
async def get_notifs(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("waktu_kirim", -1).to_list(100)


@api.put("/notifications/{nid}/read")
async def read_notif(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"status_baca": True}})
    return {"ok": True}


# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_nakes = await db.nakes.count_documents({})
    pending_nakes = await db.nakes.count_documents({"status_verifikasi": "pending"})
    total_pasien = await db.patients.count_documents({})
    total_order = await db.orders.count_documents({})
    txs = await db.transactions.find({}, {"_id": 0}).to_list(5000)
    revenue = sum(t["komisi_platform"] for t in txs)
    omzet = sum(t["total"] for t in txs)
    return {"total_nakes": total_nakes, "pending_nakes": pending_nakes,
            "total_pasien": total_pasien, "total_order": total_order,
            "pendapatan_platform": revenue, "total_omzet": omzet}


@api.get("/admin/nakes")
async def admin_nakes(user: dict = Depends(require_role("admin"))):
    res = []
    for nak in await db.nakes.find({}, {"_id": 0}).to_list(1000):
        u = await db.users.find_one({"id": nak["user_id"]}, {"_id": 0})
        nak["nama"] = u["nama_lengkap"] if u else "-"
        nak["email"] = u["email"] if u else "-"
        nak["documents"] = await db.nakes_documents.find({"nakes_id": nak["id"]}, {"_id": 0}).to_list(50)
        nak["services"] = await db.nakes_services.find({"nakes_id": nak["id"]}, {"_id": 0}).to_list(50)
        res.append(nak)
    return res


@api.put("/admin/nakes/{nakes_id}/verify")
async def verify_nakes(nakes_id: str, req: RespondReq, user: dict = Depends(require_role("admin"))):
    status = "verified" if req.action == "accept" else "rejected"
    await db.nakes.update_one({"id": nakes_id}, {"$set": {"status_verifikasi": status}})
    nak = await db.nakes.find_one({"id": nakes_id})
    msg = "disetujui" if status == "verified" else "ditolak"
    await notify(nak["user_id"], "Verifikasi Akun", f"Akun nakes Anda telah {msg} oleh admin.", "verifikasi")
    return {"status_verifikasi": status}


@api.put("/admin/documents/{doc_id}/verify")
async def verify_document(doc_id: str, req: RespondReq, user: dict = Depends(require_role("admin"))):
    status = "verified" if req.action == "accept" else "rejected"
    await db.nakes_documents.update_one({"id": doc_id}, {"$set": {"status_verifikasi_admin": status}})
    return {"status_verifikasi_admin": status}


@api.get("/admin/patients")
async def admin_patients(user: dict = Depends(require_role("admin"))):
    res = []
    for p in await db.patients.find({}, {"_id": 0}).to_list(2000):
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
        if u:
            p["nama"] = u["nama_lengkap"]; p["email"] = u["email"]; p["nomor_hp"] = u.get("nomor_hp")
        res.append(p)
    return res


@api.get("/admin/transactions")
async def admin_transactions(user: dict = Depends(require_role("admin"))):
    payments = await db.payments.find({}, {"_id": 0}).sort("tanggal_bayar", -1).to_list(1000)
    for p in payments:
        o = await db.orders.find_one({"id": p["order_id"]}, {"_id": 0})
        p["nama_layanan"] = o["nama_layanan"] if o else "-"
    return payments


@api.post("/admin/services")
async def create_service(req: ServiceReq, user: dict = Depends(require_role("admin"))):
    doc = {"id": new_id("svc"), "nama_layanan": req.nama_layanan, "kategori": req.kategori,
           "deskripsi": req.deskripsi, "tarif_dasar": req.tarif_dasar, "status_aktif": True}
    await db.services.insert_one(doc)
    return clean(doc)


# ---------------- Startup seed ----------------
DEFAULT_SERVICES = [
    ("Perawatan Luka", "Perawatan", "Perawatan luka pasca operasi, luka diabetes, dan ganti perban.", 150000),
    ("Pemasangan Infus", "Tindakan Medis", "Pemasangan dan penggantian infus di rumah.", 175000),
    ("Injeksi / Suntik", "Tindakan Medis", "Pemberian obat injeksi sesuai resep dokter.", 100000),
    ("Perawatan Lansia", "Perawatan", "Pendampingan dan perawatan harian untuk lansia.", 250000),
    ("Fisioterapi", "Rehabilitasi", "Terapi fisik untuk pemulihan gerak dan nyeri.", 200000),
    ("Perawatan Ibu & Bayi", "Perawatan", "Perawatan pasca melahirkan untuk ibu dan bayi.", 300000),
    ("Cek Kesehatan (Vital Sign)", "Pemeriksaan", "Pemeriksaan tekanan darah, gula darah, dan tanda vital.", 120000),
    ("Pasang Kateter", "Tindakan Medis", "Pemasangan dan perawatan kateter urin.", 180000),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    # seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id("user"), "nama_lengkap": "Administrator", "email": admin_email,
            "nomor_hp": "-", "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "role": "admin", "foto_profil": None, "status_akun": "aktif",
            "auth_provider": "email", "created_at": now_iso(), "updated_at": now_iso(),
        })
    elif not verify_password(os.environ["ADMIN_PASSWORD"], existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(os.environ["ADMIN_PASSWORD"])}})
    # seed services
    if await db.services.count_documents({}) == 0:
        for nama, kat, desc, tarif in DEFAULT_SERVICES:
            await db.services.insert_one({"id": new_id("svc"), "nama_layanan": nama, "kategori": kat,
                                          "deskripsi": desc, "tarif_dasar": tarif, "status_aktif": True})
    logger.info("Startup seeding complete")


@api.get("/")
async def root():
    return {"message": "Home Care Indonesia API"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
