/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { Search, Filter, X, FileText, CheckSquare, AlertTriangle, Activity } from 'lucide-react';
import { mockCirculars, mockTasks, mockPenalties, mockAuditLogs } from '../../data/mockData';
import { Circular, Task, Penalty, AuditLog } from '../../types';

interface SearchResult {
  type: 'circular' | 'task' | 'penalty' | 'audit';
  item: Circular | Task | Penalty | AuditLog;
  score: number;
}

interface SearchFilters {
  types: string[];
  status: string[];
  priority: string[];
  dateRange: string;
}

const SearchTool: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    status: [],
    priority: [],
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Search function with scoring
  const searchItems = (searchQuery: string, items: any[], type: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const query_lower = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    items.forEach(item => {
      let score = 0;
      const searchableFields = [];

      // Define searchable fields based on type
      if (type === 'circular') {
        searchableFields.push(
          { field: item.title, weight: 3 },
          { field: item.description, weight: 2 },
          { field: item.category, weight: 2 },
          { field: item.status, weight: 1 }
        );
      } else if (type === 'task') {
        searchableFields.push(
          { field: item.title, weight: 3 },
          { field: item.description, weight: 2 },
          { field: item.status, weight: 1 },
          { field: item.priority, weight: 1 },
          { field: item.type, weight: 1 }
        );
      } else if (type === 'penalty') {
        searchableFields.push(
          { field: item.remarks, weight: 3 },
          { field: item.status, weight: 2 },
          { field: item.amount?.toString(), weight: 1 }
        );
      } else if (type === 'audit') {
        searchableFields.push(
          { field: item.action, weight: 3 },
          { field: item.details, weight: 2 },
          { field: item.entity_type, weight: 1 }
        );
      }

      // Calculate score
      searchableFields.forEach(({ field, weight }) => {
        if (field && field.toLowerCase().includes(query_lower)) {
          if (field.toLowerCase().startsWith(query_lower)) {
            score += weight * 2; // Boost for prefix matches
          } else {
            score += weight;
          }
        }
      });

      if (score > 0) {
        results.push({
          type: type as 'circular' | 'task' | 'penalty' | 'audit',
          item,
          score
        });
      }
    });

    return results;
  };

  // Combined search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const allResults: SearchResult[] = [
      ...searchItems(query, mockCirculars, 'circular'),
      ...searchItems(query, mockTasks, 'task'),
      ...searchItems(query, mockPenalties, 'penalty'),
      ...searchItems(query, mockAuditLogs, 'audit')
    ];

    // Apply filters
    let filteredResults = allResults;

    if (filters.types.length > 0) {
      filteredResults = filteredResults.filter(result => filters.types.includes(result.type));
    }

    if (filters.status.length > 0) {
      filteredResults = filteredResults.filter(result => {
        const status = (result.item as any).status;
        return status && filters.status.includes(status);
      });
    }

    if (filters.priority.length > 0) {
      filteredResults = filteredResults.filter(result => {
        const priority = (result.item as any).priority;
        return priority && filters.priority.includes(priority);
      });
    }

    // Sort by score (descending)
    return filteredResults.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [query, filters]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'circular': return <FileText className="w-4 h-4" />;
      case 'task': return <CheckSquare className="w-4 h-4" />;
      case 'penalty': return <AlertTriangle className="w-4 h-4" />;
      case 'audit': return <Activity className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'circular': return 'bg-blue-100 text-blue-800';
      case 'task': return 'bg-green-100 text-green-800';
      case 'penalty': return 'bg-red-100 text-red-800';
      case 'audit': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatResultTitle = (result: SearchResult) => {
    const item = result.item as any;
    switch (result.type) {
      case 'circular':
        return item.title;
      case 'task':
        return item.title;
      case 'penalty':
        return `Penalty: ${item.remarks}`;
      case 'audit':
        return `${item.action} - ${item.entity_type}`;
      default:
        return 'Unknown';
    }
  };

  const formatResultDescription = (result: SearchResult) => {
    const item = result.item as any;
    switch (result.type) {
      case 'circular':
        return item.description;
      case 'task':
        return `${item.description} • Due: ${item.due_date}`;
      case 'penalty':
        return `Amount: ₹${item.amount?.toLocaleString()} • Status: ${item.status}`;
      case 'audit':
        return `${item.details} • ${new Date(item.timestamp).toLocaleDateString()}`;
      default:
        return '';
    }
  };

  const toggleFilter = (filterType: keyof SearchFilters, value: string) => {
    setFilters(prev => {
      const currentValues = prev[filterType] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return { ...prev, [filterType]: newValues };
    });
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search circulars, tasks, penalties, audit logs..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-96"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-12 left-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Filters</h3>
            <button onClick={() => setShowFilters(false)}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {['circular', 'task', 'penalty', 'audit'].map(type => (
                  <button
                    key={type}
                    onClick={() => toggleFilter('types', type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filters.types.includes(type)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {['Active', 'Pending', 'Completed', 'In Progress', 'Paid', 'Draft'].map(status => (
                  <button
                    key={status}
                    onClick={() => toggleFilter('status', status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filters.status.includes(status)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex flex-wrap gap-2">
                {['Low', 'Medium', 'High', 'Critical'].map(priority => (
                  <button
                    key={priority}
                    onClick={() => toggleFilter('priority', priority)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filters.priority.includes(priority)
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setFilters({ types: [], status: [], priority: [], dateRange: 'all' })}
              className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {isOpen && query.trim() && (
        <div className="absolute top-12 left-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-xs font-medium text-gray-500">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${(result.item as any).id}-${index}`}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-1 rounded ${getTypeColor(result.type)}`}>
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {formatResultTitle(result)}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(result.type)}`}>
                          {result.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {formatResultDescription(result)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default SearchTool;
