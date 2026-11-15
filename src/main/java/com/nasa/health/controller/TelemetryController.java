package com.nasa.health.controller;

import com.nasa.health.dto.TelemetryPayload;
import com.nasa.health.entity.AstraVitals;
import com.nasa.health.repository.AstraVitalsRepository;
import com.nasa.health.service.VitalsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/telemetry")
@CrossOrigin(origins = "*")
public class TelemetryController {

    @Autowired
    private VitalsService vitalsService;

    @Autowired
    private AstraVitalsRepository repository;

    // 1. Reçoit les données de Flask / ESP32 (déjà en place)
    @PostMapping
    public ResponseEntity<String> receiveDataFromFlask(@RequestBody TelemetryPayload payload) {
        vitalsService.processAndSaveTelemetry(payload);
        return ResponseEntity.ok("Données traitées et sauvegardées");
    }

    // 2. Pour user.html : récupère la dernière mesure en temps réel
    @GetMapping("/latest")
    public ResponseEntity<AstraVitals> getLatestVitals() {
        AstraVitals latest = repository.findTopByOrderByIdDesc();
        return latest != null ? ResponseEntity.ok(latest) : ResponseEntity.noContent().build();
    }

    // 3. Pour admin.html : récupère tout l'historique médical
    @GetMapping("/history")
    public List<AstraVitals> getAllHistory() {
        return repository.findAll();
    }
}