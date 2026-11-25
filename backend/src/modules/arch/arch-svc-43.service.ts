/**
 * Architecture Service 43: Hierarchical Configuration Management Provider
 * Subsystem: Dynamic Hot-Reload Watches
 */

export class HierarchicalConfigProviderService {
  private configs = new Map<string, unknown>();
  private watchers = new Map<string, Array<(newVal: unknown) => void>>();

  public setConfig(key: string, value: unknown): void {
    this.configs.set(key, value);
    const listeners = this.watchers.get(key) || [];
    for (const fn of listeners) {
      fn(value);
    }
  }

  public getConfig<T>(key: string, defaultValue?: T): T | undefined {
    return (this.configs.get(key) as T) ?? defaultValue;
  }

  public watchConfig(key: string, callback: (newVal: unknown) => void): void {
    const list = this.watchers.get(key) || [];
    list.push(callback);
    this.watchers.set(key, list);
  }
}
