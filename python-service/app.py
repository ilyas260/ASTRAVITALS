from datetime import datetime, timezone
import psycopg2
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# --- CONFIGURATION ---
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "ASTRAVITALS",
    "user": "postgres",
    "password": "Ilyas2006@@"
}

ASTRONAUT_MAP = {
    "Astra-01": "0000001",
    "Astra-02": "0000002",
}

# --- PHYSIOLOGICAL BOUNDARIES ---
METRIC_RULES = {
    "heart_rate":   {"min": 35.0,  "max": 210.0, "default": 72.0,  "decimals": 1},
    "stress_index": {"min": 0.0,   "max": 100.0, "default": 25.0,  "decimals": 1},
    "spo2":         {"min": 75.0,  "max": 100.0, "default": 98.0,  "decimals": 1},
    "hrv":          {"min": 5.0,   "max": 250.0, "default": 55.0,  "decimals": 1},
    "hemoglobin":   {"min": 5.0,   "max": 22.0,  "default": 14.5,  "decimals": 2},
    "wbc":          {"min": 1.0,   "max": 30.0,  "default": 6.5,   "decimals": 2},
    "mch":          {"min": 15.0,  "max": 45.0,  "default": 30.0,  "decimals": 2},
}

last_valid_state = {}
latest_packet = {
    "astronaut": "Astra-01", "timestamp": "Waiting for Wokwi...", "raw_type": "N/A",
    "heart_rate": 0, "stress_index": 0, "spo2": 0, "hrv": 0, "hemoglobin": 0, "wbc": 0, "mch": 0,
    "db_status": "Waiting for transmission...", "cleaning_logs": []
}

def iso_to_epoch_ms(iso_str):
    if not iso_str: return int(datetime.now(timezone.utc).timestamp() * 1000)
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except ValueError:
        return int(datetime.now(timezone.utc).timestamp() * 1000)

def extract_raw_metrics(payload):
    raw = {k: None for k in METRIC_RULES.keys()}
    mapping = {
        "HEART RATE": "heart_rate", "STRESS INDEX": "stress_index", "SPO2": "spo2",
        "HRV": "hrv", "HEMOGLOBIN": "hemoglobin", "WBC": "wbc", "MCH": "mch",
    }
    if isinstance(payload.get("metrics"), list):
        for item in payload["metrics"]:
            analyte = str(item.get("analyte", "")).upper().strip()
            if analyte in mapping:
                raw[mapping[analyte]] = item.get("value")
    return raw

def clean_and_impute_data(astro_id, raw_metrics):
    if astro_id not in last_valid_state:
        last_valid_state[astro_id] = {k: v["default"] for k, v in METRIC_RULES.items()}

    cleaned = {}
    audit_logs = []

    for key, rules in METRIC_RULES.items():
        raw_val = raw_metrics.get(key)
        fallback_val = last_valid_state[astro_id][key]

        if raw_val is None:
            cleaned[key] = fallback_val
            audit_logs.append(f"🔧 [MISSING] {key.upper()} was NULL -> Imputed ({fallback_val})")
            continue

        try:
            num_val = float(raw_val)
        except (ValueError, TypeError):
            cleaned[key] = fallback_val
            audit_logs.append(f"🔧 [CORRUPTED] {key.upper()} invalid -> Replaced ({fallback_val})")
            continue

        if num_val < rules["min"] or num_val > rules["max"]:
            cleaned[key] = fallback_val
            audit_logs.append(f"🚨 [OUTLIER] {key.upper()} = {num_val} out of bounds -> Fixed to {fallback_val}")
        else:
            clean_num = round(num_val, rules["decimals"])
            cleaned[key] = clean_num
            last_valid_state[astro_id][key] = clean_num

    return cleaned, audit_logs

def save_direct_to_postgres(data, audit_logs):
    raw_astro = data.get("astronaut") or "Astra-01"
    user_id = ASTRONAUT_MAP.get(raw_astro, "0000001")
    ts_ms = iso_to_epoch_ms(data.get("timestamp"))

    notes = f"Wokwi ESP32 [CLEANED: {len(audit_logs)} anomalies fixed]" if audit_logs else f"Wokwi ESP32 (Clean)"

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO crew_telemetry (
                        user_id, recorded_at, source,
                        heart_rate, stress_index, spo2, hrv, hemoglobin, wbc, mch, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id, ts_ms, "Sensor",
                        data.get("heart_rate"), data.get("stress_index"),
                        data.get("spo2"), data.get("hrv"),
                        data.get("hemoglobin"), data.get("wbc"),
                        data.get("mch"), notes
                    )
                )
        return user_id
    finally:
        conn.close()

