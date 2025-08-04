import React, { useState } from 'react';
import { Users, Mail, Shield, ShieldCheck, ShieldX, Trash2, RotateCcw, Search, MapPin, Truck } from 'lucide-react';
import { User } from '../../types/delivery';
import { updateUserStatus, deleteUser, sendPasswordReset } from '../../services/userService';

interface UserListProps {
  users: User[];
  onUserUpdated: () => void;
  currentUserId: string;
}

export const UserList: React.FC<UserListProps> = ({ users, onUserUpdated, currentUserId }) => {
  const [isLoading, setIsLoading] = useState<string>(''); // Track which user is being processed
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Filter users based on search and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    setIsLoading(userId);
    setStatus({ type: null, message: '' });

    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    
    try {
      const result = await updateUserStatus(userId, newStatus);
      
      if (result.success) {
        setStatus({
          type: 'success',
          message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
        });
        onUserUpdated();
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to update user status'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An unexpected error occurred'
      });
    } finally {
      setIsLoading('');
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const handleDeleteUser = async (userId: string, userUid: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(userId);
    setStatus({ type: null, message: '' });

    try {
      const result = await deleteUser(userId, userUid);
      
      if (result.success) {
        setStatus({
          type: 'success',
          message: 'User deleted successfully'
        });
        onUserUpdated();
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to delete user'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An unexpected error occurred'
      });
    } finally {
      setIsLoading('');
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const handlePasswordReset = async (email: string, userName: string) => {
    if (!window.confirm(`Send password reset email to "${userName}" at ${email}?`)) {
      return;
    }

    try {
      const result = await sendPasswordReset(email);
      
      if (result.success) {
        setStatus({
          type: 'success',
          message: 'Password reset email sent successfully'
        });
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to send password reset email'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An unexpected error occurred'
      });
    }

    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'master': return 'Master User';
      case 'salesRep': return 'Sales Rep';
      case 'driver': return 'Driver';
      case 'unknown': return 'Unknown Role';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'master': return 'bg-purple-100 text-purple-800';
      case 'salesRep': return 'bg-blue-100 text-blue-800';
      case 'driver': return 'bg-green-100 text-green-800';
      case 'unknown': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header with Search and Filters */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-green-600 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">
              User Accounts ({filteredUsers.length})
            </h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm w-full sm:w-64"
              />
            </div>
            
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            >
              <option value="all">All Roles</option>
              <option value="master">Master Users</option>
              <option value="salesRep">Sales Reps</option>
              <option value="driver">Drivers</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {status.type && (
        <div className={`p-4 border-b ${
          status.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {status.type === 'success' ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mr-3">
                <span className="text-white text-sm">✓</span>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mr-3">
                <span className="text-white text-sm">!</span>
              </div>
            )}
            <span className="font-medium">{status.message}</span>
          </div>
        </div>
      )}

      {/* User Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isOtherMaster = user.role === 'master' && !isCurrentUser;
              
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 font-medium text-sm">
                            {user.name && user.name.length > 0 ? user.name.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'Unknown User'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-green-600 font-medium">(You)</span>
                          )}
                        </div>
                        {user.email && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </div>
                        )}
                        {user.assignedTruck && (
                          <div className="text-sm text-gray-500 flex items-center mt-1">
                            <Truck className="w-3 h-3 mr-1" />
                            All Trucks
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role || 'unknown')}`}>
                      <Shield className="w-3 h-3 mr-1" />
                      {getRoleDisplay(user.role || 'unknown')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status === 'active' ? (
                        <ShieldCheck className="w-3 h-3 mr-1" />
                      ) : (
                        <ShieldX className="w-3 h-3 mr-1" />
                      )}
                      {user.status === 'active' ? 'Active' : user.status === 'disabled' ? 'Disabled' : 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Password Reset */}
                      {user.email && (
                        <button
                          onClick={() => handlePasswordReset(user.email!, user.name)}
                          disabled={!user.name}
                          className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded"
                          title="Send password reset email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Status Toggle - Don't allow disabling current user */}
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleStatusToggle(user.id, user.status || 'active')}
                          disabled={isLoading === user.id}
                          className={`p-1 rounded transition-colors ${
                            user.status === 'active'
                              ? 'text-red-600 hover:text-red-900'
                              : 'text-green-600 hover:text-green-900'
                          } disabled:opacity-50`}
                          title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                        >
                          {isLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : user.status === 'active' ? (
                            <ShieldX className="w-4 h-4" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      
                      {/* Delete - Don't allow deleting current user */}
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.id, user.name || 'Unknown User')}
                          disabled={isLoading === user.id}
                          className="text-red-600 hover:text-red-900 transition-colors p-1 rounded disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">
            {searchTerm || filterRole !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No users have been created yet.'}
          </p>
        </div>
      )}
    </div>
  );
};