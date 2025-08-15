import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, MapPin, Truck, X } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { getStoredDeliveries } from '../../utils/storage';
import { getTruckColor, getContrastTextColor } from '../../utils/truckTypes';

interface SearchBarProps {
  onViewDelivery?: (delivery: Delivery) => void;
  refreshTrigger: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onViewDelivery, refreshTrigger }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Delivery[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all deliveries when component mounts or refreshTrigger changes
  useEffect(() => {
    const loadDeliveries = async () => {
      const deliveriesData = await getStoredDeliveries();
      setAllDeliveries(deliveriesData);
    };
    loadDeliveries();
  }, [refreshTrigger]);

  // Handle search functionality
  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    
    if (trimmedTerm.length === 0) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    // Start searching after 1 character
    if (trimmedTerm.length < 1) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    const term = trimmedTerm.toLowerCase();
    console.log('🔍 Searching for:', `"${term}"`);
    console.log('📋 Total deliveries to search:', allDeliveries.length);
    
    // Log all deliveries for debugging
    console.log('📋 All deliveries:', allDeliveries.map(d => ({
      id: d.id,
      clientName: d.clientName,
      invoiceNumber: d.invoiceNumber,
      entryType: d.entryType
    })));
    
    const filtered = allDeliveries.filter(delivery => {
      // Skip internal events and equipment maintenance for regular users
      if (delivery.entryType === 'internal' || delivery.entryType === 'equipmentMaintenance') {
        console.log(`⏭️ Skipping ${delivery.entryType} entry:`, delivery.id);
        return false;
      }
      
      let clientMatch = false;
      let invoiceMatch = false;
      
      // Search in client name
      try {
        const clientName = delivery.clientName || '';
        if (typeof clientName === 'string' && clientName.length > 0) {
          clientMatch = clientName.toLowerCase().includes(term);
          console.log(`👤 Client "${clientName}" matches "${term}":`, clientMatch);
        }
      } catch (error) {
        console.warn('Error processing client name:', delivery.clientName, error);
      }
      
      // Search in invoice number
      try {
        if (delivery.invoiceNumber != null && delivery.invoiceNumber !== '') {
          // Convert to string safely
          let invoiceStr = '';
          if (typeof delivery.invoiceNumber === 'string') {
            invoiceStr = delivery.invoiceNumber;
          } else if (typeof delivery.invoiceNumber === 'number') {
            invoiceStr = delivery.invoiceNumber.toString();
          } else {
            invoiceStr = String(delivery.invoiceNumber);
          }
          
          invoiceMatch = invoiceStr.toLowerCase().includes(term);
          console.log(`📄 Invoice "${invoiceStr}" matches "${term}":`, invoiceMatch);
        }
      } catch (error) {
        console.warn('Error processing invoice number:', delivery.invoiceNumber, error);
      }
      
      const isMatch = clientMatch || invoiceMatch;
      
      console.log(`🔍 Delivery ${delivery.id} final match:`, isMatch, {
        clientName: delivery.clientName,
        invoiceNumber: delivery.invoiceNumber,
        clientMatch,
        invoiceMatch
      });
      
      return isMatch;
    });
    
    console.log(`✅ Search results: ${filtered.length} deliveries found`);
    console.log('📋 Found deliveries:', filtered.map(d => ({
      id: d.id,
      client: d.clientName,
      invoice: d.invoiceNumber
    })));

    // Sort results by date (most recent first) and limit to 50 results for performance
    const sortedResults = filtered
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 50);

    setSearchResults(sortedResults);
    setIsOpen(sortedResults.length > 0);
  }, [searchTerm, allDeliveries]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleResultClick = (delivery: Delivery) => {
    setIsOpen(false);
    setSearchTerm('');
    if (onViewDelivery) {
      onViewDelivery(delivery);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search deliveries by client or invoice..."
          className="w-full sm:w-80 pl-10 pr-10 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] max-h-96 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-600 font-medium">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </span>
          </div>
          
          {searchResults.map((delivery) => {
            const truckColor = getTruckColor(delivery.originStore, delivery.truckType);
            const textColor = getContrastTextColor(truckColor);
            
            return (
              <div
                key={delivery.id}
                onClick={() => handleResultClick(delivery)}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {delivery.clientName}
                      </h4>
                      <span className="text-sm text-gray-500">
                        #{delivery.invoiceNumber}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(delivery.scheduledDate)}</span>
                        <span>at {formatTime(delivery.scheduledTime)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{delivery.originStore}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 truncate">
                      {delivery.materialDescription}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 ml-3">
                    <div 
                      className="px-2 py-1 rounded text-xs font-medium flex items-center space-x-1"
                      style={{ 
                        backgroundColor: truckColor,
                        color: textColor
                      }}
                    >
                      <Truck className="w-3 h-3" />
                      <span>{delivery.truckType}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {searchResults.length === 50 && (
            <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
              Showing first 50 results. Refine search for more specific results.
            </div>
          )}
        </div>
      )}

      {/* No Results Message */}
      {isOpen && searchResults.length === 0 && searchTerm.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] p-4 text-center">
          <div className="text-gray-500 text-sm">
            No deliveries found for "{searchTerm}"
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Try searching by client name or invoice number
          </div>
        </div>
      )}
    </div>
  );
};