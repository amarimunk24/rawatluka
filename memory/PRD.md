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
- Notifications bell (polling), in-order chat (polling).
- Security: per-resource ownership checks (IDOR fixed), login rate limiting (5 attempts / 5 min lockout), password min length, duplicate-service guard, payment 500 guard.
- Verified: 57/57 backend functional tests, 7/7 authz probes pass after fixes, full UI journey passed.

## Backlog (P1/P2)
- P1: real file uploads for documents/wound photos (object storage) — currently metadata/URL only.
- P1: real payment gateway (QRIS/Stripe) — currently mocked.
- P2: real map/geolocation (Google Maps) — currently manual coords.
- P2: split server.py into routers; extract dashboard dialogs into components.
- P2: websocket chat instead of polling.

## Notes
- MOCKED: payments (QRIS/Cash simulated), geolocation (manual coordinates + haversine). No real money or GPS map.
