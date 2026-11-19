import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as fs from 'fs';
import * as path from 'path';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

export interface GraphQLRequestPayload {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLExecutionResult {
  data: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    subgraphsQueried: string[];
    queryDepth: number;
    queryComplexity: number;
    dbBatchCalls: number;
  };
}

export interface SubgraphDefinition {
  name: string;
  entities: string[];
  sdl: string;
}

export interface BattleUpdateEvent {
  battleId: string;
  status: string;
  challengerScore: number | null;
  opponentScore: number | null;
  winnerId: string | null;
  timestamp: string;
}

interface SelectionNode {
  name: string;
  alias?: string;
  args: Record<string, unknown>;
  selections: SelectionNode[];
}

/**
 * Generic microtask-batched DataLoader eliminating N+1 database lookups
 * across federated subgraph entity relationships.
 */
export class EntityDataLoader<K, V> {
  private queue: Array<{
    key: K;
    resolve: (val: V) => void;
    reject: (err: unknown) => void;
  }> = [];
  private scheduled = false;
  private readonly cache = new Map<string, Promise<V>>();

  constructor(
    private readonly batchFn: (keys: readonly K[]) => Promise<V[]>,
    private readonly keySerializer: (key: K) => string = (k) => String(k),
  ) {}

  load(key: K): Promise<V> {
    const cacheKey = this.keySerializer(key);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const promise = new Promise<V>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => {
          void this.dispatch();
        });
      }
    });

    this.cache.set(cacheKey, promise);
    return promise;
  }

  async loadMany(keys: readonly K[]): Promise<V[]> {
    return Promise.all(keys.map((k) => this.load(k)));
  }

  private async dispatch(): Promise<void> {
    const batch = this.queue;
    this.queue = [];
    this.scheduled = false;

    if (batch.length === 0) return;

    try {
      const results = await this.batchFn(batch.map((item) => item.key));
      if (results.length !== batch.length) {
        throw new Error(
          `DataLoader batch function returned ${results.length} results for ${batch.length} keys`,
        );
      }
      batch.forEach((item, idx) => item.resolve(results[idx]));
    } catch (err) {
      batch.forEach((item) => item.reject(err));
    }
  }
}

export interface RequestDataLoaders {
  userById: EntityDataLoader<string, Record<string, unknown> | null>;
  reposByUserId: EntityDataLoader<string, Array<Record<string, unknown>>>;
  battlesByUserId: EntityDataLoader<string, Array<Record<string, unknown>>>;
  badgesByUserId: EntityDataLoader<string, Array<Record<string, unknown>>>;
  getBatchCallCount: () => number;
}

export const MAX_QUERY_DEPTH = 6;
export const MAX_QUERY_COMPLEXITY = 250;

