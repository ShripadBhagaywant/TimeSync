
ALTER TABLE IF EXISTS shared_notes
    DROP CONSTRAINT IF EXISTS shared_notes_cleaning_stage_check;

-- Keep existing databases aligned with the 41-character temporary snapshot ID.
-- Also supplied as db/migration/V1__widen_shared_notes_hash_id.sql for manual deployment.
ALTER TABLE IF EXISTS shared_notes
    ALTER COLUMN hash_id TYPE VARCHAR(64);
