import React from 'react';
import { LogOut, Truck, User, Users, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';

interface HeaderProps {
  onNavigateToUserManagement?: () => void;
  currentView?: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateToUserManagement, currentView }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if Firebase logout fails
      logout();
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left - Logo */}
          <div className="flex-shrink-0">
            <div className="w-64 h-28 flex items-center justify-center">
              <img 
                src="/CLS Logo app.svg" 
                alt="Cornerstone Landscape Supplies Logo" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          {/* Center - Title */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-xl font-bold text-gray-900">SCHEDULE PLANNER</h1>
          </div>

          {/* Right - User Info and Actions */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <div className="flex items-center text-sm text-gray-700">
              <User className="w-4 h-4 mr-2" />
              <span className="font-medium">{user?.name}</span>
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {user?.role === 'master' ? 'Master User' : 'Sales Rep'}
              </span>
            </div>
            
            {/* Customer Tracker Link - Available to all users */}
            <a
              href="/track"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm px-3 py-1 rounded-md transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              title="Open customer delivery tracker (public)"
            >
              <Search className="w-4 h-4 mr-1" />
              Customer Tracker
            </a>
            
            {/* User Management Button - Only for Master Users */}
            {user?.role === 'master' && onNavigateToUserManagement && (
              <button
                onClick={onNavigateToUserManagement}
                className={`flex items-center text-sm px-3 py-1 rounded-md transition-colors ${
                  currentView === 'user-management'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Users className="w-4 h-4 mr-1" />
                Users
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};