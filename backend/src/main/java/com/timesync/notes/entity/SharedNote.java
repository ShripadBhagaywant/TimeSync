package com.timesync.notes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "shared_notes",
        indexes = {
                @Index(name = "idx_shared_notes_hash_id", columnList = "hash_id", unique = true),
                @Index(name = "idx_shared_notes_expires_at", columnList = "expires_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SharedNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "hash_id", nullable = false, unique = true, length = 64)
    private String hashId;

    @Column(name = "video_id", nullable = false, length = 20)
    private String videoId;

    @Column(name = "video_title", nullable = false)
    private String videoTitle;

    @Column(name = "note_content", nullable = false, columnDefinition = "TEXT")
    private String noteContent;

    @Enumerated(EnumType.STRING)
    @Column(name = "cleaning_stage", nullable = false, length = 30)
    private CleaningStage cleaningStage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
