import React, { useState } from 'react';
import { Search, Package, Clock, MapPin, Phone, Truck, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { getDeliveriesFromFirestore } from '../../services/deliveryService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

export const CustomerTracker: React.FC = () => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  // Clean up realtime listener when component unmounts or when searching for new delivery
  React.useEffect(() => {
    return () => {
      if (realtimeListener) {
        realtimeListener();
      }
    };
  }, [realtimeListener]);

  // Set up realtime listener for a specific delivery
  const setupRealtimeListener = (deliveryId: string) => {
    // Clean up existing listener
    if (realtimeListener) {
      realtimeListener();
    }

    // Set up new listener
    const deliveriesRef = collection(db, 'deliveries');
    const deliveryQuery = query(deliveriesRef, where('__name__', '==', deliveryId));
    
    const unsubscribe = onSnapshot(deliveryQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // Convert Firestore document to Delivery format (same logic as in deliveryService)
        const updatedDelivery: Delivery = {
          id: doc.id,
          type: data.type || 'delivery',
          entryType: data.entryType || (data.type === 'event' ? 'internal' : undefined),
          clientName: data.clientName,
          clientPhone: data.phone,
          deliveryAddress: data.address,
          originStore: data.originStore,
          truckType: data.truckType,
          invoiceNumber: data.invoiceNumber,
          materialDescription: data.material,
          numberOfTrips: data.trips,
          additionalNotes: data.notes,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          startTime: data.startTime || data.scheduledTime,
          endTime: data.endTime,
          durationInMinutes: data.durationInMinutes,
          estimatedTravelTime: data.estimatedTravelTime,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          assignedDriver: data.assignedDriver || undefined,
          status: data.status || 'Pending',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          lastEditedBy: data.lastEditedBy,
          lastEditedByName: data.lastEditedByName,
          lastEditedAt: data.lastEditedAt?.toDate?.()?.toISOString() || undefined,
          editHistory: data.editHistory || [],
          repeat: data.repeat,
          repeatUntil: data.repeatUntil,
          isRecurring: data.isRecurring,
          parentEventId: data.parentEventId,
          photoUrl: data.photoUrl || undefined,
          photoUrls: data.photoUrls || undefined,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || undefined
        };
        
        // Update the delivery state with new data
        setDelivery(updatedDelivery);
        console.log('🔄 Customer Tracker: Delivery status updated in real-time:', updatedDelivery.status);
      }
    }, (error) => {
      console.error('❌ Customer Tracker: Realtime listener error:', error);
    });
    
    setRealtimeListener(() => unsubscribe);
  };
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up existing listener when searching for new delivery
    if (realtimeListener) {
      realtimeListener();
      setRealtimeListener(null);
    }
    
    if (!invoiceNumber.trim()) {
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
          d.invoiceNumber && d.invoiceNumber.toLowerCase() === invoiceNumber.trim().toLowerCase()
        );
        
        console.log('Customer Tracker: Searching for invoice:', invoiceNumber.trim());
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
            
            // Set up realtime listener for this delivery
            setupRealtimeListener(foundDelivery.id);
          }
        } else {
          console.log('Customer Tracker: No delivery found with invoice:', invoiceNumber.trim());
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

  const formatCompletionTime = (completedAt: string) => {
    const date = new Date(completedAt);
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
            {/* Status Header */}
            <div className={`${statusInfo.bgColor} px-6 py-4 border-b`}>
              <div className="flex items-center justify-center">
                <StatusIcon className={`w-8 h-8 ${statusInfo.color} mr-3`} />
                <div className="text-center">
                  <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </h2>
                  <p className={`text-sm ${statusInfo.color} mt-1`}>
                    {statusInfo.description}
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
                          {(delivery.status === 'COMPLETE' || delivery.status === 'Complete') && delivery.completedAt
                            ? `• Completed at ${formatCompletionTime(delivery.completedAt)}`
                            : `at ${formatTime(delivery.scheduledTime)}`
                          }
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
                        <p className="text-sm font-medium text-gray-700">Number of Trips</p>
                        <p className="text-gray-900">{delivery.numberOfTrips}</p>
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

            {/* Contact Information */}
          {/* Google Review Section - Only show for completed deliveries */}
          {(delivery.status === 'COMPLETE' || delivery.status === 'Complete') && (
            <div className="border-t pt-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-green-800 mb-3">
                  🌟 How was your delivery experience?
                </h3>
                <p className="text-green-700 mb-4">
                  We'd love to hear about your experience with our {delivery.originStore} store.
                </p>
                <a 
                  href={delivery.originStore === 'Framingham' 
                    ? 'https://g.page/r/Ceg1BxdAGVKhEBM/review'
                    : 'https://g.page/r/CazNQrgXMGlzEBM/review'
                  }
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors inline-block font-medium shadow-sm hover:shadow-md"
                >
                  Leave a Google Review
                </a>
              </div>
            </div>
          )}
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