package com.nasa.health.repository;

import com.nasa.health.model.CrewTelemetry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CrewTelemetryRepository extends JpaRepository<CrewTelemetry, Integer> {
    List<CrewTelemetry> findByUserIdOrderByRecordedAtAsc(String userId);
}