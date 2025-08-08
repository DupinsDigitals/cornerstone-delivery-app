import React, { useState, useEffect } from 'react';
import { Truck, Clock, MapPin, Phone, Package, LogOut, Camera, Upload } from 'lucide-react';
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

  // Status progression mapping
  const getNextStatus = (currentStatus: string): string => {
    switch (currentStatus) {
      case 'pending':
      case 'Pending':
        return 'GETTING LOAD';
      case 'GETTING LOAD':
        return 'ON THE WAY';
      case 'ON THE WAY':
        return 'COMPLETE';
      default:
        return currentStatus; // No change for COMPLETE or unknown statuses
    }
  };

  // Status regression mapping (undo functionality)
  const getPreviousStatus = (currentStatus: string): string => {
    switch (currentStatus) {
      case 'GETTING LOAD':
        return 'pending';
      case 'ON THE WAY':
        return 'GETTING LOAD';
      default:
        return currentStatus; // No change for PENDING or COMPLETE
    }
  };

  // Get status button styling
  const getStatusButtonStyle = (status: string) => {
    switch (status) {
      case 'pending':
      case 'Pending':
        return {
          backgroundColor: '#6B7280', // Gray
          color: '#FFFFFF',
          label: 'PENDING'
        };
      case 'GETTING LOAD':
        return {
          backgroundColor: '#F59E0B', // Yellow/Amber
          color: '#000000',
          label: 'GETTING LOAD'
        };
      case 'ON THE WAY':
        return {
          backgroundColor: '#3B82F6', // Blue
          color: '#FFFFFF',
          label: 'ON THE WAY'
        };
      case 'COMPLETE':
        return {
          backgroundColor: '#10B981', // Green
          color: '#FFFFFF',
          label: 'COMPLETE'
        };
      case 'On Hold':
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
        
        // Sort deliveries by scheduled time (earliest first)
        const sortedDeliveries = filteredDeliveries.sort((a, b) => {
          // Parse time strings (HH:MM format) for comparison
          const timeA = a.scheduledTime.split(':').map(Number);
          const timeB = b.scheduledTime.split(':').map(Number);
          
          // Convert to minutes for easy comparison
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
  // ⏳ Atualiza a lista de deliveries antes de checar
  await loadTodaysDeliveries();

  // 🚫 BLOCK if this driver has another delivery already started (not complete)
  const isStarting = ['getting load', 'on the way'].includes(newStatus.trim().toLowerCase());

  if (isStarting) {
    const activeDeliveries = deliveries.filter(d =>
      d.startedBy === user?.email &&
      d.id !== delivery.id &&
      d.status?.trim().toLowerCase() !== 'complete'
    );

    console.log('🧱 Active Deliveries Check (with newStatus logic):', activeDeliveries);

    if (activeDeliveries.length > 0) {
      alert("You already have a delivery in progress. Please complete it before starting another.");
      return;
    }
  }

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
      const isOwner = delivery.startedBy === user?.email;
      const notStarted = !delivery.startedBy;

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: user?.email,
        lastUpdatedByName: user?.name || user?.email || 'Unknown Driver'
      };

      // If starting a delivery (moving from PENDING), claim ownership
      if ((delivery.status === 'pending' || delivery.status === 'Pending') && !delivery.startedBy) {
        updateData.startedBy = user?.email;
        updateData.assignedDriver = user?.email;
        updateData.assignedTruck = delivery.truckType;
        updateData.claimedAt = new Date().toISOString();
      }

      const result = await updateDeliveryStatus(delivery.id, newStatus, updateData);
      
      if (result.success) {
        await loadTodaysDeliveries();
      } else {
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
  const handlePhotoUploadComplete = async (photoUrls: string[]) => {
    const deliveryId = photoModalState.deliveryId;
    if (!deliveryId) return;

    try {
      // Update delivery status to COMPLETE with photo URLs
      const updateData = {
        status: 'COMPLETE',
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: user?.email,
        lastUpdatedByName: user?.name || user?.email || 'Unknown Driver',
        photoUrls: photoUrls,
        photoUrl: photoUrls[0], // Keep legacy single photo field for backward compatibility
        completedAt: new Date().toISOString()
      };
      
      const result = await updateDeliveryStatus(deliveryId, 'COMPLETE', updateData);
      
      if (result.success) {
        // Close modal and refresh deliveries
        setPhotoModalState({ deliveryId: null, clientName: '', isOpen: false });
        await loadTodaysDeliveries();
        alert(`📸 ${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''} uploaded and delivery marked as complete!`);
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

  const handleStatusButtonClick = (delivery: Delivery) => {
    // Master Drivers cannot interact with status buttons
    if (isMasterDriver) {
      return;
    }
    
    // Check if delivery is locked (being updated)
    if (lockedDeliveries.has(delivery.id)) {
      return; // Silently ignore if locked
    }

    // CRITICAL: Block access for ANY delivery owned by another driver
    const isOwnedByAnotherDriver = delivery.startedBy && delivery.startedBy !== user?.email;
    if (isOwnedByAnotherDriver) {
      alert('This delivery is currently in progress by another driver and cannot be edited.');
      return;
    }

    const isOwner = delivery.startedBy === user?.email;
    const notStarted = !delivery.startedBy;
    const currentStatus = delivery.status;
    const nextStatus = getNextStatus(currentStatus);
    
    // Special handling for COMPLETE status - require photo
    if (nextStatus === 'COMPLETE') {
  if (isOwner) {
    showPhotoUploadModal(delivery.id, delivery.clientName);
  } else {
    alert(`This delivery was started by ${delivery.lastUpdatedByName || delivery.startedBy?.split('@')[0] || 'another driver'} and can only be completed by them.`);
  }
  return;
}
    
    // Allow progression if:
    // 1. Delivery is not started (PENDING) - anyone can start
    // 2. Delivery is started by this driver - only they can progress
    if (notStarted || isOwner) {
      if (nextStatus !== currentStatus) {
await handleStatusUpdate(delivery, nextStatus, await loadTodaysDeliveries());
}

  const handleUndoClick = (delivery: Delivery) => {
    // Master Drivers cannot undo status changes
    if (isMasterDriver) {
      return;
    }
    
    // Check if delivery is locked (being updated)
    if (lockedDeliveries.has(delivery.id)) {
      return; // Silently ignore if locked
    }
    
    const isOwner = delivery.startedBy === user?.email;
    const currentStatus = delivery.status;
    
    // Only allow undo if:
    // 1. Driver owns this delivery
    // 2. Status is not COMPLETE
    // 3. Status is not PENDING (can't go back from start)
    if (isOwner && currentStatus !== 'COMPLETE' && currentStatus !== 'pending' && currentStatus !== 'Pending') {
      const previousStatus = getPreviousStatus(currentStatus);
      if (previousStatus !== currentStatus) {
        handleStatusUpdate(delivery, previousStatus);
      }
    }
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
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const renderStatusButton = (delivery: Delivery) => {
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
    
    const isOwner = delivery.startedBy === user?.email;
    const notStarted = !delivery.startedBy;
    const status = delivery.status;
    const isUpdating = updatingDelivery === delivery.id;
    const isLocked = lockedDeliveries.has(delivery.id);
    const statusStyle = getStatusButtonStyle(status);
    const nextStatus = getNextStatus(status);
    const canUpdate = notStarted || isOwner;
    const isComplete = status === 'COMPLETE';
    const canUndo = isOwner && !isComplete && status !== 'pending' && status !== 'Pending';
    const isAboutToComplete = nextStatus === 'COMPLETE';

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

    // This code is now unreachable since we block at the top of handleStatusButtonClick
    // But keeping for safety in case of edge cases
    const isOwnedByAnotherDriver = delivery.startedBy && delivery.startedBy !== user?.email;
    if (isOwnedByAnotherDriver) {
      const ownerInfo = delivery.startedBy;
      return (
        <div className="flex items-center space-x-2">
          <button
            disabled
            className="flex-1 px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-bold cursor-not-allowed"
            title={`This delivery is being handled by ${ownerInfo}`}
          >
            🚫 DRIVER: {ownerInfo?.split('@')[0]?.toUpperCase() || 'OTHER'}
          </button>
        </div>
      );
    }
    
    if (!canUpdate) {
  const ownerName = delivery.lastUpdatedByName || delivery.startedBy?.split('@')[0]?.toUpperCase() || 'ANOTHER DRIVER';
  const statusStyle = getStatusButtonStyle(delivery.status);

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => alert(`This delivery was started by ${ownerName}. You cannot update its status.`)}
        className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm cursor-not-allowed"
        style={{
          backgroundColor: statusStyle.backgroundColor,
          color: statusStyle.color,
          opacity: 0.5
        }}
        title={`Started by ${ownerName}`}
      >
        🚫 {statusStyle.label}
        <span className="block text-xs opacity-75">
          Locked by {ownerName}
        </span>
      </button>
    </div>
  );
}
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => handleStatusButtonClick(delivery)}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
          style={{
            backgroundColor: statusStyle.backgroundColor,
            color: statusStyle.color
          }}
          title={nextStatus !== status ? `Click to change to ${nextStatus}` : 'Delivery complete'}
        >
          {statusStyle.label}
          {isAboutToComplete ? (
            <span className="block text-xs opacity-75">
              Tap to → Add Photos
            </span>
          ) : nextStatus !== status && (
            <span className="block text-xs opacity-75">
              Tap to → {nextStatus}
            </span>
          )}
        </button>
        {canUndo && (
          <button
            onClick={() => handleUndoClick(delivery)}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-all hover:bg-gray-300 active:scale-95 whitespace-nowrap flex-shrink-0"
            title={`Go back to ${getPreviousStatus(status)}`}
          >
            ↶ Undo
          </button>
        )}
      </div>
    );
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
                          {delivery.clientName}
                        </h3>
                        <p className="text-sm opacity-90 mb-2">
                          Invoice #{delivery.invoiceNumber}
                        </p>
                        <div className="flex items-center text-sm opacity-80">
                          <Truck className="w-3 h-3 mr-1" />
                          {delivery.truckType}
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
                            <p className="text-gray-900">{formatTime(delivery.scheduledTime)}</p>
                          </div>
                        </div>

                        <div className="flex items-start">
                          <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-700">Address:</span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.deliveryAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors block mt-1 break-words"
                              title="Open in Google Maps"
                            >
                              {delivery.deliveryAddress}
                            </a>
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
                            <a
                              href={`tel:${delivery.clientPhone.replace(/\D/g, '')}`}
                              className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors block mt-1 font-medium"
                              title="Call client"
                            >
                              {delivery.clientPhone}
                            </a>
                          </div>
                        </div>

                        {delivery.additionalNotes && (
                          <div className="flex items-start">
                            <div className="w-4 h-4 text-gray-400 mr-2 mt-0.5">📝</div>
                            <div>
                              <span className="font-medium text-gray-700">Notes:</span>
                              <p className="text-gray-900 italic">{delivery.additionalNotes}</p>
                            </div>
                          </div>
                        )}

                        {/* Status Update Button */}
                        <div className="pt-3 border-t">
                          <div className="space-y-2">
                            {renderStatusButton(delivery)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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