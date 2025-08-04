import React, { useState } from 'react';
import { UserPlus, Mail, User, Lock, Shield, MapPin, Truck } from 'lucide-react';
import { createUser, CreateUserData } from '../../services/userService';

interface CreateUserFormProps {
  onUserCreated: () => void;
}

export const CreateUserForm: React.FC<CreateUserFormProps> = ({ onUserCreated }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'salesRep' as 'salesRep' | 'driver' | 'master',
    assignedStore: 'Framingham' as 'Framingham' | 'Marlborough',
    assignedTruck: '' as string
  });
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    // Validate required fields
    if (!formData.name || !formData.email || !formData.password || !formData.assignedStore) {
      setStatus({
        type: 'error',
        message: 'Please fill in all required fields'
      });
      setIsLoading(false);
      return;
    }

    // Validate truck assignment for drivers

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid email address'
      });
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setStatus({
        type: 'error',
        message: 'Password must be at least 6 characters long'
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await createUser(formData as CreateUserData);
      
      if (result.success) {
        setStatus({
          type: 'success',
          message: 'User created successfully!'
        });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'salesRep',
          assignedStore: 'Framingham',
          assignedTruck: ''
        });
        
        // Notify parent component
        setTimeout(() => {
          onUserCreated();
        }, 1500);
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to create user'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An unexpected error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset truck assignment when role or store changes
    if (field === 'role' || field === 'assignedStore') {
      setFormData(prev => ({
        ...prev,
        assignedTruck: field === 'role' && value === 'driver' ? undefined : ''
      }));
    }
  };

  // Get available trucks for the selected store
  const getAvailableTrucks = () => {
    const TRUCK_TYPES = {
      Framingham: ['Flatbed', 'Triaxle (22 tons)', '10 Wheeler (10 tons)', 'Rolloff'],
      Marlborough: ['Flatbed', 'Triaxle (22 tons)', '10 Wheeler (10 tons)']
    };
    return TRUCK_TYPES[formData.assignedStore as keyof typeof TRUCK_TYPES] || [];
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      <div className="flex items-center mb-6">
        <UserPlus className="w-6 h-6 text-green-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter email address"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter password (min 6 characters)"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="salesRep">Sales Rep</option>
              <option value="driver">Driver</option>
              <option value="master">Master User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Assigned Store *
            </label>
            <select
              value={formData.assignedStore}
              onChange={(e) => handleInputChange('assignedStore', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="Framingham">Framingham</option>
              <option value="Marlborough">Marlborough</option>
            </select>
          </div>

        </div>

        {/* Status Messages */}
        {status.type && (
          <div className={`p-4 rounded-md border ${
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

        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => {
              setFormData({ name: '', email: '', password: '', role: 'salesRep', assignedStore: 'Framingham', assignedTruck: '' });
              setStatus({ type: null, message: '' });
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="font-medium text-blue-900 mb-2">Role Permissions:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Sales Rep:</strong> Can create and manage delivery schedules</li>
          <li><strong>Driver:</strong> Can view and update delivery status for all trucks at their assigned store</li>
          <li><strong>Master User:</strong> Full system access - can manage all deliveries, users, and system settings across both stores</li>
        </ul>
      </div>
    </div>
  );
};