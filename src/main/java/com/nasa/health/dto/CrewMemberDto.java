package com.nasa.health.dto;

import com.nasa.health.model.AppNotification;
import com.nasa.health.model.Device;
import java.util.List;
import java.util.Map;

public record CrewMemberDto(
    String id,
    String alias,
    String role,
    Integer day,
    String name,
    String reg,
    Map data,
    List custom,
    List<Device> devices,
    List<AppNotification> notifications
) {}