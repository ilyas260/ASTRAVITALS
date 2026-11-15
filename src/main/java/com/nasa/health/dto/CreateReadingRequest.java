package com.nasa.health.dto;
public record CreateReadingRequest(String metric, Long t, Double v, Double v2, String src, String notes, String loggedBy) {}