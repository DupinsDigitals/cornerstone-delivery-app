import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, Clock, Truck, Calendar as CalendarIcon } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { useAuth } from '../../contexts/AuthContext';
import { getTruckColor, getContrastTextColor, isDarkBackground, getTextColorForBackground } from '../../utils/truckTypes';
import { getStoredDeliveries, deleteDelivery } from '../../utils/storage';
import { getDeliveriesFromFirestore } from '../../services/deliveryService';
import { SearchBar } from './SearchBar';
import { DeliveryViewModal } from './DeliveryViewModal';
import { canCreateDeliveries } from '../../services/authService';

interface DeliveryCalendarProps {
  onAddDelivery: () => void;
  onEditDelivery: (delivery: Delivery) => void;
  onAddDeliveryAtTime?: (date: string, time: string) => void;
  refreshTrigger: number;
}

interface DeliveryPosition {
  delivery: Delivery;
  top: number;
  height: number;
  width: number;
  left: number;
  zIndex: number;
}

export const DeliveryCalendar: React.FC<DeliveryCalendarProps> = ({
  onAddDelivery,
  onEditDelivery,
  onAddDeliveryAtTime,
  refreshTrigger
}) => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
  const [highlightedDelivery, setHighlightedDelivery] = useState<string | null>(null);
  const [hoveredDelivery, setHoveredDelivery] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const updateCurrentTime = () => {
      setCurrentTime(new Date());
    };

    // Update immediately
    updateCurrentTime();

    // Update every minute
    const interval = setInterval(updateCurrentTime, 60000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const result = await getDeliveriesFromFirestore();
        if (result.success && result.deliveries) {
          setDeliveries(result.deliveries);
        } else {
          const deliveriesData = await getStoredDeliveries();
          setDeliveries(deliveriesData);
        }
      } catch (error) {
        console.warn('Failed to fetch from Firestore, using localStorage:', error);
        const deliveriesData = await getStoredDeliveries();
        setDeliveries(deliveriesData);
      }
    };
    loadDeliveries();
  }, [refreshTrigger]);

  // Function to refresh deliveries
  const refreshDeliveries = async () => {
    try {
      const result = await getDeliveriesFromFirestore();
      if (result.success && result.deliveries) {
        setDeliveries(result.deliveries);
      } else {
        const deliveriesData = await getStoredDeliveries();
        setDeliveries(deliveriesData);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.warn('Failed to refresh deliveries:', error);
      const deliveriesData = await getStoredDeliveries();
      setDeliveries(deliveriesData);
      setLastUpdated(new Date());
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: Date | null): string => {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date().getTime() - timestamp.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Generate 30-minute time slots from 6:00 AM to 6:00 PM
  const generateThirtyMinuteTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute > 0) break; // Stop at 6:00 PM
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        slots.push(time);
      }
    }
    return slots;
  };

  const thirtyMinuteTimeSlots = generateThirtyMinuteTimeSlots();

  // Define slot height constant for 30-minute intervals
  const slotHeight = 32;

  // Generate hourly time slots from 6:00 AM to 6:00 PM
  const generateHourlyTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 18; hour++) {
      const time = new Date();
      time.setHours(hour, 0, 0, 0);
      slots.push(time);
    }
    return slots;
  };

  const hourlyTimeSlots = generateHourlyTimeSlots();

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeek);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  const goToMonth = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    setCurrentWeek(newDate);
    setShowMonthPicker(false);
  };

  // Calendar navigation functions
  const navigateCalendarMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarDate);
    if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCalendarDate(newDate);
  };

  // Generate calendar days for the current calendar month
  const generateCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the first Sunday of the calendar view
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generate 42 days (6 weeks) for complete calendar view
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const isSelected = currentDate.toDateString() === new Date(currentWeek).toDateString();
      
      days.push({
        date: new Date(currentDate),
        day: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const calendarMonthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleDateClick = (date: Date) => {
    // Set the week to contain this date
    setCurrentWeek(date);
    setShowMonthPicker(false);
  };

  // Convert time string to minutes from start of day
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to pixel position (1px per minute, starting from 6:00 AM)
  const minutesToPixels = (minutes: number): number => {
    const startOfDay = 6 * 60; // 6:00 AM in minutes
    return (minutes - startOfDay) * 1;
  };

  // Round duration to nearest 30 minutes for grid alignment
  const roundDurationToGrid = (minutes: number): number => {
    return Math.ceil(minutes / 30) * 30;
  };

  // Convert duration to pixel height (aligned to grid)
  const durationToPixelHeight = (minutes: number): number => {
    const roundedMinutes = roundDurationToGrid(minutes);
    return roundedMinutes; // 1px per minute, so 30min = 30px, 60min = 60px
  };

  // Get deliveries for a specific day
  const getDeliveriesForDay = (date: Date): Delivery[] => {
    const dateStr = date.toISOString().split('T')[0];
    const dayDeliveries = deliveries.filter(delivery => delivery.scheduledDate === dateStr);
    
    // Filter out internal events for drivers only
    if (user?.role === 'driver' && user?.role !== 'master') {
      return dayDeliveries.filter(delivery => 
        delivery.entryType !== 'internal' && 
        delivery.entryType !== 'equipmentMaintenance' && 
        delivery.type !== 'event' && 
        delivery.type !== 'equipmentMaintenance'
      );
    }
    
    return dayDeliveries;
  };

  // Calculate positions for all deliveries in a day
  const calculateDeliveryPositions = (dayDeliveries: Delivery[]): DeliveryPosition[] => {
    // Sort deliveries by scheduled time first
    const sortedDeliveries = [...dayDeliveries].sort((a, b) => {
      return timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime);
    });

    // Helper function to get delivery duration in minutes
    const getDeliveryDuration = (delivery: Delivery): number => {
      // For internal events and equipment maintenance, use endTime if available
      if (delivery.endTime && delivery.scheduledTime) {
        const startMinutes = timeToMinutes(delivery.scheduledTime);
        const endMinutes = timeToMinutes(delivery.endTime);
        const duration = endMinutes - startMinutes;
        return Math.max(30, duration);
      }
      
      // For regular deliveries, use estimated travel time
      if (delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance') {
        return Math.max(30, delivery.estimatedTravelTime || delivery.estimatedTimeMinutes || 60);
      }
      
      // Default duration for internal events without endTime
      return 60;
    };

    // Helper function to get delivery end time in minutes
    const getDeliveryEndTime = (delivery: Delivery): number => {
      // If endTime is specified, use it directly
      if (delivery.endTime) {
        return timeToMinutes(delivery.endTime);
      }
      
      // Otherwise calculate based on start time + duration
      const startMinutes = timeToMinutes(delivery.scheduledTime);
      const duration = getDeliveryDuration(delivery);
      return startMinutes + duration;
    };

    // Helper function to check if two deliveries overlap
    const doDeliveriesOverlap = (delivery1: Delivery, delivery2: Delivery): boolean => {
      const start1 = timeToMinutes(delivery1.scheduledTime);
      const end1 = getDeliveryEndTime(delivery1);
      const start2 = timeToMinutes(delivery2.scheduledTime);
      const end2 = getDeliveryEndTime(delivery2);
      
      // Two events overlap if one starts before the other ends
      return start1 < end2 && start2 < end1;
    };

    // Create a more robust column assignment algorithm
    const deliveryColumns: { delivery: Delivery; column: number }[] = [];
    
    sortedDeliveries.forEach(delivery => {
      let assignedColumn = 0;
      let foundColumn = false;
      
      // Try to find an existing column where this delivery doesn't overlap
      while (!foundColumn) {
        const deliveriesInColumn = deliveryColumns.filter(dc => dc.column === assignedColumn);
        let hasOverlap = false;
        
        for (const existingDeliveryColumn of deliveriesInColumn) {
          if (doDeliveriesOverlap(delivery, existingDeliveryColumn.delivery)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          foundColumn = true;
        } else {
          assignedColumn++;
        }
      }
      
      deliveryColumns.push({ delivery, column: assignedColumn });
    });

    // Calculate the total number of columns needed
    const maxColumn = Math.max(...deliveryColumns.map(dc => dc.column));
    const totalColumns = maxColumn + 1;

    // Calculate positions for each delivery
    const positions: DeliveryPosition[] = [];
    const columnWidth = totalColumns > 0 ? 90 / totalColumns : 90; // Use 90% of available width
    
    deliveryColumns.forEach(({ delivery, column }) => {
      const leftPosition = column * columnWidth + 2; // Add 2% left margin
      
      // Calculate vertical position and height
      const startMinutes = timeToMinutes(delivery.scheduledTime);
      const duration = getDeliveryDuration(delivery);
      
      // Calculate vertical position from 6:00 AM (360 minutes)
      const top = ((startMinutes - 360) / 30) * slotHeight;
      const height = (duration / 30) * slotHeight;
      
      // Calculate horizontal position and width
      const width = columnWidth - 2; // Subtract 2% for spacing between columns
      
      positions.push({
        delivery,
        top,
        height,
        width,
        left: leftPosition,
        zIndex: 10 + column
      });
    });

    return positions;
  };

  // Get active trucks for the current week (for legend)
  const getActiveTrucksForWeek = () => {
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    
    const weekDeliveries = deliveries.filter(delivery => {
      const deliveryDate = new Date(delivery.scheduledDate + 'T00:00:00');
      return deliveryDate >= weekStart && deliveryDate <= weekEnd;
    });

    const activeTrucks = new Set<string>();
    let hasInternalEvents = false;
    let hasEquipmentMaintenance = false;
    
    weekDeliveries.forEach(delivery => {
      if (delivery.entryType === 'internal') {
        hasInternalEvents = true;
      } else if (delivery.entryType === 'equipmentMaintenance') {
        hasEquipmentMaintenance = true;
      } else {
        const truckKey = `${delivery.originStore}-${delivery.truckType}`;
        activeTrucks.add(truckKey);
      }
    });

    const allTruckTypes = [
      { store: 'Framingham', type: 'Flatbed', color: '#ed1c25' },           // Red
      { store: 'Framingham', type: '6 Wheeler Dump (10 tons)', color: '#fff204' }, // Yellow
      { store: 'Framingham', type: 'Triaxle (22 tons)', color: '#ff7f27' },    // Orange
      { store: 'Framingham', type: 'Roll Off', color: '#22b14c' },              // Green
      { store: 'Marlborough', type: 'Flatbed', color: '#303bcd' },             // Dark Blue
      { store: 'Marlborough', type: '6 Wheeler Dump (10 tons)', color: '#ffafc9' }, // Pink
      { store: 'Marlborough', type: 'Triaxle (22 tons)', color: '#04a1e8' }     // Light Blue
    ];

    const activeTruckTypes = allTruckTypes.filter(truck => {
      const truckKey = `${truck.store}-${truck.type}`;
      return activeTrucks.has(truckKey);
    });
    
    // Add internal events to legend if present
    const legendItems = [...activeTruckTypes];
    if (hasInternalEvents) {
      legendItems.push({
        store: 'Internal',
        type: 'Events',
        color: '#880015'
      });
    }
    if (hasEquipmentMaintenance) {
      legendItems.push({
        store: 'Equipment',
        type: 'Maintenance',
        color: '#6B7280' // Gray color for equipment maintenance
      });
    }
    
    return legendItems;
  };

  const activeTrucks = getActiveTrucksForWeek();

  // Calculate current time indicator position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Only show during business hours (6 AM - 6 PM)
    if (hours < 6 || hours >= 18) {
      return null;
    }
    
    // Calculate position in pixels from 6:00 AM
    const totalMinutesFromStart = (hours - 6) * 60 + minutes;
    const pixelPosition = totalMinutesFromStart; // 1px per minute
    
    return {
      top: pixelPosition,
      time: now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    };
  };

  const currentTimePosition = getCurrentTimePosition();

  // Check if today is in the current week view
  const isTodayInCurrentWeek = () => {
    const today = new Date();
    const todayStr = today.toDateString();
    return weekDates.some(date => date.toDateString() === todayStr);
  };

  const showCurrentTimeLine = isTodayInCurrentWeek() && currentTimePosition;
  const handleDeleteDelivery = async (deliveryId: string) => {
    if (window.confirm('Are you sure you want to delete this delivery?')) {
      await deleteDelivery(deliveryId);
      try {
        const result = await getDeliveriesFromFirestore();
        if (result.success && result.deliveries) {
          setDeliveries(result.deliveries);
        } else {
          const updatedDeliveries = await getStoredDeliveries();
          setDeliveries(updatedDeliveries);
        }
      } catch (error) {
        const updatedDeliveries = await getStoredDeliveries();
        setDeliveries(updatedDeliveries);
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  // Status badge configuration
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      // Standard workflow statuses
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
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold text-white ${config.color} shadow-sm`}>
        {config.label}
      </div>
    );
  };

  const isCurrentTimeSlot = (timeSlot: Date, date: Date) => {
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    if (!isToday) return false;

    const slotEnd = new Date(timeSlot.getTime() + 30 * 60 * 1000); // Add 30 minutes
    
    return now >= timeSlot && now < slotEnd;
  };

  const handleSlotDoubleClick = (date: Date, timeSlot: Date) => {
    if (!canCreateDeliveries(user)) {
      return;
    }

    const dateStr = date.toISOString().split('T')[0];
    const timeStr = timeSlot.toTimeString().slice(0, 5);
    const slotKey = `${dateStr}-${timeStr}`;
    
    setHighlightedSlot(slotKey);
    setTimeout(() => setHighlightedSlot(null), 1000);
    
    if (onAddDeliveryAtTime) {
      onAddDeliveryAtTime(dateStr, timeStr);
    } else {
      onAddDelivery();
    }
  };

  const getSlotKey = (date: Date, timeSlot: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = timeSlot.toTimeString().slice(0, 5);
    return `${dateStr}-${timeStr}`;
  };

  const handleDeliveryClick = (delivery: Delivery, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDelivery(delivery);
  };

  const handleCloseModal = () => {
    setSelectedDelivery(null);
  };

  const handleRefreshClick = async () => {
    window.location.reload();
  };

  const handleViewDelivery = (delivery: Delivery) => {
    setHighlightedDelivery(delivery.id);
    setTimeout(() => setHighlightedDelivery(null), 3000);

    const deliveryDate = new Date(delivery.scheduledDate + 'T00:00:00');
    const currentWeekStart = getWeekDates(currentWeek)[0];
    const currentWeekEnd = getWeekDates(currentWeek)[6];
    
    if (deliveryDate < currentWeekStart || deliveryDate > currentWeekEnd) {
      const weekStart = new Date(deliveryDate);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day;
      weekStart.setDate(diff);
      setCurrentWeek(weekStart);
    }

    setTimeout(() => {
      const deliveryElement = document.getElementById(`delivery-${delivery.id}`);
      if (deliveryElement) {
        deliveryElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-blue-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            {/* TODAY Button */}
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              title="Go to current week"
            >
              TODAY
            </button>
            
            {/* Month Picker */}
            <div className="relative">
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="p-2 hover:bg-gray-200 rounded-md transition-colors flex items-center"
                title="Select month"
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
              
              {showMonthPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 w-80">
                  {/* Calendar Header */}
                  <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <button
                      onClick={() => navigateCalendarMonth('prev')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <h3 className="font-semibold text-gray-900">{calendarMonthName}</h3>
                    
                    <button
                      onClick={() => navigateCalendarMonth('next')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="p-3">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((dayInfo, index) => (
                        <button
                          key={index}
                          onClick={() => handleDateClick(dayInfo.date)}
                          className={`
                            w-8 h-8 text-sm rounded transition-colors flex items-center justify-center
                            ${!dayInfo.isCurrentMonth 
                              ? 'text-gray-300 hover:bg-gray-50' 
                              : dayInfo.isToday
                                ? 'bg-blue-600 text-white font-bold hover:bg-blue-700'
                                : dayInfo.isSelected
                                  ? 'bg-green-100 text-green-800 font-medium hover:bg-green-200'
                                  : 'text-gray-700 hover:bg-gray-100'
                            }
                          `}
                          title={dayInfo.date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        >
                          {dayInfo.day}
                        </button>
                      ))}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                      <button
                        onClick={() => {
                          setCalendarDate(new Date());
                          handleDateClick(new Date());
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Go to Today
                      </button>
                      <button
                        onClick={() => setShowMonthPicker(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Week Navigation */}
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Week of {formatDate(weekDates[0])}
            </h2>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <SearchBar 
              onViewDelivery={handleViewDelivery}
              refreshTrigger={refreshTrigger}
            />
            <button
              onClick={handleRefreshClick}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center text-sm sm:text-base whitespace-nowrap"
            >
              🔄 Refresh Agenda
            </button>
            <button
              onClick={onAddDelivery}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Delivery
            </button>
          </div>
        </div>
      </div>

      {/* Click outside to close month picker */}
      {showMonthPicker && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMonthPicker(false)}
        />
      )}

      {/* Calendar Grid */}
      <div className="flex flex-col w-full">
        {/* Day Headers */}
        <div className="flex border-b-2 border-gray-400 bg-blue-100 w-full">
          <div className="w-16 flex-shrink-0 p-3 text-center font-medium text-gray-700 border-r border-gray-200">
            <Clock className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">Time</span>
          </div>
          {weekDates.map((date, index) => {
            const isToday = new Date().toDateString() === date.toDateString();
            const isWeekend = index === 0 || index === 6; // Sunday or Saturday
            
            // Determine background color
            let bgColor = 'bg-blue-100'; // Default light blue
            if (isToday) {
              bgColor = 'bg-blue-200'; // Darker blue for today
            } else if (isWeekend) {
              bgColor = 'bg-blue-50'; // Lighter blue for weekends
            }
            
            return (
              <div
                key={index} 
                className={`flex-1 min-w-0 p-3 text-center last:border-r-0 ${bgColor} ${
                  isToday ? 'border-blue-300' : ''
                }`}
                style={{
                  borderRight: index < weekDates.length - 1 ? '2px solid #B0B0B0' : 'none'
                }}
              >
                <div className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base">
                  {dayNames[index]}
                </div>
                <div className={`text-xs mt-1 ${
                  isToday ? 'text-blue-700 font-semibold' : 'text-gray-600'
                }`}>
                  {date.getMonth() + 1}/{date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar Body with Fixed Height Grid */}
        <div className="flex w-full">
          {/* Time Labels Column */}
          <div className="w-16 flex-shrink-0 bg-gray-50 relative" style={{ borderRight: '2px solid #B0B0B0' }}>
            {hourlyTimeSlots.map((timeSlot, timeIndex) => (
              <div 
                key={timeIndex} 
                className="h-16 p-1 text-center text-xs text-gray-600 flex items-center justify-center"
                style={{
                  borderBottom: timeIndex < hourlyTimeSlots.length - 1 ? '1px solid #E5E5E5' : 'none'
                }}
              >
                <span className="font-medium text-xs">{formatTime(timeSlot)}</span>
              </div>
            ))}
            
            {/* Current Time Arrow */}
            {showCurrentTimeLine && (
              <div
                className="absolute right-0 flex items-center z-5"
                style={{
                  top: `${currentTimePosition.top}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                {/* Time Label */}
                <div className="bg-red-600 text-white text-xs px-2 py-1 rounded-l-md font-bold shadow-lg">
                  {currentTimePosition.time}
                </div>
                {/* Arrow */}
                <div 
                  className="w-0 h-0 border-l-8 border-r-0 border-t-4 border-b-4"
                  style={{
                    borderLeftColor: '#dc2626',
                    borderTopColor: 'transparent',
                    borderBottomColor: 'transparent'
                  }}
                />
              </div>
            )}
          </div>

          {/* Day Columns */}
          <div className="flex flex-1 min-w-0 relative">
            {/* Current Time Line */}
            {showCurrentTimeLine && (
              <div
                className="absolute left-0 right-0 border-t-2 border-red-600 z-5 pointer-events-none"
                style={{
                  top: `${currentTimePosition.top}px`,
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                }}
              />
            )}
            
            {weekDates.map((date, dayIndex) => {
              const dayDeliveries = getDeliveriesForDay(date);
              const deliveryPositions = calculateDeliveryPositions(dayDeliveries);
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div
                  key={dayIndex}
                  className={`flex-1 min-w-0 last:border-r-0 relative ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                  style={{
                    borderRight: dayIndex < weekDates.length - 1 ? '2px solid #B0B0B0' : 'none',
                    minHeight: `${thirtyMinuteTimeSlots.length * 32}px`,
                    position: 'relative'
                  }}
                >
                  {/* 30-Minute Interactive Time Slots */}
                  {thirtyMinuteTimeSlots.map((timeSlot, timeIndex) => {
                    const isCurrentSlot = isCurrentTimeSlot(timeSlot, date);
                    const slotKey = getSlotKey(date, timeSlot);
                    const isHighlighted = highlightedSlot === slotKey;
                    const canCreate = canCreateDeliveries(user);

                    return (
                      <div key={timeIndex} className="relative" style={{ height: '32px' }}>
                        {/* 30-minute interactive slot */}
                        <div
                          className={`absolute w-full h-16 border-b border-gray-200 transition-colors duration-200 ${
                            isCurrentSlot ? 'bg-green-100' : ''
                          } ${
                            isCurrentSlot ? 'bg-blue-100' : ''
                          } ${
                            isHighlighted ? 'bg-blue-100 ring-2 ring-blue-300' : ''
                          } ${
                            canCreate ? 'hover:bg-gray-50 cursor-pointer' : ''
                          }`}
                          style={{ 
                            top: '0px',
                            height: '32px',
                            zIndex: 1,
                            borderBottom: '1px solid #E5E5E5'
                          }}
                          onDoubleClick={() => handleSlotDoubleClick(date, timeSlot)}
                          title={canCreate ? 'Double-click to schedule delivery (use right margin if cards are present)' : ''}
                        />
                      </div>
                    );
                  })}

                  {/* Delivery Cards */}
                  {deliveryPositions.map((position) => {
                    const { delivery } = position;
                    const canEdit = user?.role === 'master';
                    const estimatedMinutes = delivery.estimatedTravelTime || delivery.estimatedTimeMinutes || 60;
                    const isHovered = hoveredDelivery === delivery.id;
                    const isHighlighted = highlightedDelivery === delivery.id;

                    // Get truck color for background
                    let bgColor;
                    if (delivery.entryType === 'internal') {
                      bgColor = '#880015'; // Dark red for internal events
                    } else if (delivery.entryType === 'equipmentMaintenance') {
                      bgColor = getTruckColor(delivery.originStore, delivery.truckType); // Use truck color for equipment maintenance
                    } else {
                      bgColor = getTruckColor(delivery.originStore, delivery.truckType); // Regular truck color for deliveries
                    }
                    
                    // Override color for COMPLETE deliveries
                    const finalBgColor = (delivery.status === 'COMPLETE' || delivery.status === 'Complete') ? '#b1c4cf' : bgColor;
                    const cardTextColor = getContrastTextColor(bgColor);
                    const secondaryTextColor = isDarkBackground(finalBgColor) ? '#e0e0e0' : '#555555';

                    return (
                      <div
                        id={`delivery-${delivery.id}`}
                        key={delivery.id}
                        className={`absolute rounded-md shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden ${
                          isHighlighted ? 'ring-2 ring-blue-400 ring-offset-1 shadow-lg transform scale-105' : ''
                        } ${
                          isHovered ? 'shadow-lg transform scale-102' : ''
                        }`}
                        style={{
                          backgroundColor: finalBgColor,
                          color: cardTextColor,
                          position: 'absolute',
                          top: `${position.top}px`,
                          height: `${position.height}px`,
                          left: `${position.left}%`,
                          width: `${position.width}%`,
                          right: 'auto',
                          zIndex: position.zIndex,
                          margin: '2px',
                          minHeight: `${slotHeight}px`,
                          border: '1px solid #000',
                          borderRadius: '4px',
                          boxSizing: 'border-box',
                          boxShadow: '0 0 2px rgba(0, 0, 0, 0.3)',
                          // Ensure cards don't extend beyond their allocated space
                          maxWidth: `${position.width}%`
                        }}
                        onMouseEnter={() => setHoveredDelivery(delivery.id)}
                        onMouseLeave={() => setHoveredDelivery(null)}
                        onClick={(e) => handleDeliveryClick(delivery, e)}
                      >
                        <div className="p-2 h-full flex flex-col justify-start text-xs">
                          <div className="space-y-1">
                            {delivery.entryType === 'internal' ? (
                              <div className="font-bold text-xs truncate leading-tight">
                                {delivery.clientName.toUpperCase()} (INTERNAL)
                              </div>
                            ) : delivery.entryType === 'equipmentMaintenance' ? (
                              <div className="font-bold text-xs truncate leading-tight">
                                {delivery.clientName.toUpperCase()} (MAINTENANCE)
                              </div>
                            ) : (
                              <div className="font-bold text-xs truncate leading-tight">
                                {delivery.clientName}
                              </div>
                            )}
                            
                            {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
                              <div className="flex items-center space-x-1 text-xs" style={{ color: secondaryTextColor }}>
                                <span>#{delivery.invoiceNumber}</span>
                              </div>
                            )}
                            
                            {delivery.entryType !== 'internal' && delivery.entryType !== 'equipmentMaintenance' && (
                              <div className="flex items-center justify-center">
                                <div className="scale-75 origin-left">
                                  {getStatusBadge(delivery.status)}
                                </div>
                              </div>
                            )}
                          </div>

                          {canEdit && (
                            <div className="flex space-x-1 mt-auto pt-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditDelivery(delivery);
                                }}
                                className="p-0.5 rounded transition-colors opacity-80 hover:opacity-100 flex-shrink-0"
                                style={{ 
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                                }}
                                title="Edit delivery"
                              >
                                <Edit className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDelivery(delivery.id);
                                }}
                                className="p-0.5 rounded transition-colors opacity-80 hover:opacity-100 flex-shrink-0"
                                style={{ 
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                                }}
                                title="Delete delivery"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full left-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded shadow-lg z-50 whitespace-nowrap max-w-xs">
                            <div><strong>Client:</strong> {delivery.clientName}</div>
                            <div><strong>Invoice:</strong> #{delivery.invoiceNumber}</div>
                            <div><strong>Status:</strong> {delivery.status}</div>
                            <div><strong>Time:</strong> {delivery.scheduledTime}</div>
                            <div><strong>Truck:</strong> {delivery.truckType}</div>
                            <div><strong>Store:</strong> {delivery.originStore}</div>
                            <div><strong>Material:</strong> {delivery.materialDescription}</div>
                            <div><strong>Duration:</strong> {formatDuration(estimatedMinutes)}</div>
                            <div><strong>Address:</strong> {delivery.deliveryAddress}</div>
                            {delivery.clientPhone && <div><strong>Phone:</strong> {delivery.clientPhone}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      {activeTrucks.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="font-semibold text-gray-700 flex items-center">
              <Truck className="w-4 h-4 mr-2" />
              Active This Week:
            </div>
            
            {/* Group by store */}
            {['Framingham', 'Marlborough', 'Internal', 'Equipment'].map(store => {
              const storeTrucks = activeTrucks.filter(truck => truck.store === store);
              
              if (storeTrucks.length === 0) return null;
              
              return (
                <div key={store} className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="font-medium text-gray-600">
                    {store === 'Internal' ? 'Internal Events:' : 
                     store === 'Equipment' ? 'Equipment Maintenance:' : 
                     `${store}:`}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    {storeTrucks.map((truck, index) => (
                      <div key={index} className="flex items-center space-x-1 text-xs">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: truck.color }}></div>
                        <span className="text-xs truncate">
                          {truck.store === 'Internal' || truck.store === 'Equipment' ? truck.type : truck.type.replace(' (10 tons)', '').replace(' (22 tons)', '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delivery View Modal */}
      {selectedDelivery && (
        <DeliveryViewModal
          delivery={selectedDelivery}
          onClose={handleCloseModal}
          onEdit={onEditDelivery}
          onDelete={handleDeleteDelivery}
        />
      )}
    </div>
  );
};