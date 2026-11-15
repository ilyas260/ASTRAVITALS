package com.nasa.health.service;

import com.nasa.health.dto.Metric;
import com.nasa.health.dto.TelemetryPayload;
import com.nasa.health.entity.AstraVitals;
import com.nasa.health.repository.AstraVitalsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class VitalsService {

    @Autowired
    private AstraVitalsRepository repository;

    public void processAndSaveTelemetry(TelemetryPayload payload) {
        AstraVitals record = new AstraVitals();
        record.setSubjectId(payload.getSubject_id());
        record.setTimestamp(payload.getTimestamp());

        if (payload.getMetrics() != null) {
            for (Metric metric : payload.getMetrics()) {
                switch (metric.getAnalyte().toUpperCase()) {
                    case "HEART RATE":
                        record.setHeartRate((int) metric.getValue());
                        if (metric.getValue() > 120) {
                            System.err.println("ALERTE CRITIQUE : Tachycardie (" + metric.getValue() + " BPM) chez " + payload.getSubject_id());
                        }
                        break;
                    case "STRESS INDEX":
                        record.setStressIndex((int) metric.getValue());
                        break;
                    case "HEMOGLOBIN":
                        record.setHemoglobin(metric.getValue());
                        break;
                    case "SPO2":
                        record.setSpo2((int) metric.getValue());
                        break;
                }
            }
        }

        repository.save(record);
        System.out.println("[SPRING BOOT] Echantillon enregistre en BDD pour " + payload.getSubject_id());
    }
}
