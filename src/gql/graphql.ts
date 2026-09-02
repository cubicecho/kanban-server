import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: { input: string; output: string; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: unknown; output: unknown; }
};

export type Agent = {
  baseUrl: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  lanes: Array<Lane>;
  lanesAggregate: LaneAggregate;
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['String']['output'];
  name: Scalars['String']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  role: Role;
  roleId: Scalars['String']['output'];
  runs: Array<Run>;
  runsAggregate: RunAggregate;
  servers: Array<AgentServer>;
  serversAggregate: AgentServerAggregate;
  systemPrompt: Scalars['String']['output'];
  temperature: Scalars['Float']['output'];
  toolDiscovery: AgentsToolDiscoveryEnum;
  updatedAt: Scalars['DateTime']['output'];
};


export type AgentLanesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<LaneDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LaneOrderBy>;
  where?: InputMaybe<LaneFilters>;
};


export type AgentLanesAggregateArgs = {
  where?: InputMaybe<LaneFilters>;
};


export type AgentRoleArgs = {
  where?: InputMaybe<RoleFilters>;
};


export type AgentRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<RunDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RunOrderBy>;
  where?: InputMaybe<RunFilters>;
};


export type AgentRunsAggregateArgs = {
  where?: InputMaybe<RunFilters>;
};


export type AgentServersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<AgentServerDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentServerOrderBy>;
  where?: InputMaybe<AgentServerFilters>;
};


export type AgentServersAggregateArgs = {
  where?: InputMaybe<AgentServerFilters>;
};

export type AgentAggregate = {
  avg?: Maybe<AgentAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<AgentCountDistinctAggregate>;
  countNonNull?: Maybe<AgentCountNonNullAggregate>;
  max?: Maybe<AgentMaxAggregate>;
  min?: Maybe<AgentMinAggregate>;
  sum?: Maybe<AgentSumAggregate>;
};

export type AgentAvgAggregate = {
  maxRetries?: Maybe<Scalars['Float']['output']>;
  maxTokens?: Maybe<Scalars['Float']['output']>;
  maxToolIterations?: Maybe<Scalars['Float']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Float']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
};

export type AgentAvgHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
};

export type AgentCountDistinctAggregate = {
  baseUrl: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  roleId: Scalars['Int']['output'];
  systemPrompt: Scalars['Int']['output'];
  temperature: Scalars['Int']['output'];
  toolDiscovery: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type AgentCountDistinctHaving = {
  baseUrl?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  model?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  roleId?: InputMaybe<AggregateNumberFilter>;
  systemPrompt?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  toolDiscovery?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type AgentCountNonNullAggregate = {
  baseUrl: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  enabled: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  roleId: Scalars['Int']['output'];
  systemPrompt: Scalars['Int']['output'];
  temperature: Scalars['Int']['output'];
  toolDiscovery: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type AgentCountNonNullHaving = {
  baseUrl?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  enabled?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  model?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  roleId?: InputMaybe<AggregateNumberFilter>;
  systemPrompt?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  toolDiscovery?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Agent that a query can be made distinct on */
export enum AgentDistinctColumn {
  BaseUrl = 'baseUrl',
  CreatedAt = 'createdAt',
  Enabled = 'enabled',
  Id = 'id',
  MaxRetries = 'maxRetries',
  MaxTokens = 'maxTokens',
  MaxToolIterations = 'maxToolIterations',
  Model = 'model',
  Name = 'name',
  RequestTimeoutSeconds = 'requestTimeoutSeconds',
  RoleId = 'roleId',
  SystemPrompt = 'systemPrompt',
  Temperature = 'temperature',
  ToolDiscovery = 'toolDiscovery',
  UpdatedAt = 'updatedAt'
}

export type AgentFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<AgentFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<AgentFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<AgentFilters>>;
  baseUrl?: InputMaybe<StringFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  enabled?: InputMaybe<BooleanFilter>;
  id?: InputMaybe<StringFilter>;
  lanes?: InputMaybe<LaneListRelationFilter>;
  maxRetries?: InputMaybe<IntFilter>;
  maxTokens?: InputMaybe<IntFilter>;
  maxToolIterations?: InputMaybe<IntFilter>;
  model?: InputMaybe<StringFilter>;
  name?: InputMaybe<StringFilter>;
  requestTimeoutSeconds?: InputMaybe<IntFilter>;
  /** Matches rows whose role matches these filters */
  role?: InputMaybe<RoleFilters>;
  roleId?: InputMaybe<StringFilter>;
  runs?: InputMaybe<RunListRelationFilter>;
  servers?: InputMaybe<AgentServerListRelationFilter>;
  systemPrompt?: InputMaybe<StringFilter>;
  temperature?: InputMaybe<FloatFilter>;
  toolDiscovery?: InputMaybe<AgentsToolDiscoveryEnumFilter>;
  updatedAt?: InputMaybe<DateTimeFilter>;
};

export type AgentGroupBy = {
  avg?: Maybe<AgentAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<AgentCountDistinctAggregate>;
  countNonNull?: Maybe<AgentCountNonNullAggregate>;
  group: AgentGroupKeys;
  max?: Maybe<AgentMaxAggregate>;
  min?: Maybe<AgentMinAggregate>;
  sum?: Maybe<AgentSumAggregate>;
};

/** Columns of Agent that a query can group by */
export enum AgentGroupByColumn {
  BaseUrl = 'baseUrl',
  CreatedAt = 'createdAt',
  Enabled = 'enabled',
  Id = 'id',
  MaxRetries = 'maxRetries',
  MaxTokens = 'maxTokens',
  MaxToolIterations = 'maxToolIterations',
  Model = 'model',
  Name = 'name',
  RequestTimeoutSeconds = 'requestTimeoutSeconds',
  RoleId = 'roleId',
  SystemPrompt = 'systemPrompt',
  Temperature = 'temperature',
  ToolDiscovery = 'toolDiscovery',
  UpdatedAt = 'updatedAt'
}

/** The grouped column values of one Agent group. A column the query did not group by is null. */
export type AgentGroupKeys = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  enabled?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  roleId?: Maybe<Scalars['String']['output']>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<AgentsToolDiscoveryEnum>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Filters Agent groups by their aggregated values */
export type AgentHaving = {
  avg?: InputMaybe<AgentAvgHaving>;
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<AgentCountDistinctHaving>;
  countNonNull?: InputMaybe<AgentCountNonNullHaving>;
  max?: InputMaybe<AgentMaxHaving>;
  min?: InputMaybe<AgentMinHaving>;
  sum?: InputMaybe<AgentSumHaving>;
};

export type AgentListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<AgentFilters>;
  /** No related row matches */
  none?: InputMaybe<AgentFilters>;
  /** At least one related row matches */
  some?: InputMaybe<AgentFilters>;
};

export type AgentMaxAggregate = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  roleId?: Maybe<Scalars['String']['output']>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<AgentsToolDiscoveryEnum>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AgentMaxHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
};

export type AgentMinAggregate = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  roleId?: Maybe<Scalars['String']['output']>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<AgentsToolDiscoveryEnum>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AgentMinHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
};

export type AgentOrderBy = {
  baseUrl?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  enabled?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  maxRetries?: InputMaybe<InnerOrder>;
  maxTokens?: InputMaybe<InnerOrder>;
  maxToolIterations?: InputMaybe<InnerOrder>;
  model?: InputMaybe<InnerOrder>;
  name?: InputMaybe<InnerOrder>;
  requestTimeoutSeconds?: InputMaybe<InnerOrder>;
  /** Order by columns of the related role row */
  role?: InputMaybe<RoleOrderBy>;
  roleId?: InputMaybe<InnerOrder>;
  systemPrompt?: InputMaybe<InnerOrder>;
  temperature?: InputMaybe<InnerOrder>;
  toolDiscovery?: InputMaybe<InnerOrder>;
  updatedAt?: InputMaybe<InnerOrder>;
};

export type AgentServer = {
  agent: Agent;
  agentId: Scalars['String']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  server: McpServer;
  serverId: Scalars['String']['output'];
};


export type AgentServerAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type AgentServerServerArgs = {
  where?: InputMaybe<McpServerFilters>;
};

export type AgentServerAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<AgentServerCountDistinctAggregate>;
  countNonNull?: Maybe<AgentServerCountNonNullAggregate>;
  max?: Maybe<AgentServerMaxAggregate>;
  min?: Maybe<AgentServerMinAggregate>;
};

export type AgentServerCountDistinctAggregate = {
  agentId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  serverId: Scalars['Int']['output'];
};

export type AgentServerCountDistinctHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  serverId?: InputMaybe<AggregateNumberFilter>;
};

export type AgentServerCountNonNullAggregate = {
  agentId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  serverId: Scalars['Int']['output'];
};

export type AgentServerCountNonNullHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  serverId?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of AgentServer that a query can be made distinct on */
export enum AgentServerDistinctColumn {
  AgentId = 'agentId',
  Id = 'id',
  ServerId = 'serverId'
}

export type AgentServerFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<AgentServerFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<AgentServerFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<AgentServerFilters>>;
  /** Matches rows whose agent matches these filters */
  agent?: InputMaybe<AgentFilters>;
  agentId?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  /** Matches rows whose server matches these filters */
  server?: InputMaybe<McpServerFilters>;
  serverId?: InputMaybe<StringFilter>;
};

export type AgentServerGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<AgentServerCountDistinctAggregate>;
  countNonNull?: Maybe<AgentServerCountNonNullAggregate>;
  group: AgentServerGroupKeys;
  max?: Maybe<AgentServerMaxAggregate>;
  min?: Maybe<AgentServerMinAggregate>;
};

/** Columns of AgentServer that a query can group by */
export enum AgentServerGroupByColumn {
  AgentId = 'agentId',
  Id = 'id',
  ServerId = 'serverId'
}

/** The grouped column values of one AgentServer group. A column the query did not group by is null. */
export type AgentServerGroupKeys = {
  agentId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  serverId?: Maybe<Scalars['String']['output']>;
};

/** Filters AgentServer groups by their aggregated values */
export type AgentServerHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<AgentServerCountDistinctHaving>;
  countNonNull?: InputMaybe<AgentServerCountNonNullHaving>;
};

export type AgentServerListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<AgentServerFilters>;
  /** No related row matches */
  none?: InputMaybe<AgentServerFilters>;
  /** At least one related row matches */
  some?: InputMaybe<AgentServerFilters>;
};

export type AgentServerMaxAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  serverId?: Maybe<Scalars['String']['output']>;
};

export type AgentServerMinAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  serverId?: Maybe<Scalars['String']['output']>;
};

export type AgentServerOrderBy = {
  /** Order by columns of the related agent row */
  agent?: InputMaybe<AgentOrderBy>;
  agentId?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  /** Order by columns of the related server row */
  server?: InputMaybe<McpServerOrderBy>;
  serverId?: InputMaybe<InnerOrder>;
};

export type AgentSumAggregate = {
  maxRetries?: Maybe<Scalars['Float']['output']>;
  maxTokens?: Maybe<Scalars['Float']['output']>;
  maxToolIterations?: Maybe<Scalars['Float']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Float']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
};

export type AgentSumHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
};

export enum AgentsToolDiscoveryEnum {
  /** Value: eager */
  Eager = 'eager',
  /** Value: inherit */
  Inherit = 'inherit',
  /** Value: ondemand */
  Ondemand = 'ondemand'
}

export type AgentsToolDiscoveryEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<AgentsToolDiscoveryEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<AgentsToolDiscoveryEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<AgentsToolDiscoveryEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<AgentsToolDiscoveryEnum>;
  /** Greater than */
  gt?: InputMaybe<AgentsToolDiscoveryEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<AgentsToolDiscoveryEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<AgentsToolDiscoveryEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<AgentsToolDiscoveryEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<AgentsToolDiscoveryEnum>;
  /** Not equal to */
  ne?: InputMaybe<AgentsToolDiscoveryEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<AgentsToolDiscoveryEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

/** Compares an aggregated value. Several operators in one filter are ANDed together. */
export type AggregateNumberFilter = {
  eq?: InputMaybe<Scalars['Float']['input']>;
  gt?: InputMaybe<Scalars['Float']['input']>;
  gte?: InputMaybe<Scalars['Float']['input']>;
  lt?: InputMaybe<Scalars['Float']['input']>;
  lte?: InputMaybe<Scalars['Float']['input']>;
  ne?: InputMaybe<Scalars['Float']['input']>;
};

export type BoardTemplate = {
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lanes: Scalars['JSON']['output'];
  name: Scalars['String']['output'];
};

export type BoardTemplateAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<BoardTemplateCountDistinctAggregate>;
  countNonNull?: Maybe<BoardTemplateCountNonNullAggregate>;
  max?: Maybe<BoardTemplateMaxAggregate>;
  min?: Maybe<BoardTemplateMinAggregate>;
};

export type BoardTemplateCountDistinctAggregate = {
  createdAt: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
};

export type BoardTemplateCountDistinctHaving = {
  createdAt?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
};

export type BoardTemplateCountNonNullAggregate = {
  createdAt: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  lanes: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
};

export type BoardTemplateCountNonNullHaving = {
  createdAt?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  lanes?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of BoardTemplate that a query can be made distinct on */
export enum BoardTemplateDistinctColumn {
  CreatedAt = 'createdAt',
  Description = 'description',
  Id = 'id',
  Lanes = 'lanes',
  Name = 'name'
}

export type BoardTemplateFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<BoardTemplateFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<BoardTemplateFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<BoardTemplateFilters>>;
  createdAt?: InputMaybe<DateTimeFilter>;
  description?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  lanes?: InputMaybe<JsonFilter>;
  name?: InputMaybe<StringFilter>;
};

export type BoardTemplateGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<BoardTemplateCountDistinctAggregate>;
  countNonNull?: Maybe<BoardTemplateCountNonNullAggregate>;
  group: BoardTemplateGroupKeys;
  max?: Maybe<BoardTemplateMaxAggregate>;
  min?: Maybe<BoardTemplateMinAggregate>;
};

/** Columns of BoardTemplate that a query can group by */
export enum BoardTemplateGroupByColumn {
  CreatedAt = 'createdAt',
  Description = 'description',
  Id = 'id',
  Name = 'name'
}

/** The grouped column values of one BoardTemplate group. A column the query did not group by is null. */
export type BoardTemplateGroupKeys = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** Filters BoardTemplate groups by their aggregated values */
export type BoardTemplateHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<BoardTemplateCountDistinctHaving>;
  countNonNull?: InputMaybe<BoardTemplateCountNonNullHaving>;
};

export type BoardTemplateMaxAggregate = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type BoardTemplateMinAggregate = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type BoardTemplateOrderBy = {
  createdAt?: InputMaybe<InnerOrder>;
  description?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  lanes?: InputMaybe<InnerOrder>;
  name?: InputMaybe<InnerOrder>;
};

export type BooleanFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<BooleanFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<BooleanFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<BooleanFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<Scalars['Boolean']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['Boolean']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['Boolean']['input']>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['Boolean']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['Boolean']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['Boolean']['input']>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Card = {
  acceptance: Scalars['String']['output'];
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  deps: Array<CardDep>;
  depsAggregate: CardDepAggregate;
  error: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lane: Lane;
  laneId: Scalars['String']['output'];
  position: Scalars['Int']['output'];
  project: Project;
  projectId: Scalars['String']['output'];
  result: Scalars['String']['output'];
  runs: Array<Run>;
  runsAggregate: RunAggregate;
  status: CardsStatusEnum;
  task?: Maybe<Task>;
  taskId?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


export type CardDepsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDepDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardDepOrderBy>;
  where?: InputMaybe<CardDepFilters>;
};


export type CardDepsAggregateArgs = {
  where?: InputMaybe<CardDepFilters>;
};


export type CardLaneArgs = {
  where?: InputMaybe<LaneFilters>;
};


export type CardProjectArgs = {
  where?: InputMaybe<ProjectFilters>;
};


export type CardRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<RunDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RunOrderBy>;
  where?: InputMaybe<RunFilters>;
};


export type CardRunsAggregateArgs = {
  where?: InputMaybe<RunFilters>;
};


export type CardTaskArgs = {
  where?: InputMaybe<TaskFilters>;
};

export type CardAggregate = {
  avg?: Maybe<CardAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<CardCountDistinctAggregate>;
  countNonNull?: Maybe<CardCountNonNullAggregate>;
  max?: Maybe<CardMaxAggregate>;
  min?: Maybe<CardMinAggregate>;
  sum?: Maybe<CardSumAggregate>;
};

export type CardAvgAggregate = {
  position?: Maybe<Scalars['Float']['output']>;
};

export type CardAvgHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
};

