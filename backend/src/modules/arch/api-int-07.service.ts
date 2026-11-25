/**
 * Architecture Service 97: Keyset Pagination Engine
 * Subsystem: High-Cardinality Cursor Pagination
 */

export interface PageableItem {
  id: number;
}

export class KeysetPaginationEngineService {
  public paginate<T extends PageableItem>(items: T[], afterCursor?: number, limit = 10): { items: T[]; nextCursor?: number } {
    let filtered = items;
    if (afterCursor !== undefined) {
      filtered = items.filter(i => i.id > afterCursor);
    }

    const page = filtered.slice(0, limit);
    const nextCursor = page.length === limit ? page[page.length - 1].id : undefined;

    return { items: page, nextCursor };
  }
}
