import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TournamentFormat,
  TournamentStatus,
  TournamentMatchStatus,
  CreateTournamentRequestDto,
  AdvanceMatchRequestDto,
  TournamentMatchDto,
  TournamentBracketViewDto,
  TournamentParticipantInputDto,
  TournamentStandingDto,
  TournamentBracketRoundDto,
} from './dto/tournament.dto';

export interface InternalParticipant {
  id: string;
  userId: string;
  username: string;
  seedNumber: number;
  elo: number;
  bracket: 'WINNERS' | 'LOSERS' | 'ELIMINATED' | 'CHAMPION';
  isEliminated: boolean;
}

export interface InternalTournament {
  id: string;
  title: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  bracketCapacity: number;
  participants: Map<string, InternalParticipant>;
  matches: Map<string, TournamentMatchDto>;
  startsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TournamentService {
  private readonly logger = new Logger(TournamentService.name);
  private readonly tournaments = new Map<string, InternalTournament>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Creates a tournament, computes power-of-two bracket capacity, seeds participants by Elo,
   * generates complete Single or Double Elimination brackets with linked nextMatchId and nextLoserMatchId nodes,
   * and automatically resolves initial Byes.
   */
  async createTournament(dto: CreateTournamentRequestDto): Promise<TournamentBracketViewDto> {
    const tournamentId = `tourn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const format = dto.format || TournamentFormat.DOUBLE_ELIMINATION;
    const rawParticipants = dto.participants || [];

    // Calculate power-of-two bracket slots (e.g. 4, 8, 16, 32, 64)
    const rawCount = Math.max(2, rawParticipants.length);
    const bracketCapacity = this.calculatePowerOfTwoCapacity(rawCount);

    // Seed participants by competitive Elo rating descending (Seed 1 = highest Elo)
    const seededParticipants = this.seedParticipantsByElo(rawParticipants, bracketCapacity);

    const tournament: InternalTournament = {
      id: tournamentId,
      title: dto.title,
      format,
      status: TournamentStatus.IN_PROGRESS,
      maxParticipants: dto.maxParticipants || bracketCapacity,
      bracketCapacity,
      participants: new Map(),
      matches: new Map(),
      startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Index participants
    for (const p of seededParticipants) {
      tournament.participants.set(p.userId, {
        id: `tp-${tournamentId}-${p.userId}`,
        userId: p.userId,
        username: p.username,
        seedNumber: p.seedNumber,
        elo: p.elo,
        bracket: 'WINNERS',
        isEliminated: false,
      });
    }

    // Generate bracket graph nodes
    if (format === TournamentFormat.DOUBLE_ELIMINATION) {
      this.generateDoubleEliminationBracket(tournament, seededParticipants);
    } else {
      this.generateSingleEliminationBracket(tournament, seededParticipants);
    }

    // Automatically resolve initial BYE matches and advance non-bye players immediately
    this.resolveInitialByes(tournament);

    // Save in memory
    this.tournaments.set(tournamentId, tournament);

    // Persist to Prisma if available
    await this.persistTournamentSafely(tournament);

    this.logger.log(
      `Created ${format} tournament '${dto.title}' (${tournamentId}) with capacity ${bracketCapacity} for ${seededParticipants.length} participants`,
    );

    return this.getBracket(tournamentId);
  }

  /**
   * Retrieves the structured bracket view for a tournament.
   */
  getBracket(tournamentId: string): TournamentBracketViewDto {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new NotFoundException(`Tournament '${tournamentId}' not found`);
    }

    const matches = Array.from(tournament.matches.values());

    // Separate rounds into Winners and Losers brackets
    const winnersMatches = matches.filter((m) => m.bracketType === 'WINNERS');
    const losersMatches = matches.filter((m) => m.bracketType === 'LOSERS');
    const grandFinals = matches.find((m) => m.bracketType === 'GRAND_FINALS');

    const winnersBracket = this.groupMatchesByRound(winnersMatches, 'WINNERS');
    const losersBracket = this.groupMatchesByRound(losersMatches, 'LOSERS');

    const standings = this.computeStandings(tournament);

    return {
      tournamentId: tournament.id,
      title: tournament.title,
      format: tournament.format,
      status: tournament.status,
      bracketCapacity: tournament.bracketCapacity,
      participantCount: tournament.participants.size,
      winnersBracket,
      losersBracket,
      grandFinals,
      standings,
    };
  }

  /**
   * Advances a tournament match:
   * Sets the winner, advances winner to nextMatchId, and in Double Elimination routes loser to nextLoserMatchId.
   */
  async advanceMatch(
    tournamentId: string,
    matchId: string,
    dto: AdvanceMatchRequestDto,
  ): Promise<TournamentBracketViewDto> {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new NotFoundException(`Tournament '${tournamentId}' not found`);
    }

    const match = tournament.matches.get(matchId);
    if (!match) {
      throw new NotFoundException(`Match '${matchId}' not found in tournament '${tournamentId}'`);
    }

    if (match.status === TournamentMatchStatus.COMPLETED) {
      throw new BadRequestException(`Match '${matchId}' is already completed`);
    }

    // Verify winner is a participant of this match
    if (match.player1Id !== dto.winnerId && match.player2Id !== dto.winnerId) {
      throw new BadRequestException(
        `Winner ID '${dto.winnerId}' is not an active player in match '${matchId}' (${match.player1Id} vs ${match.player2Id})`,
      );
    }

    const winnerId = dto.winnerId;
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;

    match.winnerId = winnerId;
    match.loserId = loserId;
    match.status = TournamentMatchStatus.COMPLETED;
    match.scorePlayer1 = dto.player1Score;
    match.scorePlayer2 = dto.player2Score;

    // 1. Advance Winner
    if (match.nextMatchId) {
      const nextMatch = tournament.matches.get(match.nextMatchId);
      if (nextMatch) {
        if (!nextMatch.player1Id) {
          nextMatch.player1Id = winnerId;
        } else if (!nextMatch.player2Id) {
          nextMatch.player2Id = winnerId;
        }
        if (nextMatch.player1Id && nextMatch.player2Id) {
          nextMatch.status = TournamentMatchStatus.ACTIVE;
        }
      }
    } else {
      // No next match -> This was Finals / Grand Finals!
      tournament.status = TournamentStatus.COMPLETED;
      const winnerParticipant = tournament.participants.get(winnerId);
      if (winnerParticipant) {
        winnerParticipant.bracket = 'CHAMPION';
      }
    }

    // 2. Route Loser
    if (loserId) {
      const loserParticipant = tournament.participants.get(loserId);

      if (match.bracketType === 'WINNERS' && tournament.format === TournamentFormat.DOUBLE_ELIMINATION) {
        // Loser from Winners bracket drops to Losers bracket
        if (loserParticipant) {
          loserParticipant.bracket = 'LOSERS';
        }

        if (match.nextLoserMatchId) {
          const loserMatch = tournament.matches.get(match.nextLoserMatchId);
          if (loserMatch) {
            if (!loserMatch.player1Id) {
              loserMatch.player1Id = loserId;
            } else if (!loserMatch.player2Id) {
              loserMatch.player2Id = loserId;
            }
            if (loserMatch.player1Id && loserMatch.player2Id) {
              loserMatch.status = TournamentMatchStatus.ACTIVE;
            }
          }
        }
      } else {
        // Single Elimination or Losers bracket defeat -> Eliminates player
        if (loserParticipant) {
          loserParticipant.bracket = 'ELIMINATED';
          loserParticipant.isEliminated = true;
        }
      }
    }

    // Check if next matches are Byes and auto-advance
    this.resolveInitialByes(tournament);

    // Update Prisma
    await this.updateMatchInPrismaSafely(match, tournament);

    return this.getBracket(tournamentId);
  }

  // =========================================================================
  // Bracket Generation Algorithms (Single & Double Elimination)
  // =========================================================================

  /**
   * Calculates nearest power of two capacity S >= N (8, 16, 32, 64).
   */
  public calculatePowerOfTwoCapacity(participantCount: number): number {
    let capacity = 2;
    while (capacity < participantCount) {
      capacity *= 2;
    }
    // Floor bracket at 4 or 8 minimum for realistic tournaments
    return Math.max(4, capacity);
  }

  /**
   * Seeds participants using Elo rating descending, ensuring top seeds don't collide in round 1.
   */
  public seedParticipantsByElo(
    participants: TournamentParticipantInputDto[],
    capacity: number,
  ): Array<TournamentParticipantInputDto & { seedNumber: number; elo: number }> {
    // Sort by Elo descending
    const sorted = [...participants].sort((a, b) => (b.elo || 1200) - (a.elo || 1200));

    return sorted.map((p, idx) => ({
      ...p,
      seedNumber: idx + 1,
      elo: p.elo || 1200,
    }));
  }

  /**
   * Generates standard recursive fold seed sequence for bracket capacity S.
   * e.g. for S=8: [1, 8, 4, 5, 2, 7, 3, 6]
   */
  public generateSeedOrder(capacity: number): number[] {
    let order = [1, 2];
    while (order.length < capacity) {
      const nextSize = order.length * 2;
      const nextOrder: number[] = [];
      for (const seed of order) {
        nextOrder.push(seed);
        nextOrder.push(nextSize + 1 - seed);
      }
      order = nextOrder;
    }
    return order;
  }

  /**
   * Generates complete Single Elimination bracket tree.
   */
  private generateSingleEliminationBracket(
    tournament: InternalTournament,
    seeded: Array<TournamentParticipantInputDto & { seedNumber: number }>,
  ) {
    const S = tournament.bracketCapacity;
    const totalRounds = Math.log2(S);
    const seedOrder = this.generateSeedOrder(S);

    const participantBySeed = new Map<number, string>();
    seeded.forEach((p) => participantBySeed.set(p.seedNumber, p.userId));

    // 1. Create all matches for all rounds
    for (let r = 1; r <= totalRounds; r++) {
      const matchCount = S / Math.pow(2, r);

      for (let m = 1; m <= matchCount; m++) {
        const matchId = `match_${tournament.id}_w_r${r}_m${m}`;
        const nextMatchId = r < totalRounds ? `match_${tournament.id}_w_r${r + 1}_m${Math.ceil(m / 2)}` : null;

        let player1Id: string | null = null;
        let player2Id: string | null = null;
        let isBye = false;

        // Populate Round 1 with seeds
        if (r === 1) {
          const seed1 = seedOrder[(m - 1) * 2];
          const seed2 = seedOrder[(m - 1) * 2 + 1];

          player1Id = participantBySeed.get(seed1) || null;
          player2Id = participantBySeed.get(seed2) || null;
          isBye = !player1Id || !player2Id;
        }

        const match: TournamentMatchDto = {
          id: matchId,
          tournamentId: tournament.id,
          round: r,
          bracketType: 'WINNERS',
          matchNumber: m,
          player1Id,
          player2Id,
          winnerId: null,
          loserId: null,
          nextMatchId,
          nextLoserMatchId: null,
          isBye,
          status: isBye ? TournamentMatchStatus.BYE : TournamentMatchStatus.PENDING,
        };

        tournament.matches.set(matchId, match);
      }
    }
  }

  /**
   * Generates complete Double Elimination bracket tree with Winners, Losers, and Grand Finals.
   */
  private generateDoubleEliminationBracket(
    tournament: InternalTournament,
    seeded: Array<TournamentParticipantInputDto & { seedNumber: number }>,
  ) {
    const S = tournament.bracketCapacity;
    const numWinnersRounds = Math.log2(S);
    const seedOrder = this.generateSeedOrder(S);

    const participantBySeed = new Map<number, string>();
    seeded.forEach((p) => participantBySeed.set(p.seedNumber, p.userId));

    // 1. Create Winners Bracket
    for (let r = 1; r <= numWinnersRounds; r++) {
      const matchCount = S / Math.pow(2, r);

      for (let m = 1; m <= matchCount; m++) {
        const matchId = `match_${tournament.id}_w_r${r}_m${m}`;
        const isWinnersFinal = r === numWinnersRounds;
        const nextMatchId = isWinnersFinal
          ? `match_${tournament.id}_gf_1`
          : `match_${tournament.id}_w_r${r + 1}_m${Math.ceil(m / 2)}`;

        // Determine which Losers match receives the loser from this Winners match
        let nextLoserMatchId: string | null = null;
        if (r === 1) {
          nextLoserMatchId = `match_${tournament.id}_l_r1_m${Math.ceil(m / 2)}`;
        } else if (r === 2) {
          nextLoserMatchId = `match_${tournament.id}_l_r2_m${m}`;
        } else if (isWinnersFinal) {
          // Loser from Winners Final drops to Losers Final
          nextLoserMatchId = `match_${tournament.id}_l_r${(numWinnersRounds - 1) * 2}_m1`;
        } else {
          nextLoserMatchId = `match_${tournament.id}_l_r${(r - 1) * 2}_m${m}`;
        }

        let player1Id: string | null = null;
        let player2Id: string | null = null;
        let isBye = false;

        if (r === 1) {
          const seed1 = seedOrder[(m - 1) * 2];
          const seed2 = seedOrder[(m - 1) * 2 + 1];

          player1Id = participantBySeed.get(seed1) || null;
          player2Id = participantBySeed.get(seed2) || null;
          isBye = !player1Id || !player2Id;
        }

        const match: TournamentMatchDto = {
          id: matchId,
          tournamentId: tournament.id,
          round: r,
          bracketType: 'WINNERS',
          matchNumber: m,
          player1Id,
          player2Id,
          winnerId: null,
          loserId: null,
          nextMatchId,
          nextLoserMatchId,
          isBye,
          status: isBye ? TournamentMatchStatus.BYE : TournamentMatchStatus.PENDING,
        };

        tournament.matches.set(matchId, match);
      }
    }

    // 2. Create Losers Bracket
    const numLosersRounds = (numWinnersRounds - 1) * 2;

    for (let lr = 1; lr <= numLosersRounds; lr++) {
      // In double elimination, losers round match count:
      // lr = 1: S/4
      // lr = 2: S/4
      // lr = 3: S/8
      // lr = 4: S/8
      // ...
      const powerStep = Math.floor((lr + 1) / 2);
      const matchCount = Math.max(1, S / Math.pow(2, powerStep + 1));

      for (let lm = 1; lm <= matchCount; lm++) {
        const matchId = `match_${tournament.id}_l_r${lr}_m${lm}`;
        const isLosersFinal = lr === numLosersRounds;
        const nextMatchId = isLosersFinal
          ? `match_${tournament.id}_gf_1`
          : lr % 2 === 1
            ? `match_${tournament.id}_l_r${lr + 1}_m${lm}`
            : `match_${tournament.id}_l_r${lr + 1}_m${Math.ceil(lm / 2)}`;

        const match: TournamentMatchDto = {
          id: matchId,
          tournamentId: tournament.id,
          round: lr,
          bracketType: 'LOSERS',
          matchNumber: lm,
          player1Id: null,
          player2Id: null,
          winnerId: null,
          loserId: null,
          nextMatchId,
          nextLoserMatchId: null,
          isBye: false,
          status: TournamentMatchStatus.PENDING,
        };

        tournament.matches.set(matchId, match);
      }
    }

    // 3. Create Grand Finals Match
    const grandFinalsMatchId = `match_${tournament.id}_gf_1`;
    const grandFinals: TournamentMatchDto = {
      id: grandFinalsMatchId,
      tournamentId: tournament.id,
      round: 1,
      bracketType: 'GRAND_FINALS',
      matchNumber: 1,
      player1Id: null, // Winner of Winners Final
      player2Id: null, // Winner of Losers Final
      winnerId: null,
      loserId: null,
      nextMatchId: null,
      nextLoserMatchId: null,
      isBye: false,
      status: TournamentMatchStatus.PENDING,
    };

    tournament.matches.set(grandFinalsMatchId, grandFinals);
  }

  /**
   * Automatically resolves any matches where one player has a BYE, advancing the active player.
   */
  private resolveInitialByes(tournament: InternalTournament) {
    let resolvedAny = true;

    while (resolvedAny) {
      resolvedAny = false;

      for (const match of tournament.matches.values()) {
        if (
          match.status !== TournamentMatchStatus.COMPLETED &&
          ((match.player1Id && !match.player2Id && match.isBye) ||
            (!match.player1Id && match.player2Id && match.isBye))
        ) {
          const advancingPlayer = match.player1Id || match.player2Id;
          match.winnerId = advancingPlayer;
          match.status = TournamentMatchStatus.COMPLETED;

          // Advance to next match
          if (match.nextMatchId && advancingPlayer) {
            const nextMatch = tournament.matches.get(match.nextMatchId);
            if (nextMatch) {
              if (!nextMatch.player1Id) {
                nextMatch.player1Id = advancingPlayer;
              } else if (!nextMatch.player2Id) {
                nextMatch.player2Id = advancingPlayer;
              }
              if (nextMatch.player1Id && nextMatch.player2Id) {
                nextMatch.status = TournamentMatchStatus.ACTIVE;
              }
            }
          }

          resolvedAny = true;
        } else if (
          match.status === TournamentMatchStatus.PENDING &&
          match.player1Id &&
          match.player2Id
        ) {
          match.status = TournamentMatchStatus.ACTIVE;
        }
      }
    }
  }

  private groupMatchesByRound(
    matches: TournamentMatchDto[],
    bracketType: string,
  ): TournamentBracketRoundDto[] {
    const roundMap = new Map<number, TournamentMatchDto[]>();

    for (const m of matches) {
      if (!roundMap.has(m.round)) {
        roundMap.set(m.round, []);
      }
      roundMap.get(m.round)!.push(m);
    }

    const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

    return sortedRounds.map((r) => ({
      round: r,
      bracketType,
      matches: roundMap.get(r)!.sort((a, b) => a.matchNumber - b.matchNumber),
    }));
  }

  private computeStandings(tournament: InternalTournament): TournamentStandingDto[] {
    const participants = Array.from(tournament.participants.values());

    return participants
      .sort((a, b) => {
        if (a.bracket === 'CHAMPION') return -1;
        if (b.bracket === 'CHAMPION') return 1;
        if (!a.isEliminated && b.isEliminated) return -1;
        if (a.isEliminated && !b.isEliminated) return 1;
        return a.seedNumber - b.seedNumber;
      })
      .map((p, idx) => ({
        rank: idx + 1,
        userId: p.userId,
        username: p.username,
        seedNumber: p.seedNumber,
        elo: p.elo,
        bracket: p.bracket,
        isEliminated: p.isEliminated,
      }));
  }

  // =========================================================================
  // Prisma Persistence Helpers
  // =========================================================================

  private async persistTournamentSafely(tournament: InternalTournament): Promise<void> {
    if (!this.prisma) return;

    try {
      await (this.prisma as any).tournament?.create({
        data: {
          id: tournament.id,
          title: tournament.title,
          maxParticipants: tournament.maxParticipants,
          status: tournament.status,
          format: tournament.format,
          startsAt: tournament.startsAt,
        },
      });

      // Persist participants
      for (const p of tournament.participants.values()) {
        await (this.prisma as any).tournamentParticipant?.create({
          data: {
            tournamentId: tournament.id,
            userId: p.userId,
            seedNumber: p.seedNumber,
            elo: p.elo,
            isEliminated: p.isEliminated,
          },
        });
      }

      // Persist matches
      for (const m of tournament.matches.values()) {
        await (this.prisma as any).tournamentMatch?.create({
          data: {
            id: m.id,
            tournamentId: tournament.id,
            round: m.round,
            bracketType: m.bracketType,
            matchNumber: m.matchNumber,
            player1Id: m.player1Id,
            player2Id: m.player2Id,
            winnerId: m.winnerId,
            loserId: m.loserId,
            nextMatchId: m.nextMatchId,
            nextLoserMatchId: m.nextLoserMatchId,
            isBye: m.isBye,
            status: m.status,
          },
        });
      }
    } catch (err: any) {
      this.logger.debug(`Could not persist tournament to database: ${err?.message}`);
    }
  }

  private async updateMatchInPrismaSafely(
    match: TournamentMatchDto,
    tournament: InternalTournament,
  ): Promise<void> {
    if (!this.prisma) return;

    try {
      await (this.prisma as any).tournamentMatch?.update({
        where: { id: match.id },
        data: {
          winnerId: match.winnerId,
          loserId: match.loserId,
          status: match.status,
          scorePlayer1: match.scorePlayer1,
          scorePlayer2: match.scorePlayer2,
          completedAt: new Date(),
        },
      });

      if (tournament.status === TournamentStatus.COMPLETED) {
        await (this.prisma as any).tournament?.update({
          where: { id: tournament.id },
          data: { status: TournamentStatus.COMPLETED },
        });
      }
    } catch (err: any) {
      this.logger.debug(`Could not update match in database: ${err?.message}`);
    }
  }
}

