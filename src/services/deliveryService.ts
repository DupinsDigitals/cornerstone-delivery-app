import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Delivery } from '../types/delivery';

// Get all deliveries from Firestore
export const getDeliveriesFromFirestore = async (): Promise<{
  success: boolean;
  deliveries?: Delivery[];
  error?: string;
}> => {
  try {
    const deliveriesRef = collection(db, 'deliveries');
    const querySnapshot = await getDocs(deliveriesRef);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        claimedAt: data.claimedAt?.toDate?.()?.toISOString() || data.claimedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        scheduledWebhookSentAt: data.scheduledWebhookSentAt?.toDate?.()?.toISOString() || data.scheduledWebhookSentAt
      } as Delivery);
    });
    
    return {
      success: true,
      deliveries
    };
  } catch (error) {
    console.error('Error fetching deliveries from Firestore:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Save delivery to Firestore
export const saveDeliveryToFirestore = async (delivery: Delivery): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> => {
  try {
    const deliveriesRef = collection(db, 'deliveries');
    
    // Prepare delivery data
    const deliveryData = {
      ...delivery,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Remove the id field before saving (Firestore will generate it)
    const { id, ...dataToSave } = deliveryData;
    
    const docRef = await addDoc(deliveriesRef, dataToSave);
    
    return {
      success: true,
      id: docRef.id
    };
  } catch (error) {
    console.error('Error saving delivery to Firestore:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Update delivery in Firestore
export const updateDeliveryInFirestore = async (deliveryId: string, updates: Partial<Delivery>): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(deliveryRef, updateData);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating delivery in Firestore:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Delete delivery from Firestore
export const deleteDeliveryFromFirestore = async (deliveryId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    await deleteDoc(deliveryRef);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting delivery from Firestore:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Update delivery status
export const updateDeliveryStatus = async (
  deliveryId: string, 
  newStatus: string, 
  additionalData?: any
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    
    // Get current delivery data to check ownership
    const deliveryDoc = await getDoc(deliveryRef);
    if (!deliveryDoc.exists()) {
      return {
        success: false,
        error: 'Delivery not found'
      };
    }
    
    const currentData = deliveryDoc.data();
    
    // Prepare update data
    const updateData = {
      status: newStatus,
      updatedAt: serverTimestamp(),
      ...additionalData
    };
    
    // Add edit history entry
    const editHistoryEntry = {
      action: 'status_changed',
      editedAt: new Date().toISOString(),
      editedBy: additionalData?.editedBy || additionalData?.lastUpdatedBy || 'Unknown',
      editedByName: additionalData?.editedByName || additionalData?.lastUpdatedByName || 'Unknown User',
      changes: `Status changed from ${currentData.status || 'Unknown'} to ${newStatus}`
    };
    
    // Add to edit history
    const currentHistory = currentData.editHistory || [];
    updateData.editHistory = [...currentHistory, editHistoryEntry];
    
    await updateDoc(deliveryRef, updateData);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Get today's deliveries for a specific store
export const getTodaysDeliveriesForStore = async (
  store: string, 
  date: string
): Promise<{
  success: boolean;
  deliveries?: Delivery[];
  error?: string;
}> => {
  try {
    const deliveriesRef = collection(db, 'deliveries');
    const q = query(
      deliveriesRef,
      where('originStore', '==', store),
      where('scheduledDate', '==', date),
      orderBy('scheduledTime', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        claimedAt: data.claimedAt?.toDate?.()?.toISOString() || data.claimedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        scheduledWebhookSentAt: data.scheduledWebhookSentAt?.toDate?.()?.toISOString() || data.scheduledWebhookSentAt
      } as Delivery);
    });
    
    return {
      success: true,
      deliveries
    };
  } catch (error) {
    console.error('Error fetching today\'s deliveries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Upload delivery photos to Firebase Storage
export const uploadDeliveryPhotos = async (
  deliveryId: string, 
  files: File[]
): Promise<{
  success: boolean;
  photoUrls?: string[];
  error?: string;
}> => {
  try {
    const photoUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const timestamp = Date.now();
      const fileName = `delivery-${deliveryId}-${timestamp}-${i + 1}.jpg`;
      const storageRef = ref(storage, `delivery-photos/${fileName}`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      photoUrls.push(downloadURL);
    }
    
    return {
      success: true,
      photoUrls
    };
  } catch (error) {
    console.error('Error uploading delivery photos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Batch update multiple deliveries
export const batchUpdateDeliveries = async (
  updates: Array<{ id: string; data: Partial<Delivery> }>
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const batch = writeBatch(db);
    
    updates.forEach(({ id, data }) => {
      const deliveryRef = doc(db, 'deliveries', id);
      batch.update(deliveryRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    });
    
    await batch.commit();
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error batch updating deliveries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};