export type CardCountDistinctAggregate = {
  acceptance: Scalars['Int']['output'];
  archivedAt: Scalars['Int']['output'];
  body: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  laneId: Scalars['Int']['output'];
  position: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  result: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
  title: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type CardCountDistinctHaving = {
  acceptance?: InputMaybe<AggregateNumberFilter>;
  archivedAt?: InputMaybe<AggregateNumberFilter>;
  body?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  laneId?: InputMaybe<AggregateNumberFilter>;
  position?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  result?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
  title?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type CardCountNonNullAggregate = {
  acceptance: Scalars['Int']['output'];
  archivedAt: Scalars['Int']['output'];
  body: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  laneId: Scalars['Int']['output'];
  position: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  result: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
  title: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type CardCountNonNullHaving = {
  acceptance?: InputMaybe<AggregateNumberFilter>;
  archivedAt?: InputMaybe<AggregateNumberFilter>;
  body?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  laneId?: InputMaybe<AggregateNumberFilter>;
  position?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  result?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
  title?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type CardDep = {
  card: Card;
  cardId: Scalars['String']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  dependsOnCardId: Scalars['String']['output'];
  id: Scalars['String']['output'];
};


export type CardDepCardArgs = {
  where?: InputMaybe<CardFilters>;
};

export type CardDepAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<CardDepCountDistinctAggregate>;
  countNonNull?: Maybe<CardDepCountNonNullAggregate>;
  max?: Maybe<CardDepMaxAggregate>;
  min?: Maybe<CardDepMinAggregate>;
};

export type CardDepCountDistinctAggregate = {
  cardId: Scalars['Int']['output'];
  dependsOnCardId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
};

export type CardDepCountDistinctHaving = {
  cardId?: InputMaybe<AggregateNumberFilter>;
  dependsOnCardId?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
};

export type CardDepCountNonNullAggregate = {
  cardId: Scalars['Int']['output'];
  dependsOnCardId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
};

export type CardDepCountNonNullHaving = {
  cardId?: InputMaybe<AggregateNumberFilter>;
  dependsOnCardId?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of CardDep that a query can be made distinct on */
export enum CardDepDistinctColumn {
  CardId = 'cardId',
  DependsOnCardId = 'dependsOnCardId',
  Id = 'id'
}

export type CardDepFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<CardDepFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<CardDepFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<CardDepFilters>>;
  /** Matches rows whose card matches these filters */
  card?: InputMaybe<CardFilters>;
  cardId?: InputMaybe<StringFilter>;
  dependsOnCardId?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
};

export type CardDepGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<CardDepCountDistinctAggregate>;
  countNonNull?: Maybe<CardDepCountNonNullAggregate>;
  group: CardDepGroupKeys;
  max?: Maybe<CardDepMaxAggregate>;
  min?: Maybe<CardDepMinAggregate>;
};

/** Columns of CardDep that a query can group by */
export enum CardDepGroupByColumn {
  CardId = 'cardId',
  DependsOnCardId = 'dependsOnCardId',
  Id = 'id'
}

/** The grouped column values of one CardDep group. A column the query did not group by is null. */
export type CardDepGroupKeys = {
  cardId?: Maybe<Scalars['String']['output']>;
  dependsOnCardId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** Filters CardDep groups by their aggregated values */
export type CardDepHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<CardDepCountDistinctHaving>;
  countNonNull?: InputMaybe<CardDepCountNonNullHaving>;
};

export type CardDepListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<CardDepFilters>;
  /** No related row matches */
  none?: InputMaybe<CardDepFilters>;
  /** At least one related row matches */
  some?: InputMaybe<CardDepFilters>;
};

export type CardDepMaxAggregate = {
  cardId?: Maybe<Scalars['String']['output']>;
  dependsOnCardId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

export type CardDepMinAggregate = {
  cardId?: Maybe<Scalars['String']['output']>;
  dependsOnCardId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

export type CardDepOrderBy = {
  /** Order by columns of the related card row */
  card?: InputMaybe<CardOrderBy>;
  cardId?: InputMaybe<InnerOrder>;
  dependsOnCardId?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
};

/** Columns of Card that a query can be made distinct on */
export enum CardDistinctColumn {
  Acceptance = 'acceptance',
  ArchivedAt = 'archivedAt',
  Body = 'body',
  CreatedAt = 'createdAt',
  Error = 'error',
  Id = 'id',
  LaneId = 'laneId',
  Position = 'position',
  ProjectId = 'projectId',
  Result = 'result',
  Status = 'status',
  TaskId = 'taskId',
  Title = 'title',
  UpdatedAt = 'updatedAt'
}

export type CardFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<CardFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<CardFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<CardFilters>>;
  acceptance?: InputMaybe<StringFilter>;
  archivedAt?: InputMaybe<DateTimeFilter>;
  body?: InputMaybe<StringFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  deps?: InputMaybe<CardDepListRelationFilter>;
  error?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  /** Matches rows whose lane matches these filters */
  lane?: InputMaybe<LaneFilters>;
  laneId?: InputMaybe<StringFilter>;
  position?: InputMaybe<IntFilter>;
  /** Matches rows whose project matches these filters */
  project?: InputMaybe<ProjectFilters>;
  projectId?: InputMaybe<StringFilter>;
  result?: InputMaybe<StringFilter>;
  runs?: InputMaybe<RunListRelationFilter>;
  status?: InputMaybe<CardsStatusEnumFilter>;
  /** Matches rows whose task matches these filters */
  task?: InputMaybe<TaskFilters>;
  taskId?: InputMaybe<StringFilter>;
  title?: InputMaybe<StringFilter>;
  updatedAt?: InputMaybe<DateTimeFilter>;
};

export type CardGroupBy = {
  avg?: Maybe<CardAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<CardCountDistinctAggregate>;
  countNonNull?: Maybe<CardCountNonNullAggregate>;
  group: CardGroupKeys;
  max?: Maybe<CardMaxAggregate>;
  min?: Maybe<CardMinAggregate>;
  sum?: Maybe<CardSumAggregate>;
};

/** Columns of Card that a query can group by */
export enum CardGroupByColumn {
  Acceptance = 'acceptance',
  ArchivedAt = 'archivedAt',
  Body = 'body',
  CreatedAt = 'createdAt',
  Error = 'error',
  Id = 'id',
  LaneId = 'laneId',
  Position = 'position',
  ProjectId = 'projectId',
  Result = 'result',
  Status = 'status',
  TaskId = 'taskId',
  Title = 'title',
  UpdatedAt = 'updatedAt'
}

/** The grouped column values of one Card group. A column the query did not group by is null. */
export type CardGroupKeys = {
  acceptance?: Maybe<Scalars['String']['output']>;
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  laneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  result?: Maybe<Scalars['String']['output']>;
  status?: Maybe<CardsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Filters Card groups by their aggregated values */
export type CardHaving = {
  avg?: InputMaybe<CardAvgHaving>;
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<CardCountDistinctHaving>;
  countNonNull?: InputMaybe<CardCountNonNullHaving>;
  max?: InputMaybe<CardMaxHaving>;
  min?: InputMaybe<CardMinHaving>;
  sum?: InputMaybe<CardSumHaving>;
};

export type CardListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<CardFilters>;
  /** No related row matches */
  none?: InputMaybe<CardFilters>;
  /** At least one related row matches */
  some?: InputMaybe<CardFilters>;
};

export type CardMaxAggregate = {
  acceptance?: Maybe<Scalars['String']['output']>;
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  laneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  result?: Maybe<Scalars['String']['output']>;
  status?: Maybe<CardsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CardMaxHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
};

export type CardMinAggregate = {
  acceptance?: Maybe<Scalars['String']['output']>;
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  laneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  result?: Maybe<Scalars['String']['output']>;
  status?: Maybe<CardsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CardMinHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
};

export type CardOrderBy = {
  acceptance?: InputMaybe<InnerOrder>;
  archivedAt?: InputMaybe<InnerOrder>;
  body?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  error?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  /** Order by columns of the related lane row */
  lane?: InputMaybe<LaneOrderBy>;
  laneId?: InputMaybe<InnerOrder>;
  position?: InputMaybe<InnerOrder>;
  /** Order by columns of the related project row */
  project?: InputMaybe<ProjectOrderBy>;
  projectId?: InputMaybe<InnerOrder>;
  result?: InputMaybe<InnerOrder>;
  status?: InputMaybe<InnerOrder>;
  /** Order by columns of the related task row */
  task?: InputMaybe<TaskOrderBy>;
  taskId?: InputMaybe<InnerOrder>;
  title?: InputMaybe<InnerOrder>;
  updatedAt?: InputMaybe<InnerOrder>;
};

export type CardSumAggregate = {
  position?: Maybe<Scalars['Float']['output']>;
};

export type CardSumHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
};

export enum CardsStatusEnum {
  /** Value: blocked */
  Blocked = 'blocked',
  /** Value: done */
  Done = 'done',
  /** Value: error */
  Error = 'error',
  /** Value: idle */
  Idle = 'idle',
  /** Value: running */
  Running = 'running'
}

export type CardsStatusEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<CardsStatusEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<CardsStatusEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<CardsStatusEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<CardsStatusEnum>;
  /** Greater than */
  gt?: InputMaybe<CardsStatusEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<CardsStatusEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<CardsStatusEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<CardsStatusEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<CardsStatusEnum>;
  /** Not equal to */
  ne?: InputMaybe<CardsStatusEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<CardsStatusEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type CreateAgentInput = {
  baseUrl?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  maxRetries?: InputMaybe<Scalars['Int']['input']>;
  maxTokens?: InputMaybe<Scalars['Int']['input']>;
  maxToolIterations?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  requestTimeoutSeconds?: InputMaybe<Scalars['Int']['input']>;
  roleId: Scalars['String']['input'];
  systemPrompt?: InputMaybe<Scalars['String']['input']>;
  temperature?: InputMaybe<Scalars['Float']['input']>;
  toolDiscovery?: InputMaybe<AgentsToolDiscoveryEnum>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateAgentServerInput = {
  agentId: Scalars['String']['input'];
  id?: InputMaybe<Scalars['String']['input']>;
  serverId: Scalars['String']['input'];
};

export type CreateCardDepInput = {
  cardId: Scalars['String']['input'];
  dependsOnCardId: Scalars['String']['input'];
  id?: InputMaybe<Scalars['String']['input']>;
};

export type CreateCardInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  archivedAt?: InputMaybe<Scalars['DateTime']['input']>;
  body?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  error?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  laneId: Scalars['String']['input'];
  position?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['String']['input'];
  result?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<CardsStatusEnum>;
  taskId?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateLaneInput = {
  agentId?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  intake?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  onFailureLaneId?: InputMaybe<Scalars['String']['input']>;
  onSuccessLaneId?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['String']['input'];
  readVerdict?: InputMaybe<Scalars['Boolean']['input']>;
  wipLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateMcpServerInput = {
  args?: InputMaybe<Scalars['JSON']['input']>;
  command?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  env?: InputMaybe<Scalars['JSON']['input']>;
  headers?: InputMaybe<Scalars['JSON']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  slug: Scalars['String']['input'];
  transport?: InputMaybe<McpServersTransportEnum>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type CreateMessageInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<MessagesRoleEnum>;
  taskId: Scalars['String']['input'];
};

export type CreateProjectInput = {
  autoRun?: InputMaybe<Scalars['Boolean']['input']>;
  context?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  decomposeAgentId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  refineAgentId?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateRoleInput = {
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  stage?: InputMaybe<RolesStageEnum>;
  systemPrompt?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateTaskInput = {
  brief?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  error?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  projectId: Scalars['String']['input'];
  status?: InputMaybe<TasksStatusEnum>;
  title?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type DateTimeFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<DateTimeFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<DateTimeFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<DateTimeFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<Scalars['DateTime']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['DateTime']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['DateTime']['input']>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['DateTime']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['DateTime']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['DateTime']['input']>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type FloatFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<FloatFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<FloatFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<FloatFilter>>;
  /** Equal to */
  eq?: InputMaybe<Scalars['Float']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['Float']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['Float']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<Scalars['Float']['input']>>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['Float']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['Float']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['Float']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<Scalars['Float']['input']>>;
};

export type InnerOrder = {
  direction: OrderDirection;
  /** Sort by this column's position in the `inArray` list the same request's `where` gives it, rather than by the column's own value — `direction: asc` keeps the list's order, `desc` reverses it. Requires an `inArray` filter on the same column at the top level of `where`, and cannot be combined with `after` or `distinct`. */
  matchFilterOrder?: InputMaybe<Scalars['Boolean']['input']>;
  /** Where NULL values sort. Defaults to the database's own rule (PostgreSQL: last on asc, first on desc; MySQL/SQLite: first on asc, last on desc) */
  nulls?: InputMaybe<OrderNulls>;
  /** Priority of current field */
  priority: Scalars['Int']['input'];
};

export type IntFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<IntFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<IntFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<IntFilter>>;
  /** Equal to */
  eq?: InputMaybe<Scalars['Int']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['Int']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['Int']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['Int']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['Int']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['Int']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type JsonFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<JsonFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<JsonFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<JsonFilter>>;
  /** Value structurally contains this JSON (Postgres `@>` / MySQL JSON_CONTAINS) */
  contains?: InputMaybe<Scalars['JSON']['input']>;
  /** JSON equality on the whole value */
  eq?: InputMaybe<Scalars['JSON']['input']>;
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** JSON inequality on the whole value */
  ne?: InputMaybe<Scalars['JSON']['input']>;
  /** Compares the value at one path inside the document. Several entries are ANDed; a single object may be passed without the list brackets. */
  path?: InputMaybe<Array<JsonPathFilter>>;
};

/** How to read the value at a JSON path before comparing it */
export enum JsonPathCast {
  /** Compare as a boolean */
  Boolean = 'BOOLEAN',
  /** Compare as a number; a non-numeric value never matches */
  Number = 'NUMBER',
  /** Compare as text (lexicographic ordering) */
  Text = 'TEXT'
}

export type JsonPathFilter = {
  /** Overrides how the value is read before comparing */
  as?: InputMaybe<JsonPathCast>;
  /** Extracted value contains this string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Extracted value ends with this string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<Scalars['JSON']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['JSON']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['JSON']['input']>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  /** When true, matches rows where the path holds a value */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the path is missing or holds JSON null */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['JSON']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['JSON']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['JSON']['input']>;
  /** Keys to walk from the document root, e.g. `["profile", "level"]`. An all-digits key indexes an array. */
  path: Array<Scalars['String']['input']>;
  /** Extracted value starts with this string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Lane = {
  agent?: Maybe<Agent>;
  agentId?: Maybe<Scalars['String']['output']>;
  cards: Array<Card>;
  cardsAggregate: CardAggregate;
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  intake: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  onFailureLaneId?: Maybe<Scalars['String']['output']>;
  onSuccessLaneId?: Maybe<Scalars['String']['output']>;
  position: Scalars['Int']['output'];
  project: Project;
  projectId: Scalars['String']['output'];
  readVerdict: Scalars['Boolean']['output'];
  wipLimit: Scalars['Int']['output'];
};


export type LaneAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type LaneCardsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardOrderBy>;
  where?: InputMaybe<CardFilters>;
};


export type LaneCardsAggregateArgs = {
  where?: InputMaybe<CardFilters>;
};


export type LaneProjectArgs = {
  where?: InputMaybe<ProjectFilters>;
};

export type LaneAggregate = {
  avg?: Maybe<LaneAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<LaneCountDistinctAggregate>;
  countNonNull?: Maybe<LaneCountNonNullAggregate>;
  max?: Maybe<LaneMaxAggregate>;
  min?: Maybe<LaneMinAggregate>;
  sum?: Maybe<LaneSumAggregate>;
};

export type LaneAvgAggregate = {
  position?: Maybe<Scalars['Float']['output']>;
  wipLimit?: Maybe<Scalars['Float']['output']>;
};

export type LaneAvgHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

export type LaneCountDistinctAggregate = {
  agentId: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  onFailureLaneId: Scalars['Int']['output'];
  onSuccessLaneId: Scalars['Int']['output'];
  position: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  wipLimit: Scalars['Int']['output'];
};

export type LaneCountDistinctHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  onFailureLaneId?: InputMaybe<AggregateNumberFilter>;
  onSuccessLaneId?: InputMaybe<AggregateNumberFilter>;
  position?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

export type LaneCountNonNullAggregate = {
  agentId: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  intake: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  onFailureLaneId: Scalars['Int']['output'];
  onSuccessLaneId: Scalars['Int']['output'];
  position: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  readVerdict: Scalars['Int']['output'];
  wipLimit: Scalars['Int']['output'];
};

export type LaneCountNonNullHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  intake?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  onFailureLaneId?: InputMaybe<AggregateNumberFilter>;
  onSuccessLaneId?: InputMaybe<AggregateNumberFilter>;
  position?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  readVerdict?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Lane that a query can be made distinct on */
export enum LaneDistinctColumn {
  AgentId = 'agentId',
  CreatedAt = 'createdAt',
  Id = 'id',
  Intake = 'intake',
  Name = 'name',
  OnFailureLaneId = 'onFailureLaneId',
  OnSuccessLaneId = 'onSuccessLaneId',
  Position = 'position',
  ProjectId = 'projectId',
  ReadVerdict = 'readVerdict',
  WipLimit = 'wipLimit'
}

export type LaneFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<LaneFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<LaneFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<LaneFilters>>;
  /** Matches rows whose agent matches these filters */
  agent?: InputMaybe<AgentFilters>;
  agentId?: InputMaybe<StringFilter>;
  cards?: InputMaybe<CardListRelationFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  id?: InputMaybe<StringFilter>;
  intake?: InputMaybe<BooleanFilter>;
  name?: InputMaybe<StringFilter>;
  onFailureLaneId?: InputMaybe<StringFilter>;
  onSuccessLaneId?: InputMaybe<StringFilter>;
  position?: InputMaybe<IntFilter>;
  /** Matches rows whose project matches these filters */
  project?: InputMaybe<ProjectFilters>;
  projectId?: InputMaybe<StringFilter>;
  readVerdict?: InputMaybe<BooleanFilter>;
  wipLimit?: InputMaybe<IntFilter>;
};

export type LaneGroupBy = {
  avg?: Maybe<LaneAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<LaneCountDistinctAggregate>;
  countNonNull?: Maybe<LaneCountNonNullAggregate>;
  group: LaneGroupKeys;
  max?: Maybe<LaneMaxAggregate>;
  min?: Maybe<LaneMinAggregate>;
  sum?: Maybe<LaneSumAggregate>;
};

/** Columns of Lane that a query can group by */
export enum LaneGroupByColumn {
  AgentId = 'agentId',
  CreatedAt = 'createdAt',
  Id = 'id',
  Intake = 'intake',
  Name = 'name',
  OnFailureLaneId = 'onFailureLaneId',
  OnSuccessLaneId = 'onSuccessLaneId',
  Position = 'position',
  ProjectId = 'projectId',
  ReadVerdict = 'readVerdict',
  WipLimit = 'wipLimit'
}

/** The grouped column values of one Lane group. A column the query did not group by is null. */
export type LaneGroupKeys = {
  agentId?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  intake?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  onFailureLaneId?: Maybe<Scalars['String']['output']>;
  onSuccessLaneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  readVerdict?: Maybe<Scalars['Boolean']['output']>;
  wipLimit?: Maybe<Scalars['Int']['output']>;
};

/** Filters Lane groups by their aggregated values */
export type LaneHaving = {
  avg?: InputMaybe<LaneAvgHaving>;
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<LaneCountDistinctHaving>;
  countNonNull?: InputMaybe<LaneCountNonNullHaving>;
  max?: InputMaybe<LaneMaxHaving>;
  min?: InputMaybe<LaneMinHaving>;
  sum?: InputMaybe<LaneSumHaving>;
};

export type LaneListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<LaneFilters>;
  /** No related row matches */
  none?: InputMaybe<LaneFilters>;
  /** At least one related row matches */
  some?: InputMaybe<LaneFilters>;
};

export type LaneMaxAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  onFailureLaneId?: Maybe<Scalars['String']['output']>;
  onSuccessLaneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  wipLimit?: Maybe<Scalars['Int']['output']>;
};

export type LaneMaxHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

export type LaneMinAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  onFailureLaneId?: Maybe<Scalars['String']['output']>;
  onSuccessLaneId?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  wipLimit?: Maybe<Scalars['Int']['output']>;
};

export type LaneMinHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

export type LaneOrderBy = {
  /** Order by columns of the related agent row */
  agent?: InputMaybe<AgentOrderBy>;
  agentId?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  intake?: InputMaybe<InnerOrder>;
  name?: InputMaybe<InnerOrder>;
  onFailureLaneId?: InputMaybe<InnerOrder>;
  onSuccessLaneId?: InputMaybe<InnerOrder>;
  position?: InputMaybe<InnerOrder>;
  /** Order by columns of the related project row */
  project?: InputMaybe<ProjectOrderBy>;
  projectId?: InputMaybe<InnerOrder>;
  readVerdict?: InputMaybe<InnerOrder>;
  wipLimit?: InputMaybe<InnerOrder>;
};

export type LaneSumAggregate = {
  position?: Maybe<Scalars['Float']['output']>;
  wipLimit?: Maybe<Scalars['Float']['output']>;
};

export type LaneSumHaving = {
  position?: InputMaybe<AggregateNumberFilter>;
  wipLimit?: InputMaybe<AggregateNumberFilter>;
};

/** How to reach an MCP server — the connection half of a row, without its identity. */
export type McpConnectionInput = {
  args?: InputMaybe<Array<Scalars['String']['input']>>;
  command?: InputMaybe<Scalars['String']['input']>;
  env?: InputMaybe<Scalars['JSON']['input']>;
  headers?: InputMaybe<Scalars['JSON']['input']>;
  transport: Scalars['String']['input'];
  url?: InputMaybe<Scalars['String']['input']>;
};

/** The result of dialling an MCP server once, without saving or pooling it. */
export type McpProbe = {
  error: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
  tools: Array<McpTool>;
};

export type McpServer = {
  agents: Array<AgentServer>;
  agentsAggregate: AgentServerAggregate;
  args?: Maybe<Scalars['JSON']['output']>;
  command: Scalars['String']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  env?: Maybe<Scalars['JSON']['output']>;
  headers?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  transport: McpServersTransportEnum;
  url: Scalars['String']['output'];
};


export type McpServerAgentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<AgentServerDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentServerOrderBy>;
  where?: InputMaybe<AgentServerFilters>;
};


