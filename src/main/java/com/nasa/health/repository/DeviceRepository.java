package com.nasa.health.repository;

import com.nasa.health.model.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DeviceRepository extends JpaRepository<Device, Integer> {
    List<Device> findByUserId(String userId);
}