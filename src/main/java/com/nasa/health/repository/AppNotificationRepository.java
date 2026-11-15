package com.nasa.health.repository;

import com.nasa.health.model.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AppNotificationRepository extends JpaRepository<AppNotification, Integer> {
    List<AppNotification> findByUserIdOrderByCreatedAtDesc(String userId);
}