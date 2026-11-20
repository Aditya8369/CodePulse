-- CreateTable
CREATE TABLE "battle_ratings" (
    "userId" TEXT NOT NULL,
    "elo" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "placementMatchesRemaining" INTEGER NOT NULL DEFAULT 0,
    "seasonNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_ratings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "battle_seasons" (
    "number" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "battle_seasons_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "season_archives" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "finalElo" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "tier" "Tier" NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_ratings_seasonNumber_elo_idx" ON "battle_ratings"("seasonNumber", "elo");

-- CreateIndex
CREATE INDEX "season_archives_seasonNumber_rank_idx" ON "season_archives"("seasonNumber", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "season_archives_seasonNumber_playerId_key" ON "season_archives"("seasonNumber", "playerId");

-- AddForeignKey
ALTER TABLE "battle_ratings" ADD CONSTRAINT "battle_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_archives" ADD CONSTRAINT "season_archives_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "battle_seasons"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing DeveloperRating.overall is also written by GitHub sync, so it cannot
-- safely be interpreted as legacy battle MMR. Seed former battle participants
-- at the neutral baseline; new ranked players receive five placements.
INSERT INTO "battle_ratings" ("userId", "elo", "placementMatchesRemaining", "seasonNumber", "updatedAt")
SELECT "playerId", 1200, 5, 1, CURRENT_TIMESTAMP
FROM (
    SELECT "challengerId" AS "playerId" FROM "battles" WHERE "status" = 'COMPLETED'
    UNION
    SELECT "opponentId" AS "playerId" FROM "battles" WHERE "status" = 'COMPLETED'
) AS "ranked_players";
