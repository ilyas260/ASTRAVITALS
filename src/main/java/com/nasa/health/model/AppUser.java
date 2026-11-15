package com.nasa.health.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class AppUser {
    @Id
    private String id;

    @Column(name = "registration_number", unique = true, nullable = false)
    private String registrationNumber;

    @Column(name = "role_type", nullable = false)
    private String roleType;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String r) { this.registrationNumber = r; }
    public String getRoleType() { return roleType; }
    public void setRoleType(String roleType) { this.roleType = roleType; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public String getFullName() {
        String f = firstName != null ? firstName : "";
        String l = lastName != null ? lastName : "";
        String full = (f + " " + l).trim();
        return full.isEmpty() ? "User " + id : full;
    }
}