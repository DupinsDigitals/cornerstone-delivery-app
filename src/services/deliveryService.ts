import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Delivery } from '../types/delivery';

export const getDeliveriesFromFirestore = async (): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    const deliveriesRef = collection(db, 'deliveries');
    const q = query(deliveriesRef, orderBy('scheduledDate', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      } as Delivery);
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching deliveries from Firestore:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const deleteDeliveryFromFirestore = async (deliveryId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    await deleteDoc(deliveryRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting delivery from Firestore:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const updateDeliveryStatus = async (deliveryId: string, status: string, driverId?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };
    
    if (driverId) {
      updateData.driverId = driverId;
    }
    
    await updateDoc(deliveryRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const uploadDeliveryPhotos = async (deliveryId: string, photos: File[]): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> => {
  try {
    const photoUrls: string[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoRef = ref(storage, `deliveries/${deliveryId}/photo_${i + 1}_${Date.now()}.jpg`);
      
      await uploadBytes(photoRef, photo);
      const downloadURL = await getDownloadURL(photoRef);
      photoUrls.push(downloadURL);
    }
    
    // Update delivery document with photo URLs
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    await updateDoc(deliveryRef, {
      photos: photoUrls,
      updatedAt: serverTimestamp()
    });
    
    return { success: true, photoUrls };
  } catch (error) {
    console.error('Error uploading delivery photos:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const getTodaysDeliveriesForStore = async (store: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const deliveriesRef = collection(db, 'deliveries');
    const q = query(
      deliveriesRef, 
      where('store', '==', store),
      where('scheduledDate', '==', today),
      orderBy('scheduledTime', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const deliveries: Delivery[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      deliveries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      } as Delivery);
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching today\'s deliveries:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const addDeliveryToFirestore = async (delivery: Omit<Delivery, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; deliveryId?: string; error?: string }> => {
  try {
    const deliveriesRef = collection(db, 'deliveries');
    const docRef = await addDoc(deliveriesRef, {
      ...delivery,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, deliveryId: docRef.id };
  } catch (error) {
    console.error('Error adding delivery to Firestore:', error);
    return { success: false, error: (error as Error).message };
  }
};