export type McpServerAgentsAggregateArgs = {
  where?: InputMaybe<AgentServerFilters>;
};

export type McpServerAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<McpServerCountDistinctAggregate>;
  countNonNull?: Maybe<McpServerCountNonNullAggregate>;
  max?: Maybe<McpServerMaxAggregate>;
  min?: Maybe<McpServerMinAggregate>;
};

export type McpServerCountDistinctAggregate = {
  command: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  label: Scalars['Int']['output'];
  slug: Scalars['Int']['output'];
  transport: Scalars['Int']['output'];
  url: Scalars['Int']['output'];
};

export type McpServerCountDistinctHaving = {
  command?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  label?: InputMaybe<AggregateNumberFilter>;
  slug?: InputMaybe<AggregateNumberFilter>;
  transport?: InputMaybe<AggregateNumberFilter>;
  url?: InputMaybe<AggregateNumberFilter>;
};

export type McpServerCountNonNullAggregate = {
  args: Scalars['Int']['output'];
  command: Scalars['Int']['output'];
  enabled: Scalars['Int']['output'];
  env: Scalars['Int']['output'];
  headers: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  label: Scalars['Int']['output'];
  slug: Scalars['Int']['output'];
  transport: Scalars['Int']['output'];
  url: Scalars['Int']['output'];
};

export type McpServerCountNonNullHaving = {
  args?: InputMaybe<AggregateNumberFilter>;
  command?: InputMaybe<AggregateNumberFilter>;
  enabled?: InputMaybe<AggregateNumberFilter>;
  env?: InputMaybe<AggregateNumberFilter>;
  headers?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  label?: InputMaybe<AggregateNumberFilter>;
  slug?: InputMaybe<AggregateNumberFilter>;
  transport?: InputMaybe<AggregateNumberFilter>;
  url?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of McpServer that a query can be made distinct on */
export enum McpServerDistinctColumn {
  Args = 'args',
  Command = 'command',
  Enabled = 'enabled',
  Env = 'env',
  Headers = 'headers',
  Id = 'id',
  Label = 'label',
  Slug = 'slug',
  Transport = 'transport',
  Url = 'url'
}

export type McpServerFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<McpServerFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<McpServerFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<McpServerFilters>>;
  agents?: InputMaybe<AgentServerListRelationFilter>;
  args?: InputMaybe<JsonFilter>;
  command?: InputMaybe<StringFilter>;
  enabled?: InputMaybe<BooleanFilter>;
  env?: InputMaybe<JsonFilter>;
  headers?: InputMaybe<JsonFilter>;
  id?: InputMaybe<StringFilter>;
  label?: InputMaybe<StringFilter>;
  slug?: InputMaybe<StringFilter>;
  transport?: InputMaybe<McpServersTransportEnumFilter>;
  url?: InputMaybe<StringFilter>;
};

export type McpServerGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<McpServerCountDistinctAggregate>;
  countNonNull?: Maybe<McpServerCountNonNullAggregate>;
  group: McpServerGroupKeys;
  max?: Maybe<McpServerMaxAggregate>;
  min?: Maybe<McpServerMinAggregate>;
};

/** Columns of McpServer that a query can group by */
export enum McpServerGroupByColumn {
  Command = 'command',
  Enabled = 'enabled',
  Id = 'id',
  Label = 'label',
  Slug = 'slug',
  Transport = 'transport',
  Url = 'url'
}

/** The grouped column values of one McpServer group. A column the query did not group by is null. */
export type McpServerGroupKeys = {
  command?: Maybe<Scalars['String']['output']>;
  enabled?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  transport?: Maybe<McpServersTransportEnum>;
  url?: Maybe<Scalars['String']['output']>;
};

/** Filters McpServer groups by their aggregated values */
export type McpServerHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<McpServerCountDistinctHaving>;
  countNonNull?: InputMaybe<McpServerCountNonNullHaving>;
};

export type McpServerMaxAggregate = {
  command?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  transport?: Maybe<McpServersTransportEnum>;
  url?: Maybe<Scalars['String']['output']>;
};

export type McpServerMinAggregate = {
  command?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  transport?: Maybe<McpServersTransportEnum>;
  url?: Maybe<Scalars['String']['output']>;
};

export type McpServerOrderBy = {
  args?: InputMaybe<InnerOrder>;
  command?: InputMaybe<InnerOrder>;
  enabled?: InputMaybe<InnerOrder>;
  env?: InputMaybe<InnerOrder>;
  headers?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  label?: InputMaybe<InnerOrder>;
  slug?: InputMaybe<InnerOrder>;
  transport?: InputMaybe<InnerOrder>;
  url?: InputMaybe<InnerOrder>;
};

/** Live connection state for a configured MCP server, and the tools it offers. */
export type McpServerStatus = {
  error: Scalars['String']['output'];
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tools: Array<McpTool>;
};

export enum McpServersTransportEnum {
  /** Value: http */
  Http = 'http',
  /** Value: stdio */
  Stdio = 'stdio'
}

export type McpServersTransportEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<McpServersTransportEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<McpServersTransportEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<McpServersTransportEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<McpServersTransportEnum>;
  /** Greater than */
  gt?: InputMaybe<McpServersTransportEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<McpServersTransportEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<McpServersTransportEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<McpServersTransportEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<McpServersTransportEnum>;
  /** Not equal to */
  ne?: InputMaybe<McpServersTransportEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<McpServersTransportEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type McpTool = {
  description: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type Message = {
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  role: MessagesRoleEnum;
  task: Task;
  taskId: Scalars['String']['output'];
};


export type MessageTaskArgs = {
  where?: InputMaybe<TaskFilters>;
};

export type MessageAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<MessageCountDistinctAggregate>;
  countNonNull?: Maybe<MessageCountNonNullAggregate>;
  max?: Maybe<MessageMaxAggregate>;
  min?: Maybe<MessageMinAggregate>;
};

export type MessageCountDistinctAggregate = {
  content: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  role: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
};

export type MessageCountDistinctHaving = {
  content?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  role?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
};

export type MessageCountNonNullAggregate = {
  content: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  role: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
};

export type MessageCountNonNullHaving = {
  content?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  role?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Message that a query can be made distinct on */
export enum MessageDistinctColumn {
  Content = 'content',
  CreatedAt = 'createdAt',
  Id = 'id',
  Role = 'role',
  TaskId = 'taskId'
}

export type MessageFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<MessageFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<MessageFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<MessageFilters>>;
  content?: InputMaybe<StringFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  id?: InputMaybe<StringFilter>;
  role?: InputMaybe<MessagesRoleEnumFilter>;
  /** Matches rows whose task matches these filters */
  task?: InputMaybe<TaskFilters>;
  taskId?: InputMaybe<StringFilter>;
};

export type MessageGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<MessageCountDistinctAggregate>;
  countNonNull?: Maybe<MessageCountNonNullAggregate>;
  group: MessageGroupKeys;
  max?: Maybe<MessageMaxAggregate>;
  min?: Maybe<MessageMinAggregate>;
};

/** Columns of Message that a query can group by */
export enum MessageGroupByColumn {
  Content = 'content',
  CreatedAt = 'createdAt',
  Id = 'id',
  Role = 'role',
  TaskId = 'taskId'
}

/** The grouped column values of one Message group. A column the query did not group by is null. */
export type MessageGroupKeys = {
  content?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  role?: Maybe<MessagesRoleEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
};

/** Filters Message groups by their aggregated values */
export type MessageHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<MessageCountDistinctHaving>;
  countNonNull?: InputMaybe<MessageCountNonNullHaving>;
};

export type MessageListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<MessageFilters>;
  /** No related row matches */
  none?: InputMaybe<MessageFilters>;
  /** At least one related row matches */
  some?: InputMaybe<MessageFilters>;
};

export type MessageMaxAggregate = {
  content?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  role?: Maybe<MessagesRoleEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
};

export type MessageMinAggregate = {
  content?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  role?: Maybe<MessagesRoleEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
};

export type MessageOrderBy = {
  content?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  role?: InputMaybe<InnerOrder>;
  /** Order by columns of the related task row */
  task?: InputMaybe<TaskOrderBy>;
  taskId?: InputMaybe<InnerOrder>;
};

export enum MessagesRoleEnum {
  /** Value: assistant */
  Assistant = 'assistant',
  /** Value: user */
  User = 'user'
}

export type MessagesRoleEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<MessagesRoleEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<MessagesRoleEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<MessagesRoleEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<MessagesRoleEnum>;
  /** Greater than */
  gt?: InputMaybe<MessagesRoleEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<MessagesRoleEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<MessagesRoleEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<MessagesRoleEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<MessagesRoleEnum>;
  /** Not equal to */
  ne?: InputMaybe<MessagesRoleEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<MessagesRoleEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  /** Marks a refined task ready for the decomposer, without running it. `decomposeTask` is the next step, and is what actually produces cards. */
  acceptTask: Task;
  /** Redraws a project's board from a saved template, and answers with the lanes it wrote. Refused once the board has cards on it, archived ones included: replacing lanes takes their cards with them, so this is for a project that has not started rather than a way to rearrange one that has. */
  applyBoardTemplate: Array<Lane>;
  /** Takes a card off the board without deleting it. It stops being drawn in its lane, stops being picked up by that lane's agent, and stops counting as something other cards are waiting on — but it keeps its lane, its status and its result, and `restoreCard` puts it back. This is what a Done pile is for once it is long enough to be in the way. Read the archive with `cards(where: { archivedAt: { isNotNull: true } })`. Refused while an agent is working the card; archiving one already archived leaves the time it was archived alone. */
  archiveCard: Card;
  createAgent: Agent;
  createAgentServer: AgentServer;
  createAgentServers: Array<AgentServer>;
  createAgents: Array<Agent>;
  createCard: Card;
  createCardDep: CardDep;
  createCardDeps: Array<CardDep>;
  createCards: Array<Card>;
  createLane: Lane;
  createLanes: Array<Lane>;
  createMcpServer: McpServer;
  createMcpServers: Array<McpServer>;
  createMessage: Message;
  createMessages: Array<Message>;
  createProject: Project;
  createProjects: Array<Project>;
  createRole: Role;
  createRoles: Array<Role>;
  createTask: Task;
  createTasks: Array<Task>;
  /** Breaks a task into cards and puts them in the project's intake lane, resolving with the finished run — which means it does not answer until the decomposer is done. The cards it wrote are the ones with this `taskId`. A decomposition that produced nothing readable fails, and says so on the task as well as in the run. */
  decomposeTask: Run;
  deleteAgent: Array<Agent>;
  deleteAgentServer: Array<AgentServer>;
  deleteAgentServerSingle?: Maybe<AgentServer>;
  deleteAgentSingle?: Maybe<Agent>;
  deleteBoardTemplate: Array<BoardTemplate>;
  deleteBoardTemplateSingle?: Maybe<BoardTemplate>;
  deleteCard: Array<Card>;
  deleteCardDep: Array<CardDep>;
  deleteCardDepSingle?: Maybe<CardDep>;
  deleteCardSingle?: Maybe<Card>;
  deleteLane: Array<Lane>;
  deleteLaneSingle?: Maybe<Lane>;
  deleteMcpServer: Array<McpServer>;
  deleteMcpServerSingle?: Maybe<McpServer>;
  deleteMessage: Array<Message>;
  deleteMessageSingle?: Maybe<Message>;
  deleteProject: Array<Project>;
  deleteProjectSingle?: Maybe<Project>;
  deleteRole: Array<Role>;
  deleteRoleSingle?: Maybe<Role>;
  deleteRun: Array<Run>;
  deleteRunSingle?: Maybe<Run>;
  deleteTask: Array<Task>;
  deleteTaskSingle?: Maybe<Task>;
  /** Puts a card in a lane, at a position, and renumbers the cards around it so the board stays in the order it looks like. Omit `position` to drop it at the end. A card that had failed comes back to `idle`, which is what makes dragging one back a retry; a card an agent is working cannot be moved out from under it, and nor can an archived one — `restoreCard` is what puts that back on the board. */
  moveCard: Card;
  /** Tears down and rebuilds every MCP connection. */
  reconnectMcp: Array<McpServerStatus>;
  /** One turn of talking a task into shape: says something to the refining agent and resolves once it has answered. The answer is appended to the task's messages and the task's title and brief are rewritten from it, so read the task back after this to see where the brief has got to. Only a `draft` task can be refined. */
  refineTask: Run;
  /** Puts an archived card back on the board, at the end of the lane it was archived from. Its status is left as it was found — a card archived as `error` comes back as one, and `retryCard` is still the way to put that back in play — because what the card was is the reason someone archived it. The end of the lane rather than its old position, which the cards added since have long taken. */
  restoreCard: Card;
  /** Puts a card back in play where it stands: clears its error and returns it to `idle`, which is the status a lane's agent will pick up. This is the way back for a card a reviewer rejected — those stay `error` on purpose, so the board waits for a person rather than looping — and for one interrupted by a restart. It does not run anything itself; `runCard` does that, and `autoRun` does it unasked. Refused while an agent is working the card. */
  retryCard: Card;
  /** Works one card now, with its lane's agent unless `agentId` names another, and resolves with the finished run — a long call for a long card. Read `runEvents` meanwhile to watch it, or `stopCard` to call it off. The card moves on afterwards exactly as it would have under `autoRun`, following its lane's success and failure arrows. Refused for a card waiting on unfinished dependencies. */
  runCard: Run;
  /** Keeps a project's board — its lanes, their agents, their WIP limits and the arrows between them — under a name, so the next project can start with it instead of it being drawn again. Saving under a name that already exists replaces it. The cards are not part of it: a template is the shape of a board, not its contents. */
  saveBoardTemplate: BoardTemplate;
  /** Writes one agent's own API key, for an agent pointed at an endpoint of its own. Write-only, like the shared one. Send an empty string to clear it — an agent with no key of its own borrows the shared one only while it is also on the shared endpoint. */
  setAgentApiKey: Scalars['Boolean']['output'];
  /** Replaces the set of MCP servers an agent may reach, and answers with it. Written as a set rather than a row at a time because that is how it is decided — an agent's tools are the whole of what it can do, and half-applied is a different agent. */
  setAgentServers: Array<Scalars['String']['output']>;
  /** Writes the shared API key. Separate from updateSetting because the key is write-only: it is excluded from the Setting type so it can never be read back out. */
  setApiKey: Scalars['Boolean']['output'];
  /** Replaces what a card waits on, and answers with it. A card with unfinished dependencies is skipped rather than run out of order, so this is how a decomposition that got the order wrong is corrected. Written as a set rather than a row at a time, because half an ordering is not an ordering. Every id has to be a card on the same board, and a cycle is refused — cards that wait on each other would never run, and nothing downstream would say why. */
  setCardDeps: Array<Scalars['String']['output']>;
  /** Calls off the agent working a card. False means none was — a stale button, not a failure. The run is recorded as `stopped` and the card goes back to `idle` where it is, rather than moving on. */
  stopCard: Scalars['Boolean']['output'];
  /** Calls off a refinement or decomposition in flight. False means none was running. */
  stopTask: Scalars['Boolean']['output'];
  /** The short way in, for a caller that already knows what it wants: writes the task and decomposes it in one call, resolving with the task once its cards are on the board. Skips refinement entirely. A decomposition that fails leaves the task in `error` with the reason on it rather than throwing, so the task is still there to retry. */
  submitTask: Task;
  /** Connects to a config that need not be saved yet and lists its tools, so a server can be checked before an agent depends on it. */
  testMcpServer: McpProbe;
  updateAgent: Array<Agent>;
  updateAgentServer: Array<AgentServer>;
  updateAgentServerSingle?: Maybe<AgentServer>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateAgentServersMany: Array<Maybe<AgentServer>>;
  updateAgentSingle?: Maybe<Agent>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateAgentsMany: Array<Maybe<Agent>>;
  updateCard: Array<Card>;
  updateCardDep: Array<CardDep>;
  updateCardDepSingle?: Maybe<CardDep>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateCardDepsMany: Array<Maybe<CardDep>>;
  updateCardSingle?: Maybe<Card>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateCardsMany: Array<Maybe<Card>>;
  updateLane: Array<Lane>;
  updateLaneSingle?: Maybe<Lane>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateLanesMany: Array<Maybe<Lane>>;
  updateMcpServer: Array<McpServer>;
  updateMcpServerSingle?: Maybe<McpServer>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateMcpServersMany: Array<Maybe<McpServer>>;
  updateMessage: Array<Message>;
  updateMessageSingle?: Maybe<Message>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateMessagesMany: Array<Maybe<Message>>;
  updateProject: Array<Project>;
  updateProjectSingle?: Maybe<Project>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateProjectsMany: Array<Maybe<Project>>;
  updateRole: Array<Role>;
  updateRoleSingle?: Maybe<Role>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateRolesMany: Array<Maybe<Role>>;
  updateSetting: Array<Setting>;
  updateSettingSingle?: Maybe<Setting>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateSettingsMany: Array<Maybe<Setting>>;
  updateTask: Array<Task>;
  updateTaskSingle?: Maybe<Task>;
  /** Each entry's updated rows, in entry order. An entry whose `where` matched no rows contributes `null` in its slot; an entry that matched several contributes each of its rows. */
  updateTasksMany: Array<Maybe<Task>>;
};


