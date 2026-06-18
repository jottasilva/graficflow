export const PERMISSION_KEYS = [
  "dashboard:read",
  "orders:read",
  "orders:write",
  "production:read",
  "production:write",
  "clients:read",
  "clients:write",
  "products:read",
  "products:write",
  "inventory:read",
  "inventory:write",
  "machines:read",
  "machines:write",
  "sectors:read",
  "sectors:write",
  "quotes:read",
  "quotes:write",
  "finance:read",
  "finance:write",
  "suppliers:read",
  "suppliers:write",
  "purchases:read",
  "purchases:write",
  "payments:read",
  "payments:write",
  "fiscal:read",
  "fiscal:write",
  "audit:read",
  "reports:read",
  "files:read",
  "files:write",
  "users:read",
  "users:write",
  "settings:read",
  "settings:write",
  "notifications:read",
  "notifications:write",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "dashboard:read": "Dashboard",
  "orders:read": "Pedidos ver",
  "orders:write": "Pedidos editar",
  "production:read": "Producao ver",
  "production:write": "Producao editar",
  "clients:read": "Clientes ver",
  "clients:write": "Clientes editar",
  "products:read": "Produtos ver",
  "products:write": "Produtos editar",
  "inventory:read": "Estoque ver",
  "inventory:write": "Estoque editar",
  "machines:read": "Maquinas ver",
  "machines:write": "Maquinas editar",
  "sectors:read": "Setores ver",
  "sectors:write": "Setores editar",
  "quotes:read": "Orcamentos ver",
  "quotes:write": "Orcamentos editar",
  "finance:read": "Financeiro ver",
  "finance:write": "Financeiro editar",
  "suppliers:read": "Fornecedores ver",
  "suppliers:write": "Fornecedores editar",
  "purchases:read": "Compras ver",
  "purchases:write": "Compras editar",
  "payments:read": "Pagamentos ver",
  "payments:write": "Pagamentos editar",
  "fiscal:read": "Fiscal ver",
  "fiscal:write": "Fiscal editar",
  "audit:read": "Auditoria",
  "reports:read": "Relatorios",
  "files:read": "Arquivos ver",
  "files:write": "Arquivos editar",
  "users:read": "Usuarios ver",
  "users:write": "Usuarios editar",
  "settings:read": "Configuracoes ver",
  "settings:write": "Configuracoes editar",
  "notifications:read": "Notificacoes ver",
  "notifications:write": "Notificacoes editar",
};

export const SYSTEM_PERMISSIONS = ["*"] as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

export type AnyPermission = PermissionKey | SystemPermission;

export const ALL_VALID_PERMISSION_KEYS = [
  ...PERMISSION_KEYS,
  ...SYSTEM_PERMISSIONS,
] as const;

export type AnyPermissionKey = (typeof ALL_VALID_PERMISSION_KEYS)[number];

const ALL_VALID_PERMISSIONS_SET = new Set<string>(ALL_VALID_PERMISSION_KEYS as unknown as string[]);

export function isValidPermission(value: string): value is AnyPermission {
  return ALL_VALID_PERMISSIONS_SET.has(value);
}

export function filterValidPermissions(values: string[]): AnyPermission[] {
  return values.filter((v): v is AnyPermission => isValidPermission(v));
}

export function validateAndLogPermissions(values: string[], context: string): AnyPermission[] {
  const valid = filterValidPermissions(values);
  const invalid = values.filter((v) => !isValidPermission(v));
  if (invalid.length > 0) {
    console.warn(
      `[Permissions] ${invalid.length} permissao(oes) invalida(s) detectada(s) em "${context}":`,
      invalid.map((v) => JSON.stringify(v)).join(", "),
    );
  }
  return valid;
}
