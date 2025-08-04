import { User, Delivery } from '../types/delivery';
import { getDeliveriesFromFirestore, deleteDeliveryFromFirestore } from '../services/deliveryService';

// Demo users
const DEMO_USERS: User[] = [
  {
    id: '1',
    username: 'sales1',
    role: 'salesRep',
    name: 'John Smith'
  },
  {
    id: '2',
    username: 'admin',
    role: 'master',
    name: 'Sarah Johnson'
  }
];

export const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem('cornerstone_users');
  return stored ? JSON.parse(stored) : DEMO_USERS;
};

export const authenticateUser = (username: string, password: string): User | null => {
  // Simple demo authentication - in production, use proper authentication
  const users = getStoredUsers();
  const user = users.find(u => u.username === username);
  
  // Demo: password is same as username
  if (user && password === username) {
    return user;
  }
  
  return null;
};

export const getStoredDeliveries = async (): Promise<Delivery[]> => {
  // Try to get deliveries from Firestore first
  try {
    const result = await getDeliveriesFromFirestore();
    if (result.success && result.deliveries) {
      // Sort deliveries by date and status priority
      const sortedDeliveries = result.deliveries.sort((a, b) => {
        // First sort by scheduled date
        const dateComparison = a.scheduledDate.localeCompare(b.scheduledDate);
        if (dateComparison !== 0) return dateComparison;
        
        // Then sort by status priority
        const statusOrder = { 'Pending': 1, 'pending': 1, 'Getting Load': 2, 'On the Way': 3, 'Complete': 4, 'assigned': 2, 'Accepted': 2, 'In Transit': 3, 'Delivered': 4 };
        const aStatusOrder = statusOrder[a.status as keyof typeof statusOrder] || 5;
        const bStatusOrder = statusOrder[b.status as keyof typeof statusOrder] || 5;
        
        return aStatusOrder - bStatusOrder;
      });
      
      // Also update localStorage with sorted Firestore data
      localStorage.setItem('cornerstone_deliveries', JSON.stringify(sortedDeliveries));
      return sortedDeliveries;
    }
  } catch (error) {
    console.warn('Failed to fetch from Firestore, using localStorage:', error);
  }
  
  // Fallback to localStorage
  const stored = localStorage.getItem('cornerstone_deliveries');
  return stored ? JSON.parse(stored) : [];
};

export const saveDelivery = async (delivery: Delivery): Promise<void> => {
  const deliveries = await getStoredDeliveries();
  
  // Remove any existing delivery with the same ID to prevent duplicates
  const filteredDeliveries = deliveries.filter(d => d.id !== delivery.id);
  
  // Add the updated/new delivery
  filteredDeliveries.push(delivery);
  
  // Sort deliveries by date and time for consistent ordering
  const sortedDeliveries = filteredDeliveries.sort((a, b) => {
    const dateComparison = (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
    if (dateComparison !== 0) return dateComparison;
    return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
  });
  
  localStorage.setItem('cornerstone_deliveries', JSON.stringify(sortedDeliveries));
};

export const deleteDelivery = async (deliveryId: string): Promise<void> => {
  // Delete from Firestore first
  try {
    const result = await deleteDeliveryFromFirestore(deliveryId);
    if (!result.success) {
      console.warn('Failed to delete from Firestore:', result.error);
    }
  } catch (error) {
    console.warn('Error deleting from Firestore:', error);
  }
  
  // Also delete from localStorage
  const deliveries = await getStoredDeliveries();
  const filtered = deliveries.filter(d => d.id !== deliveryId);
  localStorage.setItem('cornerstone_deliveries', JSON.stringify(filtered));
};