export type MutationAcceptTaskArgs = {
  taskId: Scalars['String']['input'];
};


export type MutationApplyBoardTemplateArgs = {
  projectId: Scalars['String']['input'];
  templateId: Scalars['String']['input'];
};


export type MutationArchiveCardArgs = {
  cardId: Scalars['String']['input'];
};


export type MutationCreateAgentArgs = {
  values: CreateAgentInput;
};


export type MutationCreateAgentServerArgs = {
  values: CreateAgentServerInput;
};


export type MutationCreateAgentServersArgs = {
  values: Array<CreateAgentServerInput>;
};


export type MutationCreateAgentsArgs = {
  values: Array<CreateAgentInput>;
};


export type MutationCreateCardArgs = {
  values: CreateCardInput;
};


export type MutationCreateCardDepArgs = {
  values: CreateCardDepInput;
};


export type MutationCreateCardDepsArgs = {
  values: Array<CreateCardDepInput>;
};


export type MutationCreateCardsArgs = {
  values: Array<CreateCardInput>;
};


export type MutationCreateLaneArgs = {
  values: CreateLaneInput;
};


export type MutationCreateLanesArgs = {
  values: Array<CreateLaneInput>;
};


export type MutationCreateMcpServerArgs = {
  values: CreateMcpServerInput;
};


export type MutationCreateMcpServersArgs = {
  values: Array<CreateMcpServerInput>;
};


export type MutationCreateMessageArgs = {
  values: CreateMessageInput;
};


export type MutationCreateMessagesArgs = {
  values: Array<CreateMessageInput>;
};


export type MutationCreateProjectArgs = {
  values: CreateProjectInput;
};


export type MutationCreateProjectsArgs = {
  values: Array<CreateProjectInput>;
};


export type MutationCreateRoleArgs = {
  values: CreateRoleInput;
};


export type MutationCreateRolesArgs = {
  values: Array<CreateRoleInput>;
};


export type MutationCreateTaskArgs = {
  values: CreateTaskInput;
};


export type MutationCreateTasksArgs = {
  values: Array<CreateTaskInput>;
};


export type MutationDecomposeTaskArgs = {
  taskId: Scalars['String']['input'];
};


export type MutationDeleteAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type MutationDeleteAgentServerArgs = {
  where?: InputMaybe<AgentServerFilters>;
};


export type MutationDeleteAgentServerSingleArgs = {
  where: AgentServerFilters;
};


export type MutationDeleteAgentSingleArgs = {
  where: AgentFilters;
};


export type MutationDeleteBoardTemplateArgs = {
  where?: InputMaybe<BoardTemplateFilters>;
};


export type MutationDeleteBoardTemplateSingleArgs = {
  where: BoardTemplateFilters;
};


export type MutationDeleteCardArgs = {
  where?: InputMaybe<CardFilters>;
};


export type MutationDeleteCardDepArgs = {
  where?: InputMaybe<CardDepFilters>;
};


export type MutationDeleteCardDepSingleArgs = {
  where: CardDepFilters;
};


export type MutationDeleteCardSingleArgs = {
  where: CardFilters;
};


export type MutationDeleteLaneArgs = {
  where?: InputMaybe<LaneFilters>;
};


export type MutationDeleteLaneSingleArgs = {
  where: LaneFilters;
};


export type MutationDeleteMcpServerArgs = {
  where?: InputMaybe<McpServerFilters>;
};


export type MutationDeleteMcpServerSingleArgs = {
  where: McpServerFilters;
};


export type MutationDeleteMessageArgs = {
  where?: InputMaybe<MessageFilters>;
};


export type MutationDeleteMessageSingleArgs = {
  where: MessageFilters;
};


export type MutationDeleteProjectArgs = {
  where?: InputMaybe<ProjectFilters>;
};


export type MutationDeleteProjectSingleArgs = {
  where: ProjectFilters;
};


export type MutationDeleteRoleArgs = {
  where?: InputMaybe<RoleFilters>;
};


export type MutationDeleteRoleSingleArgs = {
  where: RoleFilters;
};


export type MutationDeleteRunArgs = {
  where?: InputMaybe<RunFilters>;
};


export type MutationDeleteRunSingleArgs = {
  where: RunFilters;
};


export type MutationDeleteTaskArgs = {
  where?: InputMaybe<TaskFilters>;
};


export type MutationDeleteTaskSingleArgs = {
  where: TaskFilters;
};


export type MutationMoveCardArgs = {
  cardId: Scalars['String']['input'];
  laneId: Scalars['String']['input'];
  position?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationRefineTaskArgs = {
  message: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
};


export type MutationRestoreCardArgs = {
  cardId: Scalars['String']['input'];
};


export type MutationRetryCardArgs = {
  cardId: Scalars['String']['input'];
};


export type MutationRunCardArgs = {
  agentId?: InputMaybe<Scalars['String']['input']>;
  cardId: Scalars['String']['input'];
};


export type MutationSaveBoardTemplateArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  projectId: Scalars['String']['input'];
};


export type MutationSetAgentApiKeyArgs = {
  agentId: Scalars['String']['input'];
  apiKey: Scalars['String']['input'];
};


export type MutationSetAgentServersArgs = {
  agentId: Scalars['String']['input'];
  serverIds: Array<Scalars['String']['input']>;
};


export type MutationSetApiKeyArgs = {
  apiKey: Scalars['String']['input'];
};


export type MutationSetCardDepsArgs = {
  cardId: Scalars['String']['input'];
  dependsOn: Array<Scalars['String']['input']>;
};


export type MutationStopCardArgs = {
  cardId: Scalars['String']['input'];
};


export type MutationStopTaskArgs = {
  taskId: Scalars['String']['input'];
};


export type MutationSubmitTaskArgs = {
  brief: Scalars['String']['input'];
  projectId: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationTestMcpServerArgs = {
  config: McpConnectionInput;
};


export type MutationUpdateAgentArgs = {
  set: UpdateAgentInput;
  where?: InputMaybe<AgentFilters>;
};


export type MutationUpdateAgentServerArgs = {
  set: UpdateAgentServerInput;
  where?: InputMaybe<AgentServerFilters>;
};


export type MutationUpdateAgentServerSingleArgs = {
  set: UpdateAgentServerInput;
  where: AgentServerFilters;
};


export type MutationUpdateAgentServersManyArgs = {
  updates: Array<UpdateAgentServerManyInput>;
};


export type MutationUpdateAgentSingleArgs = {
  set: UpdateAgentInput;
  where: AgentFilters;
};


export type MutationUpdateAgentsManyArgs = {
  updates: Array<UpdateAgentManyInput>;
};


export type MutationUpdateCardArgs = {
  set: UpdateCardInput;
  where?: InputMaybe<CardFilters>;
};


export type MutationUpdateCardDepArgs = {
  set: UpdateCardDepInput;
  where?: InputMaybe<CardDepFilters>;
};


export type MutationUpdateCardDepSingleArgs = {
  set: UpdateCardDepInput;
  where: CardDepFilters;
};


export type MutationUpdateCardDepsManyArgs = {
  updates: Array<UpdateCardDepManyInput>;
};


export type MutationUpdateCardSingleArgs = {
  set: UpdateCardInput;
  where: CardFilters;
};


export type MutationUpdateCardsManyArgs = {
  updates: Array<UpdateCardManyInput>;
};


export type MutationUpdateLaneArgs = {
  set: UpdateLaneInput;
  where?: InputMaybe<LaneFilters>;
};


export type MutationUpdateLaneSingleArgs = {
  set: UpdateLaneInput;
  where: LaneFilters;
};


export type MutationUpdateLanesManyArgs = {
  updates: Array<UpdateLaneManyInput>;
};


export type MutationUpdateMcpServerArgs = {
  set: UpdateMcpServerInput;
  where?: InputMaybe<McpServerFilters>;
};


export type MutationUpdateMcpServerSingleArgs = {
  set: UpdateMcpServerInput;
  where: McpServerFilters;
};


export type MutationUpdateMcpServersManyArgs = {
  updates: Array<UpdateMcpServerManyInput>;
};


export type MutationUpdateMessageArgs = {
  set: UpdateMessageInput;
  where?: InputMaybe<MessageFilters>;
};


export type MutationUpdateMessageSingleArgs = {
  set: UpdateMessageInput;
  where: MessageFilters;
};


export type MutationUpdateMessagesManyArgs = {
  updates: Array<UpdateMessageManyInput>;
};


export type MutationUpdateProjectArgs = {
  set: UpdateProjectInput;
  where?: InputMaybe<ProjectFilters>;
};


export type MutationUpdateProjectSingleArgs = {
  set: UpdateProjectInput;
  where: ProjectFilters;
};


export type MutationUpdateProjectsManyArgs = {
  updates: Array<UpdateProjectManyInput>;
};


export type MutationUpdateRoleArgs = {
  set: UpdateRoleInput;
  where?: InputMaybe<RoleFilters>;
};


export type MutationUpdateRoleSingleArgs = {
  set: UpdateRoleInput;
  where: RoleFilters;
};


export type MutationUpdateRolesManyArgs = {
  updates: Array<UpdateRoleManyInput>;
};


export type MutationUpdateSettingArgs = {
  set: UpdateSettingInput;
  where?: InputMaybe<SettingFilters>;
};


export type MutationUpdateSettingSingleArgs = {
  set: UpdateSettingInput;
  where: SettingFilters;
};


export type MutationUpdateSettingsManyArgs = {
  updates: Array<UpdateSettingManyInput>;
};


export type MutationUpdateTaskArgs = {
  set: UpdateTaskInput;
  where?: InputMaybe<TaskFilters>;
};


export type MutationUpdateTaskSingleArgs = {
  set: UpdateTaskInput;
  where: TaskFilters;
};


export type MutationUpdateTasksManyArgs = {
  updates: Array<UpdateTaskManyInput>;
};

/** Order by direction */
export enum OrderDirection {
  /** Ascending order */
  Asc = 'asc',
  /** Descending order */
  Desc = 'desc'
}

/** Where NULL values sort relative to non-NULL values */
export enum OrderNulls {
  /** NULL values sort before all non-NULL values */
  First = 'first',
  /** NULL values sort after all non-NULL values */
  Last = 'last'
}

export type Project = {
  autoRun: Scalars['Boolean']['output'];
  cards: Array<Card>;
  cardsAggregate: CardAggregate;
  context: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  decomposeAgent?: Maybe<Agent>;
  decomposeAgentId?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lanes: Array<Lane>;
  lanesAggregate: LaneAggregate;
  name: Scalars['String']['output'];
  refineAgent?: Maybe<Agent>;
  refineAgentId?: Maybe<Scalars['String']['output']>;
  runs: Array<Run>;
  runsAggregate: RunAggregate;
  tasks: Array<Task>;
  tasksAggregate: TaskAggregate;
  updatedAt: Scalars['DateTime']['output'];
};


export type ProjectCardsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardOrderBy>;
  where?: InputMaybe<CardFilters>;
};


export type ProjectCardsAggregateArgs = {
  where?: InputMaybe<CardFilters>;
};


export type ProjectDecomposeAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type ProjectLanesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<LaneDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LaneOrderBy>;
  where?: InputMaybe<LaneFilters>;
};


export type ProjectLanesAggregateArgs = {
  where?: InputMaybe<LaneFilters>;
};


export type ProjectRefineAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type ProjectRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<RunDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RunOrderBy>;
  where?: InputMaybe<RunFilters>;
};


export type ProjectRunsAggregateArgs = {
  where?: InputMaybe<RunFilters>;
};


export type ProjectTasksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<TaskDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TaskOrderBy>;
  where?: InputMaybe<TaskFilters>;
};


export type ProjectTasksAggregateArgs = {
  where?: InputMaybe<TaskFilters>;
};

export type ProjectAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<ProjectCountDistinctAggregate>;
  countNonNull?: Maybe<ProjectCountNonNullAggregate>;
  max?: Maybe<ProjectMaxAggregate>;
  min?: Maybe<ProjectMinAggregate>;
};

