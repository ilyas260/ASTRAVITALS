package com.nasa.health.repository;

import com.nasa.health.entity.AstraVitals;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AstraVitalsRepository extends JpaRepository<AstraVitals, Long> {
    AstraVitals findTopByOrderByIdDesc();
}
