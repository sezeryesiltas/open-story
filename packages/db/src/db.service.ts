export type TableName =
  | 'placements'
  | 'staticTokens'
  | 'storyGroupSets'
  | 'storyGroups'
  | 'stories'
  | 'assets';

export class DbService {
  private readonly state: Record<TableName, unknown[]> = {
    placements: [],
    staticTokens: [],
    storyGroupSets: [],
    storyGroups: [],
    stories: [],
    assets: [],
  };

  list<T>(table: TableName): T[] {
    return this.state[table] as T[];
  }

  insert<T>(table: TableName, row: T): T {
    this.state[table].push(row as unknown);
    return row;
  }

  findById<T extends { id: string }>(table: TableName, id: string): T | undefined {
    return (this.state[table] as T[]).find((item) => item.id === id);
  }

  updateById<T extends { id: string }>(table: TableName, id: string, patch: Partial<T>): T | undefined {
    const row = this.findById<T>(table, id);
    if (!row) {
      return undefined;
    }

    Object.assign(row, patch);
    return row;
  }
}
