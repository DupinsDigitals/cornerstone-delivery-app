import React, { useState, useEffect } from 'react';
import { Truck, Clock, MapPin, Phone, Package, LogOut, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Delivery } from '../../types/delivery';
import { getTodaysDeliveriesForStore, updateDeliveryStatus, uploadDeliveryPhotos } from '../../services/deliveryService';
import { getTruckColor, getContrastTextColor } from '../../utils/truckTypes';
import { logoutUser } from '../../services/authService';
import { PhotoUploadModal } from './PhotoUploadModal';

export const DriverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);
  const [lockedDeliveries, setLockedDeliveries] = useState<Set<string>>(new Set());
  const [selectedStore, setSelectedStore] = useState<'Framingham' | 'Marlborough'>('Framingham');

  const toggleExpanded = (id: string) => {
    setExpandedDeliveryId(prev => (prev === id ? null : id));
  };

  // Photo upload modal state
  const [photoModalState, setPhotoModalState] = useState<{
    deliveryId: string | null;
    clientName: string;
    isOpen: boolean;
  }>({
    deliveryId: null,
    clientName: '',
    isOpen: false
  });
  const [tripModalState, setTripModalState] = useState<{
    deliveryId: string | null;
    clientName: string;
    numberOfTrips: number;
    currentTrip: number;
    isOpen: boolean;
  }>({
    deliveryId: null,
    clientName: '',
    numberOfTrips: 1,
    currentTrip: 1,
    isOpen: false
  });

  // Safe string conversion helper
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  // Safe get owner name helper
  const getSafeOwnerName = (delivery: Delivery): string => {
    const lastUpdatedByName = safeString(delivery.lastUpdatedByName);
    const startedBy = safeString(delivery.startedBy);
    const startedByUsername = startedBy ? startedBy.split('@')[0] : '';
    
    return lastUpdatedByName || startedByUsername || 'UNKNOWN';
  };

  // Status progression mapping
  const getNextStatus = (currentStatus: string): string => {
    const normalizedStatus = currentStatus.toLowerCase().trim();
    switch (normalizedStatus) {
      case 'pending':
        return 'GETTING LOAD';
      case 'getting load':
        return 'ON THE WAY';
      case 'on the way':
        return 'COMPLETE';
      default:
        return currentStatus; // No change for COMPLETE or unknown statuses
    }
  };


  // Get status button styling
  const getStatusButtonStyle = (status: string) => {
    const normalizedStatus = status.toLowerCase().trim();
    switch (normalizedStatus) {
      case 'pending':
        return {
          backgroundColor: '#6B7280', // Gray
          color: '#FFFFFF',
          label: 'PENDING'
        };
      case 'getting load':
        return {
          backgroundColor: '#F59E0B', // Yellow/Amber
          color: '#000000',
          label: 'GETTING LOAD'
        };
      case 'on the way':
        return {
          backgroundColor: '#3B82F6', // Blue
          color: '#FFFFFF',
          label: 'ON THE WAY'
        };
      case 'complete':
        return {
          backgroundColor: '#10B981', // Green
          color: '#FFFFFF',
          label: 'COMPLETE'
        };
      case 'on hold':
        return {
          backgroundColor: '#fd7e14', // Orange (matching sales area)
          color: '#FFFFFF',
          label: 'ON HOLD'
        };
      default:
        return {
          backgroundColor: '#6B7280', // Gray fallback
          color: '#FFFFFF',
          label: status.toUpperCase()
        };
    }
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Check if user is a Master Driver (read-only access)
  const isMasterDriver = user?.role === 'masterDriver';
  
  const loadTodaysDeliveries = async () => {
    // For Master Driver, use selected store; for regular driver, use assigned store
    const storeToLoad = isMasterDriver ? selectedStore : user?.assignedStore;
    
    if (!storeToLoad) {
      console.error('No store specified for loading deliveries');
      setIsLoading(false);
      return;
    }

    try {
      const todayDate = getTodayDate();
      const result = await getTodaysDeliveriesForStore(storeToLoad, todayDate);
      
      if (result.success && result.deliveries) {
        // Show all deliveries for the store - drivers can work with any truck
        // Filter out internal events - drivers should only see deliveries
        const filteredDeliveries = result.deliveries.filter(delivery => 
          delivery.entryType !== 'internal' && 
          delivery.entryType !== 'equipmentMaintenance' && 
          delivery.type !== 'event' && 
          delivery.type !== 'equipmentMaintenance'
        );
        
        // Sort deliveries by when they were started/claimed by drivers
        // Sort deliveries by scheduled time (as set by sales rep)
        const sortedDeliveries = filteredDeliveries.sort((a, b) => {
          const timeA = (a.scheduledTime || '00:00').split(':').map(Number);
          const timeB = (b.scheduledTime || '00:00').split(':').map(Number);
          
          const minutesA = timeA[0] * 60 + timeA[1];
          const minutesB = timeB[0] * 60 + timeB[1];
          
          return minutesA - minutesB;
        });

        setDeliveries(sortedDeliveries);
        console.log(`📱 Driver Dashboard - Loaded ${sortedDeliveries.length} deliveries for ${storeToLoad} on ${todayDate} (all trucks)`);
        return sortedDeliveries;
      } else {
        console.error('Failed to load deliveries:', result.error);
        setDeliveries([]);
      }
    } catch (error) {
      console.error('Error loading deliveries:', error);
      setDeliveries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTodaysDeliveries();
    
    // Refresh every 30 seconds to get updates
    const interval = setInterval(loadTodaysDeliveries, 30000);
    return () => clearInterval(interval);
  }, [user?.assignedStore, selectedStore]);

  const handleStatusUpdate = async (delivery: Delivery, newStatus: string) => {
    // Master Drivers cannot update status
    if (isMasterDriver) {
      return;
    }
    
    // Check if delivery is locked locally
    if (lockedDeliveries.has(delivery.id)) {
      return; // Silently ignore if locked locally
    }

    // CRITICAL: Check if another driver owns this delivery
    const isOwnedByAnotherDriver = delivery.startedBy && delivery.startedBy !== user?.email;
    
    if (isOwnedByAnotherDriver) {
      alert('This delivery is currently in progress by another driver and cannot be edited.');
      return;
    }
    
    // Lock this delivery locally to prevent double-clicks
    setLockedDeliveries(prev => new Set(prev).add(delivery.id));
    setUpdatingDelivery(delivery.id);
    
    try {

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: user?.email,
        lastUpdatedByName: user?.name || user?.email || 'Unknown Driver',
        editedBy: user?.email,
        editedByName: user?.name || user?.email || 'Unknown Driver'
      };

      // If starting a delivery (moving from PENDING), claim ownership
      if ((delivery.status === 'pending' || delivery.status === 'Pending') && !delivery.startedBy) {
        updateData.startedBy = user?.email;
        updateData.assignedDriver = user?.email;
        updateData.assignedTruck = delivery.truckType;
        updateData.claimedAt = new Date().toISOString();
      }

      console.log('🔄 Updating delivery status:', {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: newStatus,
        updateData: updateData
      });
      const result = await updateDeliveryStatus(delivery.id, newStatus, updateData);
      
      console.log('📊 Update result:', result);
      
      if (result.success) {
        console.log('✅ Status update successful, refreshing deliveries...');
        await loadTodaysDeliveries();
      } else {
        console.error('❌ Status update failed:', result.error);
        if (result.error?.includes('claimed') || result.error?.includes('another driver')) {
          alert('This delivery has been claimed by another driver.');
          await loadTodaysDeliveries();
        } else {
          alert('Failed to update delivery status: ' + (result.error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('An error occurred while updating the delivery status. Please try again.');
      await loadTodaysDeliveries();
    } finally {
      setLockedDeliveries(prev => {
        const newSet = new Set(prev);
        newSet.delete(delivery.id);
        return newSet;
      });
      setUpdatingDelivery(null);
    }
  };

  // Handle multiple photo upload for delivery completion
  const handleMultiplePhotoUpload = async (deliveryId: string, files: File[]): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> => {
    try {
      console.log(`📸 Starting upload of ${files.length} photos for delivery ${deliveryId}`);
      
      // Upload photos to Firebase Storage
      const uploadResult = await uploadDeliveryPhotos(deliveryId, files);
      
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error || 'Failed to upload photos'
        };
      }
      
      if (!uploadResult.photoUrls || uploadResult.photoUrls.length === 0) {
        return {
          success: false,
          error: 'No photos were uploaded successfully'
        };
      }
      
      console.log(`📸 ${uploadResult.photoUrls.length} photos uploaded successfully`);
      
      return {
        success: true,
        photoUrls: uploadResult.photoUrls
      };
      
    } catch (error) {
      console.error('Error uploading photos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload photos'
      };
    }
  };

  // Handle photo upload completion
  const handlePhotoUploadComplete = async (photoUrls: string[], deliveryComment?: string) => {
    const deliveryId = photoModalState.deliveryId;
    if (!deliveryId) return;

    try {
      // Update delivery status to COMPLETE with photo URLs
      const updateData: any = {
        status: 'COMPLETE',
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: user?.email,
        lastUpdatedByName: user?.name || user?.email || 'Unknown Driver',
        photoUrls: photoUrls,
        photoUrl: photoUrls[0], // Keep legacy single photo field for backward compatibility
        completedAt: new Date().toISOString(),
        editedBy: user?.email,
        editedByName: user?.name || user?.email || 'Unknown Driver'
      };
      
      // Add delivery comment if provided
      if (deliveryComment) {
        updateData.deliveryComment = deliveryComment;
      }
      
      const result = await updateDeliveryStatus(deliveryId, 'COMPLETE', updateData);
      
      if (result.success) {
        // Close modal and refresh deliveries
        setPhotoModalState({ deliveryId: null, clientName: '', isOpen: false });
        await loadTodaysDeliveries();
        const commentText = deliveryComment ? ' with comments' : '';
        alert(`📸 ${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''} uploaded${commentText} and delivery marked as complete!`);
      } else {
        alert('Failed to complete delivery: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('An error occurred while completing the delivery. Please try again.');
    }
  };

  // Show photo upload modal
  const showPhotoUploadModal = (deliveryId: string, clientName: string) => {
    setPhotoModalState({
      deliveryId,
      clientName,
      isOpen: true
    });
  };

  // Close photo upload modal
  const closePhotoUploadModal = () => {
    setPhotoModalState({
      deliveryId: null,
      clientName: '',
      isOpen: false
    });
  };

  // Handle trip selection
  const handleTripSelection = async (deliveryId: string, tripNumber: number) => {
    if (isMasterDriver) {
      return;
    }
    
    try {
      const updateData = {
        currentTrip: tripNumber,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: user?.email,
        lastUpdatedByName: user?.name || user?.email || 'Unknown Driver',
        editedBy: user?.email,
        editedByName: user?.name || user?.email || 'Unknown Driver'
      };
      
      // Don't change status, just update the current trip
      const result = await updateDeliveryStatus(deliveryId, null, updateData);
      
      if (result.success) {
        await loadTodaysDeliveries();
        console.log(`✅ Viagem ${tripNumber} selecionada!`);
      } else {
        alert('Erro ao selecionar viagem: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error selecting trip:', error);
      alert('Erro ao selecionar viagem. Tente novamente.');
    }
  };

  // Show trip selection modal
  const showTripSelectionModal = (delivery: Delivery) => {
    console.log('🎯 Opening trip selection modal for:', delivery.clientName, 'Trips:', delivery.numberOfTrips);
    setTripModalState({
      deliveryId: delivery.id,
      clientName: delivery.clientName,
      numberOfTrips: delivery.numberOfTrips || 1,
      currentTrip: delivery.currentTrip || 1,
      isOpen: true
    });
  };

  // Close trip selection modal
  const closeTripSelectionModal = () => {
    setTripModalState({
      deliveryId: null,
      clientName: '',
      numberOfTrips: 1,
      currentTrip: 1,
      isOpen: false
    });
  };

  const renderStatusButton = (delivery: Delivery) => {
    // Debug log for trip detection
    console.log('🔍 Delivery trip info:', {
      id: delivery.id,
      clientName: delivery.clientName,
      numberOfTrips: delivery.numberOfTrips,
      currentTrip: delivery.currentTrip,
      status: delivery.status
    });
    
    // For Master Driver, show read-only status
    if (isMasterDriver) {
      const statusStyle = getStatusButtonStyle(delivery.status);
      return (
        <div className="space-y-2">
          <button
            disabled
            className="w-full px-4 py-3 rounded-lg text-sm font-bold cursor-not-allowed opacity-75"
            style={{
              backgroundColor: statusStyle.backgroundColor,
              color: statusStyle.color
            }}
          >
            {statusStyle.label}
          </button>
        </div>
      );
    }
    
    const status = delivery.status;
    const isUpdating = updatingDelivery === delivery.id;
    const isLocked = lockedDeliveries.has(delivery.id);
    const statusStyle = getStatusButtonStyle(status);
    const nextStatus = getNextStatus(status);
    const isComplete = status === 'COMPLETE';
    const isAboutToComplete = nextStatus === 'COMPLETE';
    const isOwnedByAnotherDriver = delivery.startedBy && delivery.startedBy !== user?.email;

    // Check if delivery has multiple trips
    const hasMultipleTrips = delivery.numberOfTrips && delivery.numberOfTrips > 1;

    if (isUpdating || isLocked) {
      return (
        <div className="space-y-2">
          <button
            disabled
            className="w-full px-4 py-3 bg-gray-400 text-white rounded-lg text-sm font-bold transition-all"
          >
            {isUpdating ? 'UPDATING...' : 'LOCKED'}
          </button>
        </div>
      );
    }

    if (isComplete) {
      return (
        <div className="flex items-center space-x-2">
          <button
            disabled
            className="flex-1 px-3 py-2 rounded-lg text-sm font-bold cursor-not-allowed"
            style={{
              backgroundColor: statusStyle.backgroundColor,
              color: statusStyle.color,
              opacity: 0.8
            }}
          >
            ✓ {statusStyle.label}
          </button>
        </div>
      );
    }

    // Check if owned by another driver
    if (isOwnedByAnotherDriver) {
      const ownerInfo = safeString(delivery.startedBy);
      const ownerUsername = ownerInfo ? ownerInfo.split('@')[0] : '';
      return (
        <div className="flex items-center space-x-2">
          <button
            disabled
            className="flex-1 px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-bold cursor-not-allowed"
            title={`This delivery is being handled by ${ownerInfo}`}
          >
            🚫 DRIVER: {safeString(ownerUsername).toUpperCase() || 'OTHER'}
          </button>
        </div>
      );
    }
    
    // Show interactive button - always show next status instruction
    return (
      <div className="flex items-center space-x-2">
        {/* Trip selector for multiple trips */}
        {hasMultipleTrips && (status === 'pending' || status === 'Pending') && (
          <button
            onClick={() => showTripSelectionModal(delivery)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            title="Selecionar viagem"
          >
            Viagem {delivery.currentTrip || 1}/{delivery.numberOfTrips}
          </button>
        )}
        
        <button
          onClick={() => handleStatusButtonClick(delivery)}
          className={`${hasMultipleTrips && status === 'pending' ? 'flex-1' : 'flex-1'} px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg`}
          style={{
            backgroundColor: statusStyle.backgroundColor,
            color: statusStyle.color
          }}
          title={`Click to change to ${nextStatus}`}
        >
          {statusStyle.label}
          <span className="block text-xs opacity-75">
            {isAboutToComplete ? 'Tap to → Add Photos' : `Tap to → ${nextStatus}`}
          </span>
        </button>
      </div>
    );
  };

  const handleStatusButtonClick = async (delivery: Delivery) => {
    // Master Drivers cannot interact with status buttons
    if (isMasterDriver) {
      return;
    }
    
    // Check if delivery is locked (being updated)
    if (lockedDeliveries.has(delivery.id)) {
      return; // Silently ignore if locked
    }

    // Block access for deliveries owned by another driver
    const isOwnedByAnotherDriver = delivery.startedBy && delivery.startedBy !== user?.email;
    if (isOwnedByAnotherDriver) {
      alert('This delivery is currently in progress by another driver and cannot be edited.');
      return;
    }

    const currentStatus = delivery.status;
    const nextStatus = getNextStatus(currentStatus);
    
    console.log('🎯 Status button clicked:', {
      deliveryId: delivery.id,
      currentStatus: currentStatus,
      nextStatus: nextStatus,
      userEmail: user?.email,
      deliveryStartedBy: delivery.startedBy
    });
    
    // Special handling for COMPLETE status - require photo
    if (nextStatus === 'COMPLETE') {
      showPhotoUploadModal(delivery.id, delivery.clientName);
      return;
    }
    
    // Always try to update to next status
    console.log('✅ Calling handleStatusUpdate...');
    await handleStatusUpdate(delivery, nextStatus);
  };


  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logoutUser();
        logout();
      } catch (error) {
        console.error('Logout error:', error);
        // Force logout even if Firebase logout fails
        logout();
      }
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'N/A';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading today's deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isMasterDriver ? 'Master Driver Dashboard' : 'Driver Dashboard'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isMasterDriver ? `${selectedStore} Store - All Trucks - Today's Deliveries (Read Only)` : `${user?.assignedStore} Store - All Trucks - Today's Deliveries`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user?.name}</div>
              <div className="text-xs text-gray-500">Driver</div>
            </div>
            <button
              onClick={handleLogout}
              className="ml-4 flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Store Filter Tabs - Only for Master Driver */}
        {isMasterDriver && (
          <div className="mb-6">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedStore('Framingham')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedStore === 'Framingham'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                FRAMINGHAM
              </button>
              <button
                onClick={() => setSelectedStore('Marlborough')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedStore === 'Marlborough'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                MARLBOROUGH
              </button>
            </div>
          </div>
        )}

        {deliveries.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries for today</h3>
            <p className="text-gray-500">
              No deliveries scheduled for {isMasterDriver ? selectedStore : user?.assignedStore} store today.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => {
              const truckColor = getTruckColor(delivery.originStore, delivery.truckType);
              const textColor = getContrastTextColor(truckColor);
              const isExpanded = expandedDeliveryId === delivery.id;

              return (
                <div
                  key={delivery.id}
                  className="rounded-lg shadow-sm overflow-hidden border"
                  style={{ backgroundColor: truckColor }}
                >
                  {/* Card Header */}
                  <div className="p-4" style={{ color: textColor }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">
                          {safeString(delivery.clientName)}
                        </h3>
                        <p className="text-sm opacity-90 mb-2">
                          Invoice #{safeString(delivery.invoiceNumber)}
                        </p>
                        <div className="flex items-center text-sm opacity-80">
                          <Truck className="w-3 h-3 mr-1" />
                          {safeString(delivery.truckType)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex justify-end">
                          <div 
                            className="px-3 py-1 rounded-full text-xs font-bold shadow-sm"
                            style={{ 
                              backgroundColor: getStatusButtonStyle(delivery.status).backgroundColor,
                              color: getStatusButtonStyle(delivery.status).color
                            }}
                          >
                            {getStatusButtonStyle(delivery.status).label}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Show Details Button */}
                    <button
                      onClick={() => toggleExpanded(delivery.id)}
                      className="mt-3 w-full px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        color: textColor
                      }}
                    >
                      {isExpanded ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t bg-white p-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start">
                          <Clock className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Schedule:</span>
                            <p className="text-gray-900">{formatTime(safeString(delivery.scheduledTime))}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Address:</span>
                            {delivery.deliveryAddress || delivery.address ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.deliveryAddress || delivery.address || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors block mt-1 break-words"
                                title="Open in Google Maps"
                              >
                                {delivery.deliveryAddress || delivery.address}
                              </a>
                            ) : (
                              <p className="text-gray-500 italic mt-1">Address not available</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start">
                          <Truck className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Truck:</span>
                            <p className="text-gray-900">{delivery.truckType}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <div className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex items-center justify-center">
                            #
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Trips:</span>
                            <p className="text-gray-900">
                              {delivery.numberOfTrips || 1} total
                              {delivery.currentTrip && (
                                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                                  Viagem {delivery.currentTrip}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <Package className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Material:</span>
                            <p className="text-gray-900">{delivery.materialDescription}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <Phone className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Phone:</span>
                            {delivery.clientPhone || delivery.phone ? (
                              <a
                                href={`tel:${(delivery.clientPhone || delivery.phone || '').replace(/\D/g, '')}`}
                                className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors block mt-1"
                                title="Call client"
                              >
                                {delivery.clientPhone || delivery.phone}
                              </a>
                            ) : (
                              <p className="text-gray-500 italic mt-1">Phone not available</p>
                            )}
                          </div>
                        </div>

                        {(delivery.additionalNotes || delivery.notes) && (
                          <div className="flex items-start">
                            <div className="w-4 h-4 text-gray-400 mr-2 mt-0.5">📝</div>
                            <div>
                              <span className="font-medium text-gray-700">Notes:</span>
                              <p className="text-gray-900 italic">{delivery.additionalNotes || delivery.notes}</p>
                            </div>
                          </div>
                        )}

                        {/* Trip Selector - Simple emoji indicators */}
                        {delivery.numberOfTrips && delivery.numberOfTrips > 1 && (
                          <div className="flex items-start">
                            <div className="w-4 h-4 text-gray-400 mr-2 mt-0.5">🚛</div>
                            <div>
                              <span className="font-medium text-gray-700">Viagem:</span>
                              <div className="flex items-center space-x-2 mt-2">
                                {Array.from({ length: delivery.numberOfTrips }, (_, index) => {
                                  const isDeliveryComplete = delivery.status === 'Complete' || delivery.status === 'complete' || delivery.status === 'COMPLETE';
                                  const isCompleted = isDeliveryComplete || (delivery.currentTrip && tripNumber < delivery.currentTrip);
                                  const isSelected = !isDeliveryComplete && delivery.currentTrip === tripNumber;
                                  const isCompleted = delivery.currentTrip && tripNumber < delivery.currentTrip;
                                  const canSelect = !delivery.currentTrip || tripNumber === delivery.currentTrip || tripNumber === (delivery.currentTrip + 1);
                                  
                                  return (
                                    <button
                                      key={tripNumber}
                                      onClick={() => canSelect && !isCompleted ? handleTripSelection(delivery.id, tripNumber) : null}
                                      disabled={isMasterDriver || isDeliveryComplete}
                                      className={`text-2xl transition-all transform hover:scale-110 ${
                                        isCompleted
                                          ? 'cursor-not-allowed opacity-100'
                                          : isSelected 
                                            ? 'filter brightness-125 drop-shadow-lg cursor-pointer' 
                                            : canSelect
                                              ? 'opacity-60 hover:opacity-80 cursor-pointer'
                                              : 'opacity-30 cursor-not-allowed'
                                      } ${
                                        isMasterDriver || isDeliveryComplete ? 'cursor-not-allowed' : 'cursor-pointer'
                                      }`}
                                      style={{
                                        backgroundColor: isCompleted 
                                          ? '#10b981' 
                                          : isSelected 
                                            ? '#22c55e' 
                                            : 'transparent',
                                        borderRadius: '8px',
                                        padding: '4px 8px',
                                        border: (isCompleted || isSelected) ? '2px solid #16a34a' : '2px solid transparent'
                                      }}
                                      title={
                                        isDeliveryComplete
                                          ? `Delivery completo - todas as viagens foram concluídas`
                                          : isCompleted
                                          ? `Viagem ${tripNumber} já foi concluída`
                                          : !canSelect
                                            ? `Complete a viagem ${delivery.currentTrip} primeiro`
                                            : isMasterDriver
                                          ? 'Master drivers cannot select trips' 
                                          : `Selecionar viagem ${tripNumber}`
                                      }
                                    >
                                      {isCompleted ? '✅' : isSelected ? `${tripNumber}️⃣` : `${tripNumber}️⃣`}
                                    </button>
                                  );
                                })}
                              </div>
                              {delivery.currentTrip && !isDeliveryComplete && (
                                <p className="text-sm text-green-600 font-medium mt-1">
                                  {delivery.currentTrip === delivery.numberOfTrips 
                                    ? `✅ Última viagem (${delivery.currentTrip} de ${delivery.numberOfTrips})`
                                    : `✅ Fazendo viagem ${delivery.currentTrip} de ${delivery.numberOfTrips}`
                                  }
                                </p>
                              )}
                              {isDeliveryComplete && (
                                <p className="text-sm text-green-600 font-medium mt-1">
                                  ✅ Delivery completo - todas as {delivery.numberOfTrips} viagens foram concluídas
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Status Update Button */}
                        <div className="pt-3 border-t">
                          <div className="space-y-2">
                            {renderStatusButton(delivery)}
                          </div>
                        </div>

                        {/* Proof of Delivery Photos - Show after completion */}
                        {delivery.status === 'COMPLETE' && ((delivery.photoUrls && delivery.photoUrls.length > 0) || delivery.photoUrl) && (
                          <div className="pt-3 border-t">
                            <div className="flex items-start">
                              <div className="w-4 h-4 text-gray-400 mr-2 mt-0.5">📸</div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-700">Proof of Delivery:</span>
                                <div className="mt-2">
                                  {/* Display multiple photos if available, otherwise fall back to single photo */}
                                  {delivery.photoUrls && delivery.photoUrls.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-xs text-gray-600">{delivery.photoUrls.length} photo{delivery.photoUrls.length > 1 ? 's' : ''} uploaded</p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {delivery.photoUrls.map((photoUrl, index) => (
                                          <a
                                            key={index}
                                            href={photoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block"
                                            title={`Click to view photo ${index + 1} full-size`}
                                          >
                                            <img
                                              src={photoUrl}
                                              alt={`Proof of Delivery ${index + 1}`}
                                              className="w-full h-20 object-cover rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                              onError={(e) => {
                                                console.error(`Failed to load delivery photo ${index + 1}:`, photoUrl);
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          </a>
                                        ))}
                                      </div>
                                      <p className="text-xs text-gray-500">Click any photo to view full size</p>
                                    </div>
                                  ) : delivery.photoUrl ? (
                                    // Legacy single photo display
                                    <div>
                                      <a
                                        href={delivery.photoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block"
                                        title="Click to view full-size image"
                                      >
                                        <img
                                          src={delivery.photoUrl}
                                          alt="Proof of Delivery"
                                          className="max-w-[150px] h-auto object-cover rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                          onError={(e) => {
                                            console.error('Failed to load delivery photo:', delivery.photoUrl);
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      </a>
                                      <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                                    </div>
                                  ) : null}
                                  
                                  {/* Driver Comments - Show below photos */}
                                  {delivery.deliveryComment && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="bg-blue-50 p-3 rounded-md border-l-4 border-blue-400">
                                        <div className="flex items-start">
                                          <div className="w-4 h-4 text-blue-600 mr-2 mt-0.5">💬</div>
                                          <div className="flex-1">
                                            <span className="text-sm font-medium text-blue-800">Driver Comments:</span>
                                            <p className="text-sm text-blue-700 mt-1 whitespace-pre-wrap break-words">
                                              {delivery.deliveryComment}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trip Selection Modal */}
      {tripModalState.isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" style={{ zIndex: 10000 }}>
            {/* Header */}
            <div className="p-6 border-b bg-blue-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Selecionar Viagem
                  </h2>
                  <p className="text-sm text-gray-600">
                    {tripModalState.clientName}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Selecione qual viagem você está fazendo
                  </p>
                </div>
                <button
                  onClick={closeTripSelectionModal}
                  className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: tripModalState.numberOfTrips }, (_, index) => {
                  const tripNumber = index + 1;
                  const isCurrentTrip = tripNumber === tripModalState.currentTrip;
                  
                  return (
                    <button
                      key={tripNumber}
                      onClick={() => handleTripSelection(tripModalState.deliveryId!, tripNumber)}
                      className={`p-4 rounded-lg border-2 transition-all transform hover:scale-105 ${
                        isCurrentTrip
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {tripNumber}
                        </div>
                        <div className="text-sm">
                          Viagem {tripNumber}
                        </div>
                        {isCurrentTrip && (
                          <div className="text-xs text-blue-600 mt-1 font-medium">
                            Atual
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={closeTripSelectionModal}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {photoModalState.isOpen && (
        <PhotoUploadModal
          deliveryId={photoModalState.deliveryId!}
          clientName={photoModalState.clientName}
          onClose={closePhotoUploadModal}
          onComplete={handlePhotoUploadComplete}
          onUpload={handleMultiplePhotoUpload}
        />
      )}
    </div>
  );
};