-- Forward migration for existing PostgreSQL deployments; no Flyway runner is configured.
-- schema.sql applies the same widening during the existing Spring SQL initialization.
ALTER TABLE IF EXISTS shared_notes
    ALTER COLUMN hash_id TYPE VARCHAR(64);
