/**
 * Filter Utility Functions
 * Helper functions to apply filters on data arrays
 */

/**
 * Apply order filters to orders array
 */
export const applyOrderFilters = (orders, filters) => {
  let filtered = [...orders];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(order =>
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.customer_info?.name?.toLowerCase().includes(searchLower) ||
      order.customer_info?.phone?.includes(searchLower) ||
      order.receiver_info?.name?.toLowerCase().includes(searchLower) ||
      order.receiver_info?.phone?.includes(searchLower)
    );
  }

  // Delivery date range
  if (filters.deliveryDateFrom) {
    filtered = filtered.filter(order => order.delivery_date >= filters.deliveryDateFrom);
  }
  if (filters.deliveryDateTo) {
    filtered = filtered.filter(order => order.delivery_date <= filters.deliveryDateTo);
  }

  // Created date range
  if (filters.createdDateFrom) {
    filtered = filtered.filter(order => {
      const createdDate = new Date(order.created_at).toISOString().split('T')[0];
      return createdDate >= filters.createdDateFrom;
    });
  }
  if (filters.createdDateTo) {
    filtered = filtered.filter(order => {
      const createdDate = new Date(order.created_at).toISOString().split('T')[0];
      return createdDate <= filters.createdDateTo;
    });
  }

  // Status filter
  if (filters.status) {
    filtered = filtered.filter(order => order.status === filters.status);
  }

  // Outlet filter
  if (filters.outlet) {
    filtered = filtered.filter(order => order.outlet_id === filters.outlet);
  }

  // Payment status filter
  if (filters.paymentStatus) {
    filtered = filtered.filter(order => {
      const paidPercentage = (order.paid_amount / order.total_amount) * 100;
      if (filters.paymentStatus === 'unpaid') return paidPercentage === 0;
      if (filters.paymentStatus === 'partial') return paidPercentage > 0 && paidPercentage < 100;
      if (filters.paymentStatus === 'paid') return paidPercentage >= 100;
      return true;
    });
  }

  // Flavour filter
  if (filters.flavour) {
    filtered = filtered.filter(order => 
      order.flavour?.toLowerCase().includes(filters.flavour.toLowerCase())
    );
  }

  // Amount range
  if (filters.minAmount) {
    filtered = filtered.filter(order => order.total_amount >= parseFloat(filters.minAmount));
  }
  if (filters.maxAmount) {
    filtered = filtered.filter(order => order.total_amount <= parseFloat(filters.maxAmount));
  }

  return filtered;
};

/**
 * Apply customer filters
 */
export const applyCustomerFilters = (customers, filters) => {
  let filtered = [...customers];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(customer =>
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.phone?.includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower)
    );
  }

  // Registration date range
  if (filters.registeredFrom) {
    filtered = filtered.filter(customer => {
      const regDate = new Date(customer.created_at).toISOString().split('T')[0];
      return regDate >= filters.registeredFrom;
    });
  }
  if (filters.registeredTo) {
    filtered = filtered.filter(customer => {
      const regDate = new Date(customer.created_at).toISOString().split('T')[0];
      return regDate <= filters.registeredTo;
    });
  }

  // Birthday month
  if (filters.birthdayMonth) {
    filtered = filtered.filter(customer => {
      if (!customer.birthday) return false;
      const month = customer.birthday.split('-')[1];
      return month === filters.birthdayMonth;
    });
  }

  // Order count range
  if (filters.minOrders) {
    filtered = filtered.filter(customer => (customer.total_orders || 0) >= parseInt(filters.minOrders));
  }
  if (filters.maxOrders) {
    filtered = filtered.filter(customer => (customer.total_orders || 0) <= parseInt(filters.maxOrders));
  }

  // Total spent range
  if (filters.minSpent) {
    filtered = filtered.filter(customer => (customer.total_spent || 0) >= parseFloat(filters.minSpent));
  }
  if (filters.maxSpent) {
    filtered = filtered.filter(customer => (customer.total_spent || 0) <= parseFloat(filters.maxSpent));
  }

  return filtered;
};

/**
 * Apply payment filters
 */
export const applyPaymentFilters = (payments, filters) => {
  let filtered = [...payments];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(payment =>
      payment.order_number?.toLowerCase().includes(searchLower) ||
      payment.customer_name?.toLowerCase().includes(searchLower)
    );
  }

  // Date range
  if (filters.dateFrom) {
    filtered = filtered.filter(payment => {
      const paymentDate = new Date(payment.paid_at).toISOString().split('T')[0];
      return paymentDate >= filters.dateFrom;
    });
  }
  if (filters.dateTo) {
    filtered = filtered.filter(payment => {
      const paymentDate = new Date(payment.paid_at).toISOString().split('T')[0];
      return paymentDate <= filters.dateTo;
    });
  }

  // Payment method
  if (filters.paymentMethod) {
    filtered = filtered.filter(payment => payment.payment_method === filters.paymentMethod);
  }

  // Outlet
  if (filters.outlet) {
    filtered = filtered.filter(payment => payment.outlet_id === filters.outlet);
  }

  // Amount range
  if (filters.minAmount) {
    filtered = filtered.filter(payment => payment.amount >= parseFloat(filters.minAmount));
  }
  if (filters.maxAmount) {
    filtered = filtered.filter(payment => payment.amount <= parseFloat(filters.maxAmount));
  }

  return filtered;
};

/**
 * Apply activity log filters
 */
export const applyActivityLogFilters = (logs, filters) => {
  let filtered = [...logs];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(log =>
      log.description?.toLowerCase().includes(searchLower) ||
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.order_number?.toLowerCase().includes(searchLower)
    );
  }

  // Date range
  if (filters.date_from) {
    filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(filters.date_from));
  }
  if (filters.date_to) {
    filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(filters.date_to + 'T23:59:59'));
  }

  // User filter
  if (filters.user_id) {
    filtered = filtered.filter(log => log.user_id === filters.user_id);
  }

  // Action type
  if (filters.action_type) {
    filtered = filtered.filter(log => log.action_type === filters.action_type);
  }

  // Outlet
  if (filters.outlet_id) {
    filtered = filtered.filter(log => log.outlet_id === filters.outlet_id);
  }

  return filtered;
};

/**
 * Sort data array
 */
export const sortData = (data, sortKey, sortDirection = 'asc') => {
  return [...data].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    // Handle nested keys (e.g., 'customer_info.name')
    if (sortKey.includes('.')) {
      const keys = sortKey.split('.');
      aVal = keys.reduce((obj, key) => obj?.[key], a);
      bVal = keys.reduce((obj, key) => obj?.[key], b);
    }

    // Handle dates
    if (sortKey.includes('date') || sortKey.includes('at')) {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    // Handle numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Handle strings
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }

    // Handle dates
    if (aVal instanceof Date && bVal instanceof Date) {
      return sortDirection === 'asc' 
        ? aVal - bVal 
        : bVal - aVal;
    }

    return 0;
  });
};

/**
 * Get filter summary text
 */
export const getFilterSummary = (filters, type = 'orders') => {
  const parts = [];
  
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  if (filters.deliveryDateFrom || filters.dateFrom) parts.push('Date filtered');
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.outlet) parts.push('Outlet filtered');
  if (filters.paymentStatus) parts.push(`Payment: ${filters.paymentStatus}`);
  
  return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
};