@Injectable()
export class GraphqlFederationGatewayService {
  private readonly logger = new Logger(GraphqlFederationGatewayService.name);
  private readonly stitchedSdl: string;
  private readonly subgraphs: SubgraphDefinition[];
  private readonly battleSubscribers = new Map<
    string,
    Set<(event: BattleUpdateEvent) => void>
  >();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.subgraphs = this.buildSubgraphDefinitions();
    this.stitchedSdl = this.loadOrStitchSupergraphSdl();
  }

  private buildSubgraphDefinitions(): SubgraphDefinition[] {
    return [
      {
        name: 'UserSubgraph',
        entities: ['User', 'TeamMetrics'],
        sdl: `type User @key(fields: "id") @key(fields: "username") { id: ID! username: String! name: String email: String avatar: String bio: String location: String company: String isOnline: Boolean! teamMetrics: TeamMetrics! }`,
      },
      {
        name: 'RepositorySubgraph',
        entities: ['Repository'],
        sdl: `extend type User @key(fields: "id") { id: ID! @external repositories(limit: Int = 10): [Repository!]! } type Repository @key(fields: "id") { id: ID! githubRepoId: String! userId: ID! name: String! fullName: String! stars: Int! forks: Int! commits: Int! language: String url: String! owner: User }`,
      },
      {
        name: 'BattleSubgraph',
        entities: ['Battle', 'BattleUpdateEvent'],
        sdl: `extend type User @key(fields: "id") { id: ID! @external battles(limit: Int = 10): [Battle!]! } type Battle @key(fields: "id") { id: ID! challengerId: ID! opponentId: ID! status: String! category: String! challengerScore: Float opponentScore: Float winnerId: ID challenger: User opponent: User }`,
      },
      {
        name: 'BadgeSubgraph',
        entities: ['Badge', 'EarnedBadge'],
        sdl: `extend type User @key(fields: "id") { id: ID! @external badges: [EarnedBadge!]! } type Badge @key(fields: "id") { id: ID! name: String! description: String! icon: String tier: String! category: String } type EarnedBadge { id: ID! userId: ID! badgeId: ID! earnedAt: String! badge: Badge! }`,
      },
    ];
  }

  private loadOrStitchSupergraphSdl(): string {
    const schemaPath = path.resolve(__dirname, 'schema.gql');
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, 'utf8');
    }
    return [
      'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable", "@external"])',
      ...this.subgraphs.map((sg) => sg.sdl),
    ].join('\n\n');
  }

  getSubgraphs(): SubgraphDefinition[] {
    return [...this.subgraphs];
  }

  getSupergraphSdl(): string {
    return this.stitchedSdl;
  }

  /**
   * Creates per-request DataLoaders that batch N entity lookups into 1 database query per subgraph.
   */
  createRequestLoaders(): RequestDataLoaders {
    let dbBatchCalls = 0;

    const userById = new EntityDataLoader<
      string,
      Record<string, unknown> | null
    >(async (ids) => {
      dbBatchCalls += 1;
      const uniqueIds = Array.from(new Set(ids));
      const rows = (await this.prisma?.user.findMany({
        where: { id: { in: uniqueIds } },
      })) ?? [];
      const byId = new Map(rows.map((r) => [r.id, r as unknown as Record<string, unknown>]));
      return ids.map((id) => byId.get(id) ?? null);
    });

    const reposByUserId = new EntityDataLoader<
      string,
      Array<Record<string, unknown>>
    >(async (userIds) => {
      dbBatchCalls += 1;
      const uniqueIds = Array.from(new Set(userIds));
      const rows = (await this.prisma?.repository.findMany({
        where: { userId: { in: uniqueIds } },
        orderBy: { stars: 'desc' },
      })) ?? [];
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const row of rows) {
        const list = grouped.get(row.userId) ?? [];
        list.push(row as unknown as Record<string, unknown>);
        grouped.set(row.userId, list);
      }
      return userIds.map((id) => grouped.get(id) ?? []);
    });

    const battlesByUserId = new EntityDataLoader<
      string,
      Array<Record<string, unknown>>
    >(async (userIds) => {
      dbBatchCalls += 1;
      const uniqueIds = Array.from(new Set(userIds));
      const rows = (await this.prisma?.battle.findMany({
        where: {
          OR: [
            { challengerId: { in: uniqueIds } },
            { opponentId: { in: uniqueIds } },
          ],
        },
        orderBy: { startedAt: 'desc' },
      })) ?? [];
      return userIds.map((uid) =>
        rows
          .filter((b) => b.challengerId === uid || b.opponentId === uid)
          .map((b) => b as unknown as Record<string, unknown>),
      );
    });

    const badgesByUserId = new EntityDataLoader<
      string,
      Array<Record<string, unknown>>
    >(async (userIds) => {
      dbBatchCalls += 1;
      const uniqueIds = Array.from(new Set(userIds));
      const rows = (await this.prisma?.userBadge.findMany({
        where: { userId: { in: uniqueIds } },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      })) ?? [];
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const row of rows) {
        const list = grouped.get(row.userId) ?? [];
        list.push(row as unknown as Record<string, unknown>);
        grouped.set(row.userId, list);
      }
      return userIds.map((id) => grouped.get(id) ?? []);
    });

    return {
      userById,
      reposByUserId,
      battlesByUserId,
      badgesByUserId,
      getBatchCallCount: () => dbBatchCalls,
    };
  }

  /**
   * Computes nesting depth and weighted field complexity of a parsed selection set,
   * rejecting queries exceeding MAX_QUERY_DEPTH (6) or MAX_QUERY_COMPLEXITY (250).
   */
  validateQuerySecurity(selections: SelectionNode[]): {
    depth: number;
    complexity: number;
  } {
    const computeMetrics = (
      nodes: SelectionNode[],
      currentDepth: number,
    ): { maxDepth: number; cost: number } => {
      let maxDepth = currentDepth;
      let cost = 0;

      for (const node of nodes) {
        const limitArg =
          typeof node.args.limit === 'number' ? Math.max(1, node.args.limit) : 1;
        const multiplier =
          node.name === 'developers' ||
          node.name === 'repositories' ||
          node.name === 'battles' ||
          node.name === 'badges'
            ? Math.min(limitArg, 50)
            : 1;

        if (node.selections.length > 0) {
          const child = computeMetrics(node.selections, currentDepth + 1);
          maxDepth = Math.max(maxDepth, child.maxDepth);
          cost += multiplier * (2 + child.cost);
        } else {
          cost += 1;
        }
      }

      return { maxDepth, cost };
    };

    const { maxDepth, cost } = computeMetrics(selections, 1);

    if (maxDepth > MAX_QUERY_DEPTH) {
      throw new BadRequestException(
        `GraphQL query depth ${maxDepth} exceeds maximum allowed depth of ${MAX_QUERY_DEPTH}`,
      );
    }

    if (cost > MAX_QUERY_COMPLEXITY) {
      throw new BadRequestException(
        `GraphQL query complexity ${cost} exceeds maximum allowed complexity of ${MAX_QUERY_COMPLEXITY}`,
      );
    }

    return { depth: maxDepth, complexity: cost };
  }

  /**
   * Executes a federated GraphQL query or mutation across UserSubgraph, BattleSubgraph,
   * RepositorySubgraph, and BadgeSubgraph using request-scoped DataLoaders.
   */
  async execute(payload: GraphQLRequestPayload): Promise<GraphQLExecutionResult> {
    if (!payload?.query || typeof payload.query !== 'string') {
      throw new BadRequestException('GraphQL query string is required');
    }

    const parsed = parseGraphQLDocument(payload.query, payload.variables ?? {});
    const { depth, complexity } = this.validateQuerySecurity(parsed.selections);
    const loaders = this.createRequestLoaders();
    const subgraphsQueried = new Set<string>();

    try {
      const data: Record<string, unknown> = {};

      if (parsed.operationType === 'mutation') {
        for (const field of parsed.selections) {
          const key = field.alias ?? field.name;
          if (field.name === 'publishBattleUpdate') {
            subgraphsQueried.add('BattleSubgraph');
            const event = this.publishBattleUpdate({
              battleId: String(field.args.battleId ?? ''),
              status: String(field.args.status ?? 'ACTIVE'),
              challengerScore:
                typeof field.args.challengerScore === 'number'
                  ? field.args.challengerScore
                  : null,
              opponentScore:
                typeof field.args.opponentScore === 'number'
                  ? field.args.opponentScore
                  : null,
              winnerId:
                typeof field.args.winnerId === 'string'
                  ? field.args.winnerId
                  : null,
            });
            data[key] = selectFields(
              event as unknown as Record<string, unknown>,
              field.selections,
            );
          }
        }
      } else {
        for (const field of parsed.selections) {
          const key = field.alias ?? field.name;
          data[key] = await this.resolveRootField(
            field,
            loaders,
            subgraphsQueried,
          );
        }
      }

      return {
        data,
        extensions: {
          subgraphsQueried: Array.from(subgraphsQueried),
          queryDepth: depth,
          queryComplexity: complexity,
          dbBatchCalls: loaders.getBatchCallCount(),
        },
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'GraphQL execution failed';
      return {
        data: null,
        errors: [{ message }],
        extensions: {
          subgraphsQueried: Array.from(subgraphsQueried),
          queryDepth: depth,
          queryComplexity: complexity,
          dbBatchCalls: loaders.getBatchCallCount(),
        },
      };
    }
  }

  private async resolveRootField(
    field: SelectionNode,
    loaders: RequestDataLoaders,
    subgraphsQueried: Set<string>,
  ): Promise<unknown> {
    switch (field.name) {
      case '_service':
        subgraphsQueried.add('FederationGateway');
        return selectFields({ sdl: this.stitchedSdl }, field.selections);

      case '_entities': {
        const reps = Array.isArray(field.args.representations)
          ? (field.args.representations as Array<Record<string, unknown>>)
          : [];
        const resolved = await Promise.all(
          reps.map(async (rep) => {
            const typename = String(rep.__typename ?? '');
            if (typename === 'User' && typeof rep.id === 'string') {
              subgraphsQueried.add('UserSubgraph');
              const user = await loaders.userById.load(rep.id);
              return user
                ? this.resolveUserEntity(
                    user,
                    field.selections,
                    loaders,
                    subgraphsQueried,
                  )
                : null;
            }
            return rep;
          }),
        );
        return resolved;
      }

      case 'developerProfile': {
        subgraphsQueried.add('UserSubgraph');
        const username = String(field.args.username ?? '');
        const user = (await this.prisma?.user.findUnique({
          where: { username },
        })) as unknown as Record<string, unknown> | null;
        if (!user) return null;
        return this.resolveUserEntity(
          user,
          field.selections,
          loaders,
          subgraphsQueried,
        );
      }

      case 'developers': {
        subgraphsQueried.add('UserSubgraph');
        const usernames = Array.isArray(field.args.usernames)
          ? (field.args.usernames as string[])
          : [];
        const users = (await this.prisma?.user.findMany({
          where: { username: { in: usernames } },
        })) as unknown as Array<Record<string, unknown>> | undefined;
        return Promise.all(
          (users ?? []).map((u) =>
            this.resolveUserEntity(u, field.selections, loaders, subgraphsQueried),
          ),
        );
      }

      case 'battle': {
        subgraphsQueried.add('BattleSubgraph');
        const id = String(field.args.id ?? '');
        const battle = (await this.prisma?.battle.findUnique({
          where: { id },
        })) as unknown as Record<string, unknown> | null;
        if (!battle) return null;
        return this.resolveBattleEntity(
          battle,
          field.selections,
          loaders,
          subgraphsQueried,
        );
      }

      case 'leaderboard': {
        subgraphsQueried.add('UserSubgraph');
        const limit =
          typeof field.args.limit === 'number' ? field.args.limit : 10;
        const users = (await this.prisma?.user.findMany({
          take: Math.min(limit, 50),
        })) as unknown as Array<Record<string, unknown>> | undefined;
        return Promise.all(
          (users ?? []).map((u) =>
            this.resolveUserEntity(u, field.selections, loaders, subgraphsQueried),
          ),
        );
      }

      default:
        throw new BadRequestException(`Unknown GraphQL root field "${field.name}"`);
    }
  }

  private async resolveUserEntity(
    user: Record<string, unknown>,
    selections: SelectionNode[],
    loaders: RequestDataLoaders,
    subgraphsQueried: Set<string>,
  ): Promise<Record<string, unknown>> {
    if (selections.length === 0) return user;
    const userId = String(user.id);
    const out: Record<string, unknown> = {};

    for (const sel of selections) {
      const key = sel.alias ?? sel.name;
      if (sel.name === '__typename') {
        out[key] = 'User';
      } else if (sel.name === 'repositories') {
        subgraphsQueried.add('RepositorySubgraph');
        const limit = typeof sel.args.limit === 'number' ? sel.args.limit : 10;
        const repos = (await loaders.reposByUserId.load(userId)).slice(0, limit);
        out[key] = await Promise.all(
          repos.map((r) =>
            this.resolveRepositoryEntity(
              r,
              sel.selections,
              loaders,
              subgraphsQueried,
            ),
          ),
        );
      } else if (sel.name === 'battles') {
        subgraphsQueried.add('BattleSubgraph');
        const limit = typeof sel.args.limit === 'number' ? sel.args.limit : 10;
        const battles = (await loaders.battlesByUserId.load(userId)).slice(
          0,
          limit,
        );
        out[key] = await Promise.all(
          battles.map((b) =>
            this.resolveBattleEntity(
              b,
              sel.selections,
              loaders,
              subgraphsQueried,
            ),
          ),
        );
      } else if (sel.name === 'badges') {
        subgraphsQueried.add('BadgeSubgraph');
        const badges = await loaders.badgesByUserId.load(userId);
        out[key] = badges.map((ub) =>
          selectFields(
            {
              ...ub,
              earnedAt:
                ub.earnedAt instanceof Date
                  ? ub.earnedAt.toISOString()
                  : String(ub.earnedAt ?? ''),
            },
            sel.selections,
          ),
        );
      } else if (sel.name === 'teamMetrics') {
        subgraphsQueried.add('RepositorySubgraph');
        subgraphsQueried.add('BattleSubgraph');
        subgraphsQueried.add('BadgeSubgraph');
        const [repos, battles, badges] = await Promise.all([
          loaders.reposByUserId.load(userId),
          loaders.battlesByUserId.load(userId),
          loaders.badgesByUserId.load(userId),
        ]);
        const totalStars = repos.reduce(
          (sum, r) => sum + Number(r.stars ?? 0),
          0,
        );
        const totalCommits = repos.reduce(
          (sum, r) => sum + Number(r.commits ?? 0),
          0,
        );
        const battlesWon = battles.filter((b) => b.winnerId === userId).length;
        const winRate =
          battles.length > 0
            ? Number(((battlesWon / battles.length) * 100).toFixed(2))
            : 0;
        out[key] = selectFields(
          {
            totalRepositories: repos.length,
            totalStars,
            totalCommits,
            totalBattles: battles.length,
            battlesWon,
            winRate,
            badgeCount: badges.length,
          },
          sel.selections,
        );
      } else {
        out[key] = user[sel.name] ?? null;
      }
    }

    return out;
  }

  private async resolveRepositoryEntity(
    repo: Record<string, unknown>,
    selections: SelectionNode[],
    loaders: RequestDataLoaders,
    subgraphsQueried: Set<string>,
  ): Promise<Record<string, unknown>> {
    if (selections.length === 0) return repo;
    const out: Record<string, unknown> = {};
    for (const sel of selections) {
      const key = sel.alias ?? sel.name;
      if (sel.name === '__typename') {
        out[key] = 'Repository';
      } else if (sel.name === 'owner' && typeof repo.userId === 'string') {
        subgraphsQueried.add('UserSubgraph');
        const owner = await loaders.userById.load(repo.userId);
        out[key] = owner
          ? await this.resolveUserEntity(
              owner,
              sel.selections,
              loaders,
              subgraphsQueried,
            )
          : null;
      } else {
        out[key] = repo[sel.name] ?? null;
      }
    }
    return out;
  }

  private async resolveBattleEntity(
    battle: Record<string, unknown>,
    selections: SelectionNode[],
    loaders: RequestDataLoaders,
    subgraphsQueried: Set<string>,
  ): Promise<Record<string, unknown>> {
    if (selections.length === 0) return battle;
    const out: Record<string, unknown> = {};
    for (const sel of selections) {
      const key = sel.alias ?? sel.name;
      if (sel.name === '__typename') {
        out[key] = 'Battle';
      } else if (
        sel.name === 'challenger' &&
        typeof battle.challengerId === 'string'
      ) {
        subgraphsQueried.add('UserSubgraph');
        const challenger = await loaders.userById.load(battle.challengerId);
        out[key] = challenger
          ? await this.resolveUserEntity(
              challenger,
              sel.selections,
              loaders,
              subgraphsQueried,
            )
          : null;
      } else if (
        sel.name === 'opponent' &&
        typeof battle.opponentId === 'string'
      ) {
        subgraphsQueried.add('UserSubgraph');
        const opponent = await loaders.userById.load(battle.opponentId);
        out[key] = opponent
          ? await this.resolveUserEntity(
              opponent,
              sel.selections,
              loaders,
              subgraphsQueried,
            )
          : null;
      } else if (sel.name === 'startedAt' || sel.name === 'endsAt') {
        const raw = battle[sel.name];
        out[key] = raw instanceof Date ? raw.toISOString() : String(raw ?? '');
      } else {
        out[key] = battle[sel.name] ?? null;
      }
    }
    return out;
  }

  /**
   * Subscription Pub/Sub for real-time live match updates over WebSockets.
   */
  subscribeToBattle(
    battleId: string,
    listener: (event: BattleUpdateEvent) => void,
  ): () => void {
    const set = this.battleSubscribers.get(battleId) ?? new Set();
    set.add(listener);
    this.battleSubscribers.set(battleId, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.battleSubscribers.delete(battleId);
      }
    };
  }

  publishBattleUpdate(
    input: Omit<BattleUpdateEvent, 'timestamp'>,
  ): BattleUpdateEvent {
    const event: BattleUpdateEvent = {
      ...input,
      timestamp: new Date().toISOString(),
    };
    const subscribers = this.battleSubscribers.get(input.battleId);
    if (subscribers) {
      for (const listener of subscribers) {
        listener(event);
      }
    }
    return event;
  }
}

