export const PATH_PERMS = {
  '/dashboard': 'page_dashboard',
  '/new-order': 'page_new_order',
  '/hold-orders': 'page_hold_orders',
  '/pending-orders': 'page_pending_orders',
  '/credit-orders': 'page_credit_orders',
  '/complementary-orders': 'page_complementary_orders',
  '/manage-orders': 'page_manage_orders',
  '/deleted-orders': 'page_deleted_orders',
  '/payments': 'page_payments',
  '/customers': 'page_customers',
  '/reports': 'page_reports',
  '/incentive-report': 'page_incentive_report',
  '/delivery-report': 'page_delivery_report',
  '/analytics-chat': 'page_analytics_chat',
  '/cake-image-report': 'page_cake_image_report',
  '/kitchen': 'page_kitchen',
  '/factory': 'page_factory',
  '/delivery': 'page_delivery',
  '/outlets': 'page_outlets',
  '/users': 'page_users',
  '/sales-persons': 'page_sales_persons',
  '/zones': 'page_zones',
  '/permissions': 'page_permissions',
  '/petpooja-sync': 'page_petpooja_sync',
  '/petpooja-settings': 'page_petpooja_settings',
  '/aisensy-settings': 'page_whatsapp_settings',
  '/msg91-settings': 'page_whatsapp_settings',
  '/navigate': 'page_navigate',
  '/changes-log': 'page_changes_log',
  '/activity-logs': 'page_activity_logs',
  '/settings': 'page_settings',
};

const ORDER_PAGES = ['page_dashboard', 'page_new_order', 'page_hold_orders', 'page_pending_orders',
  'page_credit_orders', 'page_complementary_orders', 'page_manage_orders', 'page_deleted_orders',
  'page_payments', 'page_customers', 'page_reports'];

// Mirrors backend ROLE_DEFAULT_PAGES; used when a user has no page_* rights saved yet.
const ROLE_DEFAULT_PAGES = {
  outlet_admin: [...ORDER_PAGES, 'page_cake_image_report', 'page_delivery_report'],
  order_manager: ORDER_PAGES,
  factory_manager: ['page_factory', 'page_kitchen', 'page_new_order', 'page_reports'],
  kitchen: ['page_kitchen', 'page_reports'],
  delivery: ['page_delivery'],
  accounts: ['page_payments', 'page_reports'],
};

const effectivePerms = (user) => {
  const perms = user.permissions || [];
  return perms.some(p => p.startsWith('page_')) ? perms : [...perms, ...(ROLE_DEFAULT_PAGES[user.role] || ORDER_PAGES)];
};

export const hasPerm = (user, perm) =>
  !!user && (user.role === 'super_admin' || !perm || effectivePerms(user).includes(perm));

export const canAccessPath = (user, path) => hasPerm(user, PATH_PERMS[path.split('?')[0]]);

const LANDING_ORDER = ['/dashboard', '/kitchen', '/factory', '/delivery', '/new-order', '/manage-orders', '/reports'];

export const firstAllowedPath = (user) => {
  const ordered = [...LANDING_ORDER, ...Object.keys(PATH_PERMS)];
  return ordered.find(p => canAccessPath(user, p)) || '/no-access';
};
