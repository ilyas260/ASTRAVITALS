package com.nasa.health.controller;

import com.nasa.health.dto.*;
import com.nasa.health.model.*;
import com.nasa.health.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@SuppressWarnings({"unchecked", "rawtypes"})
public class ChcApiController {

    private final AppUserRepository userRepo;
    private final CrewTelemetryRepository telemetryRepo;
    private final DeviceRepository deviceRepo;
    private final AppNotificationRepository notifRepo;

    private static final List<String> ALL_METRICS = List.of(
        "hr", "bp", "spo2", "density", "ntx", "ucal", "dose", "cum", "lymph", "sleep", "stress", "react"
    );

    public ChcApiController(AppUserRepository userRepo,
                            CrewTelemetryRepository telemetryRepo,
                            DeviceRepository deviceRepo,
                            AppNotificationRepository notifRepo) {
        this.userRepo = userRepo;
        this.telemetryRepo = telemetryRepo;
        this.deviceRepo = deviceRepo;
        this.notifRepo = notifRepo;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<SessionResponse> login(@RequestBody LoginRequest req) {
        if (req.id() == null || req.id().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID required");
        }
        String key = req.id().trim();
        AppUser user = userRepo.findByIdOrRegistrationNumber(key, key)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (req.password() != null && !user.getPasswordHash().equals(req.password())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid password");
        }

        String sessionRole = "ADMIN".equalsIgnoreCase(user.getRoleType()) ? "admin" : "user";
        return ResponseEntity.ok(new SessionResponse(
            user.getId(),
            user.getRegistrationNumber(),
            user.getFullName(),
            sessionRole,
            UUID.randomUUID().toString()
        ));
    }

    @GetMapping("/api/crew")
    public List<CrewMemberDto> getAllCrew() {
        return userRepo.findByRoleType("CREW").stream().map(this::toCrewDto).toList();
    }

    @GetMapping("/api/crew/{id}")
    public CrewMemberDto getCrewMember(@PathVariable String id) {
        AppUser user = userRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Crew member not found"));
        return toCrewDto(user);
    }

    @GetMapping("/api/admins")
    public List getAdmins() {
        List list = new ArrayList();
        for (AppUser a : userRepo.findByRoleType("ADMIN")) {
            Map m = new LinkedHashMap();
            m.put("id", a.getId());
            m.put("reg", a.getRegistrationNumber());
            m.put("name", a.getFullName());
            m.put("role", "Flight surgeon");
            m.put("admin", true);
            list.add(m);
        }
        return list;
    }

    @PostMapping("/api/crew/{id}/readings")
    public ResponseEntity<ReadingPointDto> addManualReading(@PathVariable String id,
                                                            @RequestBody CreateReadingRequest req) {
        if (!userRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Crew member not found");
        }
        long ts = req.t() != null ? req.t() : System.currentTimeMillis();
        CrewTelemetry row = new CrewTelemetry();
        row.setUserId(id);
        row.setRecordedAt(ts);
        row.setSource(req.src() != null ? req.src() : "Manual");
        row.setNotes(req.notes() != null ? req.notes() : "");
        if (req.loggedBy() != null && userRepo.existsById(req.loggedBy())) {
            row.setLoggedBy(req.loggedBy());
        }

        String m = req.metric() != null ? req.metric() : "";
        if ("hr".equals(m)) {
            row.setHeartRate(req.v());
        } else if ("bp".equals(m)) {
            row.setBpSystolic(req.v());
            row.setBpDiastolic(req.v2());
        } else if ("spo2".equals(m)) {
            row.setSpo2(req.v());
        } else if ("stress".equals(m)) {
            row.setStressIndex(req.v());
        } else {
            row.setNotes((row.getNotes() + " [" + m + "=" + req.v() + "]").trim());
        }

        telemetryRepo.save(row);
        checkAndCreateAlerts(row);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new ReadingPointDto(ts, req.v(), req.v2(), row.getSource(), row.getNotes()));
    }