@ApiTags('graphql')
@Controller('graphql')
export class GraphqlFederationController {
  constructor(
    private readonly gateway: GraphqlFederationGatewayService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Execute unified GraphQL query across federated User, Battle, Repository, and Badge subgraphs',
  })
  async executeGraphql(
    @Body() payload: GraphQLRequestPayload,
  ): Promise<GraphQLExecutionResult> {
    return this.gateway.execute(payload);
  }

  @Get('sdl')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Retrieve stitched Apollo Federation supergraph SDL' })
  getSupergraphSdl(): string {
    return this.gateway.getSupergraphSdl();
  }
}

@WebSocketGateway({ namespace: '/graphql-ws', cors: { origin: '*' } })
export class GraphqlSubscriptionsGateway {
  @WebSocketServer()
  server?: Server;

  private readonly socketSubscriptions = new Map<string, () => void>();

  constructor(private readonly gateway: GraphqlFederationGatewayService) {}

  @SubscribeMessage('subscribe_battle')
  handleSubscribeBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string },
  ) {
    const subKey = `${client.id}:${payload.battleId}`;
    this.socketSubscriptions.get(subKey)?.();

    const unsubscribe = this.gateway.subscribeToBattle(
      payload.battleId,
      (event) => {
        client.emit('battleUpdated', { data: { battleUpdated: event } });
      },
    );
    this.socketSubscriptions.set(subKey, unsubscribe);
    return { subscribed: true, battleId: payload.battleId };
  }
}