export type ProjectCountDistinctAggregate = {
  context: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  decomposeAgentId: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  refineAgentId: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type ProjectCountDistinctHaving = {
  context?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  decomposeAgentId?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  refineAgentId?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type ProjectCountNonNullAggregate = {
  autoRun: Scalars['Int']['output'];
  context: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  decomposeAgentId: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  refineAgentId: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type ProjectCountNonNullHaving = {
  autoRun?: InputMaybe<AggregateNumberFilter>;
  context?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  decomposeAgentId?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  refineAgentId?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Project that a query can be made distinct on */
export enum ProjectDistinctColumn {
  AutoRun = 'autoRun',
  Context = 'context',
  CreatedAt = 'createdAt',
  DecomposeAgentId = 'decomposeAgentId',
  Description = 'description',
  Id = 'id',
  Name = 'name',
  RefineAgentId = 'refineAgentId',
  UpdatedAt = 'updatedAt'
}

export type ProjectFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<ProjectFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<ProjectFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<ProjectFilters>>;
  autoRun?: InputMaybe<BooleanFilter>;
  cards?: InputMaybe<CardListRelationFilter>;
  context?: InputMaybe<StringFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  /** Matches rows whose decomposeAgent matches these filters */
  decomposeAgent?: InputMaybe<AgentFilters>;
  decomposeAgentId?: InputMaybe<StringFilter>;
  description?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  lanes?: InputMaybe<LaneListRelationFilter>;
  name?: InputMaybe<StringFilter>;
  /** Matches rows whose refineAgent matches these filters */
  refineAgent?: InputMaybe<AgentFilters>;
  refineAgentId?: InputMaybe<StringFilter>;
  runs?: InputMaybe<RunListRelationFilter>;
  tasks?: InputMaybe<TaskListRelationFilter>;
  updatedAt?: InputMaybe<DateTimeFilter>;
};

export type ProjectGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<ProjectCountDistinctAggregate>;
  countNonNull?: Maybe<ProjectCountNonNullAggregate>;
  group: ProjectGroupKeys;
  max?: Maybe<ProjectMaxAggregate>;
  min?: Maybe<ProjectMinAggregate>;
};

/** Columns of Project that a query can group by */
export enum ProjectGroupByColumn {
  AutoRun = 'autoRun',
  Context = 'context',
  CreatedAt = 'createdAt',
  DecomposeAgentId = 'decomposeAgentId',
  Description = 'description',
  Id = 'id',
  Name = 'name',
  RefineAgentId = 'refineAgentId',
  UpdatedAt = 'updatedAt'
}

/** The grouped column values of one Project group. A column the query did not group by is null. */
export type ProjectGroupKeys = {
  autoRun?: Maybe<Scalars['Boolean']['output']>;
  context?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  decomposeAgentId?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  refineAgentId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Filters Project groups by their aggregated values */
export type ProjectHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<ProjectCountDistinctHaving>;
  countNonNull?: InputMaybe<ProjectCountNonNullHaving>;
};

export type ProjectMaxAggregate = {
  context?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  decomposeAgentId?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  refineAgentId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type ProjectMinAggregate = {
  context?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  decomposeAgentId?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  refineAgentId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type ProjectOrderBy = {
  autoRun?: InputMaybe<InnerOrder>;
  context?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  /** Order by columns of the related decomposeAgent row */
  decomposeAgent?: InputMaybe<AgentOrderBy>;
  decomposeAgentId?: InputMaybe<InnerOrder>;
  description?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  name?: InputMaybe<InnerOrder>;
  /** Order by columns of the related refineAgent row */
  refineAgent?: InputMaybe<AgentOrderBy>;
  refineAgentId?: InputMaybe<InnerOrder>;
  updatedAt?: InputMaybe<InnerOrder>;
};

export type Query = {
  agent?: Maybe<Agent>;
  agentServer?: Maybe<AgentServer>;
  agentServers: Array<AgentServer>;
  agentServersAggregate: AgentServerAggregate;
  agentServersGroupBy: Array<AgentServerGroupBy>;
  agents: Array<Agent>;
  agentsAggregate: AgentAggregate;
  agentsGroupBy: Array<AgentGroupBy>;
  boardTemplate?: Maybe<BoardTemplate>;
  boardTemplates: Array<BoardTemplate>;
  boardTemplatesAggregate: BoardTemplateAggregate;
  boardTemplatesGroupBy: Array<BoardTemplateGroupBy>;
  card?: Maybe<Card>;
  cardDep?: Maybe<CardDep>;
  cardDeps: Array<CardDep>;
  cardDepsAggregate: CardDepAggregate;
  cardDepsGroupBy: Array<CardDepGroupBy>;
  cards: Array<Card>;
  cardsAggregate: CardAggregate;
  cardsGroupBy: Array<CardGroupBy>;
  lane?: Maybe<Lane>;
  lanes: Array<Lane>;
  lanesAggregate: LaneAggregate;
  lanesGroupBy: Array<LaneGroupBy>;
  mcpServer?: Maybe<McpServer>;
  mcpServers: Array<McpServer>;
  mcpServersAggregate: McpServerAggregate;
  mcpServersGroupBy: Array<McpServerGroupBy>;
  /** Which of the configured MCP servers this one actually reached, and the tools it found on each. A server that is enabled but absent here failed to connect, and its tools are not offered to any agent linked to it. */
  mcpStatus: Array<McpServerStatus>;
  message?: Maybe<Message>;
  messages: Array<Message>;
  messagesAggregate: MessageAggregate;
  messagesGroupBy: Array<MessageGroupBy>;
  /** Model ids an OpenAI-compatible server reports. With no `agentId` this asks the endpoint in Settings; with one it asks that agent's own endpoint, which is the list that agent can actually choose from. */
  models: Array<Scalars['String']['output']>;
  project?: Maybe<Project>;
  projects: Array<Project>;
  projectsAggregate: ProjectAggregate;
  projectsGroupBy: Array<ProjectGroupBy>;
  role?: Maybe<Role>;
  roles: Array<Role>;
  rolesAggregate: RoleAggregate;
  rolesGroupBy: Array<RoleGroupBy>;
  run?: Maybe<Run>;
  /** What a run has said so far, oldest first, with consecutive thinking and output tokens folded into one entry each. The snapshot form of the `runEvents` subscription, for a client that polls rather than holds a stream open: pass the `seq` of the last entry you read as `afterSeq` to pick up exactly where you left off. Empty for a run that has not started, or one that finished over a minute ago. */
  runEvents: Array<RunEvent>;
  runs: Array<Run>;
  runsAggregate: RunAggregate;
  runsGroupBy: Array<RunGroupBy>;
  setting?: Maybe<Setting>;
  settings: Array<Setting>;
  settingsAggregate: SettingAggregate;
  settingsGroupBy: Array<SettingGroupBy>;
  /** What a project has cost in tokens, over a window, added up from its runs. With a `taskId` it is that one task instead: its refinement, its decomposition, and every run of every card it turned into. Read `from` before quoting the number — it says how far back the runs behind it actually go. */
  spend: Spend;
  task?: Maybe<Task>;
  tasks: Array<Task>;
  tasksAggregate: TaskAggregate;
  tasksGroupBy: Array<TaskGroupBy>;
};


export type QueryAgentArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentOrderBy>;
  where?: InputMaybe<AgentFilters>;
};


export type QueryAgentServerArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentServerOrderBy>;
  where?: InputMaybe<AgentServerFilters>;
};


export type QueryAgentServersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<AgentServerDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentServerOrderBy>;
  where?: InputMaybe<AgentServerFilters>;
};


export type QueryAgentServersAggregateArgs = {
  where?: InputMaybe<AgentServerFilters>;
};


export type QueryAgentServersGroupByArgs = {
  groupBy: Array<AgentServerGroupByColumn>;
  having?: InputMaybe<AgentServerHaving>;
  where?: InputMaybe<AgentServerFilters>;
};


export type QueryAgentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<AgentDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentOrderBy>;
  where?: InputMaybe<AgentFilters>;
};


export type QueryAgentsAggregateArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type QueryAgentsGroupByArgs = {
  groupBy: Array<AgentGroupByColumn>;
  having?: InputMaybe<AgentHaving>;
  where?: InputMaybe<AgentFilters>;
};


export type QueryBoardTemplateArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BoardTemplateOrderBy>;
  where?: InputMaybe<BoardTemplateFilters>;
};


export type QueryBoardTemplatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<BoardTemplateDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BoardTemplateOrderBy>;
  where?: InputMaybe<BoardTemplateFilters>;
};


export type QueryBoardTemplatesAggregateArgs = {
  where?: InputMaybe<BoardTemplateFilters>;
};


export type QueryBoardTemplatesGroupByArgs = {
  groupBy: Array<BoardTemplateGroupByColumn>;
  having?: InputMaybe<BoardTemplateHaving>;
  where?: InputMaybe<BoardTemplateFilters>;
};


export type QueryCardArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardOrderBy>;
  where?: InputMaybe<CardFilters>;
};


export type QueryCardDepArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardDepOrderBy>;
  where?: InputMaybe<CardDepFilters>;
};


export type QueryCardDepsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDepDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardDepOrderBy>;
  where?: InputMaybe<CardDepFilters>;
};


export type QueryCardDepsAggregateArgs = {
  where?: InputMaybe<CardDepFilters>;
};


export type QueryCardDepsGroupByArgs = {
  groupBy: Array<CardDepGroupByColumn>;
  having?: InputMaybe<CardDepHaving>;
  where?: InputMaybe<CardDepFilters>;
};


export type QueryCardsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardOrderBy>;
  where?: InputMaybe<CardFilters>;
};


export type QueryCardsAggregateArgs = {
  where?: InputMaybe<CardFilters>;
};


export type QueryCardsGroupByArgs = {
  groupBy: Array<CardGroupByColumn>;
  having?: InputMaybe<CardHaving>;
  where?: InputMaybe<CardFilters>;
};


export type QueryLaneArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LaneOrderBy>;
  where?: InputMaybe<LaneFilters>;
};


export type QueryLanesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<LaneDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LaneOrderBy>;
  where?: InputMaybe<LaneFilters>;
};


export type QueryLanesAggregateArgs = {
  where?: InputMaybe<LaneFilters>;
};


export type QueryLanesGroupByArgs = {
  groupBy: Array<LaneGroupByColumn>;
  having?: InputMaybe<LaneHaving>;
  where?: InputMaybe<LaneFilters>;
};


export type QueryMcpServerArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<McpServerOrderBy>;
  where?: InputMaybe<McpServerFilters>;
};


export type QueryMcpServersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<McpServerDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<McpServerOrderBy>;
  where?: InputMaybe<McpServerFilters>;
};


export type QueryMcpServersAggregateArgs = {
  where?: InputMaybe<McpServerFilters>;
};


export type QueryMcpServersGroupByArgs = {
  groupBy: Array<McpServerGroupByColumn>;
  having?: InputMaybe<McpServerHaving>;
  where?: InputMaybe<McpServerFilters>;
};


export type QueryMessageArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MessageOrderBy>;
  where?: InputMaybe<MessageFilters>;
};


export type QueryMessagesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<MessageDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MessageOrderBy>;
  where?: InputMaybe<MessageFilters>;
};


export type QueryMessagesAggregateArgs = {
  where?: InputMaybe<MessageFilters>;
};


export type QueryMessagesGroupByArgs = {
  groupBy: Array<MessageGroupByColumn>;
  having?: InputMaybe<MessageHaving>;
  where?: InputMaybe<MessageFilters>;
};


export type QueryModelsArgs = {
  agentId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryProjectArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ProjectOrderBy>;
  where?: InputMaybe<ProjectFilters>;
};


export type QueryProjectsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<ProjectDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ProjectOrderBy>;
  where?: InputMaybe<ProjectFilters>;
};


export type QueryProjectsAggregateArgs = {
  where?: InputMaybe<ProjectFilters>;
};


export type QueryProjectsGroupByArgs = {
  groupBy: Array<ProjectGroupByColumn>;
  having?: InputMaybe<ProjectHaving>;
  where?: InputMaybe<ProjectFilters>;
};


export type QueryRoleArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RoleOrderBy>;
  where?: InputMaybe<RoleFilters>;
};


export type QueryRolesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<RoleDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RoleOrderBy>;
  where?: InputMaybe<RoleFilters>;
};


export type QueryRolesAggregateArgs = {
  where?: InputMaybe<RoleFilters>;
};


export type QueryRolesGroupByArgs = {
  groupBy: Array<RoleGroupByColumn>;
  having?: InputMaybe<RoleHaving>;
  where?: InputMaybe<RoleFilters>;
};


export type QueryRunArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RunOrderBy>;
  where?: InputMaybe<RunFilters>;
};


export type QueryRunEventsArgs = {
  afterSeq?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  runId: Scalars['String']['input'];
};


export type QueryRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<RunDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RunOrderBy>;
  where?: InputMaybe<RunFilters>;
};


export type QueryRunsAggregateArgs = {
  where?: InputMaybe<RunFilters>;
};


export type QueryRunsGroupByArgs = {
  groupBy: Array<RunGroupByColumn>;
  having?: InputMaybe<RunHaving>;
  where?: InputMaybe<RunFilters>;
};


export type QuerySettingArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SettingOrderBy>;
  where?: InputMaybe<SettingFilters>;
};


export type QuerySettingsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<SettingDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SettingOrderBy>;
  where?: InputMaybe<SettingFilters>;
};


export type QuerySettingsAggregateArgs = {
  where?: InputMaybe<SettingFilters>;
};


export type QuerySettingsGroupByArgs = {
  groupBy: Array<SettingGroupByColumn>;
  having?: InputMaybe<SettingHaving>;
  where?: InputMaybe<SettingFilters>;
};


export type QuerySpendArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['String']['input'];
  taskId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTaskArgs = {
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TaskOrderBy>;
  where?: InputMaybe<TaskFilters>;
};


export type QueryTasksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<TaskDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TaskOrderBy>;
  where?: InputMaybe<TaskFilters>;
};


export type QueryTasksAggregateArgs = {
  where?: InputMaybe<TaskFilters>;
};


export type QueryTasksGroupByArgs = {
  groupBy: Array<TaskGroupByColumn>;
  having?: InputMaybe<TaskHaving>;
  where?: InputMaybe<TaskFilters>;
};

export type Role = {
  agents: Array<Agent>;
  agentsAggregate: AgentAggregate;
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  stage: RolesStageEnum;
  systemPrompt: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


export type RoleAgentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<AgentDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<AgentOrderBy>;
  where?: InputMaybe<AgentFilters>;
};


export type RoleAgentsAggregateArgs = {
  where?: InputMaybe<AgentFilters>;
};

export type RoleAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<RoleCountDistinctAggregate>;
  countNonNull?: Maybe<RoleCountNonNullAggregate>;
  max?: Maybe<RoleMaxAggregate>;
  min?: Maybe<RoleMinAggregate>;
};

