# ASTRAVITALS — Autonomous Crew Health & Mission Console

**ASTRAVITALS** is an end-to-end biomedical telemetry and autonomous clinical decision-support console designed for human spaceflight missions (LEO / ISS and Deep Space / Mars).

## System Architecture

1. **IoT Telemetry & Data Cleaning Pipeline (`python-service/app.py`)**
   - Flask ingestion server (Port `5000`) receiving real-time JSON packets from ESP32 biometric sensors (Wokwi simulation).
   - Validates incoming readings against physiological bounds (`METRIC_RULES`), imputes `MISSING` or `OUTLIER` values from the last valid state, and records audit logs.

2. **Persistent Storage (PostgreSQL)**
   - Centralizes time-series telemetry (`crew_telemetry`), crew/flight surgeon accounts (`users`), hardware sensors (`devices`), and medical alerts (`notifications`).

3. **REST API & Backend Orchestration (Java / Spring Boot)**
   - Exposes `/api/...` endpoints (`ChcApiController`, `TelemetryController`) backed by `VitalsService` and Spring Data JPA repositories.

4. **Clinical Dashboard & Autonomous Decision Engine (`src/main/resources/static/`)**
   - **4 Physiological Domains:** Cardio (`HR`, `SpO2`, `HRV`), Bone (`Density`, `NTx`, `uCal`), Behaviour (`Stress`, `Sleep`, `Reaction Time`), and Radiation (`Dose Rate`, `Cumulative Dose`).
   - **EVA Go / No-Go Engine:** Cross-checks multi-system thresholds to clear or block extravehicular activities.
   - **ISS / Mars Latency Mode:** Simulates communication delay (`0.2s` LEO vs. `14m 20s` Mars) and activates local autonomous triage when ground control cannot respond in real time.
   - **Flight Surgeon Brief:** Generates printable clinical status reports and triggers live countermeasure protocols.

## Quick Start

### 1. Start the Python IoT Ingestion Service
```bash
cd python-service
pip install flask flask-cors psycopg2-binary
python app.py
```

### 2. Run the Spring Boot Backend
```bash
mvn spring-boot:run
```

### 3. Open the Mission Console
- **Crew / Flight Surgeon Login:** `http://localhost:8080/index.html`
- **Telemetry Pipeline Monitor:** `http://localhost:5000/`