// ============================================================================
// Lightweight Recursive-Descent GraphQL Query Parser
// ============================================================================

function selectFields(
  obj: Record<string, unknown>,
  selections: SelectionNode[],
): Record<string, unknown> {
  if (!selections || selections.length === 0) return obj;
  const result: Record<string, unknown> = {};
  for (const sel of selections) {
    const key = sel.alias ?? sel.name;
    const val = obj[sel.name];
    if (
      sel.selections.length > 0 &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      result[key] = selectFields(val as Record<string, unknown>, sel.selections);
    } else {
      result[key] = val ?? null;
    }
  }
  return result;
}

function parseGraphQLDocument(
  source: string,
  variables: Record<string, unknown>,
): { operationType: 'query' | 'mutation' | 'subscription'; selections: SelectionNode[] } {
  const cleaned = source.replace(/#[^\n]*/g, ' ').trim();
  let pos = 0;
  let operationType: 'query' | 'mutation' | 'subscription' = 'query';

  const skipWs = () => {
    while (pos < cleaned.length && /[\s,]/.test(cleaned[pos])) pos += 1;
  };

  const readIdent = (): string => {
    skipWs();
    const start = pos;
    while (pos < cleaned.length && /[A-Za-z0-9_]/.test(cleaned[pos])) pos += 1;
    return cleaned.slice(start, pos);
  };

  const parseValue = (): unknown => {
    skipWs();
    const ch = cleaned[pos];
    if (ch === '$') {
      pos += 1;
      const varName = readIdent();
      return variables[varName];
    }
    if (ch === '"') {
      pos += 1;
      let str = '';
      while (pos < cleaned.length && cleaned[pos] !== '"') {
        if (cleaned[pos] === '\\' && pos + 1 < cleaned.length) {
          pos += 1;
        }
        str += cleaned[pos];
        pos += 1;
      }
      pos += 1;
      return str;
    }
    if (ch === '[') {
      pos += 1;
      const arr: unknown[] = [];
      skipWs();
      while (pos < cleaned.length && cleaned[pos] !== ']') {
        arr.push(parseValue());
        skipWs();
      }
      pos += 1;
      return arr;
    }
    if (ch === '{') {
      pos += 1;
      const obj: Record<string, unknown> = {};
      skipWs();
      while (pos < cleaned.length && cleaned[pos] !== '}') {
        const k = readIdent();
        skipWs();
        if (cleaned[pos] === ':') pos += 1;
        obj[k] = parseValue();
        skipWs();
      }
      pos += 1;
      return obj;
    }
    if (ch === '-' || /[0-9]/.test(ch)) {
      const start = pos;
      while (pos < cleaned.length && /[-0-9.]/.test(cleaned[pos])) pos += 1;
      return Number(cleaned.slice(start, pos));
    }
    const word = readIdent();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return word;
  };

  const parseArguments = (): Record<string, unknown> => {
    const args: Record<string, unknown> = {};
    skipWs();
    if (cleaned[pos] !== '(') return args;
    pos += 1;
    skipWs();
    while (pos < cleaned.length && cleaned[pos] !== ')') {
      const argName = readIdent();
      skipWs();
      if (cleaned[pos] === ':') pos += 1;
      args[argName] = parseValue();
      skipWs();
    }
    if (cleaned[pos] === ')') pos += 1;
    return args;
  };

  const parseSelectionSet = (): SelectionNode[] => {
    const nodes: SelectionNode[] = [];
    skipWs();
    if (cleaned[pos] !== '{') return nodes;
    pos += 1;
    skipWs();
    while (pos < cleaned.length && cleaned[pos] !== '}') {
      const firstIdent = readIdent();
      if (!firstIdent) {
        pos += 1;
        continue;
      }
      skipWs();
      let alias: string | undefined;
      let fieldName = firstIdent;
      if (cleaned[pos] === ':') {
        pos += 1;
        alias = firstIdent;
        fieldName = readIdent();
      }
      const args = parseArguments();
      skipWs();
      const selections = cleaned[pos] === '{' ? parseSelectionSet() : [];
      nodes.push({ name: fieldName, alias, args, selections });
      skipWs();
    }
    if (cleaned[pos] === '}') pos += 1;
    return nodes;
  };

  skipWs();
  if (cleaned[pos] !== '{') {
    const opKeyword = readIdent();
    if (
      opKeyword === 'query' ||
      opKeyword === 'mutation' ||
      opKeyword === 'subscription'
    ) {
      operationType = opKeyword;
    }
    skipWs();
    if (/[A-Za-z_]/.test(cleaned[pos] ?? '')) {
      readIdent(); // operation name
    }
    skipWs();
    if (cleaned[pos] === '(') {
      let depth = 0;
      while (pos < cleaned.length) {
        if (cleaned[pos] === '(') depth += 1;
        else if (cleaned[pos] === ')') {
          depth -= 1;
          if (depth === 0) {
            pos += 1;
            break;
          }
        }
        pos += 1;
      }
    }
  }

  const selections = parseSelectionSet();
  return { operationType, selections };
}
