import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard, ShoppingCart, Clock, Store, Users, MapPin, Settings, LogOut,
  Menu, X, MessageSquare, List, Receipt, Truck, CreditCard, RefreshCw, Navigation,
  TrendingUp, Webhook, Wallet, ImageIcon, Factory, Trash2, FileText, Activity,
  ChevronDown, ChevronRight, Package, BarChart3, ShieldCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLogoutConfirm } from './ConfirmDialog';

const STORAGE_KEY = 'usb_sidebar_open_groups';

const Sidebar = ({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed;
  const setCollapsed = setCollapsedProp || setInternalCollapsed;

  const { showConfirm, LogoutConfirmDialog } = useLogoutConfirm(logout);

  const isSuperAdmin = user?.role === 'super_admin';
  const role = user?.role;

  const isActive = (path) => location.pathname === path;

  // -------------------- Menu structure --------------------
  // Each entry is either:
  //   { type: 'item', path, label, icon, testId }
  //   { type: 'group', key, label, icon, testId, items: [ {path,label,icon,testId}, ... ] }
  const buildMenu = () => {
    if (isSuperAdmin) {
      return [
        { type: 'item', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
        {
          type: 'group', key: 'orders', label: 'Orders', icon: ShoppingCart, testId: 'nav-group-orders',
          items: [
            { path: '/new-order', label: 'New Order', icon: ShoppingCart, testId: 'nav-new-order' },
            { path: '/hold-orders', label: 'Hold Orders', icon: Clock, testId: 'nav-hold-orders' },
            { path: '/pending-orders', label: 'Pending Orders', icon: Clock, testId: 'nav-pending-orders' },
            { path: '/credit-orders', label: 'Credit Orders', icon: CreditCard, testId: 'nav-credit-orders' },
            { path: '/manage-orders', label: 'Manage Orders', icon: List, testId: 'nav-manage-orders' },
            { path: '/deleted-orders', label: 'Deleted Orders', icon: Trash2, testId: 'nav-deleted-orders' },
          ]
        },
        {
          type: 'group', key: 'payments', label: 'Payments', icon: Wallet, testId: 'nav-group-payments',
          items: [
            { path: '/payments', label: 'All Payments', icon: Wallet, testId: 'nav-payments' },
            { path: '/payments?tab=pending', label: 'Pending Payments', icon: Clock, testId: 'nav-pending-payments' },
          ]
        },
        { type: 'item', path: '/customers', label: 'Customers', icon: Users, testId: 'nav-customers' },
        {
          type: 'group', key: 'reports', label: 'Reports', icon: BarChart3, testId: 'nav-group-reports',
          items: [
            { path: '/reports', label: 'All Reports', icon: Receipt, testId: 'nav-reports' },
            { path: '/incentive-report', label: 'Incentive Report', icon: TrendingUp, testId: 'nav-incentive' },
            { path: '/cake-image-report', label: 'Cake Image Report', icon: ImageIcon, testId: 'nav-cake-report' },
          ]
        },
        {
          type: 'group', key: 'management', label: 'Management', icon: Package, testId: 'nav-group-management',
          items: [
            { path: '/outlets', label: 'Outlets', icon: Store, testId: 'nav-outlets' },
            { path: '/users', label: 'Users', icon: Users, testId: 'nav-users' },
            { path: '/sales-persons', label: 'Sales Persons', icon: Users, testId: 'nav-sales-persons' },
            { path: '/zones', label: 'Zones', icon: MapPin, testId: 'nav-zones' },
            { path: '/permissions', label: 'Permissions', icon: ShieldCheck, testId: 'nav-permissions' },
          ]
        },
        {
          type: 'group', key: 'integrations', label: 'Integrations', icon: Webhook, testId: 'nav-group-integrations',
          items: [
            { path: '/petpooja-sync', label: 'PetPooja Sync', icon: RefreshCw, testId: 'nav-petpooja-sync' },
            { path: '/petpooja-settings', label: 'PetPooja Settings', icon: Webhook, testId: 'nav-petpooja-settings' },
            { path: '/aisensy-settings', label: 'AiSensy WhatsApp', icon: MessageSquare, testId: 'nav-aisensy-settings' },
            { path: '/navigate', label: 'Navigate', icon: Navigation, testId: 'nav-navigate' },
          ]
        },
        {
          type: 'group', key: 'system', label: 'System', icon: Settings, testId: 'nav-group-system',
          items: [
            { path: '/changes-log', label: 'Changes Log', icon: FileText, testId: 'nav-changes-log' },
            { path: '/activity-logs', label: 'Activity Logs', icon: Activity, testId: 'nav-activity-logs' },
            { path: '/settings', label: 'Settings', icon: Settings, testId: 'nav-settings' },
          ]
        },
      ];
    }

    if (role === 'kitchen') {
      return [
        { type: 'item', path: '/kitchen', label: 'Kitchen Orders', icon: ShoppingCart, testId: 'nav-kitchen' },
        { type: 'item', path: '/reports', label: 'Reports', icon: Receipt, testId: 'nav-reports' },
      ];
    }
    if (role === 'delivery') {
      return [
        { type: 'item', path: '/delivery', label: 'Delivery Orders', icon: Truck, testId: 'nav-delivery' },
      ];
    }
    if (role === 'factory_manager') {
      return [
        { type: 'item', path: '/factory', label: 'Factory Dashboard', icon: Factory, testId: 'nav-factory' },
        { type: 'item', path: '/kitchen', label: 'Kitchen View', icon: ShoppingCart, testId: 'nav-kitchen' },
        {
          type: 'group', key: 'orders', label: 'Orders', icon: ShoppingCart, testId: 'nav-group-orders',
          items: [
            { path: '/new-order', label: 'New Order', icon: ShoppingCart, testId: 'nav-new-order' },
          ]
        },
        { type: 'item', path: '/reports', label: 'Reports', icon: Receipt, testId: 'nav-reports' },
      ];
    }

    // Outlet Admin / others
    return [
      { type: 'item', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
      {
        type: 'group', key: 'orders', label: 'Orders', icon: ShoppingCart, testId: 'nav-group-orders',
        items: [
          { path: '/new-order', label: 'New Order', icon: ShoppingCart, testId: 'nav-new-order' },
          { path: '/hold-orders', label: 'Hold Orders', icon: Clock, testId: 'nav-hold-orders' },
          { path: '/pending-orders', label: 'Pending Orders', icon: Clock, testId: 'nav-pending-orders' },
          { path: '/credit-orders', label: 'Credit Orders', icon: CreditCard, testId: 'nav-credit-orders' },
          { path: '/manage-orders', label: 'Manage Orders', icon: List, testId: 'nav-manage-orders' },
          { path: '/deleted-orders', label: 'Deleted Orders', icon: Trash2, testId: 'nav-deleted-orders' },
        ]
      },
      {
        type: 'group', key: 'payments', label: 'Payments', icon: Wallet, testId: 'nav-group-payments',
        items: [
          { path: '/payments', label: 'All Payments', icon: Wallet, testId: 'nav-payments' },
          { path: '/payments?tab=pending', label: 'Pending Payments', icon: Clock, testId: 'nav-pending-payments' },
        ]
      },
      { type: 'item', path: '/customers', label: 'Customers', icon: Users, testId: 'nav-customers' },
      { type: 'item', path: '/reports', label: 'Reports', icon: Receipt, testId: 'nav-reports' },
    ];
  };

  const menu = buildMenu();

  // Determine which group contains current path so we can open it by default
  const findGroupForPath = (path) => {
    for (const node of menu) {
      if (node.type === 'group' && node.items.some(i => i.path.split('?')[0] === path)) {
        return node.key;
      }
    }
    return null;
  };

  // Restore open groups from localStorage; always include the group of the current route
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const grp = findGroupForPath(location.pathname);
    if (grp && !openGroups[grp]) {
      const next = { ...openGroups, [grp]: true };
      setOpenGroups(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (key) => {
    const next = { ...openGroups, [key]: !openGroups[key] };
    setOpenGroups(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const renderItem = (item, indented = false) => {
    const Icon = item.icon;
    const path = item.path.split('?')[0];
    const search = item.path.includes('?') ? item.path.split('?')[1] : '';
    const active = location.pathname === path && (
      !search || (search && location.search.includes(search))
    );
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
          active ? 'bg-pink-50 text-[#e92587]' : 'text-gray-700 hover:bg-gray-100'
        } ${indented && !collapsed ? 'pl-9' : ''}`}
        data-testid={item.testId}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
      </button>
    );
  };

  const renderGroup = (group) => {
    const Icon = group.icon;
    const isOpen = !!openGroups[group.key];
    // group considered "active" if any sub-item path matches current
    const groupActive = group.items.some(i => i.path.split('?')[0] === location.pathname);

    // When collapsed (icon-only mode), render group header alone (click = expand sidebar);
    // sub-items are reachable after expanding.
    if (collapsed) {
      return (
        <button
          key={group.key}
          onClick={() => setCollapsed(false)}
          className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${
            groupActive ? 'bg-pink-50 text-[#e92587]' : 'text-gray-700 hover:bg-gray-100'
          }`}
          data-testid={group.testId}
          title={group.label}
        >
          <Icon className="h-5 w-5" />
        </button>
      );
    }

    return (
      <div key={group.key} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.key)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
            groupActive ? 'bg-pink-50/60 text-[#e92587]' : 'text-gray-700 hover:bg-gray-100'
          }`}
          data-testid={group.testId}
          aria-expanded={isOpen}
        >
          <span className="flex items-center space-x-3 min-w-0">
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-semibold truncate">{group.label}</span>
          </span>
          {isOpen
            ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        </button>
        {isOpen && (
          <div className="space-y-1">
            {group.items.map(it => renderItem(it, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <LogoutConfirmDialog />
      <div
        className={`fixed left-0 top-0 h-screen flex flex-col bg-white border-r shadow-sm transition-all duration-300 z-50 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <img src="/us-bakers-logo.jpg" alt="US Bakers" className="h-10 w-10 object-contain" />
              <div>
                <h1 className="text-sm font-bold" style={{ color: '#e92587' }}>US Bakers</h1>
                <p className="text-xs text-gray-500">Bakery CRM</p>
              </div>
            </div>
          )}
          {collapsed && (
            <img src="/us-bakers-logo.jpg" alt="US Bakers" className="h-8 w-8 object-contain" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {menu.map(node => node.type === 'item' ? renderItem(node) : renderGroup(node))}
          </nav>
        </ScrollArea>

        {/* User Info & Logout */}
        <div className="border-t p-4">
          {!collapsed ? (
            <div>
              <div className="mb-3">
                <p className="text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                onClick={showConfirm}
                className="w-full"
                size="sm"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <button
              onClick={showConfirm}
              className="w-full flex justify-center p-2 hover:bg-gray-100 rounded"
              data-testid="logout-button"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}
    </>
  );
};

export default Sidebar;