@app.route("/sensor", methods=["POST"])
@app.route("/api/sensor", methods=["POST"])
def receive_wokwi_sensor():
    global latest_packet
    payload = request.get_json(force=True, silent=True) or {}
    if not payload: return jsonify({"error": "Invalid JSON"}), 400

    astro_id = payload.get("subject_id", "Astra-01")
    ts_val = payload.get("timestamp", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    pkt_type = payload.get("packet_type", "UNKNOWN")

    raw_metrics = extract_raw_metrics(payload)
    cleaned_metrics, audit_logs = clean_and_impute_data(astro_id, raw_metrics)

    latest_packet = {
        "astronaut": astro_id, "timestamp": ts_val, "raw_type": pkt_type,
        **cleaned_metrics, "cleaning_logs": audit_logs, "db_status": "Saving..."
    }

    try:
        user_id = save_direct_to_postgres(latest_packet, audit_logs)
        latest_packet["db_status"] = f"✅ PostgreSQL OK : All metrics saved to crew_telemetry (User: {user_id})"
        return jsonify({"status": "cleaned_and_saved", "data": latest_packet}), 201
    except Exception as e:
        print(f"DB Error: {str(e)}")
        latest_packet["db_status"] = f"❌ DB Error: {str(e)}"
        return jsonify({"error": str(e)}), 500

@app.route("/")
def live_view():
    html = """
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8"><meta http-equiv="refresh" content="3">
      <title>Pipeline Monitor</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f8fafc; padding: 24px; }
        .badge { padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; }
        .CLEAN { background: #065f46; color: #34d399; }
        .OUTLIER { background: #9a3412; color: #fdba74; }
        .MISSING_DATA { background: #991b1b; color: #fca5a5; }
        .status-bar { background: #1e293b; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 16px 0; font-family: monospace; }
        .audit-box { background: #172033; padding: 14px; border-radius: 8px; border: 1px solid #f59e0b; margin-bottom: 20px; }
        .audit-box li { color: #fcd34d; font-family: monospace; margin: 4px 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .card { background: #1e293b; padding: 16px; border-radius: 12px; border: 1px solid #334155; }
        .cap { font-size: 12px; color: #94a3b8; letter-spacing: 1px; }
        .val { font-size: 24px; font-weight: 700; margin-top: 6px; color: #38bdf8; }
      </style>
    </head>
    <body>
      <h2>🛡️ AstraVitals Pipeline</h2>
      <p>Astronaut: <b>{{ p.astronaut }}</b> | Packet: <span class="badge {{ p.raw_type }}">{{ p.raw_type }}</span></p>
      <div class="status-bar">{{ p.db_status }}</div>
      {% if p.cleaning_logs %}
      <div class="audit-box"><b>⚠️ Anomalies fixed:</b><ul>{% for log in p.cleaning_logs %}<li>{{ log }}</li>{% endfor %}</ul></div>
      {% endif %}
      <div class="grid">
        <div class="card"><div class="cap">HEART RATE</div><div class="val">{{ p.heart_rate }} bpm</div></div>
        <div class="card"><div class="cap">SPO2</div><div class="val">{{ p.spo2 }} %</div></div>
        <div class="card"><div class="cap">STRESS INDEX</div><div class="val">{{ p.stress_index }} /100</div></div>
        <div class="card"><div class="cap">HRV</div><div class="val">{{ p.hrv }} ms</div></div>
        <div class="card"><div class="cap">HEMOGLOBIN</div><div class="val">{{ p.hemoglobin }} g/dL</div></div>
        <div class="card"><div class="cap">WBC</div><div class="val">{{ p.wbc }} 10^3</div></div>
        <div class="card"><div class="cap">MCH</div><div class="val">{{ p.mch }} pg</div></div>
      </div>
    </body>
    </html>
    """
    return render_template_string(html, p=latest_packet)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)