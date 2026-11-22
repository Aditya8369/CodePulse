import { OpaService, DynamicPolicyRule } from './opa.service';

describe('OpaService (Declarative Rego Policy & ABAC Guard)', () => {
  let opa: OpaService;

  beforeEach(() => {
    opa = new OpaService();
  });

  describe('Default Role Matrix Evaluation', () => {
    it('allows Admin wildcard access to any action and resource', () => {
      const res = opa.evaluate({
        subject: { id: 'admin-1', role: 'ADMIN' },
        action: 'wipe_database_cache',
        resource: { type: 'system_settings' },
      });

      expect(res.allowed).toBe(true);
      expect(res.decisionId).toBeDefined();
    });

    it('allows Moderator to ban users and view cheat logs', () => {
      const banRes = opa.evaluate({
        subject: { id: 'mod-1', role: 'MODERATOR' },
        action: 'ban_user',
        resource: { type: 'user', id: 'cheater-99' },
      });
      expect(banRes.allowed).toBe(true);

      const invalidRes = opa.evaluate({
        subject: { id: 'mod-1', role: 'MODERATOR' },
        action: 'award_admin_privileges',
        resource: { type: 'roles' },
      });
      expect(invalidRes.allowed).toBe(false);
    });

    it('enforces ABAC minimum trust score threshold on Mentor actions', () => {
      const trustedMentor = opa.evaluate({
        subject: { id: 'mentor-1', role: 'MENTOR', trustScore: 85 },
        action: 'shadow_code',
        resource: { type: 'mentorship_session' },
      });
      expect(trustedMentor.allowed).toBe(true);

      const untrustedMentor = opa.evaluate({
        subject: { id: 'mentor-low', role: 'MENTOR', trustScore: 50 }, // Requires >= 70
        action: 'shadow_code',
        resource: { type: 'mentorship_session' },
      });
      expect(untrustedMentor.allowed).toBe(false);
      expect(untrustedMentor.reason).toContain('trust score');
    });

    it('enforces resource ownership for profile/api_key modifications', () => {
      const ownerRes = opa.evaluate({
        subject: { id: 'user-alpha', role: 'PLAYER' },
        action: 'update_profile',
        resource: { type: 'profile', ownerId: 'user-alpha' },
      });
      expect(ownerRes.allowed).toBe(true);

      const imposterRes = opa.evaluate({
        subject: { id: 'user-beta', role: 'PLAYER' },
        action: 'update_profile',
        resource: { type: 'profile', ownerId: 'user-alpha' },
      });
      expect(imposterRes.allowed).toBe(false);
      expect(imposterRes.reason).toContain('does not own');
    });
  });

  describe('Dynamic Policy Reload Without Server Restart', () => {
    it('instantly applies updated policy rules at runtime', () => {
      // Initially, player cannot access 'spectate_private_scrim'
      const initial = opa.evaluate({
        subject: { id: 'p-1', role: 'PLAYER' },
        action: 'spectate_private_scrim',
        resource: { type: 'scrim' },
      });
      expect(initial.allowed).toBe(false);

      // Dynamically add new rule
      const newRules: DynamicPolicyRule[] = [
        {
          id: 'vip-scrim-spectate',
          roles: ['PLAYER'],
          actions: ['spectate_private_scrim'],
          resourceTypes: ['scrim'],
        },
      ];

      opa.updatePolicies(newRules, 'v2.0.0-live');
      expect(opa.getPolicyVersion()).toBe('v2.0.0-live');

      // Now allowed immediately without reboot!
      const afterUpdate = opa.evaluate({
        subject: { id: 'p-1', role: 'PLAYER' },
        action: 'spectate_private_scrim',
        resource: { type: 'scrim' },
      });
      expect(afterUpdate.allowed).toBe(true);
    });
  });

  describe('Immutable Audit Decision Trail', () => {
    it('records each evaluation into audit logs with unique decision ID and timestamp', () => {
      const res = opa.evaluate({
        subject: { id: 'p-1', role: 'PLAYER' },
        action: 'submit_code',
        resource: { type: 'battle', id: 'b-100' },
      });

      const auditLog = opa.getAuditLogByDecisionId(res.decisionId);
      expect(auditLog).toBeDefined();
      expect(auditLog?.subjectId).toBe('p-1');
      expect(auditLog?.allowed).toBe(true);
      expect(auditLog?.action).toBe('submit_code');
      expect(auditLog?.timestamp).toBeDefined();
    });
  });
});