export type RoleCountDistinctAggregate = {
  createdAt: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  stage: Scalars['Int']['output'];
  systemPrompt: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type RoleCountDistinctHaving = {
  createdAt?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  stage?: InputMaybe<AggregateNumberFilter>;
  systemPrompt?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type RoleCountNonNullAggregate = {
  createdAt: Scalars['Int']['output'];
  description: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['Int']['output'];
  stage: Scalars['Int']['output'];
  systemPrompt: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type RoleCountNonNullHaving = {
  createdAt?: InputMaybe<AggregateNumberFilter>;
  description?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  name?: InputMaybe<AggregateNumberFilter>;
  stage?: InputMaybe<AggregateNumberFilter>;
  systemPrompt?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Role that a query can be made distinct on */
export enum RoleDistinctColumn {
  CreatedAt = 'createdAt',
  Description = 'description',
  Id = 'id',
  Name = 'name',
  Stage = 'stage',
  SystemPrompt = 'systemPrompt',
  UpdatedAt = 'updatedAt'
}

export type RoleFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<RoleFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<RoleFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<RoleFilters>>;
  agents?: InputMaybe<AgentListRelationFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  description?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  name?: InputMaybe<StringFilter>;
  stage?: InputMaybe<RolesStageEnumFilter>;
  systemPrompt?: InputMaybe<StringFilter>;
  updatedAt?: InputMaybe<DateTimeFilter>;
};

export type RoleGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<RoleCountDistinctAggregate>;
  countNonNull?: Maybe<RoleCountNonNullAggregate>;
  group: RoleGroupKeys;
  max?: Maybe<RoleMaxAggregate>;
  min?: Maybe<RoleMinAggregate>;
};

/** Columns of Role that a query can group by */
export enum RoleGroupByColumn {
  CreatedAt = 'createdAt',
  Description = 'description',
  Id = 'id',
  Name = 'name',
  Stage = 'stage',
  SystemPrompt = 'systemPrompt',
  UpdatedAt = 'updatedAt'
}

/** The grouped column values of one Role group. A column the query did not group by is null. */
export type RoleGroupKeys = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  stage?: Maybe<RolesStageEnum>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Filters Role groups by their aggregated values */
export type RoleHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<RoleCountDistinctHaving>;
  countNonNull?: InputMaybe<RoleCountNonNullHaving>;
};

export type RoleMaxAggregate = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  stage?: Maybe<RolesStageEnum>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type RoleMinAggregate = {
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  stage?: Maybe<RolesStageEnum>;
  systemPrompt?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type RoleOrderBy = {
  createdAt?: InputMaybe<InnerOrder>;
  description?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  name?: InputMaybe<InnerOrder>;
  stage?: InputMaybe<InnerOrder>;
  systemPrompt?: InputMaybe<InnerOrder>;
  updatedAt?: InputMaybe<InnerOrder>;
};

export enum RolesStageEnum {
  /** Value: card */
  Card = 'card',
  /** Value: decompose */
  Decompose = 'decompose',
  /** Value: refine */
  Refine = 'refine'
}

export type RolesStageEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<RolesStageEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<RolesStageEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<RolesStageEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<RolesStageEnum>;
  /** Greater than */
  gt?: InputMaybe<RolesStageEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<RolesStageEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<RolesStageEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<RolesStageEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<RolesStageEnum>;
  /** Not equal to */
  ne?: InputMaybe<RolesStageEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<RolesStageEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Run = {
  agent?: Maybe<Agent>;
  agentId?: Maybe<Scalars['String']['output']>;
  card?: Maybe<Card>;
  cardId?: Maybe<Scalars['String']['output']>;
  completionTokens: Scalars['Int']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  error: Scalars['String']['output'];
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  kind: RunsKindEnum;
  laneId?: Maybe<Scalars['String']['output']>;
  output: Scalars['String']['output'];
  project: Project;
  projectId: Scalars['String']['output'];
  promptTokens: Scalars['Int']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: RunsStatusEnum;
  task?: Maybe<Task>;
  taskId?: Maybe<Scalars['String']['output']>;
  toolCalls?: Maybe<Scalars['JSON']['output']>;
  totalTokens: Scalars['Int']['output'];
};


export type RunAgentArgs = {
  where?: InputMaybe<AgentFilters>;
};


export type RunCardArgs = {
  where?: InputMaybe<CardFilters>;
};


export type RunProjectArgs = {
  where?: InputMaybe<ProjectFilters>;
};


export type RunTaskArgs = {
  where?: InputMaybe<TaskFilters>;
};

export type RunAggregate = {
  avg?: Maybe<RunAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<RunCountDistinctAggregate>;
  countNonNull?: Maybe<RunCountNonNullAggregate>;
  max?: Maybe<RunMaxAggregate>;
  min?: Maybe<RunMinAggregate>;
  sum?: Maybe<RunSumAggregate>;
};

export type RunAvgAggregate = {
  completionTokens?: Maybe<Scalars['Float']['output']>;
  promptTokens?: Maybe<Scalars['Float']['output']>;
  totalTokens?: Maybe<Scalars['Float']['output']>;
};

export type RunAvgHaving = {
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

export type RunCountDistinctAggregate = {
  agentId: Scalars['Int']['output'];
  cardId: Scalars['Int']['output'];
  completionTokens: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  finishedAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  kind: Scalars['Int']['output'];
  laneId: Scalars['Int']['output'];
  output: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  promptTokens: Scalars['Int']['output'];
  startedAt: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
  totalTokens: Scalars['Int']['output'];
};

export type RunCountDistinctHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  cardId?: InputMaybe<AggregateNumberFilter>;
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  finishedAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  kind?: InputMaybe<AggregateNumberFilter>;
  laneId?: InputMaybe<AggregateNumberFilter>;
  output?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  startedAt?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

export type RunCountNonNullAggregate = {
  agentId: Scalars['Int']['output'];
  cardId: Scalars['Int']['output'];
  completionTokens: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  finishedAt: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  kind: Scalars['Int']['output'];
  laneId: Scalars['Int']['output'];
  output: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  promptTokens: Scalars['Int']['output'];
  startedAt: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  taskId: Scalars['Int']['output'];
  toolCalls: Scalars['Int']['output'];
  totalTokens: Scalars['Int']['output'];
};

export type RunCountNonNullHaving = {
  agentId?: InputMaybe<AggregateNumberFilter>;
  cardId?: InputMaybe<AggregateNumberFilter>;
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  finishedAt?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  kind?: InputMaybe<AggregateNumberFilter>;
  laneId?: InputMaybe<AggregateNumberFilter>;
  output?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  startedAt?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  taskId?: InputMaybe<AggregateNumberFilter>;
  toolCalls?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Run that a query can be made distinct on */
export enum RunDistinctColumn {
  AgentId = 'agentId',
  CardId = 'cardId',
  CompletionTokens = 'completionTokens',
  Error = 'error',
  FinishedAt = 'finishedAt',
  Id = 'id',
  Kind = 'kind',
  LaneId = 'laneId',
  Output = 'output',
  ProjectId = 'projectId',
  PromptTokens = 'promptTokens',
  StartedAt = 'startedAt',
  Status = 'status',
  TaskId = 'taskId',
  ToolCalls = 'toolCalls',
  TotalTokens = 'totalTokens'
}

/** Something a run did while it was running — a token, a tool call, a notice. Held in memory for the length of the run and a minute after; the run row is the lasting record. */
export type RunEvent = {
  at: Scalars['DateTime']['output'];
  /** turn | thinking | output | tool-call | tool-result | notice | done. */
  kind: Scalars['String']['output'];
  /** Tool name, where there is one. */
  name: Scalars['String']['output'];
  ok?: Maybe<Scalars['Boolean']['output']>;
  runId: Scalars['String']['output'];
  /** Per-run counter from 1, so a client can order and de-duplicate. */
  seq: Scalars['Int']['output'];
  text: Scalars['String']['output'];
};

export type RunFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<RunFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<RunFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<RunFilters>>;
  /** Matches rows whose agent matches these filters */
  agent?: InputMaybe<AgentFilters>;
  agentId?: InputMaybe<StringFilter>;
  /** Matches rows whose card matches these filters */
  card?: InputMaybe<CardFilters>;
  cardId?: InputMaybe<StringFilter>;
  completionTokens?: InputMaybe<IntFilter>;
  error?: InputMaybe<StringFilter>;
  finishedAt?: InputMaybe<DateTimeFilter>;
  id?: InputMaybe<StringFilter>;
  kind?: InputMaybe<RunsKindEnumFilter>;
  laneId?: InputMaybe<StringFilter>;
  output?: InputMaybe<StringFilter>;
  /** Matches rows whose project matches these filters */
  project?: InputMaybe<ProjectFilters>;
  projectId?: InputMaybe<StringFilter>;
  promptTokens?: InputMaybe<IntFilter>;
  startedAt?: InputMaybe<DateTimeFilter>;
  status?: InputMaybe<RunsStatusEnumFilter>;
  /** Matches rows whose task matches these filters */
  task?: InputMaybe<TaskFilters>;
  taskId?: InputMaybe<StringFilter>;
  toolCalls?: InputMaybe<JsonFilter>;
  totalTokens?: InputMaybe<IntFilter>;
};

export type RunGroupBy = {
  avg?: Maybe<RunAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<RunCountDistinctAggregate>;
  countNonNull?: Maybe<RunCountNonNullAggregate>;
  group: RunGroupKeys;
  max?: Maybe<RunMaxAggregate>;
  min?: Maybe<RunMinAggregate>;
  sum?: Maybe<RunSumAggregate>;
};

/** Columns of Run that a query can group by */
export enum RunGroupByColumn {
  AgentId = 'agentId',
  CardId = 'cardId',
  CompletionTokens = 'completionTokens',
  Error = 'error',
  FinishedAt = 'finishedAt',
  Id = 'id',
  Kind = 'kind',
  LaneId = 'laneId',
  Output = 'output',
  ProjectId = 'projectId',
  PromptTokens = 'promptTokens',
  StartedAt = 'startedAt',
  Status = 'status',
  TaskId = 'taskId',
  TotalTokens = 'totalTokens'
}

/** The grouped column values of one Run group. A column the query did not group by is null. */
export type RunGroupKeys = {
  agentId?: Maybe<Scalars['String']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  completionTokens?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  kind?: Maybe<RunsKindEnum>;
  laneId?: Maybe<Scalars['String']['output']>;
  output?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  promptTokens?: Maybe<Scalars['Int']['output']>;
  startedAt?: Maybe<Scalars['DateTime']['output']>;
  status?: Maybe<RunsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  totalTokens?: Maybe<Scalars['Int']['output']>;
};

/** Filters Run groups by their aggregated values */
export type RunHaving = {
  avg?: InputMaybe<RunAvgHaving>;
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<RunCountDistinctHaving>;
  countNonNull?: InputMaybe<RunCountNonNullHaving>;
  max?: InputMaybe<RunMaxHaving>;
  min?: InputMaybe<RunMinHaving>;
  sum?: InputMaybe<RunSumHaving>;
};

export type RunListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<RunFilters>;
  /** No related row matches */
  none?: InputMaybe<RunFilters>;
  /** At least one related row matches */
  some?: InputMaybe<RunFilters>;
};

export type RunMaxAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  completionTokens?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  kind?: Maybe<RunsKindEnum>;
  laneId?: Maybe<Scalars['String']['output']>;
  output?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  promptTokens?: Maybe<Scalars['Int']['output']>;
  startedAt?: Maybe<Scalars['DateTime']['output']>;
  status?: Maybe<RunsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  totalTokens?: Maybe<Scalars['Int']['output']>;
};

export type RunMaxHaving = {
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

export type RunMinAggregate = {
  agentId?: Maybe<Scalars['String']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  completionTokens?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  kind?: Maybe<RunsKindEnum>;
  laneId?: Maybe<Scalars['String']['output']>;
  output?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  promptTokens?: Maybe<Scalars['Int']['output']>;
  startedAt?: Maybe<Scalars['DateTime']['output']>;
  status?: Maybe<RunsStatusEnum>;
  taskId?: Maybe<Scalars['String']['output']>;
  totalTokens?: Maybe<Scalars['Int']['output']>;
};

export type RunMinHaving = {
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

export type RunOrderBy = {
  /** Order by columns of the related agent row */
  agent?: InputMaybe<AgentOrderBy>;
  agentId?: InputMaybe<InnerOrder>;
  /** Order by columns of the related card row */
  card?: InputMaybe<CardOrderBy>;
  cardId?: InputMaybe<InnerOrder>;
  completionTokens?: InputMaybe<InnerOrder>;
  error?: InputMaybe<InnerOrder>;
  finishedAt?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  kind?: InputMaybe<InnerOrder>;
  laneId?: InputMaybe<InnerOrder>;
  output?: InputMaybe<InnerOrder>;
  /** Order by columns of the related project row */
  project?: InputMaybe<ProjectOrderBy>;
  projectId?: InputMaybe<InnerOrder>;
  promptTokens?: InputMaybe<InnerOrder>;
  startedAt?: InputMaybe<InnerOrder>;
  status?: InputMaybe<InnerOrder>;
  /** Order by columns of the related task row */
  task?: InputMaybe<TaskOrderBy>;
  taskId?: InputMaybe<InnerOrder>;
  toolCalls?: InputMaybe<InnerOrder>;
  totalTokens?: InputMaybe<InnerOrder>;
};

export type RunSumAggregate = {
  completionTokens?: Maybe<Scalars['Float']['output']>;
  promptTokens?: Maybe<Scalars['Float']['output']>;
  totalTokens?: Maybe<Scalars['Float']['output']>;
};

export type RunSumHaving = {
  completionTokens?: InputMaybe<AggregateNumberFilter>;
  promptTokens?: InputMaybe<AggregateNumberFilter>;
  totalTokens?: InputMaybe<AggregateNumberFilter>;
};

export enum RunsKindEnum {
  /** Value: card */
  Card = 'card',
  /** Value: decompose */
  Decompose = 'decompose',
  /** Value: refine */
  Refine = 'refine'
}

export type RunsKindEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<RunsKindEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<RunsKindEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<RunsKindEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<RunsKindEnum>;
  /** Greater than */
  gt?: InputMaybe<RunsKindEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<RunsKindEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<RunsKindEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<RunsKindEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<RunsKindEnum>;
  /** Not equal to */
  ne?: InputMaybe<RunsKindEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<RunsKindEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export enum RunsStatusEnum {
  /** Value: error */
  Error = 'error',
  /** Value: ok */
  Ok = 'ok',
  /** Value: running */
  Running = 'running',
  /** Value: stopped */
  Stopped = 'stopped'
}

export type RunsStatusEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<RunsStatusEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<RunsStatusEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<RunsStatusEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<RunsStatusEnum>;
  /** Greater than */
  gt?: InputMaybe<RunsStatusEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<RunsStatusEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<RunsStatusEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<RunsStatusEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<RunsStatusEnum>;
  /** Not equal to */
  ne?: InputMaybe<RunsStatusEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<RunsStatusEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Setting = {
  baseUrl: Scalars['String']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['String']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  runRetentionDays: Scalars['Int']['output'];
  temperature: Scalars['Float']['output'];
  toolDiscovery: SettingsToolDiscoveryEnum;
  toolSelectModel: Scalars['String']['output'];
  workerIntervalSeconds: Scalars['Int']['output'];
};

export type SettingAggregate = {
  avg?: Maybe<SettingAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<SettingCountDistinctAggregate>;
  countNonNull?: Maybe<SettingCountNonNullAggregate>;
  max?: Maybe<SettingMaxAggregate>;
  min?: Maybe<SettingMinAggregate>;
  sum?: Maybe<SettingSumAggregate>;
};

export type SettingAvgAggregate = {
  maxRetries?: Maybe<Scalars['Float']['output']>;
  maxTokens?: Maybe<Scalars['Float']['output']>;
  maxToolIterations?: Maybe<Scalars['Float']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Float']['output']>;
  runRetentionDays?: Maybe<Scalars['Float']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  workerIntervalSeconds?: Maybe<Scalars['Float']['output']>;
};

export type SettingAvgHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

export type SettingCountDistinctAggregate = {
  baseUrl: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['Int']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  runRetentionDays: Scalars['Int']['output'];
  temperature: Scalars['Int']['output'];
  toolDiscovery: Scalars['Int']['output'];
  toolSelectModel: Scalars['Int']['output'];
  workerIntervalSeconds: Scalars['Int']['output'];
};

export type SettingCountDistinctHaving = {
  baseUrl?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  model?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  toolDiscovery?: InputMaybe<AggregateNumberFilter>;
  toolSelectModel?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

export type SettingCountNonNullAggregate = {
  baseUrl: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  maxRetries: Scalars['Int']['output'];
  maxTokens: Scalars['Int']['output'];
  maxToolIterations: Scalars['Int']['output'];
  model: Scalars['Int']['output'];
  requestTimeoutSeconds: Scalars['Int']['output'];
  runRetentionDays: Scalars['Int']['output'];
  temperature: Scalars['Int']['output'];
  toolDiscovery: Scalars['Int']['output'];
  toolSelectModel: Scalars['Int']['output'];
  workerIntervalSeconds: Scalars['Int']['output'];
};

export type SettingCountNonNullHaving = {
  baseUrl?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  model?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  toolDiscovery?: InputMaybe<AggregateNumberFilter>;
  toolSelectModel?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Setting that a query can be made distinct on */
export enum SettingDistinctColumn {
  BaseUrl = 'baseUrl',
  Id = 'id',
  MaxRetries = 'maxRetries',
  MaxTokens = 'maxTokens',
  MaxToolIterations = 'maxToolIterations',
  Model = 'model',
  RequestTimeoutSeconds = 'requestTimeoutSeconds',
  RunRetentionDays = 'runRetentionDays',
  Temperature = 'temperature',
  ToolDiscovery = 'toolDiscovery',
  ToolSelectModel = 'toolSelectModel',
  WorkerIntervalSeconds = 'workerIntervalSeconds'
}

export type SettingFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<SettingFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<SettingFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<SettingFilters>>;
  baseUrl?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  maxRetries?: InputMaybe<IntFilter>;
  maxTokens?: InputMaybe<IntFilter>;
  maxToolIterations?: InputMaybe<IntFilter>;
  model?: InputMaybe<StringFilter>;
  requestTimeoutSeconds?: InputMaybe<IntFilter>;
  runRetentionDays?: InputMaybe<IntFilter>;
  temperature?: InputMaybe<FloatFilter>;
  toolDiscovery?: InputMaybe<SettingsToolDiscoveryEnumFilter>;
  toolSelectModel?: InputMaybe<StringFilter>;
  workerIntervalSeconds?: InputMaybe<IntFilter>;
};

export type SettingGroupBy = {
  avg?: Maybe<SettingAvgAggregate>;
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<SettingCountDistinctAggregate>;
  countNonNull?: Maybe<SettingCountNonNullAggregate>;
  group: SettingGroupKeys;
  max?: Maybe<SettingMaxAggregate>;
  min?: Maybe<SettingMinAggregate>;
  sum?: Maybe<SettingSumAggregate>;
};

/** Columns of Setting that a query can group by */
export enum SettingGroupByColumn {
  BaseUrl = 'baseUrl',
  Id = 'id',
  MaxRetries = 'maxRetries',
  MaxTokens = 'maxTokens',
  MaxToolIterations = 'maxToolIterations',
  Model = 'model',
  RequestTimeoutSeconds = 'requestTimeoutSeconds',
  RunRetentionDays = 'runRetentionDays',
  Temperature = 'temperature',
  ToolDiscovery = 'toolDiscovery',
  ToolSelectModel = 'toolSelectModel',
  WorkerIntervalSeconds = 'workerIntervalSeconds'
}

/** The grouped column values of one Setting group. A column the query did not group by is null. */
export type SettingGroupKeys = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  runRetentionDays?: Maybe<Scalars['Int']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<SettingsToolDiscoveryEnum>;
  toolSelectModel?: Maybe<Scalars['String']['output']>;
  workerIntervalSeconds?: Maybe<Scalars['Int']['output']>;
};

/** Filters Setting groups by their aggregated values */
export type SettingHaving = {
  avg?: InputMaybe<SettingAvgHaving>;
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<SettingCountDistinctHaving>;
  countNonNull?: InputMaybe<SettingCountNonNullHaving>;
  max?: InputMaybe<SettingMaxHaving>;
  min?: InputMaybe<SettingMinHaving>;
  sum?: InputMaybe<SettingSumHaving>;
};

export type SettingMaxAggregate = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  runRetentionDays?: Maybe<Scalars['Int']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<SettingsToolDiscoveryEnum>;
  toolSelectModel?: Maybe<Scalars['String']['output']>;
  workerIntervalSeconds?: Maybe<Scalars['Int']['output']>;
};

export type SettingMaxHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

export type SettingMinAggregate = {
  baseUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  maxRetries?: Maybe<Scalars['Int']['output']>;
  maxTokens?: Maybe<Scalars['Int']['output']>;
  maxToolIterations?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Int']['output']>;
  runRetentionDays?: Maybe<Scalars['Int']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  toolDiscovery?: Maybe<SettingsToolDiscoveryEnum>;
  toolSelectModel?: Maybe<Scalars['String']['output']>;
  workerIntervalSeconds?: Maybe<Scalars['Int']['output']>;
};

export type SettingMinHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

export type SettingOrderBy = {
  baseUrl?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  maxRetries?: InputMaybe<InnerOrder>;
  maxTokens?: InputMaybe<InnerOrder>;
  maxToolIterations?: InputMaybe<InnerOrder>;
  model?: InputMaybe<InnerOrder>;
  requestTimeoutSeconds?: InputMaybe<InnerOrder>;
  runRetentionDays?: InputMaybe<InnerOrder>;
  temperature?: InputMaybe<InnerOrder>;
  toolDiscovery?: InputMaybe<InnerOrder>;
  toolSelectModel?: InputMaybe<InnerOrder>;
  workerIntervalSeconds?: InputMaybe<InnerOrder>;
};

export type SettingSumAggregate = {
  maxRetries?: Maybe<Scalars['Float']['output']>;
  maxTokens?: Maybe<Scalars['Float']['output']>;
  maxToolIterations?: Maybe<Scalars['Float']['output']>;
  requestTimeoutSeconds?: Maybe<Scalars['Float']['output']>;
  runRetentionDays?: Maybe<Scalars['Float']['output']>;
  temperature?: Maybe<Scalars['Float']['output']>;
  workerIntervalSeconds?: Maybe<Scalars['Float']['output']>;
};

export type SettingSumHaving = {
  maxRetries?: InputMaybe<AggregateNumberFilter>;
  maxTokens?: InputMaybe<AggregateNumberFilter>;
  maxToolIterations?: InputMaybe<AggregateNumberFilter>;
  requestTimeoutSeconds?: InputMaybe<AggregateNumberFilter>;
  runRetentionDays?: InputMaybe<AggregateNumberFilter>;
  temperature?: InputMaybe<AggregateNumberFilter>;
  workerIntervalSeconds?: InputMaybe<AggregateNumberFilter>;
};

export enum SettingsToolDiscoveryEnum {
  /** Value: eager */
  Eager = 'eager',
  /** Value: ondemand */
  Ondemand = 'ondemand'
}

export type SettingsToolDiscoveryEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<SettingsToolDiscoveryEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<SettingsToolDiscoveryEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<SettingsToolDiscoveryEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<SettingsToolDiscoveryEnum>;
  /** Greater than */
  gt?: InputMaybe<SettingsToolDiscoveryEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<SettingsToolDiscoveryEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<SettingsToolDiscoveryEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<SettingsToolDiscoveryEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<SettingsToolDiscoveryEnum>;
  /** Not equal to */
  ne?: InputMaybe<SettingsToolDiscoveryEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<SettingsToolDiscoveryEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

/** What has been spent on a project, or on one task in it, added up from the run rows themselves rather than from a counter — a counter would keep climbing after retention deleted the runs behind it. */
export type Spend = {
  completionTokens: Scalars['Int']['output'];
  /** The window that was asked for. Zero means every run still kept. */
  days: Scalars['Int']['output'];
  /** The oldest run in the total. This, not `days`, is what the number actually covers: if retention has swept older runs away, it is later than the window asked for. Null when nothing was counted. */
  from?: Maybe<Scalars['DateTime']['output']>;
  promptTokens: Scalars['Int']['output'];
  /** How long runs are kept, from settings. Zero means forever, and then the total is the whole history. */
  retentionDays: Scalars['Int']['output'];
  /** How many runs went into this total. */
  runs: Scalars['Int']['output'];
  totalTokens: Scalars['Int']['output'];
};

export type StringFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<StringFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<StringFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<StringFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<Scalars['String']['input']>;
  /** Greater than */
  gt?: InputMaybe<Scalars['String']['input']>;
  /** Greater than or equal to */
  gte?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<Scalars['String']['input']>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<Scalars['String']['input']>;
  /** Less than or equal to */
  lte?: InputMaybe<Scalars['String']['input']>;
  /** Not equal to */
  ne?: InputMaybe<Scalars['String']['input']>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<Scalars['String']['input']>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type Subscription = {
  /** Watches a run as it happens. Replays what the run has said so far, then follows it live, and completes when the run ends. Subscribing to a run that has not started waits for it; subscribing to one long finished ends straight away. */
  runEvents: RunEvent;
};


export type SubscriptionRunEventsArgs = {
  runId: Scalars['String']['input'];
};

export type Task = {
  brief: Scalars['String']['output'];
  cards: Array<Card>;
  cardsAggregate: CardAggregate;
  createdAt: Scalars['DateTime']['output'];
  /** Opaque cursor of this row's position in the query's ordering. Pass it as `after` to resume from here. Only set on rows returned by a list query. */
  cursor?: Maybe<Scalars['String']['output']>;
  error: Scalars['String']['output'];
  id: Scalars['String']['output'];
  messages: Array<Message>;
  messagesAggregate: MessageAggregate;
  project: Project;
  projectId: Scalars['String']['output'];
  status: TasksStatusEnum;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


export type TaskCardsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<CardDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CardOrderBy>;
  where?: InputMaybe<CardFilters>;
};


export type TaskCardsAggregateArgs = {
  where?: InputMaybe<CardFilters>;
};


export type TaskMessagesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  distinct?: InputMaybe<Array<MessageDistinctColumn>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MessageOrderBy>;
  where?: InputMaybe<MessageFilters>;
};


export type TaskMessagesAggregateArgs = {
  where?: InputMaybe<MessageFilters>;
};


export type TaskProjectArgs = {
  where?: InputMaybe<ProjectFilters>;
};

export type TaskAggregate = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<TaskCountDistinctAggregate>;
  countNonNull?: Maybe<TaskCountNonNullAggregate>;
  max?: Maybe<TaskMaxAggregate>;
  min?: Maybe<TaskMinAggregate>;
};

