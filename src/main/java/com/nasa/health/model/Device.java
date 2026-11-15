package com.nasa.health.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "devices")
public class Device {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "device_name", nullable = false)
    private String deviceName;

    @Column(name = "mac_address", unique = true)
    private String macAddress;

    private String status;

    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Integer getId() { return id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getDeviceName() { return deviceName; }
    public void setDeviceName(String deviceName) { this.deviceName = deviceName; }
    public String getMacAddress() { return macAddress; }
    public void setMacAddress(String macAddress) { this.macAddress = macAddress; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(OffsetDateTime lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
}