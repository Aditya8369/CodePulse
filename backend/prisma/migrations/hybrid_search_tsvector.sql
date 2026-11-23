-- Add tsvector column and GIN index for hybrid reciprocal rank fusion search
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Automatically generate tsvector from title and description
CREATE OR REPLACE FUNCTION challenges_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  new."searchVector" :=
    setweight(to_tsvector('english', coalesce(new."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new."description", '')), 'B');
  return new;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate ON "challenges";
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON "challenges" FOR EACH ROW EXECUTE PROCEDURE challenges_tsvector_trigger();

-- Create GIN index for sub-25ms BM25 full-text queries
CREATE INDEX IF NOT EXISTS "idx_challenges_search_vector_gin" ON "challenges" USING gin("searchVector");