export type TaskCountDistinctAggregate = {
  brief: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  title: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type TaskCountDistinctHaving = {
  brief?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  title?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

export type TaskCountNonNullAggregate = {
  brief: Scalars['Int']['output'];
  createdAt: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  projectId: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  title: Scalars['Int']['output'];
  updatedAt: Scalars['Int']['output'];
};

export type TaskCountNonNullHaving = {
  brief?: InputMaybe<AggregateNumberFilter>;
  createdAt?: InputMaybe<AggregateNumberFilter>;
  error?: InputMaybe<AggregateNumberFilter>;
  id?: InputMaybe<AggregateNumberFilter>;
  projectId?: InputMaybe<AggregateNumberFilter>;
  status?: InputMaybe<AggregateNumberFilter>;
  title?: InputMaybe<AggregateNumberFilter>;
  updatedAt?: InputMaybe<AggregateNumberFilter>;
};

/** Columns of Task that a query can be made distinct on */
export enum TaskDistinctColumn {
  Brief = 'brief',
  CreatedAt = 'createdAt',
  Error = 'error',
  Id = 'id',
  ProjectId = 'projectId',
  Status = 'status',
  Title = 'title',
  UpdatedAt = 'updatedAt'
}

export type TaskFilters = {
  /** Every branch matches */
  AND?: InputMaybe<Array<TaskFilters>>;
  /** Negates the nested filters */
  NOT?: InputMaybe<TaskFilters>;
  /** At least one branch matches; ANDed with any sibling fields */
  OR?: InputMaybe<Array<TaskFilters>>;
  brief?: InputMaybe<StringFilter>;
  cards?: InputMaybe<CardListRelationFilter>;
  createdAt?: InputMaybe<DateTimeFilter>;
  error?: InputMaybe<StringFilter>;
  id?: InputMaybe<StringFilter>;
  messages?: InputMaybe<MessageListRelationFilter>;
  /** Matches rows whose project matches these filters */
  project?: InputMaybe<ProjectFilters>;
  projectId?: InputMaybe<StringFilter>;
  status?: InputMaybe<TasksStatusEnumFilter>;
  title?: InputMaybe<StringFilter>;
  updatedAt?: InputMaybe<DateTimeFilter>;
};

export type TaskGroupBy = {
  count: Scalars['Int']['output'];
  countDistinct?: Maybe<TaskCountDistinctAggregate>;
  countNonNull?: Maybe<TaskCountNonNullAggregate>;
  group: TaskGroupKeys;
  max?: Maybe<TaskMaxAggregate>;
  min?: Maybe<TaskMinAggregate>;
};

/** Columns of Task that a query can group by */
export enum TaskGroupByColumn {
  Brief = 'brief',
  CreatedAt = 'createdAt',
  Error = 'error',
  Id = 'id',
  ProjectId = 'projectId',
  Status = 'status',
  Title = 'title',
  UpdatedAt = 'updatedAt'
}

/** The grouped column values of one Task group. A column the query did not group by is null. */
export type TaskGroupKeys = {
  brief?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  status?: Maybe<TasksStatusEnum>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Filters Task groups by their aggregated values */
export type TaskHaving = {
  /** Filters groups by how many rows they contain */
  count?: InputMaybe<AggregateNumberFilter>;
  countDistinct?: InputMaybe<TaskCountDistinctHaving>;
  countNonNull?: InputMaybe<TaskCountNonNullHaving>;
};

export type TaskListRelationFilter = {
  /** Every related row matches */
  every?: InputMaybe<TaskFilters>;
  /** No related row matches */
  none?: InputMaybe<TaskFilters>;
  /** At least one related row matches */
  some?: InputMaybe<TaskFilters>;
};

export type TaskMaxAggregate = {
  brief?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  status?: Maybe<TasksStatusEnum>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TaskMinAggregate = {
  brief?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  projectId?: Maybe<Scalars['String']['output']>;
  status?: Maybe<TasksStatusEnum>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TaskOrderBy = {
  brief?: InputMaybe<InnerOrder>;
  createdAt?: InputMaybe<InnerOrder>;
  error?: InputMaybe<InnerOrder>;
  id?: InputMaybe<InnerOrder>;
  /** Order by columns of the related project row */
  project?: InputMaybe<ProjectOrderBy>;
  projectId?: InputMaybe<InnerOrder>;
  status?: InputMaybe<InnerOrder>;
  title?: InputMaybe<InnerOrder>;
  updatedAt?: InputMaybe<InnerOrder>;
};

export enum TasksStatusEnum {
  /** Value: decomposed */
  Decomposed = 'decomposed',
  /** Value: decomposing */
  Decomposing = 'decomposing',
  /** Value: draft */
  Draft = 'draft',
  /** Value: error */
  Error = 'error',
  /** Value: ready */
  Ready = 'ready'
}

export type TasksStatusEnumFilter = {
  /** Every branch matches */
  AND?: InputMaybe<Array<TasksStatusEnumFilter>>;
  /** Negates the nested operators */
  NOT?: InputMaybe<TasksStatusEnumFilter>;
  /** At least one branch matches; ANDed with any sibling operators */
  OR?: InputMaybe<Array<TasksStatusEnumFilter>>;
  /** Matches values containing the given string. `%`, `_` and `\` are matched literally. */
  contains?: InputMaybe<Scalars['String']['input']>;
  /** Matches values ending with the given string. `%`, `_` and `\` are matched literally. */
  endsWith?: InputMaybe<Scalars['String']['input']>;
  /** Equal to */
  eq?: InputMaybe<TasksStatusEnum>;
  /** Greater than */
  gt?: InputMaybe<TasksStatusEnum>;
  /** Greater than or equal to */
  gte?: InputMaybe<TasksStatusEnum>;
  /** Case-insensitive `contains`. */
  iContains?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `endsWith`. */
  iEndsWith?: InputMaybe<Scalars['String']['input']>;
  /** Case-insensitive `startsWith`. */
  iStartsWith?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  /** Matches any one of these values (SQL `IN`) */
  inArray?: InputMaybe<Array<TasksStatusEnum>>;
  /** When true, every comparison operator in this object matches case-insensitively — `eq`, `ne`, the ordering operators, `inArray`/`notInArray` and the pattern operators all compare `lower(column)` against `lower(operand)`. Applies only to the operators beside it; a nested `AND`/`OR`/`NOT` branch sets its own. */
  insensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is not NULL */
  isNotNull?: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, matches rows where the column is NULL */
  isNull?: InputMaybe<Scalars['Boolean']['input']>;
  like?: InputMaybe<Scalars['String']['input']>;
  /** Less than */
  lt?: InputMaybe<TasksStatusEnum>;
  /** Less than or equal to */
  lte?: InputMaybe<TasksStatusEnum>;
  /** Not equal to */
  ne?: InputMaybe<TasksStatusEnum>;
  notIlike?: InputMaybe<Scalars['String']['input']>;
  /** Matches none of these values (SQL `NOT IN`) */
  notInArray?: InputMaybe<Array<TasksStatusEnum>>;
  notLike?: InputMaybe<Scalars['String']['input']>;
  /** Matches values starting with the given string. `%`, `_` and `\` are matched literally. */
  startsWith?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAgentInput = {
  baseUrl?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  maxRetries?: InputMaybe<Scalars['Int']['input']>;
  maxTokens?: InputMaybe<Scalars['Int']['input']>;
  maxToolIterations?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  requestTimeoutSeconds?: InputMaybe<Scalars['Int']['input']>;
  roleId?: InputMaybe<Scalars['String']['input']>;
  systemPrompt?: InputMaybe<Scalars['String']['input']>;
  temperature?: InputMaybe<Scalars['Float']['input']>;
  toolDiscovery?: InputMaybe<AgentsToolDiscoveryEnum>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

/** One entry of a batch update of Agent: the rows `where` matches get this entry's `set` applied. */
export type UpdateAgentManyInput = {
  set: UpdateAgentInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<AgentFilters>;
};

export type UpdateAgentServerInput = {
  agentId?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  serverId?: InputMaybe<Scalars['String']['input']>;
};

/** One entry of a batch update of AgentServer: the rows `where` matches get this entry's `set` applied. */
export type UpdateAgentServerManyInput = {
  set: UpdateAgentServerInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<AgentServerFilters>;
};

export type UpdateCardDepInput = {
  cardId?: InputMaybe<Scalars['String']['input']>;
  dependsOnCardId?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** One entry of a batch update of CardDep: the rows `where` matches get this entry's `set` applied. */
export type UpdateCardDepManyInput = {
  set: UpdateCardDepInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<CardDepFilters>;
};

export type UpdateCardInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  archivedAt?: InputMaybe<Scalars['DateTime']['input']>;
  body?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  error?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  laneId?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['String']['input']>;
  result?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<CardsStatusEnum>;
  taskId?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

/** One entry of a batch update of Card: the rows `where` matches get this entry's `set` applied. */
export type UpdateCardManyInput = {
  set: UpdateCardInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<CardFilters>;
};

export type UpdateLaneInput = {
  agentId?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  intake?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  onFailureLaneId?: InputMaybe<Scalars['String']['input']>;
  onSuccessLaneId?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['String']['input']>;
  readVerdict?: InputMaybe<Scalars['Boolean']['input']>;
  wipLimit?: InputMaybe<Scalars['Int']['input']>;
};

/** One entry of a batch update of Lane: the rows `where` matches get this entry's `set` applied. */
export type UpdateLaneManyInput = {
  set: UpdateLaneInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<LaneFilters>;
};

export type UpdateMcpServerInput = {
  args?: InputMaybe<Scalars['JSON']['input']>;
  command?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  env?: InputMaybe<Scalars['JSON']['input']>;
  headers?: InputMaybe<Scalars['JSON']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  transport?: InputMaybe<McpServersTransportEnum>;
  url?: InputMaybe<Scalars['String']['input']>;
};

/** One entry of a batch update of McpServer: the rows `where` matches get this entry's `set` applied. */
export type UpdateMcpServerManyInput = {
  set: UpdateMcpServerInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<McpServerFilters>;
};

export type UpdateMessageInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<MessagesRoleEnum>;
  taskId?: InputMaybe<Scalars['String']['input']>;
};

/** One entry of a batch update of Message: the rows `where` matches get this entry's `set` applied. */
export type UpdateMessageManyInput = {
  set: UpdateMessageInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<MessageFilters>;
};

export type UpdateProjectInput = {
  autoRun?: InputMaybe<Scalars['Boolean']['input']>;
  context?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  decomposeAgentId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  refineAgentId?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

/** One entry of a batch update of Project: the rows `where` matches get this entry's `set` applied. */
export type UpdateProjectManyInput = {
  set: UpdateProjectInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<ProjectFilters>;
};

export type UpdateRoleInput = {
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  stage?: InputMaybe<RolesStageEnum>;
  systemPrompt?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

/** One entry of a batch update of Role: the rows `where` matches get this entry's `set` applied. */
export type UpdateRoleManyInput = {
  set: UpdateRoleInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<RoleFilters>;
};

export type UpdateSettingInput = {
  baseUrl?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  maxRetries?: InputMaybe<Scalars['Int']['input']>;
  maxTokens?: InputMaybe<Scalars['Int']['input']>;
  maxToolIterations?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  requestTimeoutSeconds?: InputMaybe<Scalars['Int']['input']>;
  runRetentionDays?: InputMaybe<Scalars['Int']['input']>;
  temperature?: InputMaybe<Scalars['Float']['input']>;
  toolDiscovery?: InputMaybe<SettingsToolDiscoveryEnum>;
  toolSelectModel?: InputMaybe<Scalars['String']['input']>;
  workerIntervalSeconds?: InputMaybe<Scalars['Int']['input']>;
};

/** One entry of a batch update of Setting: the rows `where` matches get this entry's `set` applied. */
export type UpdateSettingManyInput = {
  set: UpdateSettingInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<SettingFilters>;
};

export type UpdateTaskInput = {
  brief?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['DateTime']['input']>;
  error?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  projectId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TasksStatusEnum>;
  title?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

/** One entry of a batch update of Task: the rows `where` matches get this entry's `set` applied. */
export type UpdateTaskManyInput = {
  set: UpdateTaskInput;
  /** Rows this entry updates. An omitted filter updates every row. */
  where?: InputMaybe<TaskFilters>;
};

export type AgentsQueryVariables = Exact<{ [key: string]: never; }>;


export type AgentsQuery = { agents: Array<{ id: string, name: string, roleId: string, enabled: boolean, baseUrl: string, model: string, systemPrompt: string, maxTokens: number, temperature: number, maxToolIterations: number, toolDiscovery: AgentsToolDiscoveryEnum, requestTimeoutSeconds: number, maxRetries: number, role: { id: string, name: string, stage: RolesStageEnum, systemPrompt: string }, servers: Array<{ serverId: string }> }>, roles: Array<{ id: string, name: string, description: string, stage: RolesStageEnum, systemPrompt: string }>, mcpServers: Array<{ id: string, slug: string, label: string, enabled: boolean }> };

export type AgentModelsQueryVariables = Exact<{
  agentId?: InputMaybe<Scalars['String']['input']>;
}>;


export type AgentModelsQuery = { models: Array<string> };

export type CreateAgentMutationVariables = Exact<{
  values: CreateAgentInput;
}>;


export type CreateAgentMutation = { createAgent: { id: string } };

export type UpdateAgentMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateAgentInput;
}>;


export type UpdateAgentMutation = { updateAgentSingle?: { id: string } | null };

export type DeleteAgentMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteAgentMutation = { deleteAgentSingle?: { id: string } | null };

export type SetAgentServersMutationVariables = Exact<{
  agentId: Scalars['String']['input'];
  serverIds: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type SetAgentServersMutation = { setAgentServers: Array<string> };

export type SetAgentApiKeyMutationVariables = Exact<{
  agentId: Scalars['String']['input'];
  apiKey: Scalars['String']['input'];
}>;


export type SetAgentApiKeyMutation = { setAgentApiKey: boolean };

export type CreateRoleMutationVariables = Exact<{
  values: CreateRoleInput;
}>;


export type CreateRoleMutation = { createRole: { id: string } };

export type UpdateRoleMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateRoleInput;
}>;


export type UpdateRoleMutation = { updateRoleSingle?: { id: string } | null };

export type DeleteRoleMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteRoleMutation = { deleteRoleSingle?: { id: string } | null };

export type ArchiveQueryVariables = Exact<{
  projectId: Scalars['String']['input'];
}>;


export type ArchiveQuery = { cards: Array<{ id: string, laneId: string, title: string, body: string, status: CardsStatusEnum, result: string, error: string, archivedAt?: string | null, lane: { name: string } }> };

export type ArchiveCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
}>;


export type ArchiveCardMutation = { archiveCard: { id: string, archivedAt?: string | null } };

export type RestoreCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
}>;


export type RestoreCardMutation = { restoreCard: { id: string, laneId: string, position: number, archivedAt?: string | null } };

export type BoardQueryVariables = Exact<{
  projectId: Scalars['String']['input'];
}>;


export type BoardQuery = { lanes: Array<{ id: string, name: string, position: number, intake: boolean, agentId?: string | null, onSuccessLaneId?: string | null, onFailureLaneId?: string | null, wipLimit: number, readVerdict: boolean }>, cards: Array<{ id: string, laneId: string, taskId?: string | null, title: string, body: string, acceptance: string, position: number, status: CardsStatusEnum, result: string, error: string, updatedAt: string, deps: Array<{ dependsOnCardId: string }> }> };

export type MoveCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
  laneId: Scalars['String']['input'];
  position?: InputMaybe<Scalars['Int']['input']>;
}>;


export type MoveCardMutation = { moveCard: { id: string, laneId: string, position: number, status: CardsStatusEnum } };

export type RunCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
}>;


export type RunCardMutation = { runCard: { id: string, status: RunsStatusEnum, error: string } };

export type SetCardDepsMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
  dependsOn: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type SetCardDepsMutation = { setCardDeps: Array<string> };

export type RetryCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
}>;


export type RetryCardMutation = { retryCard: { id: string, status: CardsStatusEnum, error: string } };

export type StopCardMutationVariables = Exact<{
  cardId: Scalars['String']['input'];
}>;


export type StopCardMutation = { stopCard: boolean };

export type CreateCardMutationVariables = Exact<{
  values: CreateCardInput;
}>;


export type CreateCardMutation = { createCard: { id: string } };

export type UpdateCardMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateCardInput;
}>;


export type UpdateCardMutation = { updateCardSingle?: { id: string } | null };

export type DeleteCardMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteCardMutation = { deleteCardSingle?: { id: string } | null };

export type CreateLaneMutationVariables = Exact<{
  values: CreateLaneInput;
}>;


export type CreateLaneMutation = { createLane: { id: string } };

export type UpdateLaneMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateLaneInput;
}>;


export type UpdateLaneMutation = { updateLaneSingle?: { id: string } | null };

export type DeleteLaneMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteLaneMutation = { deleteLaneSingle?: { id: string } | null };

export type McpServersQueryVariables = Exact<{ [key: string]: never; }>;


export type McpServersQuery = { mcpServers: Array<{ id: string, slug: string, label: string, enabled: boolean, transport: McpServersTransportEnum, command: string, args?: unknown | null, env?: unknown | null, url: string, headers?: unknown | null }>, mcpStatus: Array<{ id: string, status: string, error: string, tools: Array<{ name: string, description: string }> }> };

export type CreateMcpServerMutationVariables = Exact<{
  values: CreateMcpServerInput;
}>;


export type CreateMcpServerMutation = { createMcpServer: { id: string } };

export type UpdateMcpServerMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateMcpServerInput;
}>;


export type UpdateMcpServerMutation = { updateMcpServerSingle?: { id: string } | null };

export type DeleteMcpServerMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMcpServerMutation = { deleteMcpServerSingle?: { id: string } | null };

export type TestMcpServerMutationVariables = Exact<{
  config: McpConnectionInput;
}>;


export type TestMcpServerMutation = { testMcpServer: { ok: boolean, error: string, tools: Array<{ name: string, description: string }> } };

export type ReconnectMcpMutationVariables = Exact<{ [key: string]: never; }>;


export type ReconnectMcpMutation = { reconnectMcp: Array<{ id: string, status: string, error: string }> };

export type ProjectsQueryVariables = Exact<{ [key: string]: never; }>;


export type ProjectsQuery = { projects: Array<{ id: string, name: string, description: string, context: string, autoRun: boolean, refineAgentId?: string | null, decomposeAgentId?: string | null }> };

export type CreateProjectMutationVariables = Exact<{
  values: CreateProjectInput;
}>;


export type CreateProjectMutation = { createProject: { id: string, name: string } };

export type UpdateProjectMutationVariables = Exact<{
  id: Scalars['String']['input'];
  set: UpdateProjectInput;
}>;


export type UpdateProjectMutation = { updateProjectSingle?: { id: string } | null };

export type DeleteProjectMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteProjectMutation = { deleteProjectSingle?: { id: string } | null };

export type RunsQueryVariables = Exact<{
  projectId?: InputMaybe<Scalars['String']['input']>;
}>;


export type RunsQuery = { runs: Array<{ id: string, kind: RunsKindEnum, status: RunsStatusEnum, startedAt: string, finishedAt?: string | null, output: string, error: string, toolCalls?: unknown | null, totalTokens: number, cardId?: string | null, taskId?: string | null, agent?: { name: string } | null, card?: { title: string } | null, task?: { title: string } | null }> };

export type ActiveRunsQueryVariables = Exact<{
  projectId: Scalars['String']['input'];
}>;


export type ActiveRunsQuery = { runs: Array<{ id: string, kind: RunsKindEnum, cardId?: string | null, taskId?: string | null }> };

export type DeleteRunMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteRunMutation = { deleteRunSingle?: { id: string } | null };

export type RunEventsSubscriptionVariables = Exact<{
  runId: Scalars['String']['input'];
}>;


export type RunEventsSubscription = { runEvents: { seq: number, kind: string, text: string, name: string, ok?: boolean | null } };

export type SettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type SettingsQuery = { settings: Array<{ id: string, baseUrl: string, model: string, maxTokens: number, temperature: number, maxToolIterations: number, toolDiscovery: SettingsToolDiscoveryEnum, toolSelectModel: string, requestTimeoutSeconds: number, maxRetries: number, runRetentionDays: number, workerIntervalSeconds: number }> };

export type UpdateSettingsMutationVariables = Exact<{
  set: UpdateSettingInput;
}>;


export type UpdateSettingsMutation = { updateSettingSingle?: { id: string } | null };

export type SetApiKeyMutationVariables = Exact<{
  apiKey: Scalars['String']['input'];
}>;


export type SetApiKeyMutation = { setApiKey: boolean };

export type SpendQueryVariables = Exact<{
  projectId: Scalars['String']['input'];
  taskId?: InputMaybe<Scalars['String']['input']>;
  days?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SpendQuery = { spend: { runs: number, promptTokens: number, completionTokens: number, totalTokens: number, days: number, from?: string | null, retentionDays: number } };

export type TasksQueryVariables = Exact<{
  projectId: Scalars['String']['input'];
}>;


export type TasksQuery = { tasks: Array<{ id: string, title: string, brief: string, status: TasksStatusEnum, error: string, createdAt: string, messages: Array<{ id: string, role: MessagesRoleEnum, content: string }>, cards: Array<{ id: string, title: string, status: CardsStatusEnum }> }> };

export type CreateTaskMutationVariables = Exact<{
  values: CreateTaskInput;
}>;


export type CreateTaskMutation = { createTask: { id: string, title: string, brief: string, status: TasksStatusEnum } };

export type RefineTaskMutationVariables = Exact<{
  taskId: Scalars['String']['input'];
  message: Scalars['String']['input'];
}>;


export type RefineTaskMutation = { refineTask: { id: string, status: RunsStatusEnum, error: string } };

export type AcceptTaskMutationVariables = Exact<{
  taskId: Scalars['String']['input'];
}>;


export type AcceptTaskMutation = { acceptTask: { id: string, status: TasksStatusEnum } };

export type DecomposeTaskMutationVariables = Exact<{
  taskId: Scalars['String']['input'];
}>;


export type DecomposeTaskMutation = { decomposeTask: { id: string, status: RunsStatusEnum, error: string } };

export type SubmitTaskMutationVariables = Exact<{
  projectId: Scalars['String']['input'];
  title: Scalars['String']['input'];
  brief: Scalars['String']['input'];
}>;


export type SubmitTaskMutation = { submitTask: { id: string, status: TasksStatusEnum, error: string } };

export type DeleteTaskMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteTaskMutation = { deleteTaskSingle?: { id: string } | null };

export type StopTaskMutationVariables = Exact<{
  taskId: Scalars['String']['input'];
}>;


export type StopTaskMutation = { stopTask: boolean };

export type BoardTemplatesQueryVariables = Exact<{ [key: string]: never; }>;


export type BoardTemplatesQuery = { boardTemplates: Array<{ id: string, name: string, description: string, lanes: unknown, createdAt: string }> };

export type SaveBoardTemplateMutationVariables = Exact<{
  projectId: Scalars['String']['input'];
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type SaveBoardTemplateMutation = { saveBoardTemplate: { id: string, name: string } };

export type ApplyBoardTemplateMutationVariables = Exact<{
  projectId: Scalars['String']['input'];
  templateId: Scalars['String']['input'];
}>;


export type ApplyBoardTemplateMutation = { applyBoardTemplate: Array<{ id: string, name: string, position: number }> };

export type DeleteBoardTemplateMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteBoardTemplateMutation = { deleteBoardTemplateSingle?: { id: string } | null };


export const AgentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Agents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"agents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"roleId"}},{"kind":"Field","name":{"kind":"Name","value":"role"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"systemPrompt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"baseUrl"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"systemPrompt"}},{"kind":"Field","name":{"kind":"Name","value":"maxTokens"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"maxToolIterations"}},{"kind":"Field","name":{"kind":"Name","value":"toolDiscovery"}},{"kind":"Field","name":{"kind":"Name","value":"requestTimeoutSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"maxRetries"}},{"kind":"Field","name":{"kind":"Name","value":"servers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serverId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"roles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"systemPrompt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mcpServers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slug"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}}]}}]} as unknown as DocumentNode<AgentsQuery, AgentsQueryVariables>;
export const AgentModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AgentModels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"models"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"agentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}}}]}]}}]} as unknown as DocumentNode<AgentModelsQuery, AgentModelsQueryVariables>;
export const CreateAgentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateAgent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAgentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAgent"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateAgentMutation, CreateAgentMutationVariables>;
export const UpdateAgentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAgent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateAgentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAgentSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateAgentMutation, UpdateAgentMutationVariables>;
export const DeleteAgentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAgent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAgentSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteAgentMutation, DeleteAgentMutationVariables>;
export const SetAgentServersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetAgentServers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"serverIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setAgentServers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"agentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"serverIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"serverIds"}}}]}]}}]} as unknown as DocumentNode<SetAgentServersMutation, SetAgentServersMutationVariables>;
export const SetAgentApiKeyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetAgentApiKey"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setAgentApiKey"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"agentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}]}]}}]} as unknown as DocumentNode<SetAgentApiKeyMutation, SetAgentApiKeyMutationVariables>;
export const CreateRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateRoleMutation, CreateRoleMutationVariables>;
export const UpdateRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRoleSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateRoleMutation, UpdateRoleMutationVariables>;
export const DeleteRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRoleSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteRoleMutation, DeleteRoleMutationVariables>;
export const ArchiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Archive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cards"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"500"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"archivedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNotNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"archivedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"laneId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lane"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<ArchiveQuery, ArchiveQueryVariables>;
export const ArchiveCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}}]}}]}}]} as unknown as DocumentNode<ArchiveCardMutation, ArchiveCardMutationVariables>;
export const RestoreCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"laneId"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}}]}}]}}]} as unknown as DocumentNode<RestoreCardMutation, RestoreCardMutationVariables>;
export const BoardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Board"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lanes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"intake"}},{"kind":"Field","name":{"kind":"Name","value":"agentId"}},{"kind":"Field","name":{"kind":"Name","value":"onSuccessLaneId"}},{"kind":"Field","name":{"kind":"Name","value":"onFailureLaneId"}},{"kind":"Field","name":{"kind":"Name","value":"wipLimit"}},{"kind":"Field","name":{"kind":"Name","value":"readVerdict"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cards"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"500"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"archivedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"laneId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"acceptance"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dependsOnCardId"}}]}}]}}]}}]} as unknown as DocumentNode<BoardQuery, BoardQueryVariables>;
export const MoveCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MoveCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"laneId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"position"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"moveCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}},{"kind":"Argument","name":{"kind":"Name","value":"laneId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"laneId"}}},{"kind":"Argument","name":{"kind":"Name","value":"position"},"value":{"kind":"Variable","name":{"kind":"Name","value":"position"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"laneId"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<MoveCardMutation, MoveCardMutationVariables>;
export const RunCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RunCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<RunCardMutation, RunCardMutationVariables>;
export const SetCardDepsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetCardDeps"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dependsOn"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setCardDeps"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}},{"kind":"Argument","name":{"kind":"Name","value":"dependsOn"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dependsOn"}}}]}]}}]} as unknown as DocumentNode<SetCardDepsMutation, SetCardDepsMutationVariables>;
export const RetryCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<RetryCardMutation, RetryCardMutationVariables>;
export const StopCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StopCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stopCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cardId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cardId"}}}]}]}}]} as unknown as DocumentNode<StopCardMutation, StopCardMutationVariables>;
export const CreateCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCardInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateCardMutation, CreateCardMutationVariables>;
export const UpdateCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateCardInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCardSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateCardMutation, UpdateCardMutationVariables>;
export const DeleteCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCardSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteCardMutation, DeleteCardMutationVariables>;
export const CreateLaneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLane"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateLaneInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLane"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateLaneMutation, CreateLaneMutationVariables>;
export const UpdateLaneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateLane"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateLaneInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateLaneSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateLaneMutation, UpdateLaneMutationVariables>;
export const DeleteLaneDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteLane"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteLaneSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteLaneMutation, DeleteLaneMutationVariables>;
export const McpServersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"McpServers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mcpServers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slug"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"transport"}},{"kind":"Field","name":{"kind":"Name","value":"command"}},{"kind":"Field","name":{"kind":"Name","value":"args"}},{"kind":"Field","name":{"kind":"Name","value":"env"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mcpStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"tools"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]}}]} as unknown as DocumentNode<McpServersQuery, McpServersQueryVariables>;
export const CreateMcpServerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMcpServer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMcpServerInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMcpServer"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateMcpServerMutation, CreateMcpServerMutationVariables>;
export const UpdateMcpServerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMcpServer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMcpServerInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMcpServerSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateMcpServerMutation, UpdateMcpServerMutationVariables>;
export const DeleteMcpServerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMcpServer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMcpServerSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteMcpServerMutation, DeleteMcpServerMutationVariables>;
export const TestMcpServerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TestMcpServer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"config"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"McpConnectionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testMcpServer"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"config"},"value":{"kind":"Variable","name":{"kind":"Name","value":"config"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"tools"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]}}]} as unknown as DocumentNode<TestMcpServerMutation, TestMcpServerMutationVariables>;
export const ReconnectMcpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReconnectMcp"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reconnectMcp"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<ReconnectMcpMutation, ReconnectMcpMutationVariables>;
export const ProjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Projects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projects"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"context"}},{"kind":"Field","name":{"kind":"Name","value":"autoRun"}},{"kind":"Field","name":{"kind":"Name","value":"refineAgentId"}},{"kind":"Field","name":{"kind":"Name","value":"decomposeAgentId"}}]}}]}}]} as unknown as DocumentNode<ProjectsQuery, ProjectsQueryVariables>;
export const CreateProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateProjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateProjectMutation, CreateProjectMutationVariables>;
export const UpdateProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProjectSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateProjectMutation, UpdateProjectMutationVariables>;
export const DeleteProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteProjectSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteProjectMutation, DeleteProjectMutationVariables>;
export const RunsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Runs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"output"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"toolCalls"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"cardId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"agent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"card"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]} as unknown as DocumentNode<RunsQuery, RunsQueryVariables>;
export const ActiveRunsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ActiveRuns"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"status"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"EnumValue","value":"running"}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"cardId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}}]}}]}}]} as unknown as DocumentNode<ActiveRunsQuery, ActiveRunsQueryVariables>;
export const DeleteRunDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRun"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRunSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteRunMutation, DeleteRunMutationVariables>;
export const RunEventsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"RunEvents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"runId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runEvents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"runId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"runId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"seq"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"ok"}}]}}]}}]} as unknown as DocumentNode<RunEventsSubscription, RunEventsSubscriptionVariables>;
export const SettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"baseUrl"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"maxTokens"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"maxToolIterations"}},{"kind":"Field","name":{"kind":"Name","value":"toolDiscovery"}},{"kind":"Field","name":{"kind":"Name","value":"toolSelectModel"}},{"kind":"Field","name":{"kind":"Name","value":"requestTimeoutSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"maxRetries"}},{"kind":"Field","name":{"kind":"Name","value":"runRetentionDays"}},{"kind":"Field","name":{"kind":"Name","value":"workerIntervalSeconds"}}]}}]}}]} as unknown as DocumentNode<SettingsQuery, SettingsQueryVariables>;
export const UpdateSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSettingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSettingSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"StringValue","value":"default","block":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateSettingsMutation, UpdateSettingsMutationVariables>;
export const SetApiKeyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetApiKey"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setApiKey"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}]}]}}]} as unknown as DocumentNode<SetApiKeyMutation, SetApiKeyMutationVariables>;
export const SpendDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Spend"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spend"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runs"}},{"kind":"Field","name":{"kind":"Name","value":"promptTokens"}},{"kind":"Field","name":{"kind":"Name","value":"completionTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"retentionDays"}}]}}]}}]} as unknown as DocumentNode<SpendQuery, SpendQueryVariables>;
export const TasksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Tasks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"projectId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"brief"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cards"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<TasksQuery, TasksQueryVariables>;
export const CreateTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"values"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"values"},"value":{"kind":"Variable","name":{"kind":"Name","value":"values"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"brief"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CreateTaskMutation, CreateTaskMutationVariables>;
export const RefineTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefineTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refineTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"message"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<RefineTaskMutation, RefineTaskMutationVariables>;
export const AcceptTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AcceptTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AcceptTaskMutation, AcceptTaskMutationVariables>;
export const DecomposeTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DecomposeTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"decomposeTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<DecomposeTaskMutation, DecomposeTaskMutationVariables>;
export const SubmitTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"brief"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"brief"},"value":{"kind":"Variable","name":{"kind":"Name","value":"brief"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<SubmitTaskMutation, SubmitTaskMutationVariables>;
export const DeleteTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTaskSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteTaskMutation, DeleteTaskMutationVariables>;
export const StopTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StopTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stopTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}}]}]}}]} as unknown as DocumentNode<StopTaskMutation, StopTaskMutationVariables>;
export const BoardTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BoardTemplates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"boardTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"direction"},"value":{"kind":"EnumValue","value":"asc"}},{"kind":"ObjectField","name":{"kind":"Name","value":"priority"},"value":{"kind":"IntValue","value":"1"}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"lanes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<BoardTemplatesQuery, BoardTemplatesQueryVariables>;
export const SaveBoardTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveBoardTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveBoardTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<SaveBoardTemplateMutation, SaveBoardTemplateMutationVariables>;
export const ApplyBoardTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ApplyBoardTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"applyBoardTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}}]}}]} as unknown as DocumentNode<ApplyBoardTemplateMutation, ApplyBoardTemplateMutationVariables>;
export const DeleteBoardTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteBoardTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteBoardTemplateSingle"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteBoardTemplateMutation, DeleteBoardTemplateMutationVariables>;