import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Filter, Calendar, DollarSign, MapPin, User, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import debounce from 'lodash/debounce';

/**
 * Order Filters Component
 * Advanced filtering for order management pages
 */
export const OrderFilters = ({ 
  onFilterChange, 
  outlets = [], 
  showOutletFilter = true,
  showStatusFilter = true,
  showPaymentFilter = true,
  defaultFilters = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    deliveryDateFrom: defaultFilters.deliveryDateFrom || '',
    deliveryDateTo: defaultFilters.deliveryDateTo || '',
    createdDateFrom: defaultFilters.createdDateFrom || '',
    createdDateTo: defaultFilters.createdDateTo || '',
    status: defaultFilters.status || '',
    outlet: defaultFilters.outlet || '',
    paymentStatus: defaultFilters.paymentStatus || '',
    flavour: defaultFilters.flavour || '',
    minAmount: defaultFilters.minAmount || '',
    maxAmount: defaultFilters.maxAmount || '',
    ...defaultFilters
  });

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((term, currentFilters) => {
      onFilterChange({ search: term, ...currentFilters });
    }, 300),
    [onFilterChange]
  );

  useEffect(() => {
    debouncedSearch(searchTerm, filters);
  }, [searchTerm, filters, debouncedSearch]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      deliveryDateFrom: '',
      deliveryDateTo: '',
      createdDateFrom: '',
      createdDateTo: '',
      status: '',
      outlet: '',
      paymentStatus: '',
      flavour: '',
      minAmount: '',
      maxAmount: ''
    };
    setFilters(emptyFilters);
    setSearchTerm('');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by order number, customer name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Advanced Filters Button */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge 
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                  style={{ backgroundColor: '#e92587' }}
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px]" align="end">
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between sticky top-0 bg-white pb-2 border-b">
                <h3 className="font-semibold text-lg">Advanced Filters</h3>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              {/* Delivery Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4" />
                  Delivery Date Range
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">From</Label>
                    <Input
                      type="date"
                      value={filters.deliveryDateFrom}
                      onChange={(e) => handleFilterChange('deliveryDateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">To</Label>
                    <Input
                      type="date"
                      value={filters.deliveryDateTo}
                      onChange={(e) => handleFilterChange('deliveryDateTo', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Created Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4" />
                  Created Date Range
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">From</Label>
                    <Input
                      type="date"
                      value={filters.createdDateFrom}
                      onChange={(e) => handleFilterChange('createdDateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">To</Label>
                    <Input
                      type="date"
                      value={filters.createdDateTo}
                      onChange={(e) => handleFilterChange('createdDateTo', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              {showStatusFilter && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <Tag className="h-4 w-4" />
                    Order Status
                  </Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="ready_to_deliver">Ready to Deliver</SelectItem>
                      <SelectItem value="picked_up">Picked Up</SelectItem>
                      <SelectItem value="reached">Reached</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Outlet Filter */}
              {showOutletFilter && outlets.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    Outlet
                  </Label>
                  <Select value={filters.outlet} onValueChange={(value) => handleFilterChange('outlet', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All outlets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All outlets</SelectItem>
                      {outlets.map(outlet => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Payment Status */}
              {showPaymentFilter && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4" />
                    Payment Status
                  </Label>
                  <Select value={filters.paymentStatus} onValueChange={(value) => handleFilterChange('paymentStatus', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All payment statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All payment statuses</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partially Paid</SelectItem>
                      <SelectItem value="paid">Fully Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Flavour Filter */}
              <div className="space-y-2">
                <Label className="font-medium">Cake Flavour</Label>
                <Input
                  placeholder="e.g., Chocolate, Vanilla..."
                  value={filters.flavour}
                  onChange={(e) => handleFilterChange('flavour', e.target.value)}
                />
              </div>

              {/* Amount Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <DollarSign className="h-4 w-4" />
                  Order Amount
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">Min Amount</Label>
                    <Input
                      type="number"
                      placeholder="₹ 0"
                      value={filters.minAmount}
                      onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Max Amount</Label>
                    <Input
                      type="number"
                      placeholder="₹ 99999"
                      value={filters.maxAmount}
                      onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {(activeFiltersCount > 0 || searchTerm) && (
        <div className="flex flex-wrap gap-2">
          {searchTerm && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              Search: {searchTerm.substring(0, 20)}...
              <button onClick={clearSearch} className="ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.deliveryDateFrom && (
            <Badge variant="secondary">
              Delivery From: {filters.deliveryDateFrom}
              <button onClick={() => handleFilterChange('deliveryDateFrom', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.deliveryDateTo && (
            <Badge variant="secondary">
              Delivery To: {filters.deliveryDateTo}
              <button onClick={() => handleFilterChange('deliveryDateTo', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary">
              Status: {filters.status}
              <button onClick={() => handleFilterChange('status', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.outlet && (
            <Badge variant="secondary">
              Outlet: {outlets.find(o => o.id === filters.outlet)?.name || filters.outlet}
              <button onClick={() => handleFilterChange('outlet', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.paymentStatus && (
            <Badge variant="secondary">
              Payment: {filters.paymentStatus}
              <button onClick={() => handleFilterChange('paymentStatus', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.flavour && (
            <Badge variant="secondary">
              Flavour: {filters.flavour}
              <button onClick={() => handleFilterChange('flavour', '')} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.minAmount || filters.maxAmount) && (
            <Badge variant="secondary">
              Amount: ₹{filters.minAmount || '0'} - ₹{filters.maxAmount || '∞'}
              <button onClick={() => {
                handleFilterChange('minAmount', '');
                handleFilterChange('maxAmount', '');
              }} className="ml-2">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Quick Date Filters
 */
export const QuickDateFilters = ({ onFilterSelect }) => {
  const getDateRange = (filter) => {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    
    switch(filter) {
      case 'today':
        return { from: startOfToday.toISOString().split('T')[0], to: startOfToday.toISOString().split('T')[0] };
      case 'tomorrow':
        const tomorrow = new Date(startOfToday);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { from: tomorrow.toISOString().split('T')[0], to: tomorrow.toISOString().split('T')[0] };
      case 'week':
        const weekEnd = new Date(startOfToday);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return { from: startOfToday.toISOString().split('T')[0], to: weekEnd.toISOString().split('T')[0] };
      case 'month':
        const monthEnd = new Date(startOfToday);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        return { from: startOfToday.toISOString().split('T')[0], to: monthEnd.toISOString().split('T')[0] };
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterSelect(getDateRange('today'))}
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterSelect(getDateRange('tomorrow'))}
      >
        Tomorrow
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterSelect(getDateRange('week'))}
      >
        This Week
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterSelect(getDateRange('month'))}
      >
        This Month
      </Button>
    </div>
  );
};

export default OrderFilters;
