import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Delivery } from '../types/delivery';

const DELIVERIES_COLLECTION = 'deliveries';

// Get all deliveries from Firestore
export const getDeliveriesFromFirestore = async (): Promise<Delivery[]> => {
  try {
    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    const querySnapshot = await getDocs(deliveriesRef);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        scheduledDateTime: data.scheduledDateTime?.toDate?.() || data.scheduledDateTime,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      } as Delivery);
    });
    
    return deliveries;
  } catch (error) {
    console.error('Error getting deliveries from Firestore:', error);
    throw error;
  }
};

// Add delivery to Firestore
export const addDeliveryToFirestore = async (deliveryData: Partial<Delivery>): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    const docRef = await addDoc(deliveriesRef, {
      ...deliveryData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: deliveryData.status || 'PENDING'
    });
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding delivery to Firestore:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add delivery'
    };
  }
};

// Handle schedule delivery (wrapper for addDeliveryToFirestore)
export const handleScheduleDelivery = async (deliveryData: Partial<Delivery>): Promise<{ success: boolean; id?: string; error?: string }> => {
  return await addDeliveryToFirestore(deliveryData);
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
      error: error instanceof Error ? error.message : 'Failed to delete delivery'
    };
  }
};

// Get today's deliveries for a specific store
export const getTodaysDeliveriesForStore = async (store: string): Promise<Delivery[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deliveriesRef = collection(db, DELIVERIES_COLLECTION);
    const q = query(
      deliveriesRef,
      where('store', '==', store),
      where('scheduledDateTime', '>=', Timestamp.fromDate(today)),
      where('scheduledDateTime', '<', Timestamp.fromDate(tomorrow)),
      orderBy('scheduledDateTime', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const deliveries: Delivery[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        scheduledDateTime: data.scheduledDateTime?.toDate?.() || data.scheduledDateTime,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      } as Delivery);
    });

    return deliveries;
  } catch (error) {
    console.error('Error getting today\'s deliveries for store:', error);
    throw error;
  }
};

// Update delivery status
export const updateDeliveryStatus = async (deliveryId: string, status: string, additionalData?: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
    await updateDoc(deliveryRef, {
      status,
      updatedAt: Timestamp.now(),
      ...additionalData
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update delivery status'
    };
  }
};

// Upload delivery photos
export const uploadDeliveryPhotos = async (deliveryId: string, photos: File[]): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> => {
  try {
    const photoUrls: string[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoRef = ref(storage, `deliveries/${deliveryId}/photo_${i + 1}_${Date.now()}`);
      
      await uploadBytes(photoRef, photo);
      const downloadURL = await getDownloadURL(photoRef);
      photoUrls.push(downloadURL);
    }
    
    // Update delivery document with photo URLs
    const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
    await updateDoc(deliveryRef, {
      photos: photoUrls,
      updatedAt: Timestamp.now()
    });
    
    return { success: true, photoUrls };
  } catch (error) {
    console.error('Error uploading delivery photos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload photos'
    };
  }
};