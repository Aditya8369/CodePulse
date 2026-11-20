package codepulse.rbac

import future.keywords.in
import future.keywords.if

default allow := false

# Role definitions & hierarchy
role_hierarchy := {
    "SUPER_ADMIN": ["SUPER_ADMIN", "ADMIN", "MAINTAINER", "LEAD", "MEMBER", "GUEST"],
    "ADMIN": ["ADMIN", "MAINTAINER", "LEAD", "MEMBER", "GUEST"],
    "MAINTAINER": ["MAINTAINER", "LEAD", "MEMBER", "GUEST"],
    "LEAD": ["LEAD", "MEMBER", "GUEST"],
    "MEMBER": ["MEMBER", "GUEST"],
    "GUEST": ["GUEST"]
}

# Check if user holds required role or higher in tenant
has_role(user_roles, required_role) if {
    some role in user_roles
    required_role in role_hierarchy[role]
}

# Rule 1: Super admins have unconditional tenant-scoped & global access
allow if {
    "SUPER_ADMIN" in input.user.roles
}

# Rule 2: Tenant isolation enforcement
is_valid_tenant if {
    input.user.tenantId == input.resource.tenantId
}
is_valid_tenant if {
    input.resource.tenantId == "global"
}

# Rule 3: IP Whitelist Check (Contextual condition)
ip_is_whitelisted if {
    count(input.context.ipWhitelist) == 0
}
ip_is_whitelisted if {
    input.context.clientIp in input.context.ipWhitelist
}

# Rule 4: Business Hours Restriction (Contextual condition: 00-24 or restricted hour)
is_allowed_time if {
    not input.context.maintenanceWindow
}

# Rule 5: View code during battle (Granular ABAC / contextual condition)
# Only team lead or battle participant can view live editor code during an active battle
allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action == "view_code"
    input.resource.type == "battle_session"
    input.resource.battleState == "in_progress"
    has_role(input.user.roles, "LEAD")
}

allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action == "view_code"
    input.resource.type == "battle_session"
    input.resource.battleState == "in_progress"
    input.user.id in input.resource.participants
}

# Rule 6: Normal challenge submission and test execution
allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action in ["execute_code", "submit_solution"]
    input.resource.type == "challenge"
    has_role(input.user.roles, "MEMBER")
}

# Rule 7: Organization repository management (create, delete, edit)
allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action in ["create_repo", "delete_repo", "modify_settings"]
    input.resource.type == "repository"
    has_role(input.user.roles, "ADMIN")
}

# Rule 8: Read public or team resources
allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action == "read"
    has_role(input.user.roles, "GUEST")
}

# Rule 9: View Audit Logs & Security Traces
allow if {
    is_valid_tenant
    ip_is_whitelisted
    is_allowed_time
    input.action == "view_security_logs"
    input.resource.type == "audit_log"
    has_role(input.user.roles, "ADMIN")
}

# Denial audit diagnostics explanation
deny_reasons[msg] if {
    not is_valid_tenant
    msg := sprintf("Cross-tenant violation: user tenant '%v' cannot access resource tenant '%v'", [input.user.tenantId, input.resource.tenantId])
}

deny_reasons[msg] if {
    not ip_is_whitelisted
    msg := sprintf("IP authorization failure: client IP '%v' is not in allowed tenant CIDR/whitelist", [input.context.clientIp])
}

deny_reasons[msg] if {
    not is_allowed_time
    msg := "Access denied: system is currently undergoing scheduled maintenance"
}

deny_reasons[msg] if {
    input.action == "view_code"
    input.resource.battleState == "in_progress"
    not has_role(input.user.roles, "LEAD")
    not input.user.id in input.resource.participants
    msg := "Contextual ABAC rejection: only team leads or match participants may inspect live code during an active battle"
}

deny_reasons[msg] if {
    not allow
    count(deny_reasons) == 0
    msg := sprintf("RBAC rejection: user '%v' lacks required permissions for action '%v' on '%v'", [input.user.id, input.action, input.resource.type])
}
