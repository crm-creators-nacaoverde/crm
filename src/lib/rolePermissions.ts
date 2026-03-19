// src/lib/rolePermissions.ts
// ─── Permissões padrão por cargo ─────────────────────────────────────────────
// Ao selecionar um cargo, essas permissões são aplicadas automaticamente.
// O admin pode ajustar individualmente depois na aba Permissões.

export type Permissions = {
  clients:      { view: boolean; edit: boolean; delete: boolean };
  deals:        { view: boolean; edit: boolean; delete: boolean };
  interactions: { view: boolean; edit: boolean; delete: boolean };
  forms:        { view: boolean; edit: boolean; delete: boolean };
  financeiro:   { view: boolean; edit: boolean; delete: boolean };
  logistica:    { view: boolean; edit: boolean; delete: boolean };
  webhooks:     { view: boolean; edit: boolean };
  metrics:      { view: boolean };
  settings:     { view: boolean; edit: boolean };
  users:        { view: boolean; edit: boolean };
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  admin: {
    clients:      { view: true,  edit: true,  delete: true  },
    deals:        { view: true,  edit: true,  delete: true  },
    interactions: { view: true,  edit: true,  delete: true  },
    forms:        { view: true,  edit: true,  delete: true  },
    financeiro:   { view: true,  edit: true,  delete: true  },
    logistica:    { view: true,  edit: true,  delete: true  },
    webhooks:     { view: true,  edit: true                 },
    metrics:      { view: true                               },
    settings:     { view: true,  edit: true                 },
    users:        { view: true,  edit: true                 },
  },
  manager: {
    clients:      { view: true,  edit: true,  delete: true  },
    deals:        { view: true,  edit: true,  delete: true  },
    interactions: { view: true,  edit: true,  delete: true  },
    forms:        { view: true,  edit: true,  delete: false },
    financeiro:   { view: true,  edit: true,  delete: false },
    logistica:    { view: true,  edit: true,  delete: false },
    webhooks:     { view: true,  edit: false               },
    metrics:      { view: true                              },
    settings:     { view: true,  edit: false               },
    users:        { view: true,  edit: false               },
  },
  operator: {
    clients:      { view: true,  edit: true,  delete: false },
    deals:        { view: true,  edit: true,  delete: false },
    interactions: { view: true,  edit: true,  delete: false },
    forms:        { view: true,  edit: false, delete: false },
    financeiro:   { view: true,  edit: true,  delete: false },
    logistica:    { view: true,  edit: true,  delete: false },
    webhooks:     { view: false, edit: false               },
    metrics:      { view: true                              },
    settings:     { view: false, edit: false               },
    users:        { view: false, edit: false               },
  },
  viewer: {
    clients:      { view: true,  edit: false, delete: false },
    deals:        { view: true,  edit: false, delete: false },
    interactions: { view: true,  edit: false, delete: false },
    forms:        { view: false, edit: false, delete: false },
    financeiro:   { view: true,  edit: false, delete: false },
    logistica:    { view: true,  edit: false, delete: false },
    webhooks:     { view: false, edit: false               },
    metrics:      { view: true                              },
    settings:     { view: false, edit: false               },
    users:        { view: false, edit: false               },
  },
};

export const ROLE_LABELS: Record<string, string> = {
  admin:    'Administrador',
  manager:  'Gerente',
  operator: 'Operador',
  viewer:   'Visualizador',
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:    'Acesso total ao sistema, incluindo usuários e configurações da empresa',
  manager:  'Acesso completo a creators, financeiro e logística. Não gerencia usuários nem configs',
  operator: 'Cria e edita registros. Não pode excluir nem acessar configurações',
  viewer:   'Somente visualização. Não pode criar, editar ou excluir nada',
};

export function getDefaultPermissions(role: string): Permissions {
  return ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer;
}
