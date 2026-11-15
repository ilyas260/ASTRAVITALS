package com.nasa.health.repository;

import com.nasa.health.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AppUserRepository extends JpaRepository<AppUser, String> {
    List<AppUser> findByRoleType(String roleType);
    Optional<AppUser> findByIdOrRegistrationNumber(String id, String reg);
}