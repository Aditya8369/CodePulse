import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TenantSandboxedClassloaderService {
  private readonly logger = new Logger(TenantSandboxedClassloaderService.name);
  private tenantRegistries = new Map<string, Map<string, any>>(); // tenantId -> (pluginName -> module)

  public registerPlugin(tenantId: string, pluginName: string, implementation: any): void {
    if (!this.tenantRegistries.has(tenantId)) {
      this.tenantRegistries.set(tenantId, new Map());
    }
    this.tenantRegistries.get(tenantId)!.set(pluginName, implementation);
    this.logger.log(`Loaded isolated plugin ${pluginName} for tenant ${tenantId}`);
  }

  public executePluginMethod(tenantId: string, pluginName: string, methodName: string, ...args: any[]): any {
    const reg = this.tenantRegistries.get(tenantId);
    if (!reg || !reg.has(pluginName)) {
      throw new Error('PLUGIN_NOT_FOUND_FOR_TENANT');
    }

    const plugin = reg.get(pluginName);
    if (typeof plugin[methodName] !== 'function') {
      throw new Error('METHOD_NOT_SUPPORTED');
    }

    return plugin[methodName](...args);
  }
}
