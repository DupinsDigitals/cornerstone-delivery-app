import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { Header } from './components/Layout/Header';
import { DeliveryForm } from './components/DeliveryForm/DeliveryForm';
import { DeliveryCalendar } from './components/Calendar/DeliveryCalendar';
import { UserManagement } from './components/UserManagement/UserManagement';
import { DriverDashboard } from './components/Driver/DriverDashboard';
import { CustomerTracker } from './components/Customer/CustomerTracker';
import { Delivery } from './types/delivery';
import { canAccessUserManagement, canCreateDeliveries, canAccessDriverDashboard } from './services/authService';

const AppContent: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<'calendar' | 'form' | 'user-management' | 'customer-tracker'>('calendar');
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Determine the appropriate view based on user role
  React.useEffect(() => {
    if (user?.role === 'driver') {
      setCurrentView('driver-dashboard');
    } else if (currentView === 'driver-dashboard' && user?.role !== 'driver') {
      setCurrentView('calendar');
    }
  }, [user?.role]);

  // Route protection - prevent direct access to unauthorized views
  React.useEffect(() => {
    if (currentView === 'user-management' && !canAccessUserManagement(user)) {
      setCurrentView('calendar');
    }
    if (currentView === 'form' && !canCreateDeliveries(user)) {
      setCurrentView('calendar');
    }
    if (currentView === 'driver-dashboard' && !canAccessDriverDashboard(user)) {
      setCurrentView('calendar');
    }
    // Customer tracker is public, no restrictions needed
  }, [currentView, user]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if we should show customer tracker (public access)
  const showCustomerTracker = window.location.pathname === '/track' || currentView === 'customer-tracker';
  
  // Show customer tracker without authentication
  if (showCustomerTracker) {
    return <CustomerTracker />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // If user is a driver, show only the driver dashboard
  if (user?.role === 'driver') {
    return (
      <div className="min-h-screen bg-gray-50">
        <DriverDashboard />
      </div>
    );
  }

  const handleAddDelivery = () => {
    if (!canCreateDeliveries(user)) {
      alert('You do not have permission to create deliveries.');
      return;
    }
    setEditingDelivery(null);
    setCurrentView('form');
  };

  const handleAddDeliveryAtTime = (date: string, time: string) => {
    if (!canCreateDeliveries(user)) {
      alert('You do not have permission to create deliveries.');
      return;
    }
    // Create a partial delivery object with pre-filled date and time
    const preFilledDelivery: Partial<Delivery> = {
      scheduledDate: date,
      scheduledTime: time
    };
    setEditingDelivery(preFilledDelivery as Delivery);
    setCurrentView('form');
  };

  const handleEditDelivery = (delivery: Delivery) => {
    if (user?.role !== 'master') {
      alert('You do not have permission to edit deliveries.');
      return;
    }
    setEditingDelivery(delivery);
    setCurrentView('form');
  };

  const handleDeliverySubmit = (delivery: Delivery) => {
    // Force refresh to ensure updated delivery replaces any duplicates
    setRefreshTrigger(prev => prev + 1);
    setCurrentView('calendar');
    setEditingDelivery(null);
  };

  const handleCancelForm = () => {
    setCurrentView('calendar');
    setEditingDelivery(null);
  };

  const handleNavigateToUserManagement = () => {
    if (!canAccessUserManagement(user)) {
      alert('You do not have permission to access user management.');
      return;
    }
    setCurrentView('user-management');
    setEditingDelivery(null);
  };

  const handleBackToCalendar = () => {
    setCurrentView('calendar');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#8b6f47' }}>
      <Header 
        onNavigateToUserManagement={canAccessUserManagement(user) ? handleNavigateToUserManagement : undefined}
        currentView={currentView}
      />
      
      <main className="w-full px-2 sm:px-4 py-8" style={{ backgroundColor: '#8b6f47' }}>
        {currentView === 'user-management' ? (
          <div className="max-w-7xl mx-auto">
            <UserManagement onBackToCalendar={handleBackToCalendar} />
          </div>
        ) : currentView === 'calendar' ? (
          <DeliveryCalendar
            onAddDelivery={handleAddDelivery}
            onEditDelivery={handleEditDelivery}
            onAddDeliveryAtTime={handleAddDeliveryAtTime}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <DeliveryForm
              onSubmit={handleDeliverySubmit}
              editingDelivery={editingDelivery}
              onCancel={handleCancelForm}
            />
          </div>
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;