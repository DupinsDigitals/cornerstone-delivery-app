import React, { useState, useEffect } from 'react';
import { Search, X, Eye, Edit, Trash2, Calendar, MapPin, Phone, Truck, Clock } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { getStoredDeliveries } from '../../utils/storage';
import { getDeliveriesFromFirestore } from '../../services/deliveryService';
import { getTruckColor, getContrastTextColor } from '../../utils/truckTypes';
import { DeliveryViewModal } from './DeliveryViewModal';

interface SearchBarProps {
  onViewDelivery: (delivery: Delivery) => void;
  onEditDelivery: (delivery: Delivery) => void;
  onDeleteDelivery: (deliveryId: string) => void;
  refreshTrigger: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onViewDelivery,
  onEditDelivery,
  onDeleteDelivery,
  refreshTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Delivery[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // Load deliveries when component mounts or refreshTrigger changes
  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        console.log('🔄 Loading deliveries for search...');
        const result = await getDeliveriesFromFirestore();
        if (result.success && result.deliveries) {
          setAllDeliveries(result.deliveries);
          console.log(`✅ Loaded ${result.deliveries.length} deliveries from Firestore`);
          
          // Show sample of first 5 deliveries for debugging
          const sample = result.deliveries.slice(0, 5).map(d => ({
            id: d.id,
            clientName: d.clientName,
            invoiceNumber: d.invoiceNumber
          }));
          console.log('📋 Sample deliveries:', sample);
        } else {
          console.log('⚠️ Firestore failed, trying localStorage...');
          const deliveriesData = await getStoredDeliveries();
          setAllDeliveries(deliveriesData);
          console.log(`✅ Loaded ${deliveriesData.length} deliveries from localStorage`);
        }
      } catch (error) {
        console.warn('❌ Failed to fetch from Firestore, using localStorage:', error);
        const deliveriesData = await getStoredDeliveries();
        setAllDeliveries(deliveriesData);
        console.log(`✅ Loaded ${deliveriesData.length} deliveries from localStorage (fallback)`);
      }
    };
    loadDeliveries();
  }, [refreshTrigger]);

  // Search function
  useEffect(() => {
    if (searchTerm.length >= 2) {
      setIsSearching(true);
      console.log(`🔍 Searching for: "${searchTerm}"`);
      console.log(`📊 Total deliveries to search: ${allDeliveries.length}`);
      
      const results = allDeliveries.filter(delivery => {
        try {
          // Convert all fields to strings safely
          const clientName = String(delivery.clientName || '').toLowerCase();
          const invoiceNumber = String(delivery.invoiceNumber || '').toLowerCase();
          const searchLower = searchTerm.toLowerCase();
          
          // Check matches
          const clientMatch = clientName.includes(searchLower);
          const invoiceMatch = invoiceNumber.includes(searchLower);
          
          console.log(`🔎 Checking delivery ${delivery.id}:`, {
            clientName: delivery.clientName,
            invoiceNumber: delivery.invoiceNumber,
            clientMatch,
            invoiceMatch,
            finalMatch: clientMatch || invoiceMatch
          });
          
          return clientMatch || invoiceMatch;
        } catch (error) {
          console.error('❌ Error filtering delivery:', delivery.id, error);
          return false;
        }
      });
      
      console.log(`✅ Search results: ${results.length} deliveries found`);
      console.log('📋 Found deliveries:', results.map(d => ({ 
        id: d.id, 
        clientName: d.clientName, 
        invoiceNumber: d.invoiceNumber 
      })));
      
      setSearchResults(results);
      setShowResults(true);
      setIsSearching(false);
    } else {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
    }
  }, [searchTerm, allDeliveries]);

  const handleResultClick = (delivery: Delivery) => {
    console.log('🎯 Result clicked:', delivery.clientName, delivery.invoiceNumber);
    
    // Open modal immediately
    setSelectedDelivery(delivery);
    
    // Also highlight in calendar after a short delay
    setTimeout(() => {
      onViewDelivery(delivery);
      setShowResults(false);
    }, 500);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
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
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search deliveries..."
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={handleClearSearch}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[9998] max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <div className="p-3 border-b border-gray-100 bg-gray-50 text-sm font-medium text-gray-700">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </div>
              {searchResults.map((delivery) => {
                const bgColor = getTruckColor(delivery.originStore, delivery.truckType);
                const textColor = getContrastTextColor(bgColor);
                
                return (
                  <div
                    key={delivery.id}
                    onClick={() => handleResultClick(delivery)}
                    className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            🔍 {delivery.clientName}
                          </h3>
                          <span className="text-sm font-medium text-gray-600">
                            🎯 #{delivery.invoiceNumber}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(delivery.scheduledDate)} at {formatTime(delivery.scheduledTime)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{delivery.originStore}</span>
                          </div>
                          {delivery.clientPhone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="w-4 h-4" />
                              <span>{delivery.clientPhone}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <span className="truncate">{delivery.materialDescription}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <div 
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          {delivery.truckType.replace(' (10 tons)', '').replace(' (22 tons)', '')}
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDelivery(delivery);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDelivery(delivery);
                              setShowResults(false);
                            }}
                            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            title="Edit delivery"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDelivery(delivery.id);
                              setShowResults(false);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Delete delivery"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No deliveries found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Click outside to close results */}
      {showResults && (
        <div 
          className="fixed inset-0 z-[9997]" 
          onClick={() => setShowResults(false)}
        />
      )}

      {/* Delivery View Modal */}
      {selectedDelivery && (
        <DeliveryViewModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onEdit={onEditDelivery}
          onDelete={onDeleteDelivery}
        />
      )}
    </div>
  );
};