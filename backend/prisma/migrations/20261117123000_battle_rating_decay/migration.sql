ALTER TABLE "battle_ratings"
  ADD COLUMN "lastBattleAt" TIMESTAMP(3),
  ADD COLUMN "decayPeriodsApplied" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "decayFloor" DOUBLE PRECISION,
  ADD COLUMN "decayWarnedFor" TIMESTAMP(3);

CREATE INDEX "battle_ratings_lastBattleAt_idx" ON "battle_ratings"("lastBattleAt");
