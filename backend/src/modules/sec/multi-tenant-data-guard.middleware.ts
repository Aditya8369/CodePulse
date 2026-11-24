export class MultiTenantDataGuardMiddleware {
  public injectTenantFilter(queryObj: Record<string, any>, tenantId: string): Record<string, any> {
    if (!tenantId) {
      throw new Error('Tenant context missing');
    }
    return {
      ...queryObj,
      where: {
        ...(queryObj.where || {}),
        tenantId
      }
    };
  }
}
