package com.timesync.notes.repository;

import com.timesync.notes.entity.SharedNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SharedNoteRepository extends JpaRepository<SharedNote,Long> {
    Optional<SharedNote> findByHashId(String hashId);
}
