# HomeCare Indonesia — PRD

## Problem Statement
Build a web app based on provided documents (SRS, Blueprint, ERD, BPMN, Flowchart) describing "Home Care Indonesia": a healthcare home-care marketplace connecting patients with healthcare providers (Nakes / tenaga kesehatan) by location. Three roles: Patient, Nakes, Admin. UI in Bahasa Indonesia, responsive on mobile & laptop.

## Architecture
- Backend: FastAPI (single `server.py`), MongoDB (motor), UUID string ids. JWT (Bearer) auth + Emergent Google OAuth (unified into own JWT). Haversine distance for mock geolocation.
- Frontend: React (CRA + craco `@` alias), TailwindCSS, shadcn/ui, sonner toasts, lucide icons, Plus Jakarta Sans + Inter fonts. Emerald/slate healthcare theme.
- Payments: mock QRIS + Cash (Stripe NOT available — Indonesia unsupported by Stripe). Admin verifies payments; 15% platform commission.

## User Personas
- Pasien: books home-care services, pays, views medical records, reviews.
- Nakes: sets profile/location/services/tariffs/documents, toggles online, accepts orders, fills SOAP records, tracks income.
- Admin (admin@homecare.id / admin123): verifies nakes & documents, verifies payments, manages services, views platform stats & patients.

## Core Requirements (static)
Auth & roles · provider search by radius/service/rating · booking with schedule · order lifecycle (pending→accepted/rejected→completed) · SOAP medical records + vital signs · mock payments + admin verification · reviews & ratings · in-order chat · notifications · admin verification & dashboards.

## Implemented (2026-06)
- Full 3-role auth (JWT + Google), landing page, role-based dashboards.
- Patient: search, booking (calendar+time), orders, payment (QRIS/Cash), review, medical record viewer + print, profile with coords.
- Nakes: overview/income, incoming orders + accept/reject, SOAP form, services & tariffs, legal documents, profile/location/online toggle.
- Admin: platform stats, nakes verification (+document verify), payment/transaction verification, service management, patient list.
- Notifications bell (polling), in-order chat (polling 2.5s).
- Security: per-resource ownership checks (IDOR fixed), login rate limiting (5 attempts / 5 min lockout), password min length, duplicate-service guard, payment 500 guard.

## Iteration 2 (2026-06) — added
- **Real file uploads** via Emergent object storage: nakes STR/SIP/certificate photos & wound/medical-record photos. Endpoints POST /api/upload, GET /api/files/{path} (JWT via header or ?auth=). File-serving now authorizes owner / admin / record-owning patient (PHI protection verified). Storage calls offloaded via run_in_threadpool.
- **Interactive maps** (react-leaflet 5.0.0 + OpenStreetMap, no API key): patient search map with self + nakes markers (jittered when overlapping); click-to-pick coordinates on patient search and nakes profile.
- **More real-time chat**: 2.5s polling while dialog open.
- Verified: 86/86 backend tests (22 new + 57 regression + 7 authz), 100% frontend flows.
- NOTE: react-leaflet MUST stay >=5.0.0 (4.x crashes under React 19).

## Iteration 3 (2026-06) — added
- **Ekspor PDF Rekam Medis**: GET /api/orders/{oid}/medical-record/pdf (reportlab) — PDF berlogo HomeCare.id berisi info pasien/nakes, diagnosis/tindakan, SOAP + tabel tanda vital. Ownership-protected (owner patient/nakes/admin). Frontend: tombol "Unduh PDF" (blob) di viewer rekam medis. Verified: 200 application/pdf, valid %PDF header.
- **Rute ke Lokasi**: tombol di kartu pesanan nakes (status accepted) membuka Google Maps directions ke koordinat rumah pasien (tanpa API key).

## Pending integrations (need user API keys)
- WhatsApp (Twilio) — awaiting Account SID, Auth Token, WhatsApp sender.
- Real QRIS (Midtrans Snap `other_qris` + webhook) — awaiting Sandbox Server Key & Client Key; webhook will be {BACKEND}/api/payments/midtrans/webhook.

## Notes
- MOCKED: payments (QRIS/Cash simulated), geolocation (manual coordinates + haversine). No real money or GPS map.
