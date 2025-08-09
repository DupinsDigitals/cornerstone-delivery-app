import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Calendar, Clock, MapPin, Phone, User, FileText, Package, Truck, Calculator } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { useAuth } from '../../contexts/AuthContext';
import { saveDeliveryToFirestore } from '../../services/deliveryService';
import { TRUCK_TYPES, getTruckColor, getContrastTextColor } from '../../utils/truckTypes';
import { calculateTravelTime, validateAddress } from '../../utils/googleMaps';

interface DeliveryFormProps {
  onSubmit: (delivery: Delivery) => void;
  onCancel: () => void;
  editingDelivery?: Delivery | null;
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  onSubmit,
  onCancel,
  editingDelivery
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingTime, setIsCalculatingTime] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data with existing delivery data or defaults
  const [formData, setFormData] = useState({
    clientName: editingDelivery?.clientName || '',
    clientPhone: editingDelivery?.clientPhone || '',
    deliveryAddress: editingDelivery?.deliveryAddress || '',
    originStore: editingDelivery?.originStore || user?.assignedStore || 'Framingham',
    truckType: editingDelivery?.truckType || 'Flatbed',
    invoiceNumber: editingDelivery?.invoiceNumber || '',
    materialDescription: editingDelivery?.materialDescription || '',
    numberOfTrips: editingDelivery?.numberOfTrips || 1,
    additionalNotes: editingDelivery?.additionalNotes || '',
    scheduledDate: editingDelivery?.scheduledDate || new Date().toISOString().split('T')[0],
    scheduledTime: editingDelivery?.scheduledTime || '08:00',
    endTime: editingDelivery?.endTime || '',
    estimatedTravelTime: editingDelivery?.estimatedTravelTime || 60,
    entryType: editingDelivery?.entryType || 'regular',
    type: editingDelivery?.type || 'delivery',
    repeat: editingDelivery?.repeat || 'none',
    repeatUntil: editingDelivery?.repeatUntil || '',
    isRecurring: editingDelivery?.isRecurring || false
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Update form data when editingDelivery changes
  useEffect(() => {
    if (editingDelivery) {
      setFormData({
        clientName: editingDelivery.clientName || '',
        clientPhone: editingDelivery.clientPhone || '',
        deliveryAddress: editingDelivery.deliveryAddress || '',
        originStore: editingDelivery.originStore || user?.assignedStore || 'Framingham',
        truckType: editingDelivery.truckType || 'Flatbed',
        invoiceNumber: editingDelivery.invoiceNumber || '',
        materialDescription: editingDelivery.materialDescription || '',
        numberOfTrips: editingDelivery.numberOfTrips || 1,
        additionalNotes: editingDelivery.additionalNotes || '',
        scheduledDate: editingDelivery.scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: editingDelivery.scheduledTime || '08:00',
        endTime: editingDelivery.endTime || '',
        estimatedTravelTime: editingDelivery.estimatedTravelTime || 60,
        entryType: editingDelivery.entryType || 'regular',
        type: editingDelivery.type || 'delivery',
        repeat: editingDelivery.repeat || 'none',
        repeatUntil: editingDelivery.repeatUntil || '',
        isRecurring: editingDelivery.isRecurring || false
      });
    }
  }, [editingDelivery, user?.assignedStore]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (window.google && addressInputRef.current && formData.entryType === 'regular') {
      const autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'address_components', 'geometry']
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setFormData(prev => ({
            ...prev,
            deliveryAddress: place.formatted_address
          }));
          // Clear any previous address errors
          setErrors(prev => ({ ...prev, deliveryAddress: '' }));
        }
      });
    }
  }, [formData.entryType]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Auto-calculate end time when scheduled time or estimated time changes
    if ((field === 'scheduledTime' || field === 'estimatedTravelTime') && formData.entryType === 'regular') {
      const schedTime = field === 'scheduledTime' ? value as string : formData.scheduledTime;
      const estTime = field === 'estimatedTravelTime' ? value as number : formData.estimatedTravelTime;
      
      if (schedTime && estTime) {
        const [hours, minutes] = schedTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate.getTime() + (estTime * 60 * 1000));
        const endTimeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        
        setFormData(prev => ({
          ...prev,
          endTime: endTimeStr
        }));
      }
    }
  };

  const handleCalculateTravelTime = async () => {
    if (!formData.deliveryAddress || !formData.originStore) {
      setErrors(prev => ({
        ...prev,
        deliveryAddress: 'Please enter a delivery address first'
      }));
      return;
    }

    if (!validateAddress(formData.deliveryAddress)) {
      setErrors(prev => ({
        ...prev,
        deliveryAddress: 'Please enter a valid address'
      }));
      return;
    }

    setIsCalculatingTime(true);
    setErrors(prev => ({ ...prev, deliveryAddress: '' }));

    try {
      const result = await calculateTravelTime(
        formData.originStore as 'Framingham' | 'Marlborough',
        formData.deliveryAddress
      );

      if (result.success && result.travelTimeMinutes) {
        handleInputChange('estimatedTravelTime', result.travelTimeMinutes);
      } else {
        setErrors(prev => ({
          ...prev,
          deliveryAddress: result.error || 'Could not calculate travel time'
        }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        deliveryAddress: 'Error calculating travel time'
      }));
    } finally {
      setIsCalculatingTime(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Required fields validation
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    if (formData.entryType === 'regular' && !formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Client phone is required';
    }

    if (formData.entryType === 'regular' && !formData.deliveryAddress.trim()) {
      newErrors.deliveryAddress = 'Delivery address is required';
    }

    if (formData.entryType === 'regular' && !formData.invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Invoice number is required';
    }

    if (formData.entryType === 'regular' && !formData.materialDescription.trim()) {
      newErrors.materialDescription = 'Material description is required';
    }

    if (!formData.scheduledDate) {
      newErrors.scheduledDate = 'Scheduled date is required';
    }

    if (!formData.scheduledTime) {
      newErrors.scheduledTime = 'Scheduled time is required';
    }

    if (formData.entryType === 'regular' && formData.numberOfTrips < 1) {
      newErrors.numberOfTrips = 'Number of trips must be at least 1';
    }

    // Phone number format validation
    if (formData.entryType === 'regular' && formData.clientPhone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.clientPhone.replace(/\D/g, ''))) {
        newErrors.clientPhone = 'Please enter a valid phone number';
      }
    }

    // Date validation - cannot be in the past
    const selectedDate = new Date(formData.scheduledDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      newErrors.scheduledDate = 'Scheduled date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const deliveryData: Partial<Delivery> = {
        ...formData,
        id: editingDelivery?.id,
        status: editingDelivery?.status || 'PENDING',
        createdBy: editingDelivery?.createdBy || user?.email || user?.username || 'Unknown',
        createdByName: editingDelivery?.createdByName || user?.name || user?.username || 'Unknown User',
        createdAt: editingDelivery?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastEditedBy: user?.email || user?.username || 'Unknown',
        lastEditedByName: user?.name || user?.username || 'Unknown User',
        lastEditedAt: new Date().toISOString(),
        // Preserve existing fields that shouldn't be overwritten
        startedBy: editingDelivery?.startedBy,
        assignedDriver: editingDelivery?.assignedDriver,
        assignedTruck: editingDelivery?.assignedTruck,
        claimedAt: editingDelivery?.claimedAt,
        photoUrl: editingDelivery?.photoUrl,
        photoUrls: editingDelivery?.photoUrls,
        editHistory: editingDelivery?.editHistory || []
      };

      const result = await saveDeliveryToFirestore(deliveryData);

      if (result.success) {
        onSubmit(deliveryData as Delivery);
      } else {
        alert('Failed to save delivery: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving delivery:', error);
      alert('An error occurred while saving the delivery');
    } finally {
      setIsLoading(false);
    }
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

  // Get form title based on entry type
  const getFormTitle = () => {
    if (editingDelivery) {
      switch (formData.entryType) {
        case 'internal':
          return 'Edit Internal Event';
        case 'equipmentMaintenance':
          return 'Edit Equipment Maintenance';
        default:
          return 'Edit Delivery';
      }
    } else {
      switch (formData.entryType) {
        case 'internal':
          return 'Schedule Internal Event';
        case 'equipmentMaintenance':
          return 'Schedule Equipment Maintenance';
        default:
          return 'Schedule New Delivery';
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {getFormTitle()}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Cancel"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Entry Type *
          </label>
          <select
            value={formData.entryType}
            onChange={(e) => handleInputChange('entryType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="regular">Regular Delivery</option>
            <option value="internal">Internal Event</option>
            <option value="equipmentMaintenance">Equipment Maintenance</option>
          </select>
          
          {/* Truck Color Visual Indicators */}
          <div className="mt-3">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {formData.originStore} Truck Types:
            </div>
            <div className="flex flex-wrap gap-2">
              {(TRUCK_TYPES[formData.originStore as keyof typeof TRUCK_TYPES] || []).map((truck) => {
                const truckColor = getTruckColor(formData.originStore, truck);
                const textColor = getContrastTextColor(truckColor);
                const isSelected = formData.truckType === truck;
                const shortName = truck.replace(' (22 tons)', '').replace(' (10 tons)', '');
                
                return (
                  <button
                    key={truck}
                    type="button"
                    onClick={() => handleInputChange('truckType', truck)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: truckColor,
                      color: textColor
                    }}
                    title={truck}
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className={`grid grid-cols-1 ${formData.entryType === 'regular' ? 'md:grid-cols-2' : ''} gap-6`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              {formData.entryType === 'internal' ? 'Event Name *' : 
               formData.entryType === 'equipmentMaintenance' ? 'Equipment/Task Name *' : 
               'Client Name *'}
            </label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => handleInputChange('clientName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.clientName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={
                formData.entryType === 'internal' ? 'Enter event name' :
                formData.entryType === 'equipmentMaintenance' ? 'Enter equipment/task name' :
                'Enter client name'
              }
            />
            {errors.clientName && (
              <p className="mt-1 text-sm text-red-600">{errors.clientName}</p>
            )}
          </div>

          {formData.entryType === 'regular' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Client Phone *
              </label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.clientPhone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter client phone number"
              />
              {errors.clientPhone && (
                <p className="mt-1 text-sm text-red-600">{errors.clientPhone}</p>
              )}
            </div>
          )}
        </div>

        {/* Delivery Address */}
        {formData.entryType === 'regular' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Delivery Address *
            </label>
            <div className="flex space-x-2">
              <input
                ref={addressInputRef}
                type="text"
                value={formData.deliveryAddress}
                onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.deliveryAddress ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter delivery address"
              />
              <button
                type="button"
                onClick={handleCalculateTravelTime}
                disabled={isCalculatingTime || !formData.deliveryAddress}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isCalculatingTime ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.deliveryAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.deliveryAddress}</p>
            )}
          </div>
        )}

        {/* Store and Truck Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              {formData.entryType === 'equipmentMaintenance' ? 'Equipment Location *' : 'Origin Store *'}
            </label>
            <select
              value={formData.originStore}
              onChange={(e) => handleInputChange('originStore', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="Framingham">Framingham</option>
              <option value="Marlborough">Marlborough</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="w-4 h-4 inline mr-1" />
              {formData.entryType === 'equipmentMaintenance' ? 'Equipment Type *' : 'Truck Type *'}
            </label>
            <select
              value={formData.truckType}
              onChange={(e) => handleInputChange('truckType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {(TRUCK_TYPES[formData.originStore as keyof typeof TRUCK_TYPES] || []).map((truck) => (
                <option key={truck} value={truck}>
                  {truck}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Invoice and Material */}
        {formData.entryType === 'regular' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Invoice Number *
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.invoiceNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter invoice number"
              />
              {errors.invoiceNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.invoiceNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="w-4 h-4 inline mr-1" />
                Number of Trips *
              </label>
              <input
                type="number"
                min="1"
                value={formData.numberOfTrips}
                onChange={(e) => handleInputChange('numberOfTrips', parseInt(e.target.value) || 1)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.numberOfTrips ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.numberOfTrips && (
                <p className="mt-1 text-sm text-red-600">{errors.numberOfTrips}</p>
              )}
            </div>
          </div>
        )}

        {/* Material Description */}
        {formData.entryType === 'regular' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Material Description *
            </label>
            <textarea
              value={formData.materialDescription}
              onChange={(e) => handleInputChange('materialDescription', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.materialDescription ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe the material to be delivered"
            />
            {errors.materialDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.materialDescription}</p>
            )}
          </div>
        )}

        {/* Schedule Information */}
        <div className={`grid grid-cols-1 ${formData.entryType === 'regular' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Scheduled Date *
            </label>
            <input
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.scheduledDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.scheduledDate && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduledDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Start Time *
            </label>
            <input
              type="time"
              value={formData.scheduledTime}
              onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.scheduledTime ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.scheduledTime && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduledTime}</p>
            )}
          </div>

          {formData.entryType === 'regular' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                End Time
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Auto-calculated based on estimated time
              </p>
            </div>
          )}
        </div>

        {/* Estimated Travel Time */}
        {formData.entryType === 'regular' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Estimated Total Time (minutes)
            </label>
            <input
              type="number"
              min="30"
              step="15"
              value={formData.estimatedTravelTime}
              onChange={(e) => handleInputChange('estimatedTravelTime', parseInt(e.target.value) || 60)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Current estimate: {formatDuration(formData.estimatedTravelTime)} 
              (includes round trip + loading/unloading time)
            </p>
          </div>
        )}

        {/* Recurring Settings - Show for all entry types */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {formData.entryType === 'internal' ? 'Recurring Event Settings' :
             formData.entryType === 'equipmentMaintenance' ? 'Recurring Maintenance Settings' :
             'Recurring Delivery Settings'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat
              </label>
              <select
                value={formData.repeat}
                onChange={(e) => handleInputChange('repeat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Mon-Fri)</option>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            {formData.repeat !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat Until
                </label>
                <input
                  type="date"
                  value={formData.repeatUntil}
                  onChange={(e) => handleInputChange('repeatUntil', e.target.value)}
                  min={formData.scheduledDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
          </div>

          {formData.repeat !== 'none' && formData.repeatUntil && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Preview:</strong> This will create multiple entries from{' '}
                {new Date(formData.scheduledDate + 'T00:00:00').toLocaleDateString()} to{' '}
                {new Date(formData.repeatUntil + 'T00:00:00').toLocaleDateString()}{' '}
                {formData.repeat === 'weekly' ? '(Monday-Friday only)' : `(${formData.repeat})`}
                {formData.scheduledTime && formData.endTime && 
                  ` from ${formData.scheduledTime} to ${formData.endTime}`
                }
              </p>
            </div>
          )}
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            {formData.entryType === 'internal' ? 'Event Details' :
             formData.entryType === 'equipmentMaintenance' ? 'Maintenance Notes' :
             'Additional Notes'}
          </label>
          <textarea
            value={formData.additionalNotes}
            onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={
              formData.entryType === 'internal' ? 'Describe the internal event details' :
              formData.entryType === 'equipmentMaintenance' ? 'Describe the maintenance work needed' :
              'Any additional notes or special instructions'
            }
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editingDelivery ? 
                  (formData.entryType === 'internal' ? 'Update Event' :
                   formData.entryType === 'equipmentMaintenance' ? 'Update Maintenance' :
                   'Update Delivery') :
                  (formData.entryType === 'internal' ? 'Schedule Event' :
                   formData.entryType === 'equipmentMaintenance' ? 'Schedule Maintenance' :
                   'Schedule Delivery')
                }
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};