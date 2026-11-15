package com.nasa.health.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "astravitals")
public class AstraVitals {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String subjectId;
    private String timestamp;
    private Integer heartRate;
    private Integer stressIndex;
    private Double hemoglobin;
    private Integer spo2;

    public Long getId() { return id; }
    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public Integer getHeartRate() { return heartRate; }
    public void setHeartRate(Integer heartRate) { this.heartRate = heartRate; }

    public Integer getStressIndex() { return stressIndex; }
    public void setStressIndex(Integer stressIndex) { this.stressIndex = stressIndex; }

    public Double getHemoglobin() { return hemoglobin; }
    public void setHemoglobin(Double hemoglobin) { this.hemoglobin = hemoglobin; }

    public Integer getSpo2() { return spo2; }
    public void setSpo2(Integer spo2) { this.spo2 = spo2; }
}
