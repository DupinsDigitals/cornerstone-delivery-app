import React, { useState } from 'react';
import { Save, MapPin, Clock, Timer, CheckCircle, AlertCircle } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { useAuth } from '../../contexts/AuthContext';
import { TRUCK_TYPES, getTruckColor, getContrastTextColor } from '../../utils/truckTypes';
import { saveDelivery } from '../../utils/storage';
import { saveDeliveryToFirestore, handleScheduleDelivery } from '../../services/deliveryService';
import { canCreateDeliveries } from '../../services/authService';

interface DeliveryFormProps {
  onSubmit: (delivery: Delivery) => void;
  editingDelivery?: Delivery | null;
  onCancel?: () => void;
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({ 
  onSubmit, 
  editingDelivery, 
  onCancel 
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [addressAutocomplete, setAddressAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);
  const addressInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedPlaceData, setSelectedPlaceData] = useState<{
    formattedAddress: string;
    placeId?: string;
    lat?: number;
    lng?: number;
    zipCode?: string;
  } | null>(null);

  // Helper functions - defined before formData state
  // Parse time string (HH:MM) to minutes from midnight
  const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Format minutes to HH:MM string
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Format time for display (12-hour format)
  const formatTimeDisplay = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Calculate end time based on start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const startMinutes = parseTime(startTime);
    const endMinutes = startMinutes + durationMinutes;
    return formatTime(endMinutes);
  };

