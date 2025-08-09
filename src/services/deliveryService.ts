import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import { Delivery } from '../types/delivery';

const DELIVERIES_COLLECTION = 'deliveries';

// Get all deliveries from Firestore
export const getDeliveriesFromFirestore = async (): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    // Get all deliveries and sort client-side to avoid composite index requirement
    const querySnapshot = await getDocs(deliveriesRef);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings if needed
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Delivery);
    });
    
    // Sort client-side by scheduledDate and scheduledTime
    deliveries.sort((a, b) => {
      // First sort by date
      if (a.scheduledDate && b.scheduledDate) {
        const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
        if (dateCompare !== 0) return dateCompare;
      }
      
      // Then sort by time
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      
      return 0;
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching deliveries from Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Add new delivery to Firestore
export const addDeliveryToFirestore = async (deliveryData: Partial<Delivery>): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // Filter out undefined values to prevent Firestore errors
    const cleanedData = Object.fromEntries(
      Object.entries(deliveryData).filter(([_, value]) => value !== undefined)
    );
    
    // Ensure required fields for webhook are present
    const dataForFirestore = {
      ...cleanedData,
      // Set default status if not provided
      status: cleanedData.status || 'PENDING',
      // Ensure webhook hasn't been sent yet
      scheduledWebhookSent: false,
      // Map field names for webhook compatibility
      customerName: cleanedData.clientName || cleanedData.customerName || null,
      customerPhone: cleanedData.clientPhone || cleanedData.customerPhone || null,
      address: cleanedData.deliveryAddress || cleanedData.address || null,
      scheduledDateTime: cleanedData.scheduledDate && cleanedData.scheduledTime 
        ? `${cleanedData.scheduledDate} ${cleanedData.scheduledTime}`
        : null,
      invoiceNumber: cleanedData.invoiceNumber || null,
      store: cleanedData.originStore || cleanedData.store || null
    };

    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    const docRef = await addDoc(deliveriesRef, {
      ...dataForFirestore,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log('✅ Delivery created successfully with ID:', docRef.id);
    console.log('📧 Webhook should be triggered automatically by Cloud Function');
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding delivery to Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Update existing delivery in Firestore
export const updateDeliveryInFirestore = async (deliveryId: string, updateData: Partial<Delivery>): Promise<{ success: boolean; error?: string }> => {
  try {
    // Filter out undefined values to prevent Firestore errors
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );
    
    const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
    await updateDoc(deliveryRef, {
      ...cleanedData,
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating delivery in Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Save delivery (create or update)
export const saveDeliveryToFirestore = async (deliveryData: Partial<Delivery>): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (deliveryData.id) {
    // Update existing delivery
    const result = await updateDeliveryInFirestore(deliveryData.id, deliveryData);
    return { ...result, id: deliveryData.id };
  } else {
    // Create new delivery
    return await addDeliveryToFirestore(deliveryData);
  }
};

// Delete delivery from Firestore
export const deleteDeliveryFromFirestore = async (deliveryId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
    await deleteDoc(deliveryRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting delivery from Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Get today's deliveries for a specific store
export const getTodaysDeliveriesForStore = async (store: string, date: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    // First filter by store and date, then sort client-side to avoid composite index requirement
    const q = query(
      deliveriesRef, 
      where('originStore', '==', store),
      where('scheduledDate', '==', date)
    );
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Delivery);
    });
    
    // Sort by scheduledTime client-side
    deliveries.sort((a, b) => {
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      return 0;
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching today\'s deliveries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Update delivery status
export const updateDeliveryStatus = async (deliveryId: string, status: string, additionalData?: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
    
    // Get current delivery data to check ownership
    const deliveryDoc = await getDoc(deliveryRef);
    if (!deliveryDoc.exists()) {
      return { success: false, error: 'Delivery not found' };
    }
    
    const currentData = deliveryDoc.data();
    
    // Check if delivery is already claimed by another driver
    if (currentData.startedBy && additionalData?.startedBy && currentData.startedBy !== additionalData.startedBy) {
      return { success: false, error: 'This delivery has been claimed by another driver' };
    }
    
    const updateData = {
      status,
      updatedAt: serverTimestamp(),
      ...additionalData
    };
    
    // Add edit history entry
    const editEntry = {
      action: 'status_changed',
      editedAt: new Date().toISOString(),
      editedBy: additionalData?.lastUpdatedBy || 'Unknown',
      editedByName: additionalData?.lastUpdatedByName || 'Unknown User',
      changes: `Status changed to ${status}`
    };
    
    if (currentData.editHistory) {
      updateData.editHistory = [...currentData.editHistory, editEntry];
    } else {
      updateData.editHistory = [editEntry];
    }
    
    await updateDoc(deliveryRef, updateData);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Upload delivery photos to Firebase Storage
export const uploadDeliveryPhotos = async (deliveryId: string, files: File[]): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> => {
  try {
    const photoUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const timestamp = Date.now();
      const fileName = `delivery_${deliveryId}_${timestamp}_${i + 1}.jpg`;
      const storageRef = ref(storage, `delivery-photos/${fileName}`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      photoUrls.push(downloadURL);
    }
    
    return { success: true, photoUrls };
  } catch (error) {
    console.error('Error uploading delivery photos:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Handle schedule delivery (wrapper for addDeliveryToFirestore)
export const handleScheduleDelivery = async (deliveryData: Partial<Delivery>): Promise<{ success: boolean; id?: string; error?: string }> => {
  return await addDeliveryToFirestore(deliveryData);
};

// Search deliveries by various criteria
export const searchDeliveries = async (searchTerm: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    // Get all deliveries and filter client-side (Firestore has limited text search)
    const result = await getDeliveriesFromFirestore();
    
    if (!result.success || !result.deliveries) {
      return result;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    const filteredDeliveries = result.deliveries.filter(delivery => 
      delivery.clientName?.toLowerCase().includes(searchTermLower) ||
      delivery.invoiceNumber?.toLowerCase().includes(searchTermLower) ||
      delivery.deliveryAddress?.toLowerCase().includes(searchTermLower) ||
      delivery.clientPhone?.includes(searchTerm)
    );
    
    return { success: true, deliveries: filteredDeliveries };
  } catch (error) {
    console.error('Error searching deliveries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};