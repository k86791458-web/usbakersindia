import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Skeleton Loader Components
 * Use instead of "Loading..." text
 */

export const TableSkeleton = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-12 bg-gray-100 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton = () => {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-4/6" />
      </CardContent>
    </Card>
  );
};

export const OrderCardSkeleton = () => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-100 rounded w-48" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
        
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
        
        <div className="mt-4 flex gap-2">
          <div className="h-10 bg-gray-200 rounded flex-1" />
          <div className="h-10 bg-gray-200 rounded flex-1" />
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-8 bg-gray-300 rounded w-20" />
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const FormSkeleton = () => {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-10 bg-gray-100 rounded w-full animate-pulse" />
        </div>
      ))}
      <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
    </div>
  );
};

export const ListSkeleton = ({ items = 8 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
          <div className="h-12 w-12 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
      ))}
    </div>
  );
};

export const ImageSkeleton = ({ width = 'w-full', height = 'h-64' }) => {
  return (
    <div className={`${width} ${height} bg-gray-200 rounded animate-pulse flex items-center justify-center`}>
      <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    </div>
  );
};