  // Calculate duration between start and end time
  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    return Math.max(0, endMinutes - startMinutes);
  };

  // Generate time slots from start to end with specified interval
  const generateTimeSlots = (startTime: string, endTime: string, intervalMinutes: number = 30) => {
    const slots = [];
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    let current = start;
    while (current <= end) {
      const timeString = formatTime(current);
      slots.push({
        value: timeString,
        label: formatTimeDisplay(timeString)
      });
      current += intervalMinutes;
    }
    
    return slots;
  };

  // Determine if this is an internal event
  const isInternalEvent = editingDelivery?.entryType === 'internal' || editingDelivery?.type === 'event';
  const isEquipmentMaintenance = editingDelivery?.entryType === 'equipmentMaintenance' || editingDelivery?.type === 'equipmentMaintenance';

  const [formData, setFormData] = useState({
    type: editingDelivery?.type || 'delivery' as 'delivery' | 'event' | 'equipmentMaintenance',
    isInternalEvent: isInternalEvent,
    isEquipmentMaintenance: isEquipmentMaintenance,
    clientName: editingDelivery?.clientName || '',
    clientPhone: editingDelivery?.clientPhone || '',
    deliveryAddress: editingDelivery?.deliveryAddress || '',
    originStore: editingDelivery?.originStore || 'Framingham' as 'Framingham' | 'Marlborough',
    truckType: editingDelivery?.truckType || '',
    invoiceNumber: editingDelivery?.invoiceNumber || '',
    materialDescription: editingDelivery?.materialDescription || '',
    numberOfTrips: editingDelivery?.numberOfTrips || 1,
    additionalNotes: editingDelivery?.additionalNotes || '',
    scheduledDate: editingDelivery?.scheduledDate || '',
    startTime: editingDelivery?.startTime || editingDelivery?.scheduledTime || '',
    endTime: editingDelivery?.endTime || (editingDelivery?.scheduledTime ? calculateEndTime(editingDelivery.scheduledTime, editingDelivery.estimatedTravelTime || 60) : ''),
    repeat: editingDelivery?.repeat || 'none',
    repeatUntil: editingDelivery?.repeatUntil || ''
  });

  // Validation state
  const [timeError, setTimeError] = useState<string>('');

  // Initialize Google Maps Autocomplete
  React.useEffect(() => {
    if (
      addressInputRef.current &&
      window.google &&
      window.google.maps &&
      window.google.maps.places &&
      formData.type === 'delivery'
    ) {
      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components', 'geometry']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (place.formatted_address && place.geometry) {
          const zipCode = place.address_components?.find(
            component => component.types.includes('postal_code')
          )?.long_name;

          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          setSelectedPlaceData({
            formattedAddress: place.formatted_address,
            placeId: place.place_id,
            lat,
            lng,
            zipCode
          });

          setFormData(prev => ({
            ...prev,
            deliveryAddress: place.formatted_address
          }));
          setIsAddressConfirmed(true);
        }
      });

      setAddressAutocomplete(autocomplete);
    }
  }, [formData.type]);

  // Handle manual address input (not from autocomplete)
  const handleAddressInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      deliveryAddress: value
    }));
    
    // Reset confirmation status when user types manually or changes selected address
    if (isAddressConfirmed && selectedPlaceData && value !== selectedPlaceData.formattedAddress) {
      setIsAddressConfirmed(false);
      setSelectedPlaceData(null);
    }
  };

  // Phone number formatting function
  const formatPhoneNumber = (value: string): string => {
    // For SALES and MASTER users, ensure +1 prefix
    if (user?.role === 'salesRep' || user?.role === 'master') {
      // If value doesn't start with +1, add it
      if (!value.startsWith('+1')) {
        // Remove any existing + or 1 at the start, then add +1
        const cleanValue = value.replace(/^\+?1?/, '');
        const phoneNumber = cleanValue.replace(/\D/g, '');
        
        // Don't format if empty after cleaning
        if (!phoneNumber) return '+1';
        
        // Format with +1 prefix
        if (phoneNumber.length < 4) {
          return `+1${phoneNumber}`;
        } else if (phoneNumber.length < 7) {
          return `+1(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        } else {
          return `+1(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
        }
      } else {
        // Value already starts with +1, format the rest
        const phoneNumber = value.slice(2).replace(/\D/g, ''); // Remove +1 and non-digits
        
        // Don't format if empty after cleaning
        if (!phoneNumber) return '+1';
        
        // Format with +1 prefix
        if (phoneNumber.length < 4) {
          return `+1${phoneNumber}`;
        } else if (phoneNumber.length < 7) {
          return `+1(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        } else {
          return `+1(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
        }
      }
    } else {
      // For other users, use original formatting logic
      const phoneNumber = value.replace(/\D/g, '');
      
      // Don't format if empty
      if (!phoneNumber) return '';
      
      // Format based on length
      if (phoneNumber.length < 4) {
        return phoneNumber;
      } else if (phoneNumber.length < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
      } else {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
      }
    }
  };

  // Phone number validation function - updated for +1 prefix
  const validatePhoneNumber = (phone: string): boolean => {
    if (user?.role === 'salesRep' || user?.role === 'master') {
      // For SALES and MASTER users, expect +1 prefix
      if (!phone.startsWith('+1')) return false;
      const phoneDigits = phone.slice(2).replace(/\D/g, ''); // Remove +1 and non-digits
      return phoneDigits.length === 10;
    } else {
      // For other users, use original validation
      const phoneDigits = phone.replace(/\D/g, '');
      return phoneDigits.length === 10;
    }
  };

  // Handle phone input changes with +1 enforcement
  const handlePhoneInputChange = (value: string) => {
    if (user?.role === 'salesRep' || user?.role === 'master') {
      // Prevent removal of +1 prefix
      if (!value.startsWith('+1') && value.length > 0) {
        // If user tries to remove +1, restore it
        const cleanValue = value.replace(/^\+?1?/, '');
        const formattedPhone = formatPhoneNumber('+1' + cleanValue);
        setFormData(prev => ({
          ...prev,
          clientPhone: formattedPhone
        }));
      } else {
        // Normal formatting
        const formattedPhone = formatPhoneNumber(value);
        setFormData(prev => ({
          ...prev,
          clientPhone: formattedPhone
        }));
      }
    } else {
      // For other users, use original logic
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        clientPhone: formattedPhone
      }));
    }
  };

  // Initialize phone field with +1 for SALES and MASTER users
  React.useEffect(() => {
    if ((user?.role === 'salesRep' || user?.role === 'master') && 
        formData.type === 'delivery' && 
        !formData.clientPhone && 
        !editingDelivery?.clientPhone) {
      setFormData(prev => ({
        ...prev,
        clientPhone: '+1'
      }));
    }
  }, [user?.role, formData.type]);


  // Validate time range
  const validateTimeRange = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '';
    
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    if (end <= start) {
      return 'End time must be later than start time';
    }
    
    const durationMinutes = end - start;
    if (durationMinutes < 30) {
      return 'Duration must be at least 30 minutes';
    }
    
    return '';
  };

  // Calculate duration for display
  const getDurationDisplay = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '';
    
    const durationMinutes = calculateDuration(startTime, endTime);
    if (durationMinutes <= 0) return '';
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permission to create deliveries
    if (!canCreateDeliveries(user)) {
      setSubmitStatus({
        type: 'error',
        message: 'You do not have permission to create deliveries'
      });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setSubmitStatus({ type: null, message: '' });
    
    // Validate required fields based on type
    if (formData.type === 'event' || formData.type === 'equipmentMaintenance') {
      // For internal events, only require basic fields
      if (!formData.clientName || !formData.scheduledDate || 
          !formData.startTime || !formData.endTime) {
        setSubmitStatus({
          type: 'error',
          message: `Please fill in all required fields for the ${formData.type === 'event' ? 'event' : 'maintenance'}`
        });
        setIsLoading(false);
        return;
      }
      
      // For equipment maintenance, also require truck type and origin store
      if (formData.type === 'equipmentMaintenance' && (!formData.truckType || !formData.originStore)) {
        setSubmitStatus({
          type: 'error',
          message: 'Please select both Origin Store and Truck Type for equipment maintenance'
        });
        setIsLoading(false);
        return;
      }
      
      // Validate repeat settings
      if (formData.repeat !== 'none' && !formData.repeatUntil) {
        setSubmitStatus({
          type: 'error',
          message: `Please specify the "Repeat Until" date for recurring ${formData.type === 'event' ? 'events' : formData.type === 'equipmentMaintenance' ? 'maintenance' : 'deliveries'}`
        });
        setIsLoading(false);
        return;
      }
      
      // Validate repeat until date is after scheduled date
      if (formData.repeat !== 'none' && formData.repeatUntil <= formData.scheduledDate) {
        setSubmitStatus({
          type: 'error',
          message: `The "Repeat Until" date must be after the scheduled date`
        });
        setIsLoading(false);
        return;
      }
    } else {
      // For deliveries, require all fields
      if (!formData.clientName || !formData.invoiceNumber || !formData.clientPhone || 
          !formData.deliveryAddress || !formData.truckType || !formData.scheduledDate || 
          !formData.startTime || !formData.endTime || !formData.materialDescription) {
        setSubmitStatus({
          type: 'error',
          message: 'Please fill in all required fields'
        });
        setIsLoading(false);
        return;
      }
      
      // Validate phone number for deliveries
      if (!validatePhoneNumber(formData.clientPhone)) {
        setSubmitStatus({
          type: 'error',
          message: 'Please enter a valid 10-digit US phone number'
        });
        setIsLoading(false);
        return;
      }
      
      // Validate originStore for deliveries
      if (!formData.originStore || (formData.originStore !== 'Framingham' && formData.originStore !== 'Marlborough')) {
        setSubmitStatus({
          type: 'error',
          message: 'Please select a valid origin store (Framingham or Marlborough)'
        });
        setIsLoading(false);
        return;
      }
    }
    
    // Validate time range
    const timeValidationError = validateTimeRange(formData.startTime, formData.endTime);
    if (timeValidationError) {
      setSubmitStatus({
        type: 'error',
        message: timeValidationError
      });
      setIsLoading(false);
      return;
    }
    
    try {
      // Create delivery object with proper ID handling
      const durationInMinutes = calculateDuration(formData.startTime, formData.endTime);
      const delivery: Delivery = {
        id: editingDelivery?.id || `delivery_${Date.now()}`, // Preserve existing ID for edits
        type: formData.type,
        entryType: formData.type === 'event' ? 'internal' : formData.type === 'equipmentMaintenance' ? 'equipmentMaintenance' : undefined,
        clientName: formData.clientName,
        // For events and equipment maintenance, use placeholder values for required delivery fields
        clientPhone: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? '' : formData.clientPhone,
        deliveryAddress: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? '' : (selectedPlaceData?.formattedAddress || formData.deliveryAddress),
        invoiceNumber: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? 'N/A' : formData.invoiceNumber,
        materialDescription: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? formData.clientName : formData.materialDescription,
        numberOfTrips: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? 1 : formData.numberOfTrips,
        additionalNotes: formData.additionalNotes,
        originStore: formData.type === 'event' ? 'Internal' : formData.originStore,
        truckType: formData.type === 'event' ? 'Internal Event' : formData.truckType,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.startTime, // Use start time as scheduled time for compatibility
        startTime: formData.startTime,
        endTime: formData.endTime,
        durationInMinutes,
        estimatedTravelTime: durationInMinutes || undefined, // Keep for backward compatibility
        status: editingDelivery?.status || 'pending', // Preserve existing status for edits
        assignedDriver: editingDelivery?.assignedDriver || undefined, // Preserve existing assignment
        createdBy: user?.name || user?.username || 'Unknown User',
        createdAt: editingDelivery?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add edit tracking for existing deliveries
        lastEditedBy: editingDelivery?.id ? (user?.name || user?.username || 'Unknown User') : undefined,
        lastEditedAt: editingDelivery?.id ? new Date().toISOString() : undefined,
        // Add repeat fields for internal events
        repeat: formData.repeat !== 'none' ? formData.repeat : null,
        repeatUntil: formData.repeat !== 'none' ? formData.repeatUntil : null
      };

      console.log('📝 Processing delivery:', {
        isEdit: !!editingDelivery?.id,
        deliveryId: delivery.id,
        clientName: delivery.clientName,
        status: delivery.status,
        type: delivery.type,
        entryType: delivery.entryType,
        repeat: delivery.repeat,
        repeatUntil: delivery.repeatUntil
      });

      let result;
      if (editingDelivery?.id && !editingDelivery.id.startsWith('delivery_')) {
        // This is an existing delivery being edited
        result = await saveDeliveryToFirestore(delivery, user?.email || user?.id || 'Anonymous', user?.name || user?.username || 'Unknown User');
      } else {
        // This is a new delivery or a pre-filled delivery
        const values = {
          type: formData.type,
          entryType: formData.type === 'event' ? 'internal' : formData.type === 'equipmentMaintenance' ? 'equipmentMaintenance' : undefined,
          clientName: formData.clientName,
          invoiceNumber: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? 'N/A' : formData.invoiceNumber,
          phone: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? '' : formData.clientPhone,
          address: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? '' : (selectedPlaceData?.formattedAddress || formData.deliveryAddress),
          originStore: formData.type === 'event' ? 'Internal' : formData.originStore,
          truckType: formData.type === 'event' ? 'Internal Event' : formData.truckType,
          scheduledDate: formData.scheduledDate,
          scheduledTime: formData.startTime,
          trips: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? 1 : formData.numberOfTrips,
          material: (formData.type === 'event' || formData.type === 'equipmentMaintenance') ? formData.clientName : formData.materialDescription,
          notes: formData.additionalNotes,
          startTime: formData.startTime,
          endTime: formData.endTime,
          durationInMinutes,
          userEmail: user?.email || user?.username || 'Unknown User',
          userName: user?.name || user?.username || 'Unknown User',
          status: 'pending',
          assignedDriver: null,
          repeat: formData.repeat !== 'none' ? formData.repeat : null,
          repeatUntil: formData.repeat !== 'none' ? formData.repeatUntil : null
        };
        
        result = await handleScheduleDelivery(values);
        
        if (result.success && result.id) {
          delivery.id = result.id; // Update with Firestore-generated ID
        }
      }
      
      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to save delivery');
      }

      // Save to localStorage as backup
      await saveDelivery(delivery);
      
      setSubmitStatus({
        type: 'success',
        message: editingDelivery?.id ? 
          (formData.type === 'event' ? 'Event updated successfully!' : 
           formData.type === 'equipmentMaintenance' ? 'Maintenance updated successfully!' : 
           'Delivery updated successfully!') : 
          (result.message || (formData.type === 'event' ? 'Event created successfully!' : 
                             formData.type === 'equipmentMaintenance' ? 'Maintenance scheduled successfully!' : 
                             'Delivery created successfully!'))
      });
      
      // Wait a moment to show success message, then close form
      setTimeout(() => {
        onSubmit(delivery);
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting delivery:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    // Special handling for phone number formatting
    if (field === 'clientPhone') {
      handlePhoneInputChange(value);
      return;
    }

    // Special handling for start time changes
    if (field === 'startTime' || field === 'endTime') {
      setFormData(prev => {
        const newData = { ...prev, [field]: value };
        
        // Clear time error when user changes time
        setTimeError('');
        
        // Validate time range if both times are set
        if (newData.startTime && newData.endTime) {
          const error = validateTimeRange(newData.startTime, newData.endTime);
          setTimeError(error);
        }
        
        return newData;
      });
      return;
    }

    // Handle type change
    if (field === 'type') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        isInternalEvent: value === 'event',
        isEquipmentMaintenance: value === 'equipmentMaintenance'
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset truck type when origin store changes
    if (field === 'originStore') {
      setFormData(prev => ({
        ...prev,
        truckType: ''
      }));
    }
  };

  const availableTrucks = TRUCK_TYPES[formData.originStore] || [];
  
  // Generate time slot options
  const startTimeSlots = generateTimeSlots('06:00', '17:00', 30); // 6:00 AM to 5:00 PM
  const endTimeSlots = formData.startTime 
    ? generateTimeSlots(formData.startTime, '18:00', 30) // From start time to 6:00 PM
    : generateTimeSlots('06:30', '18:00', 30); // Default range

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {editingDelivery?.id ? 
          (formData.type === 'event' ? 'Edit Internal Event' : 
           formData.type === 'equipmentMaintenance' ? 'Edit Equipment Maintenance' : 
           'Edit Delivery') : 
          (formData.type === 'event' ? 'Schedule Internal Event' : 
           formData.type === 'equipmentMaintenance' ? 'Schedule Equipment Maintenance' : 
           'Schedule New Delivery')
        }
        {editingDelivery?.scheduledDate && editingDelivery?.scheduledTime && !editingDelivery?.id && (
          <span className="block text-sm font-normal text-green-600 mt-1">
            Pre-filled for {new Date(editingDelivery.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })} at {new Date(`2000-01-01T${editingDelivery.scheduledTime}`).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}
          </span>
        )}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry Type Selection */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Entry Type *
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="delivery"
                checked={formData.type === 'delivery'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Delivery</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="event"
                checked={formData.type === 'event'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Internal Event</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="equipmentMaintenance"
                checked={formData.type === 'equipmentMaintenance'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Equipment Maintenance</span>
            </label>
          </div>
        </div>

        {/* Color Indicators */}
        {formData.type === 'event' && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center space-x-3">
              <div 
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: '#880015' }}
              />
              <div>
                <div className="text-sm font-medium text-gray-700">Internal Event Color</div>
                <div className="text-xs text-gray-600">
                  All internal events will appear in this dark red color (#880015)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event Description / Client Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.type === 'event' ? 'Event Description *' : 
             formData.type === 'equipmentMaintenance' ? 'Maintenance Description *' : 
             'Client/Company Name *'}
          </label>
          <input
            type="text"
            value={formData.clientName}
            onChange={(e) => handleInputChange('clientName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={formData.type === 'event' ? 'e.g., Vacation, Meeting, Training' : 
                        formData.type === 'equipmentMaintenance' ? 'e.g., Oil Change, Brake Inspection, Tire Replacement' : 
                        'Enter client or company name'}
            required
          />
        </div>

        {/* Delivery-specific fields */}
        {formData.type === 'delivery' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => handlePhoneInputChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={
                    (user?.role === 'salesRep' || user?.role === 'master') 
                      ? "+1(508) 820-9700" 
                      : "(508) 820-9700"
                  }
                  required
                />
                {formData.clientPhone && !validatePhoneNumber(formData.clientPhone) && (
                  <p className="mt-1 text-sm text-red-600">
                    {(user?.role === 'salesRep' || user?.role === 'master') 
                      ? "Please enter a valid US phone number with +1 country code"
                      : "Please enter a valid 10-digit US phone number"
                    }
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Address *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  ref={addressInputRef}
                  id="deliveryAddressInput"
                  type="text"
                  value={formData.deliveryAddress}
                  onChange={(e) => handleAddressInputChange(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter complete delivery address"
                  required
                />
                {/* Address confirmation indicator */}
                {formData.deliveryAddress && (
                  <div className="absolute right-3 top-3">
                    {isAddressConfirmed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" title="Address confirmed by Google Maps" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" title="Address not confirmed - please select from suggestions" />
                    )}
                  </div>
                )}
              </div>
              {/* Address status message */}
              {formData.deliveryAddress && isAddressConfirmed && (
                <p className="mt-1 text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  ✓ Address confirmed by Google Maps
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Trips *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.numberOfTrips}
                  onChange={(e) => handleInputChange('numberOfTrips', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material Description *
              </label>
              <input
                type="text"
                value={formData.materialDescription}
                onChange={(e) => handleInputChange('materialDescription', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Crushed Stone, Mulch, Loam"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origin Store *
                </label>
                <select
                  value={formData.originStore}
                  onChange={(e) => handleInputChange('originStore', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="Framingham">Framingham</option>
                  <option value="Marlborough">Marlborough</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Truck Type *
                </label>
                <div className="relative">
                  <select
                    value={formData.truckType}
                    onChange={(e) => handleInputChange('truckType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent truck-type-select"
                    required
                  >
                    <option value="">Select truck type</option>
                    {availableTrucks.map(truck => {
                      const truckKey = `${formData.originStore}-${truck}`;
                      return (
                        <option 
                          key={truck} 
                          value={truck}
                          className={`truck-option truck-option-${truckKey.replace(/\s+/g, '').replace(/[()]/g, '')}`}
                        >
                          {truck}
                        </option>
                      );
                    })}
                  </select>
                  
                  {/* Color indicator for selected truck */}
                  {formData.truckType && (
                    <div 
                      className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded border border-gray-300"
                      style={{ 
                        backgroundColor: getTruckColor(formData.originStore, formData.truckType)
                      }}
                    />
                  )}
                </div>
                
                {/* Truck Type Legend */}
                {formData.originStore && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      {formData.originStore} Truck Types:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTrucks.map(truck => {
                        const color = getTruckColor(formData.originStore, truck);
                        const textColor = getContrastTextColor(color);
                        return (
                          <div 
                            key={truck}
                            className="flex items-center space-x-1 px-2 py-1 rounded text-xs"
                            style={{ 
                              backgroundColor: color,
                              color: textColor,
                              fontWeight: '500'
                            }}
                          >
                            <div className="w-2 h-2 rounded-full bg-current opacity-75" />
                            <span>{truck.replace(' (10 tons)', '').replace(' (22 tons)', '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Equipment Maintenance specific fields */}
        {formData.type === 'equipmentMaintenance' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origin Store *
                </label>
                <select
                  value={formData.originStore}
                  onChange={(e) => handleInputChange('originStore', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="Framingham">Framingham</option>
                  <option value="Marlborough">Marlborough</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Truck Type *
                </label>
                <div className="relative">
                  <select
                    value={formData.truckType}
                    onChange={(e) => handleInputChange('truckType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent truck-type-select"
                    required
                  >
                    <option value="">Select truck type</option>
                    {availableTrucks.map(truck => {
                      const truckKey = `${formData.originStore}-${truck}`;
                      return (
                        <option 
                          key={truck} 
                          value={truck}
                          className={`truck-option truck-option-${truckKey.replace(/\s+/g, '').replace(/[()]/g, '')}`}
                        >
                          {truck}
                        </option>
                      );
                    })}
                  </select>
                  
                  {/* Color indicator for selected truck */}
                  {formData.truckType && (
                    <div 
                      className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded border border-gray-300"
                      style={{ 
                        backgroundColor: getTruckColor(formData.originStore, formData.truckType)
                      }}
                    />
                  )}
                </div>
                
                {/* Truck Type Legend */}
                {formData.originStore && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      {formData.originStore} Truck Types:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTrucks.map(truck => {
                        const color = getTruckColor(formData.originStore, truck);
                        const textColor = getContrastTextColor(color);
                        return (
                          <div 
                            key={truck}
                            className="flex items-center space-x-1 px-2 py-1 rounded text-xs"
                            style={{ 
                              backgroundColor: color,
                              color: textColor,
                              fontWeight: '500'
                            }}
                          >
                            <div className="w-2 h-2 rounded-full bg-current opacity-75" />
                            <span>{truck.replace(' (10 tons)', '').replace(' (22 tons)', '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.additionalNotes}
            onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={formData.type === 'event' ? 'Additional details about this event...' : 
                        formData.type === 'equipmentMaintenance' ? 'Additional maintenance details, parts needed, etc...' : 
                        'Any special instructions or notes...'}
          />
        </div>

        {/* Repeat Settings - Available for both Deliveries and Internal Events */}
        {(formData.type === 'event' || formData.type === 'delivery' || formData.type === 'equipmentMaintenance') && (
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900">
              {formData.type === 'event' ? 'Repeat Settings' : 
               formData.type === 'equipmentMaintenance' ? 'Recurring Maintenance Settings' : 
               'Recurring Delivery Settings'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat
                </label>
                <select
                  value={formData.repeat}
                  onChange={(e) => handleInputChange('repeat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="none">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min={formData.scheduledDate}
                    required
                  />
                </div>
              )}
            </div>
            
            {formData.repeat !== 'none' && formData.scheduledDate && formData.repeatUntil && (
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
                <strong>Preview:</strong> This {formData.type === 'event' ? 'event' : formData.type === 'equipmentMaintenance' ? 'maintenance' : 'delivery'} will repeat {formData.repeat} from {new Date(formData.scheduledDate).toLocaleDateString()} until {new Date(formData.repeatUntil).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.type === 'event' ? 'Event Date *' : 
               formData.type === 'equipmentMaintenance' ? 'Maintenance Date *' : 
               'Scheduled Date *'}
            </label>
            <input
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time *
            </label>
            <select
              value={formData.startTime}
              onChange={(e) => handleInputChange('startTime', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                timeError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              required
            >
              <option value="">Select start time</option>
              {startTimeSlots.map(slot => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time *
            </label>
            <select
              value={formData.endTime}
              onChange={(e) => handleInputChange('endTime', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                timeError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              required
              disabled={!formData.startTime}
            >
              <option value="">Select end time</option>
              {endTimeSlots.map(slot => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time validation error */}
        {timeError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {timeError}
            </p>
          </div>
        )}

        {/* Duration display */}
        {formData.startTime && formData.endTime && !timeError && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center text-sm text-blue-800">
              <Timer className="w-4 h-4 mr-2" />
              <span className="font-medium">Duration: {getDurationDisplay(formData.startTime, formData.endTime)}</span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              From {formatTimeDisplay(formData.startTime)} to {formatTimeDisplay(formData.endTime)}
            </p>
          </div>
        )}

        {/* Status Messages */}
        {submitStatus.type && (
          <div className={`p-4 rounded-md border ${
            submitStatus.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {submitStatus.type === 'success' ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mr-3">
                  <span className="text-white text-sm">✓</span>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mr-3">
                  <span className="text-white text-sm">!</span>
                </div>
              )}
              <span className="font-medium">{submitStatus.message}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-6 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {editingDelivery?.id ? 
                  (formData.type === 'event' ? 'Update Event' : 
                   formData.type === 'equipmentMaintenance' ? 'Update Maintenance' : 
                   'Update Delivery') : 
                  (formData.type === 'event' ? 'Schedule Event' : 
                   formData.type === 'equipmentMaintenance' ? 'Schedule Maintenance' : 
                   'Schedule Delivery')
                }
              </>
            )}
          </button>
        </div>
      </form>

      {/* Custom Styles for Truck Options */}
      <style jsx>{`
        .truck-type-select option {
          padding: 8px 12px;
          font-weight: 500;
        }
        
        /* Framingham Trucks */
        .truck-option-Framingham-Flatbed { 
          background-color: #ed1c25 !important;
          color: #fff !important;
        }
        
        .truck-option-Framingham-Triaxle22tons {
          background-color: #ff7f27 !important;
          color: #fff !important;
        }
        
        .truck-option-Framingham-10Wheeler10tons {
          background-color: #fff204 !important;
          color: #000 !important;
        }
        
        .truck-option-Framingham-Rolloff {
          background-color: #22b14c !important;
          color: #fff !important;
        }
        
        /* Marlborough Trucks */
        .truck-option-Marlborough-Flatbed {
          background-color: #303bcd !important;
          color: #fff !important;
        }
        
        .truck-option-Marlborough-Triaxle22tons {
          background-color: #04a1e8 !important;
          color: #fff !important;
        }
        
        .truck-option-Marlborough-10Wheeler10tons {
          background-color: #ffafc9 !important;
          color: #000 !important;
        }
        
        /* Hover and focus states */
        .truck-type-select option:hover,
        .truck-type-select option:focus {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};