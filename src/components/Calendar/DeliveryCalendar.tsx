import React, { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { useAuth } from '../../contexts/AuthContext';
import { getStoredDeliveries, deleteDelivery } from '../../utils/storage';
import { DeliveryViewModal } from './DeliveryViewModal';
import { SearchBar } from './SearchBar';
import { getTruckColor, getContrastTextColor } from '../../utils/truckTypes';
import { canCreateDeliveries } from '../../services/authService';

interface DeliveryCalendarProps {
  onAddDelivery: () => void;
  onEditDelivery: (delivery: Delivery) => void;
  onAddDeliveryAtTime: (date: string, time: string) => void;
  refreshTrigger: number;
}

export const DeliveryCalendar: React.FC<DeliveryCalendarProps> = ({
  onAddDelivery,
  onEditDelivery,
  onAddDeliveryAtTime,
  refreshTrigger
}) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDeliveries = async () => {
    try {
      const deliveriesData = await getStoredDeliveries();
      setDeliveries(deliveriesData);
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [refreshTrigger]);

  const handleViewDelivery = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    try {
      await deleteDelivery(deliveryId);
      await loadDeliveries();
    } catch (error) {
      console.error('Error deleting delivery:', error);
      alert('Failed to delete delivery');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getDeliveriesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return deliveries.filter(delivery => delivery.scheduledDate === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">Delivery Schedule</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <SearchBar onViewDelivery={handleViewDelivery} refreshTrigger={refreshTrigger} />
            
            {canCreateDeliveries(user) && (
              <button
                onClick={onAddDelivery}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Delivery
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-semibold text-gray-900">{monthYear}</h3>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
            >
              Today
            </button>
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) {
              return <div key={index} className="min-h-[120px]" />;
            }

            const dayDeliveries = getDeliveriesForDate(day);
            const dateStr = day.toISOString().split('T')[0];
            const isCurrentDay = isToday(day);
            const isPast = isPastDate(day);

            return (
              <div
                key={dateStr}
                className={`min-h-[120px] p-2 border border-gray-200 ${
                  isCurrentDay ? 'bg-blue-50 border-blue-300' : 'bg-white'
                } ${isPast ? 'bg-gray-50' : ''}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-medium ${
                    isCurrentDay ? 'text-blue-600' : isPast ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    {day.getDate()}
                  </span>
                  {canCreateDeliveries(user) && !isPast && (
                    <button
                      onClick={() => onAddDeliveryAtTime(dateStr, '08:00')}
                      className="w-5 h-5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors flex items-center justify-center text-xs"
                      title="Add delivery for this day"
                    >
                      +
                    </button>
                  )}
                </div>
                
                <div className="space-y-1">
                  {dayDeliveries.map(delivery => {
                    const truckColor = getTruckColor(delivery.originStore, delivery.truckType);
                    const textColor = getContrastTextColor(truckColor);
                    
                    return (
                      <div
                        key={delivery.id}
                        className="p-2 rounded-lg shadow-sm text-xs cursor-pointer transition-all hover:shadow-md"
                        onClick={() => handleViewDelivery(delivery)}
                        style={{
                          backgroundColor: truckColor,
                          color: textColor,
                        }}
                      >
                        <div className="font-bold truncate mb-1">{delivery.clientName}</div>
                        <div className="opacity-90 mb-1">
                          {delivery.scheduledTime} - {delivery.truckType}
                        </div>
                        <div className="opacity-80 truncate">
                          #{delivery.invoiceNumber}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery View Modal */}
      {selectedDelivery && (
        <DeliveryViewModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onEdit={onEditDelivery}
          onDelete={handleDeleteDelivery}
        />
      )}
    </div>
  );
};