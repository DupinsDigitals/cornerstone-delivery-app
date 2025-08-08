import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Phone, User, Calendar, Clock, Package, Building2, FileText, Save, X } from 'lucide-react';
import { Delivery } from '../../types/delivery';
import { saveDeliveryToFirestore, updateDeliveryInFirestore } from '../../services/deliveryService';
import { useAuth } from '../../contexts/AuthContext';

interface DeliveryFormProps {
  onSubmit: (delivery: Delivery) => void;
  editingDelivery?: Delivery | null;
  onCancel: () => void;
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  onSubmit,
  editingDelivery,
  onCancel
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    address: '',
    scheduledDate: '',
    scheduledTime: '',
    truckType: '',
    invoiceNumber: '',
    originStore: '',
    notes: ''
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (editingDelivery) {
      setFormData({
        clientName: editingDelivery.clientName || '',
        phone: editingDelivery.phone || '',
        address: editingDelivery.address || '',
        scheduledDate: editingDelivery.scheduledDate || '',
        scheduledTime: editingDelivery.scheduledTime || '',
        truckType: editingDelivery.truckType || '',
        invoiceNumber: editingDelivery.invoiceNumber || '',
        originStore: editingDelivery.originStore || '',
        notes: editingDelivery.notes || ''
      });
    }
  }, [editingDelivery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('You must be logged in to create deliveries.');
      return;
    }

    setIsSubmitting(true);

    try {
      const deliveryData: Delivery = {
        id: editingDelivery?.id || '',
        clientName: formData.clientName,
        phone: formData.phone,
        address: formData.address,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        truckType: formData.truckType,
        invoiceNumber: formData.invoiceNumber,
        originStore: formData.originStore,
        notes: formData.notes,
        status: editingDelivery?.status || 'PENDING',
        createdAt: editingDelivery?.createdAt || new Date().toISOString(),
        createdBy: editingDelivery?.createdBy || user.uid,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid
      };

      let savedDelivery: Delivery;

      if (editingDelivery?.id) {
        // Update existing delivery
        savedDelivery = await updateDeliveryInFirestore(deliveryData);
      } else {
        // Create new delivery
        savedDelivery = await saveDeliveryToFirestore(deliveryData);
      }

      onSubmit(savedDelivery);
      
      // Reset form
      setFormData({
        clientName: '',
        phone: '',
        address: '',
        scheduledDate: '',
        scheduledTime: '',
        truckType: '',
        invoiceNumber: '',
        originStore: '',
        notes: ''
      });

    } catch (error) {
      console.error('Error saving delivery:', error);
      alert('Failed to save delivery. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Package className="mr-2 text-green-600" />
          {editingDelivery ? 'Edit Delivery' : 'Schedule New Delivery'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline w-4 h-4 mr-1" />
              Client Name *
            </label>
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter client name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline w-4 h-4 mr-1" />
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter phone number"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              Delivery Address *
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter delivery address"
            />
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Scheduled Date *
            </label>
            <input
              type="date"
              name="scheduledDate"
              value={formData.scheduledDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="inline w-4 h-4 mr-1" />
              Scheduled Time *
            </label>
            <input
              type="time"
              name="scheduledTime"
              value={formData.scheduledTime}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Truck Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="inline w-4 h-4 mr-1" />
              Truck Type *
            </label>
            <select
              name="truckType"
              value={formData.truckType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select truck type</option>
              <option value="Small Truck">Small Truck</option>
              <option value="Medium Truck">Medium Truck</option>
              <option value="Large Truck">Large Truck</option>
              <option value="Van">Van</option>
            </select>
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline w-4 h-4 mr-1" />
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter invoice number"
            />
          </div>

          {/* Origin Store */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline w-4 h-4 mr-1" />
              Origin Store *
            </label>
            <select
              name="originStore"
              value={formData.originStore}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select origin store</option>
              <option value="Cornerstone Flooring - Langley">Cornerstone Flooring - Langley</option>
              <option value="Cornerstone Flooring - Surrey">Cornerstone Flooring - Surrey</option>
              <option value="Cornerstone Flooring - Richmond">Cornerstone Flooring - Richmond</option>
              <option value="Cornerstone Flooring - Burnaby">Cornerstone Flooring - Burnaby</option>
            </select>
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter any additional notes"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : (editingDelivery ? 'Update Delivery' : 'Schedule Delivery')}
          </button>
        </div>
      </form>
    </div>
  );
};