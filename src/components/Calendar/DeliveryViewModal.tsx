import React from 'react';
import { X, Clock, Truck, MapPin, FileText, Package, Phone, Calendar, Edit, Trash2, User } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { useAuth } from '../../contexts/AuthContext';
import { updateDeliveryStatus } from '../../services/deliveryService';
import { getAllUsers } from '../../services/userService';
import { getTruckColor, getContrastTextColor, isDarkBackground } from '../../utils/truckTypes';

interface DeliveryViewModalProps {
  delivery: Delivery;
  onClose: () => void;
  onEdit?: (delivery: Delivery) => void;
  onDelete?: (deliveryId: string) => void;
}

export const DeliveryViewModal: React.FC<DeliveryViewModalProps> = ({ 
  delivery, 
  onClose, 
  onEdit, 
  onDelete 
}) => {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [driverName, setDriverName] = React.useState<string>('');

  // Load driver name when component mounts
  React.useEffect(() => {
    const loadDriverName = async () => {
      const driverEmail = delivery.startedBy || delivery.assignedDriver || delivery.lastUpdatedBy;
      if (driverEmail) {
        try {
          const result = await getAllUsers();
          if (result.success && result.users) {
            const driver = result.users.find(u => u.email === driverEmail);
            if (driver) {
              setDriverName(driver.name);
            } else {
              // Fallback to email username if user not found
              setDriverName(driverEmail.split('@')[0]);
            }
          } else {
            // Fallback to email username if can't load users
            setDriverName(driverEmail.split('@')[0]);
          }
        } catch (error) {
          console.error('Error loading driver name:', error);
          // Fallback to email username on error
          setDriverName(driverEmail.split('@')[0]);
        }
      }
    };

    loadDriverName();
  }, [delivery.startedBy, delivery.assignedDriver, delivery.lastUpdatedBy]);
  
  // Calculate actual duration from start and end times
  const getActualDuration = (delivery: Delivery): number => {
    if (delivery.startTime && delivery.endTime) {
      const startTime = delivery.startTime.split(':').map(Number);
      const endTime = delivery.endTime.split(':').map(Number);
      
      const startMinutes = startTime[0] * 60 + startTime[1];
      const endMinutes = endTime[0] * 60 + endTime[1];
      
      return endMinutes - startMinutes;
    }
    
    // Fallback to stored duration or estimated time
    return delivery.durationInMinutes || delivery.estimatedTravelTime || delivery.estimatedTimeMinutes || 60;
  };
  
  // Get truck color using the utility function
  const getTruckColorForDelivery = (delivery: Delivery): string => {
    if (delivery.entryType === 'internal') {
      return '#880015'; // Dark red for internal events
    } else if (delivery.entryType === 'equipmentMaintenance') {
      return getTruckColor(delivery.originStore, delivery.truckType);
    } else {
      return getTruckColor(delivery.originStore, delivery.truckType);
    }
  };
  
  const backgroundColor = getTruckColorForDelivery(delivery);
  const modalTextColor = getContrastTextColor(backgroundColor);
  const secondaryTextColor = isDarkBackground(backgroundColor) ? '#e0e0e0' : '#555555';
  
  const actualDurationMinutes = getActualDuration(delivery);
  
  // Normalize comparison strings for reliable matching
  const driverStore = (user?.assignedStore || '').toLowerCase().trim();
  const deliveryStore = (delivery.originStore || '').toLowerCase().trim();
  const isSameStore = driverStore === deliveryStore;
  
  // Check permissions based on user role and normalized store assignment
  const canEdit = user?.role === 'master';
  const isDriver = user?.role === 'driver';
  
  // Role-based access control for hold/resume functionality
  const isMaster = user?.role === 'master';
  const isSeller = user?.role === 'salesRep'; // Using salesRep as the seller role
  const isOnHold = delivery.status === 'On Hold';
  const isComplete = delivery.status === 'Complete' || delivery.status === 'complete' || delivery.status === 'COMPLETE';

  // Business rule: COMPLETE deliveries cannot be put on hold by anyone
  // Only non-complete deliveries can be put on hold
  const canShowHoldButton = (isSeller || isMaster) && !isOnHold && !isComplete;
  
  // Resume button: show for on-hold deliveries, but if complete delivery is on hold, only masters can resume
  const canShowResumeButton = (isSeller || isMaster) && isOnHold && (!isComplete || isMaster);

  // Handle status updates for hold/resume functionality
  const handleStatusUpdate = async (newStatus: string, userInfo?: { editedBy: string; editedByName: string }) => {
    // Show confirmation for putting delivery on hold
    if (newStatus === 'On Hold') {
      const confirmHold = window.confirm(
        `Are you sure you want to put this delivery ON HOLD?\n\n` +
        `Client: ${delivery.clientName}\n` +
        `Invoice: #${delivery.invoiceNumber}\n` +
        `Scheduled: ${formatDate(delivery.scheduledDate)} at ${formatTime(delivery.scheduledTime)}\n\n` +
        `This will pause the delivery until it is resumed.`
      );
      
      if (!confirmHold) {
        return; // User cancelled, don't proceed with status update
      }
    }
    
    setIsUpdating(true);
    try {
      const result = await updateDeliveryStatus(delivery.id, newStatus, userInfo);
      if (result.success) {
        // Close modal and let parent component refresh
        onClose();
        // Trigger a page refresh to show updated status
        window.location.reload();
      } else {
        alert('Failed to update delivery status: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('An error occurred while updating the delivery status');
    } finally {
      setIsUpdating(false);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      // Standard workflow statuses (matching driver dashboard)
      'pending': { color: 'bg-gray-500', label: 'PENDING' },
      'Pending': { color: 'bg-gray-500', label: 'PENDING' },
      'GETTING LOAD': { color: 'bg-yellow-500', label: 'GETTING LOAD' },
      'Getting Load': { color: 'bg-yellow-500', label: 'GETTING LOAD' },
      'ON THE WAY': { color: 'bg-blue-500', label: 'ON THE WAY' },
      'On the Way': { color: 'bg-blue-500', label: 'ON THE WAY' },
      'COMPLETE': { color: 'bg-green-500', label: 'COMPLETE' },
      'Complete': { color: 'bg-green-500', label: 'COMPLETE' },
      
      // Legacy/alternative statuses
      'assigned': { color: 'bg-blue-400', label: 'ASSIGNED' },
      'Accepted': { color: 'bg-blue-400', label: 'ACCEPTED' },
      'In Transit': { color: 'bg-blue-500', label: 'IN TRANSIT' },
      'Delivered': { color: 'bg-green-500', label: 'DELIVERED' },
      
      // Special statuses
      'On Hold': { color: 'bg-orange-500', label: 'ON HOLD' },
      'Cancelled': { color: 'bg-red-500', label: 'CANCELLED' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'bg-gray-500', label: status.toUpperCase() };
    
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white ${config.color} shadow-sm`}>
        {config.label}
      </div>
    );
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(delivery);
      onClose();
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to cancel this delivery?')) {
      if (onDelete) {
        onDelete(delivery.id);
        onClose();
      }
    }
  };

  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header with truck color background */}
        <div 
          className="p-6 border-b rounded-t-lg"
          style={{ 
            backgroundColor: backgroundColor,
            color: modalTextColor
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">
                {delivery.entryType === 'internal' ? 
                  delivery.clientName.toUpperCase() + ' (INTERNAL)' : 
                  delivery.entryType === 'equipmentMaintenance' ?
                  delivery.clientName.toUpperCase() + ' (MAINTENANCE)' :
                  delivery.clientName
                }
              </h2>
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {delivery.truckType} - {delivery.originStore}
                </span>
              </div>
              {/* Driver Name - Show if delivery has been started by a driver */}
              {(delivery.startedBy || delivery.assignedDriver || delivery.lastUpdatedBy) && (
                <div className="flex items-center space-x-2 mt-1">
                  <User className="w-4 h-4" />
                  <span className="text-sm" style={{ color: secondaryTextColor }}>
                    Driver: {driverName || 'Loading...'}
                  </span>
                </div>
              )}
            </div>
            {!isUpdating && (
              <button
                onClick={onClose}
                className="p-1 rounded-full transition-colors ml-4"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: modalTextColor
                }}
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            {getStatusBadge(delivery.status)}
          </div>

          {/* Client Name */}
          <div className="flex items-start space-x-3">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Name:</span>
              <p className="text-gray-900">{delivery.clientName}</p>
            </div>
          </div>

          {/* Invoice Number - Only show for deliveries, not internal events or maintenance */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Invoice Number:</span>
              <p className="text-gray-900">#{delivery.invoiceNumber}</p>
            </div>
          </div>
          )}

          {/* Delivery Address - Only show for deliveries, not internal events or maintenance */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <MapPin className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Address:</span>
              {(delivery.deliveryAddress || delivery.address) ? (
                <p className="text-gray-900 break-words">
                  {delivery.deliveryAddress || delivery.address}
                </p>
              ) : (
                <p className="text-gray-500 italic">Address not provided</p>
              )}
            </div>
          </div>
          )}

          {/* Client Phone Number - Only show for deliveries, not internal events or maintenance */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <Phone className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Client Phone Number:</span>
              {(delivery.clientPhone || delivery.phone || delivery.customerPhone) ? (
                <a
                  href={`tel:${(delivery.clientPhone || delivery.phone || delivery.customerPhone || '').replace(/\D/g, '')}`}
                  className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors font-medium block mt-1"
                  title="Call client"
                >
                  {delivery.clientPhone || delivery.phone || delivery.customerPhone}
                </a>
              ) : (
                <p className="text-gray-500 italic mt-1">Phone number not provided</p>
              )}
            </div>
          </div>
          )}

          {/* Number of Trips - Only show for deliveries, not internal events or maintenance */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <Truck className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Number of Trips:</span>
              <p className="text-gray-900">{delivery.numberOfTrips || delivery.trips || 1}</p>
            </div>
          </div>
          )}

          {/* Material Description - Only show for deliveries, not internal events or maintenance */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <Package className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Material Description:</span>
              {(delivery.materialDescription || delivery.material || delivery.description) ? (
                <p className="text-gray-900 break-words mt-1">{delivery.materialDescription}</p>
              ) : (
                <p className="text-gray-500 italic mt-1">No description provided</p>
              )}
            </div>
          </div>
          )}

          {/* Additional Notes */}
          {(delivery.additionalNotes || delivery.notes) && (
            <div className="flex items-start space-x-3">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {delivery.entryType === 'equipmentMaintenance' ? 'Maintenance Notes:' : 'Additional Notes:'}
                </span>
                <p className="text-gray-900 whitespace-pre-wrap break-words mt-1">{delivery.additionalNotes || delivery.notes}</p>
              </div>
            </div>
          )}

          {/* Truck Information */}
          <div className="flex items-start space-x-3">
            <Truck className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Truck & Store:</span>
              <div className="flex items-center space-x-2 mt-1">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: backgroundColor }}
                  title={`${delivery.originStore} - ${delivery.truckType}`}
                />
                <p className="text-gray-900">{delivery.truckType} ({delivery.originStore})</p>
              </div>
            </div>
          </div>

          {/* Scheduled Date & Time */}
          <div className="flex items-start space-x-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700">Scheduled:</span>
              <p className="text-gray-900 mt-1">
                {formatDate(delivery.scheduledDate)} at {formatTime(delivery.scheduledTime)}
              </p>
            </div>
          </div>

          {/* Delivery Photo */}
          {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
          <div className="flex items-start space-x-3">
            <div className="w-4 h-4 text-gray-400 mt-0.5">📸</div>
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">Proof of Delivery:</span>
              {(delivery.photoUrls && delivery.photoUrls.length > 0) || delivery.photoUrl ? (
                <div className="mt-2">
                  {/* Display multiple photos if available, otherwise fall back to single photo */}
                  {delivery.photoUrls && delivery.photoUrls.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">{delivery.photoUrls.length} photo{delivery.photoUrls.length > 1 ? 's' : ''} available</p>
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
                            const parent = e.currentTarget.parentElement?.parentElement;
                            if (parent) {
                              parent.innerHTML = '<p class="text-gray-500 italic mt-1">Failed to load delivery photo</p>';
                            }
                          }}
                        />
                      </a>
                      <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-gray-500 italic mt-1">No delivery photo available</p>
              )}
            </div>
          </div>
          )}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Creation & Edit History</h4>
            
            <div className="space-y-3">
              {/* Created By */}
              <div className="flex items-start space-x-3">
                <div className="w-4 h-4 text-gray-400 flex items-center justify-center mt-0.5">
                  👤
                </div>
                <div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Created by:</span>
                    <span className="ml-1 text-gray-900">{delivery.createdByName || delivery.createdBy || 'Unknown User'}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Date & Time:</span>
                    <span className="ml-1">
                      {delivery.createdAt ? 
                        new Date(delivery.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        }) : 
                        'Unknown Date'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit History - Show all edits chronologically */}
              {delivery.editHistory && delivery.editHistory.filter(edit => edit.action === 'edited').length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-700 mb-2">Edit History:</div>
                  <div className="space-y-2">
                    {delivery.editHistory
                      .filter(edit => edit.action === 'edited')
                      .map((edit, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="w-4 h-4 text-gray-400 flex items-center justify-center mt-0.5">
                            ✏️
                          </div>
                          <div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Edit By:</span>
                              <span className="ml-1 text-gray-900">{edit.editedByName || edit.editedBy}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Date & Time:</span>
                              <span className="ml-1">
                                {new Date(edit.editedAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                            {edit.changes && (
                              <div className="text-xs text-gray-500 mt-1 italic">
                                {edit.changes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Status Updates - Show recent status changes */}
              {delivery.editHistory && delivery.editHistory.filter(edit => edit.action === 'status_changed').length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-700 mb-2">Recent Status Updates:</div>
                  <div className="space-y-2">
                    {delivery.editHistory
                      .filter(edit => edit.action === 'status_changed')
                      .slice(-3) // Show last 3 status changes
                      .map((edit, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="w-4 h-4 text-gray-400 flex items-center justify-center mt-0.5">
                            🔄
                          </div>
                          <div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Status Updated by:</span>
                              <span className="ml-1 text-gray-900">{edit.editedByName || edit.editedBy}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Date & Time:</span>
                              <span className="ml-1">
                                {new Date(edit.editedAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                            {edit.changes && (
                              <div className="text-xs text-gray-500 mt-1 italic">
                                {edit.changes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-end space-x-3">
            {/* Put On Hold Button - Show to Sellers/Masters (except if Complete or already On Hold) */}
            {canShowHoldButton && (
              <button
                onClick={() => handleStatusUpdate('On Hold', {
                  editedBy: user?.email || user?.username || 'Unknown',
                  editedByName: user?.name || user?.username || 'Unknown User'
                })}
                disabled={isUpdating}
                style={{
                  backgroundColor: '#fd7e14',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  opacity: isUpdating ? 0.6 : 1,
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {isUpdating ? 'Updating...' : 'Put On Hold'}
              </button>
            )}
            
            {/* Resume Button - Show for on-hold deliveries */}
            {canShowResumeButton && (
              <button
                onClick={() => handleStatusUpdate('Pending', {
                  editedBy: user?.email || user?.username || 'Unknown',
                  editedByName: user?.name || user?.username || 'Unknown User'
                })}
                disabled={isUpdating}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                {isUpdating ? 'Updating...' : 'Resume'}
              </button>
            )}

            {/* Edit Button - Show to Masters */}
            {canEdit && onEdit && (
              <button
                onClick={handleEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
            )}

            {/* Delete Button - Show to Masters */}
            {canEdit && onDelete && (
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};