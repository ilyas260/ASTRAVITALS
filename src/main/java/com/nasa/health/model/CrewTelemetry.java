package com.nasa.health.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "crew_telemetry")
public class CrewTelemetry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "recorded_at", nullable = false)
    private Long recordedAt;

    private String source;

    @Column(name = "heart_rate")
    private Double heartRate;

    @Column(name = "stress_index")
    private Double stressIndex;

    private Double spo2;
    private Double hrv;
    private Double hemoglobin;
    private Double wbc;
    private Double mch;

    @Column(name = "bp_systolic")
    private Double bpSystolic;

    @Column(name = "bp_diastolic")
    private Double bpDiastolic;

    private String notes;

    @Column(name = "logged_by")
    private String loggedBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Integer getId() { return id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public Long getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Long recordedAt) { this.recordedAt = recordedAt; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Double getHeartRate() { return heartRate; }
    public void setHeartRate(Double heartRate) { this.heartRate = heartRate; }
    public Double getStressIndex() { return stressIndex; }
    public void setStressIndex(Double stressIndex) { this.stressIndex = stressIndex; }
    public Double getSpo2() { return spo2; }
    public void setSpo2(Double spo2) { this.spo2 = spo2; }
    public Double getHrv() { return hrv; }
    public void setHrv(Double hrv) { this.hrv = hrv; }
    public Double getHemoglobin() { return hemoglobin; }
    public void setHemoglobin(Double hemoglobin) { this.hemoglobin = hemoglobin; }
    public Double getWbc() { return wbc; }
    public void setWbc(Double wbc) { this.wbc = wbc; }
    public Double getMch() { return mch; }
    public void setMch(Double mch) { this.mch = mch; }
    public Double getBpSystolic() { return bpSystolic; }
    public void setBpSystolic(Double bpSystolic) { this.bpSystolic = bpSystolic; }
    public Double getBpDiastolic() { return bpDiastolic; }
    public void setBpDiastolic(Double bpDiastolic) { this.bpDiastolic = bpDiastolic; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getLoggedBy() { return loggedBy; }
    public void setLoggedBy(String loggedBy) { this.loggedBy = loggedBy; }
}