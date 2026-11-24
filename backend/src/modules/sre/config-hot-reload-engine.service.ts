export class ConfigHotReloadEngineService {
  private configStore = new Map<string, any>();
  private listeners: ((key: string, newVal: any) => void)[] = [];

  public updateKey(key: string, val: any): void {
    this.configStore.set(key, val);
    for (const listener of this.listeners) {
      listener(key, val);
    }
  }

  public getKey<T>(key: string, defaultValue?: T): T {
    return this.configStore.has(key) ? this.configStore.get(key) : defaultValue;
  }

  public onChange(listener: (key: string, newVal: any) => void): void {
    this.listeners.push(listener);
  }
}
