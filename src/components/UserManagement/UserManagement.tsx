import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Mail, Shield, ShieldCheck, ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CreateUserForm } from './CreateUserForm';
import { UserList } from './UserList';
import { User } from '../../types/delivery';
import { getAllUsers } from '../../services/userService';

interface UserManagementProps {
  onBackToCalendar?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBackToCalendar }) => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await getAllUsers();
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        setError(result.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUserCreated = () => {
    loadUsers(); // Refresh the user list
    // Automatically redirect to calendar after successful user creation
    if (onBackToCalendar) {
      setTimeout(() => {
        onBackToCalendar();
      }, 1500); // Wait for success message to be visible
    } else {
      setCurrentView('list'); // Fallback to list view
    }
  };

  const handleUserUpdated = () => {
    loadUsers(); // Refresh the user list
  };

  // Check if user has master role
  if (!user || user.role !== 'master') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to access the User Management system. 
            Only Master Users can manage user accounts.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">Manage All System Users</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-700">
                <ShieldCheck className="w-4 h-4 mr-2 text-green-600" />
                <span className="font-medium">Master User Access</span>
              </div>
              
              {onBackToCalendar && (
                <button
                  onClick={onBackToCalendar}
                  className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mr-3">
                <span className="text-white text-sm">!</span>
              </div>
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCurrentView('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'list'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                User List ({users.length})
              </button>
              <button
                onClick={() => setCurrentView('create')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'create'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create User
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {currentView === 'list' ? (
          <UserList 
            users={users} 
            onUserUpdated={handleUserUpdated}
            currentUserId={user.id}
          />
        ) : (
          <CreateUserForm onUserCreated={handleUserCreated} />
        )}
      </main>
    </div>
  );
};