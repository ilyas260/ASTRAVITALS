package com.nasa.health.dto;

import java.util.List;

public class TelemetryPayload {
    private String subject_id;
    private String timestamp;
    private List<Metric> metrics;

    public String getSubject_id() { return subject_id; }
    public void setSubject_id(String subject_id) { this.subject_id = subject_id; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public List<Metric> getMetrics() { return metrics; }
    public void setMetrics(List<Metric> metrics) { this.metrics = metrics; }
}
