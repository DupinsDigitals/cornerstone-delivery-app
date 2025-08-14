import React, { useState, useEffect } from 'react';
import { Search, Package, Clock, MapPin, Phone, Truck, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { getDeliveriesFromFirestore } from '../../services/deliveryService';

// Google Review Links for each store
const GOOGLE_REVIEW_LINKS = {
  Framingham: 'https://g.page/r/Ceg1BxdAGVKhEBM/review',
  Marlborough: 'https://g.page/r/CazNQrgXMGlzEBM/review'
};

export const CustomerTracker: React.FC = () => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  // Check for invoice parameter in URL and auto-search
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceParam = urlParams.get('invoice');
    
    if (invoiceParam && !hasAutoSearched) {
      console.log('🔍 Auto-searching for invoice from URL:', invoiceParam);
      setInvoiceNumber(invoiceParam);
      setHasAutoSearched(true);
      
      // Auto-execute search after a brief delay to ensure state is set
      setTimeout(() => {
        performSearch(invoiceParam);
      }, 100);
    }
  }, [hasAutoSearched]);

  // Extract search logic into a separate function for reuse
  const performSearch = async (searchInvoice?: string) => {
    const invoiceToSearch = searchInvoice || invoiceNumber.trim();
    
    if (!invoiceToSearch) {
      setError('Please enter an invoice number');
      return;
    }

    setIsLoading(true);
    setError('');
    setDelivery(null);
    setHasSearched(true);

    try {
      // Get deliveries directly from Firestore for customer tracking
      const result = await getDeliveriesFromFirestore();
      
      if (result.success && result.deliveries && result.deliveries.length > 0) {
        const deliveries = result.deliveries;
        console.log('Customer Tracker: Found', deliveries.length, 'total deliveries');
        
        // Find delivery by invoice number (case-insensitive)
        const foundDelivery = deliveries.find(d => 
          d.invoiceNumber && d.invoiceNumber.toLowerCase() === invoiceToSearch.toLowerCase()
        );
        
        console.log('Customer Tracker: Searching for invoice:', invoiceToSearch);
        console.log('Customer Tracker: Available invoices:', deliveries.map(d => d.invoiceNumber).filter(Boolean));
        
        if (foundDelivery) {
          console.log('Customer Tracker: Found delivery:', foundDelivery);
          // Only show regular deliveries, not internal events or maintenance
          if (foundDelivery.entryType === 'internal' || foundDelivery.entryType === 'equipmentMaintenance') {
            console.log('Customer Tracker: Delivery is internal/maintenance, not showing');
            setError('Invoice number not found. Please check your invoice number and try again.');
          } else {
            console.log('Customer Tracker: Showing delivery to customer');
            setDelivery(foundDelivery);
            setLastUpdateTime(new Date());
          }
        } else {
          console.log('Customer Tracker: No delivery found with invoice:', invoiceToSearch);
          setError('Invoice number not found. Please check your invoice number and try again.');
        }
      } else {
        console.log('Customer Tracker: No deliveries available');
        if (!result.success) {
          console.error('Customer Tracker: Firestore error:', result.error);
          setError('Unable to connect to delivery database. Please try again in a few moments or contact us for assistance.');
        } else {
          setError('No deliveries found in the system. Please contact us if you believe this is an error.');
        }
      }
    } catch (error) {
      console.error('Error searching for delivery:', error);
      setError('Connection error. Please check your internet connection and try again, or contact us for assistance.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch();
  };

  // Auto-refresh function for live updates
  const refreshDeliveryStatus = async () => {
    if (!delivery || !invoiceNumber.trim()) return;
    
    setIsRefreshing(true);
    
    try {
      const result = await getDeliveriesFromFirestore();
      
      if (result.success && result.deliveries && result.deliveries.length > 0) {
        const updatedDelivery = result.deliveries.find(d => 
          d.invoiceNumber && d.invoiceNumber.toLowerCase() === invoiceNumber.trim().toLowerCase()
        );
        
        if (updatedDelivery && updatedDelivery.entryType !== 'internal' && updatedDelivery.entryType !== 'equipmentMaintenance') {
          // Check if there are actual changes
          const hasChanges = 
            updatedDelivery.status !== delivery.status ||
            updatedDelivery.currentTrip !== delivery.currentTrip ||
            (updatedDelivery.photoUrls?.length || 0) !== (delivery.photoUrls?.length || 0) ||
            updatedDelivery.deliveryComment !== delivery.deliveryComment ||
            updatedDelivery.updatedAt !== delivery.updatedAt;
          
          if (hasChanges) {
            console.log('Customer Tracker: Status updated from', delivery.status, 'to', updatedDelivery.status);
            setDelivery(updatedDelivery);
            setLastUpdateTime(new Date());
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing delivery status:', error);
      // Don't show error to user for background refresh
    } finally {
      setIsRefreshing(false);
    }
  };

  // Set up auto-refresh when delivery is being tracked
  useEffect(() => {
    if (!delivery) return;
    
    // Refresh every 15 seconds for more frequent updates
    const interval = setInterval(refreshDeliveryStatus, 15000);
    
    return () => clearInterval(interval);
  }, [delivery, invoiceNumber]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
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

  const getStatusInfo = (status: string) => {
    const statusConfig = {
      'pending': { 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100', 
        icon: Clock,
        label: 'PENDING',
        description: 'Your delivery is scheduled and waiting to be processed.'
      },
      'Pending': { 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100', 
        icon: Clock,
        label: 'PENDING',
        description: 'Your delivery is scheduled and waiting to be processed.'
      },
      'GETTING LOAD': { 
        color: 'text-yellow-700', 
        bgColor: 'bg-yellow-100', 
        icon: Package,
        label: 'GETTING LOAD',
        description: 'Our team is preparing your materials for delivery.'
      },
      'Getting Load': { 
        color: 'text-yellow-700', 
        bgColor: 'bg-yellow-100', 
        icon: Package,
        label: 'GETTING LOAD',
        description: 'Our team is preparing your materials for delivery.'
      },
      'ON THE WAY': { 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-100', 
        icon: Truck,
        label: 'ON THE WAY',
        description: 'Your delivery is loaded and on the way to your location!'
      },
      'On the Way': { 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-100', 
        icon: Truck,
        label: 'ON THE WAY',
        description: 'Your delivery is loaded and on the way to your location!'
      },
      'COMPLETE': { 
        color: 'text-green-700', 
        bgColor: 'bg-green-100', 
        icon: CheckCircle,
        label: 'COMPLETE',
        description: 'Your delivery has been completed successfully!'
      },
      'Complete': { 
        color: 'text-green-700', 
        bgColor: 'bg-green-100', 
        icon: CheckCircle,
        label: 'COMPLETE',
        description: 'Your delivery has been completed successfully!'
      },
      'On Hold': { 
        color: 'text-orange-700', 
        bgColor: 'bg-orange-100', 
        icon: AlertCircle,
        label: 'ON HOLD',
        description: 'Your delivery is temporarily on hold. We will contact you with updates.'
      }
    };
    
    return statusConfig[status as keyof typeof statusConfig] || {
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      icon: Clock,
      label: status.toUpperCase(),
      description: 'Status information is being updated.'
    };
  };

  const statusInfo = delivery ? getStatusInfo(delivery.status) : null;
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="w-64 h-32 flex items-center justify-center mx-auto mb-4">
              <img 
                src="/CLS Logo app.svg" 
                alt="Cornerstone Landscape Supplies Logo" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Track Your Delivery</h1>
            <p className="text-gray-600">Enter your invoice number to check your delivery status</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="invoice" className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="invoice"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  placeholder="Enter your invoice number (e.g., 12345)"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-lg font-medium"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Track Delivery
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* No Results Message */}
        {hasSearched && !delivery && !error && !isLoading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No delivery found</h3>
            <p className="text-gray-600">
              Please check your invoice number and try again, or contact us if you need assistance.
            </p>
          </div>
        )}

        {/* Delivery Information */}
        {delivery && statusInfo && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Live Status Indicator */}
            <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm">
              <div className="flex items-center justify-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-300' : 'bg-green-300'} animate-pulse`}></div>
                <span className="font-medium">
                  {isRefreshing ? 'Updating...' : 'Live Status Tracking'}
                </span>
                {lastUpdateTime && (
                  <span className="text-blue-200 text-xs">
                    • Last updated: {lastUpdateTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true 
                    })}
                  </span>
                )}
              </div>
            </div>
            
            {/* Status Header */}
            <div className={`${statusInfo.bgColor} px-6 py-4 border-b`}>
              <div className="flex items-center justify-center">
                <StatusIcon className={`w-8 h-8 ${statusInfo.color} mr-3`} />
                <div className="text-center">
                  <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                    {delivery.currentTrip && delivery.numberOfTrips > 1 && 
                      ` (Trip ${delivery.currentTrip} of ${delivery.numberOfTrips})`
                    }
                  </h2>
                  <p className={`text-sm ${statusInfo.color} mt-1`}>
                    {statusInfo.description}
                    {delivery.currentTrip && delivery.status !== 'COMPLETE' && delivery.status !== 'Complete' && 
                      ` Currently on trip ${delivery.currentTrip}.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <Package className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Invoice Number</p>
                        <p className="text-gray-900">#{delivery.invoiceNumber}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Calendar className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Scheduled Delivery</p>
                        <p className="text-gray-900">
                          {formatDate(delivery.scheduledDate)}
                        </p>
                        <p className="text-gray-600 text-sm">
                          at {formatTime(delivery.scheduledTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Delivery Address</p>
                        <p className="text-gray-900">{delivery.deliveryAddress}</p>
                      </div>
                    </div>

                    {/* Driver Information - Show for GETTING LOAD, ON THE WAY, and COMPLETE */}
                    {(delivery.status === 'GETTING LOAD' || 
                      delivery.status === 'Getting Load' || 
                      delivery.status === 'ON THE WAY' || 
                      delivery.status === 'On the Way' || 
                      delivery.status === 'COMPLETE' || 
                      delivery.status === 'Complete') && 
                     (delivery.lastUpdatedByName || delivery.startedBy) && (
                      <div className="flex items-start">
                        <div className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex items-center justify-center">
                          👤
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {delivery.status === 'COMPLETE' || delivery.status === 'Complete' 
                              ? 'Delivered by' 
                              : 'Driver'}
                          </p>
                          <p className="text-gray-900 font-medium">
                            {delivery.lastUpdatedByName || 
                             (delivery.startedBy ? delivery.startedBy.split('@')[0] : 'Driver')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <Truck className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Truck & Location</p>
                        <p className="text-gray-900">{delivery.truckType}</p>
                        <p className="text-gray-600 text-sm">{delivery.originStore} Store</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Package className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Material</p>
                        <p className="text-gray-900">{delivery.materialDescription}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex items-center justify-center">
                        #
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Trips</p>
                        <div className="flex items-center space-x-2">
                          <p className="text-gray-900">{delivery.numberOfTrips} total</p>
                          {delivery.currentTrip && (
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                                Trip {delivery.currentTrip}
                              </span>
                              {delivery.status !== 'COMPLETE' && delivery.status !== 'Complete' && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold animate-pulse">
                                  In Progress
                                </span>
                              )}
                            </div>
                          )}
                          {(delivery.status === 'COMPLETE' || delivery.status === 'Complete') && delivery.numberOfTrips > 1 && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                              ✅ All trips completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              {delivery.additionalNotes && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-md">
                    {delivery.additionalNotes}
                  </p>
                </div>
              )}

              {/* Delivery Photos - Only show if delivery is complete */}
              {(delivery.status === 'COMPLETE' || delivery.status === 'Complete') && 
               ((delivery.photoUrls && delivery.photoUrls.length > 0) || delivery.photoUrl) && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h3>
                  {delivery.photoUrls && delivery.photoUrls.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {delivery.photoUrls.map((photoUrl, index) => (
                        <a
                          key={index}
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photoUrl}
                            alt={`Delivery proof ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  ) : delivery.photoUrl ? (
                    <a
                      href={delivery.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-md"
                    >
                      <img
                        src={delivery.photoUrl}
                        alt="Delivery proof"
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </a>
                  ) : null}
                  <p className="text-sm text-gray-600 mt-2">
                    Click {delivery.photoUrls && delivery.photoUrls.length > 1 ? 'any photo' : 'the photo'} to view full size
                  </p>
                </div>
              )}
            </div>

            {/* Google Review Section - Only show for completed deliveries */}
            {(delivery.status === 'COMPLETE' || delivery.status === 'Complete') && (
              <div className="border-t pt-6">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 text-center border border-green-200">
                  <div className="mb-4">
                    <div className="text-4xl mb-2">🌟</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Delivery Complete!
                    </h3>
                    <p className="text-gray-700 mb-4">
                      We hope you're thrilled with your delivery! Your experience matters to us and helps other customers make confident choices.
                    </p>
                    <p className="text-sm text-gray-600 mb-6">
                      Would you take a moment to share your experience? It only takes 30 seconds and means the world to our team!
                    </p>
                  </div>
                  
                  <a
                    href={GOOGLE_REVIEW_LINKS[delivery.originStore as keyof typeof GOOGLE_REVIEW_LINKS]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <span className="text-xl mr-2">⭐</span>
                    Leave a Review for Cornerstone
                    <span className="text-xl ml-2">⭐</span>
                  </a>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    Your review helps us improve and helps other customers choose Cornerstone Landscape Supplies
                  </p>
                </div>
              </div>
            )}
            {/* Contact Information */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Questions about your delivery?
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <a
                    href={`tel:${delivery.originStore === 'Framingham' ? '+15088209700' : '+15084600088'}`}
                    className="flex items-center text-green-600 hover:text-green-700 font-medium"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call {delivery.originStore} Store
                  </a>
                  <span className="text-gray-300">|</span>
                  <p className="text-sm text-gray-600">
                    {delivery.originStore === 'Framingham' ? '(508) 820-9700' : '(508) 460-0088'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};