    @PostMapping("/api/crew/{id}/custom")
    public ResponseEntity addCustomReading(@PathVariable String id,
                                                @RequestBody Map req) {
        if (!userRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Crew member not found");
        }
        long ts = req.get("t") != null ? Long.parseLong(String.valueOf(req.get("t"))) : System.currentTimeMillis();
        String name = String.valueOf(req.getOrDefault("name", "")).toUpperCase().trim();
        double val = Double.parseDouble(String.valueOf(req.get("v")));
        String unit = String.valueOf(req.getOrDefault("unit", ""));
        String notes = String.valueOf(req.getOrDefault("notes", ""));

        CrewTelemetry row = new CrewTelemetry();
        row.setUserId(id);
        row.setRecordedAt(ts);
        row.setSource("Manual");
        row.setNotes(notes);

        if ("HRV".equals(name)) {
            row.setHrv(val);
        } else if ("HEMOGLOBIN".equals(name)) {
            row.setHemoglobin(val);
        } else if ("WBC".equals(name)) {
            row.setWbc(val);
        } else if ("MCH".equals(name)) {
            row.setMch(val);
        } else {
            row.setNotes((notes + " [" + name + "=" + val + " " + unit + "]").trim());
        }

        telemetryRepo.save(row);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("t", ts, "name", name, "v", val, "unit", unit, "notes", notes));
    }

    private void checkAndCreateAlerts(CrewTelemetry r) {
        if (r.getHeartRate() != null && (r.getHeartRate() > 105 || r.getHeartRate() < 42)) {
            AppNotification n = new AppNotification();
            n.setUserId(r.getUserId());
            n.setTitle("Heart rate out of range");
            n.setMessage("Heart rate measured at " + r.getHeartRate() + " bpm");
            n.setIsRead(false);
            notifRepo.save(n);
        }
    }

    private CrewMemberDto toCrewDto(AppUser u) {
        Map data = new LinkedHashMap();
        for (String k : ALL_METRICS) {
            data.put(k, new ArrayList());
        }
        List custom = new ArrayList();

        for (CrewTelemetry r : telemetryRepo.findByUserIdOrderByRecordedAtAsc(u.getId())) {
            long t = r.getRecordedAt();
            String src = r.getSource() != null ? r.getSource() : "Sensor";
            String notes = r.getNotes() != null ? r.getNotes() : "";

            if (r.getHeartRate() != null) ((List) data.get("hr")).add(new ReadingPointDto(t, r.getHeartRate(), null, src, notes));
            if (r.getBpSystolic() != null) ((List) data.get("bp")).add(new ReadingPointDto(t, r.getBpSystolic(), r.getBpDiastolic(), src, notes));
            if (r.getSpo2() != null) ((List) data.get("spo2")).add(new ReadingPointDto(t, r.getSpo2(), null, src, notes));
            if (r.getStressIndex() != null) ((List) data.get("stress")).add(new ReadingPointDto(t, r.getStressIndex(), null, src, notes));

            if (r.getHrv() != null) custom.add(Map.of("t", t, "name", "HRV", "v", r.getHrv(), "unit", "ms", "src", src, "notes", notes));
            if (r.getHemoglobin() != null) custom.add(Map.of("t", t, "name", "HEMOGLOBIN", "v", r.getHemoglobin(), "unit", "g/dL", "src", src, "notes", notes));
            if (r.getWbc() != null) custom.add(Map.of("t", t, "name", "WBC", "v", r.getWbc(), "unit", "10^3/uL", "src", src, "notes", notes));
            if (r.getMch() != null) custom.add(Map.of("t", t, "name", "MCH", "v", r.getMch(), "unit", "pg", "src", src, "notes", notes));
        }

        return new CrewMemberDto(
            u.getId(),
            u.getFirstName() != null ? u.getFirstName() : u.getId(),
            "Crew member",
            142,
            u.getFullName(),
            u.getRegistrationNumber(),
            data,
            custom,
            deviceRepo.findByUserId(u.getId()),
            notifRepo.findByUserIdOrderByCreatedAtDesc(u.getId())
        );
    }
}