import React, { useState, useMemo } from 'react';
import { Search, X, Filter, Calendar, User, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import debounce from 'lodash/debounce';

/**
 * Customer Filters Component
 */
export const CustomerFilters = ({ onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    registeredFrom: '',
    registeredTo: '',
    birthdayMonth: '',
    minOrders: '',
    maxOrders: '',
    minSpent: '',
    maxSpent: ''
  });

  const debouncedSearch = useMemo(
    () => debounce((term, currentFilters) => {
      onFilterChange({ search: term, ...currentFilters });
    }, 300),
    [onFilterChange]
  );

  React.useEffect(() => {
    debouncedSearch(searchTerm, filters);
  }, [searchTerm, filters, debouncedSearch]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({
      registeredFrom: '',
      registeredTo: '',
      birthdayMonth: '',
      minOrders: '',
      maxOrders: '',
      minSpent: '',
      maxSpent: ''
    });
    setSearchTerm('');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0" style={{ backgroundColor: '#e92587' }}>
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Customer Filters</h3>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>Clear all</Button>
                )}
              </div>

              {/* Registration Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Registration Date
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={filters.registeredFrom}
                    onChange={(e) => handleFilterChange('registeredFrom', e.target.value)}
                  />
                  <Input
                    type="date"
                    value={filters.registeredTo}
                    onChange={(e) => handleFilterChange('registeredTo', e.target.value)}
                  />
                </div>
              </div>

              {/* Birthday Month */}
              <div className="space-y-2">
                <Label>Birthday Month</Label>
                <select
                  className="w-full border rounded p-2"
                  value={filters.birthdayMonth}
                  onChange={(e) => handleFilterChange('birthdayMonth', e.target.value)}
                >
                  <option value="">All months</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              {/* Order Count Range */}
              <div className="space-y-2">
                <Label>Total Orders</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minOrders}
                    onChange={(e) => handleFilterChange('minOrders', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxOrders}
                    onChange={(e) => handleFilterChange('maxOrders', e.target.value)}
                  />
                </div>
              </div>

              {/* Total Spent Range */}
              <div className="space-y-2">
                <Label>Total Spent</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="₹ Min"
                    value={filters.minSpent}
                    onChange={(e) => handleFilterChange('minSpent', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="₹ Max"
                    value={filters.maxSpent}
                    onChange={(e) => handleFilterChange('maxSpent', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters */}
      {(activeFiltersCount > 0 || searchTerm) && (
        <div className="flex flex-wrap gap-2">
          {searchTerm && (
            <Badge variant="secondary">
              Search: {searchTerm.substring(0, 20)}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSearchTerm('')} />
            </Badge>
          )}
          {Object.entries(filters).map(([key, value]) => value && (
            <Badge key={key} variant="secondary">
              {key}: {value}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFilterChange(key, '')} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerFilters;
