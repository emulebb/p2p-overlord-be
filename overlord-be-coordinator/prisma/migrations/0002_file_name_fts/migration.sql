ALTER TABLE "FileName"
    ADD COLUMN "nameTsv" TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', "name")) STORED;

CREATE INDEX "FileName_nameTsv_idx" ON "FileName" USING GIN ("nameTsv");
CREATE INDEX "FileName_fileId_idx" ON "FileName"("fileId");
