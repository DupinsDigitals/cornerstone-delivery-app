import React, { useState, useEffect } from 'react';
import { Search, X, Eye, Edit, Trash2, Calendar, MapPin, Phone, Truck, Clock, Package } from 'lucide-react';
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
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[9998] max-h-96 overflow-y-auto w-96 min-w-full">
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
                    className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-200 hover:shadow-sm"
                  >
                    <div className="space-y-3">
                      {/* Header with client name and invoice */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-bold text-gray-900">
                            {delivery.clientName}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-semibold">
                            #{delivery.invoiceNumber}
                          </span>
                        </div>
                        
                        {/* Truck badge */}
                        <div 
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          {delivery.truckType.replace(' (10 tons)', '').replace(' (22 tons)', '')}
                        </div>
                      </div>

                      {/* Date and time */}
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                        <span className="font-medium">{formatDate(delivery.scheduledDate)}</span>
                        <span className="mx-2">•</span>
                        <Clock className="w-4 h-4 mr-1 text-green-500" />
                        <span>{formatTime(delivery.scheduledTime)}</span>
                      </div>

                      {/* Location and phone */}
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2 text-red-500" />
                          <span className="font-medium">{delivery.originStore}</span>
                        </div>
                        {delivery.clientPhone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-1 text-purple-500" />
                            <span className="text-xs">{delivery.clientPhone}</span>
                          </div>
                        )}
                      </div>

                      {/* Material description */}
                      <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-md">
                        <Package className="w-4 h-4 inline mr-2 text-orange-500" />
                        <span className="font-medium">Material:</span> {delivery.materialDescription}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDelivery(delivery);
                          }}
                          className="flex items-center px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors font-medium"
                          title="View details"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDelivery(delivery);
                            setShowResults(false);
                          }}
                          className="flex items-center px-3 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors font-medium"
                          title="Edit delivery"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDelivery(delivery.id);
                            setShowResults(false);
                          }}
                          className="flex items-center px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors font-medium"
                          title="Delete delivery"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <div className="py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No deliveries found</p>
                <p className="text-sm text-gray-400">Try searching by client name or invoice number</p>
              </div>
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