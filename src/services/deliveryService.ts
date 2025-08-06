import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db } from '../config/firebase';
import { storage } from '../config/firebase';
import { Delivery } from '../types/delivery';
import { getTodaysDeliveriesForStore } from './deliveryService';

const COLLECTION_NAME = 'deliveries';

export interface FirestoreDelivery {
  type?: 'delivery' | 'event' | 'equipmentMaintenance';
  entryType?: 'internal' | 'equipmentMaintenance';
  clientName: string;
  invoiceNumber: string;
  phone: string;
  address: string;
  originStore: string;
  truckType: string;
  scheduledDate: string;
  scheduledTime: string;
  startTime?: string;
  endTime?: string;
  durationInMinutes?: number;
  trips: number;
  material: string;
  notes?: string;
  status: string;
  assignedDriver?: string;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  lastEditedBy?: string;
  lastEditedAt: any; // Firestore Timestamp
  repeat?: string;
  repeatUntil?: string;
}

// Generate recurring events based on repeat settings
const generateRecurringEvents = (baseEvent: any): any[] => {
  if (!baseEvent.repeat || baseEvent.repeat === 'none' || !baseEvent.repeatUntil) {
    return [baseEvent];
  }

  const events = [];
  const startDate = new Date(baseEvent.scheduledDate + 'T00:00:00');
  const endDate = new Date(baseEvent.repeatUntil + 'T00:00:00');
  let currentDate = new Date(startDate);

  // Add the original event
  events.push({
    ...baseEvent,
    isRecurring: true,
    parentEventId: baseEvent.id || 'parent'
  });

  // Generate recurring instances
  while (currentDate < endDate) {
    switch (baseEvent.repeat) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'annually':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        return events;
    }

    if (currentDate <= endDate) {
      const recurringEvent = {
        ...baseEvent,
        id: `${baseEvent.id || 'recurring'}_${currentDate.toISOString().split('T')[0]}`,
        scheduledDate: currentDate.toISOString().split('T')[0],
        isRecurring: true,
        parentEventId: baseEvent.id || 'parent'
      };
      events.push(recurringEvent);
    }
  }

  return events;
};

// Handle schedule delivery submission
export const handleScheduleDelivery = async (values: any) => {
  try {
    const eventData = {
      type: values.type || "delivery",
      entryType: values.entryType || null,
      clientName: values.clientName,
      invoiceNumber: values.invoiceNumber,
      phone: values.phone,
      address: values.address,
      originStore: values.originStore,
      truckType: values.truckType,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      trips: Number(values.trips),
      material: values.material,
      notes: values.notes || "",
      startTime: values.startTime || values.scheduledTime,
      endTime: values.endTime,
      durationInMinutes: values.durationInMinutes,
      status: "Pending",
      assignedDriver: null,
      createdBy: values.userEmail || "Anonymous",
      createdByName: values.userName || values.user || "Anonymous",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      repeat: values.repeat,
      repeatUntil: values.repeatUntil
    };

    // For internal events with repeat settings, generate all recurring instances
    if ((values.type === 'event' || values.type === 'equipmentMaintenance') && values.repeat && values.repeat !== 'none') {
      const recurringEvents = generateRecurringEvents(eventData);
      
      // Save all recurring events
      const batch = writeBatch(db);
      const eventIds = [];
      
      for (const event of recurringEvents) {
        const docRef = doc(collection(db, "deliveries"));
        batch.set(docRef, event);
        eventIds.push(docRef.id);
      }
      
      await batch.commit();
      
      return { 
        success: true, 
        message: `Recurring event created with ${recurringEvents.length} instances.`,
        id: eventIds[0] // Return the first event ID
      };
    } else {
      // Single event or delivery
      const docRef = await addDoc(collection(db, "deliveries"), eventData);
      return { success: true, message: "Event saved to Firebase.", id: docRef.id };
    }

  } catch (error) {
    console.error('Error saving delivery:', error);
    return { 
      success: false, 
      message: "Error saving delivery: " + (error as Error).message 
    };
  }
};

// Convert Delivery to Firestore format
const deliveryToFirestore = (delivery: Delivery, userId: string, userName?: string): Omit<FirestoreDelivery, 'createdAt' | 'updatedAt'> => ({
  type: delivery.type || 'delivery',
  clientName: delivery.clientName,
  invoiceNumber: delivery.invoiceNumber,
  phone: delivery.clientPhone,
  address: delivery.deliveryAddress,
  originStore: delivery.originStore,
  truckType: delivery.truckType,
  scheduledDate: delivery.scheduledDate,
  scheduledTime: delivery.scheduledTime,
  startTime: delivery.startTime || null,
  endTime: delivery.endTime || null,
  durationInMinutes: delivery.durationInMinutes || null,
  trips: delivery.numberOfTrips,
  material: delivery.materialDescription,
  notes: delivery.additionalNotes || null,
  status: delivery.status || 'Pending',
  assignedDriver: delivery.assignedDriver || null,
  createdBy: userId || 'Anonymous',
  createdByName: userName || userId || 'Anonymous',
  lastEditedBy: delivery.lastEditedBy || null,
  lastEditedByName: delivery.lastEditedByName || null,
  lastEditedAt: delivery.lastEditedAt ? new Date(delivery.lastEditedAt) : null,
  repeat: delivery.repeat || null,
  repeatUntil: delivery.repeatUntil || null
});

// Convert Firestore document to Delivery format
const firestoreToDelivery = (doc: any): Delivery => {
  const data = doc.data();
  return {
    id: doc.id,
    type: data.type || 'delivery',
    entryType: data.entryType || (data.type === 'event' ? 'internal' : undefined),
    clientName: data.clientName,
    clientPhone: data.phone,
    deliveryAddress: data.address,
    originStore: data.originStore,
    truckType: data.truckType,
    invoiceNumber: data.invoiceNumber,
    materialDescription: data.material,
    numberOfTrips: data.trips,
    additionalNotes: data.notes,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    startTime: data.startTime || data.scheduledTime, // Fallback for backward compatibility
    endTime: data.endTime,
    durationInMinutes: data.durationInMinutes,
    estimatedTravelTime: data.estimatedTravelTime,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    assignedDriver: data.assignedDriver || undefined,
    status: data.status || 'Pending',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
    lastEditedBy: data.lastEditedBy,
    lastEditedByName: data.lastEditedByName,
    lastEditedAt: data.lastEditedAt instanceof Timestamp ? data.lastEditedAt.toDate().toISOString() : undefined,
    editHistory: data.editHistory || [],
    repeat: data.repeat,
    repeatUntil: data.repeatUntil,
    isRecurring: data.isRecurring,
    parentEventId: data.parentEventId,
    photoUrl: data.photoUrl || undefined, // Legacy single photo support
    photoUrls: data.photoUrls || undefined, // New multiple photos support
    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : data.completedAt || undefined
  };
};

// Save delivery to Firestore
export const saveDeliveryToFirestore = async (delivery: Delivery, userId: string, userName?: string): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    console.log("🔥 ENTROU NA FUNÇÃO saveDeliveryToFirestore");
    const deliveryData = deliveryToFirestore(delivery, userId, userName);
    
    if (delivery.id && delivery.id.startsWith('delivery_')) {
      // This is a new delivery (local ID), create new document
      const newEditHistory = [{
        editedBy: userId,
        editedByName: userName || userId,
        editedAt: new Date().toISOString(),
        action: 'created' as const,
        changes: 'Delivery created'
      }];
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...deliveryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending',
        assignedDriver: null,
        editHistory: newEditHistory
      });
      
      // Send webhook for new delivery creation
      console.log("🚀 Attempting to trigger delivery webhook now...");
      try {
        console.log(`📡 Triggering delivery creation webhook for delivery ${docRef.id}`);
        
        const webhookPayload = {
          name: deliveryData.clientName,
          phone: deliveryData.phone,
          scheduledDate: deliveryData.scheduledDate,
          address: deliveryData.address,
          invoiceNumber: deliveryData.invoiceNumber
        };
        
        console.log(`📤 Sending delivery creation webhook payload:`, webhookPayload);
        
        const response = await fetch("https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/3f877227-3f75-48b4-a4ec-fe434fe61a60", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (response.ok) {
          console.log(`✅ Delivery creation webhook triggered successfully for delivery ${docRef.id}`);
        } else {
          console.error(`❌ Delivery creation webhook failed with status ${response.status}`);
        }
      } catch (webhookError) {
        console.error(`❌ Error triggering delivery creation webhook for delivery ${docRef.id}:`, webhookError);
        // Don't fail the delivery creation if webhook fails
      }
      
      return { success: true, id: docRef.id };
    } else {
      // This is an existing delivery, update it
      // Get current delivery to preserve edit history
      const docRef = doc(db, COLLECTION_NAME, delivery.id);
      const currentDoc = await getDoc(docRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Build new edit history entry
      const newEditEntry = {
        editedBy: userId,
        editedByName: userName || userId,
        editedAt: new Date().toISOString(),
        action: 'edited' as const,
        changes: 'Delivery updated'
      };
      
      // Preserve existing edit history and add new entry
      const updatedEditHistory = [
        ...(currentData.editHistory || []),
        newEditEntry
      ];
      
      await updateDoc(docRef, {
        ...deliveryData,
        updatedAt: serverTimestamp(),
        editHistory: updatedEditHistory
      });
      
      return { success: true, id: delivery.id };
    }
  } catch (error) {
    console.error('Error saving delivery to Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save delivery' 
    };
  }
};

// Get all deliveries from Firestore
export const getDeliveriesFromFirestore = async (): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    console.log('🔍 Fetching deliveries from Firestore for customer tracker...');
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      deliveries.push(firestoreToDelivery(doc));
    });
    
    console.log('✅ Successfully fetched', deliveries.length, 'deliveries from Firestore');
    return { success: true, deliveries };
  } catch (error) {
    console.error('❌ Error fetching deliveries from Firestore:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to fetch deliveries';
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        errorMessage = 'Database access denied - please contact support';
      } else if (error.message.includes('unavailable')) {
        errorMessage = 'Database temporarily unavailable - please try again';
      } else {
        errorMessage = error.message;
      }
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
};

// Delete delivery from Firestore
export const deleteDeliveryFromFirestore = async (deliveryId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, deliveryId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting delivery from Firestore:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete delivery' 
    };
  }
};

// Get unassigned deliveries for a specific store
export const getUnassignedDeliveries = async (store: string, scheduledDate?: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    let q;
    
    if (scheduledDate) {
      // Filter by store, status, and specific date
      q = query(
        collection(db, COLLECTION_NAME),
        where('originStore', '==', store),
        where('status', '==', 'Pending'),
        where('scheduledDate', '==', scheduledDate)
      );
    } else {
      // Filter by store and status only
      q = query(
        collection(db, COLLECTION_NAME),
        where('originStore', '==', store),
        where('status', '==', 'Pending'),
        where('assignedDriver', '==', null)
      );
    }
    
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const delivery = firestoreToDelivery(doc);
      if (scheduledDate) {
        // Only show deliveries that are truly unassigned
        if (!delivery.assignedDriver) {
          deliveries.push(delivery);
        }
      } else {
        // Include all matching deliveries
        deliveries.push(delivery);
      }
    });
    
    console.log(`📊 Query results for store ${store}${scheduledDate ? ` on ${scheduledDate}` : ''}:`, {
      totalFound: deliveries.length,
      deliveries: deliveries.map(d => ({
        id: d.id,
        client: d.clientName,
        date: d.scheduledDate,
        time: d.scheduledTime,
        status: d.status,
        assignedDriver: d.assignedDriver
      }))
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching unassigned deliveries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch unassigned deliveries' 
    };
  }
};

// Get all deliveries for a specific store and date (for drivers to see all statuses)
export const getTodaysDeliveriesForStore = async (store: string, scheduledDate: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    console.log(`📅 Driver Dashboard - Fetching ALL deliveries for store ${store} on ${scheduledDate}`);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('originStore', '==', store),
      where('scheduledDate', '==', scheduledDate)
    );
    
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const delivery = firestoreToDelivery(doc);
      deliveries.push(delivery);
    });
    
    // Sort deliveries by scheduledTime (earliest first)
    const sortedDeliveries = deliveries.sort((a, b) => {
      // Parse time strings (HH:MM format) for proper time comparison
      const timeA = a.scheduledTime.split(':').map(Number);
      const timeB = b.scheduledTime.split(':').map(Number);
      
      // Convert to minutes for easy comparison
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      
      return minutesA - minutesB;
    });
    
    console.log(`📊 Found ${sortedDeliveries.length} deliveries for ${store} on ${scheduledDate}:`, {
      deliveries: deliveries.map(d => ({
        id: d.id,
        client: d.clientName,
        time: d.scheduledTime,
        status: d.status
      }))
    });
    
    return { success: true, deliveries: sortedDeliveries };
  } catch (error) {
    console.error('Error fetching today\'s deliveries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch today\'s deliveries' 
    };
  }
};

// Get assigned deliveries for a specific driver
export const getAssignedDeliveries = async (driverEmail: string): Promise<{ success: boolean; deliveries?: Delivery[]; error?: string }> => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, COLLECTION_NAME),
      where('assignedDriver', '==', driverEmail)
    );
    const querySnapshot = await getDocs(q);
    
    const deliveries: Delivery[] = [];
    querySnapshot.forEach((doc) => {
      const delivery = firestoreToDelivery(doc);
      // Filter by status in memory instead of in query
      if (['assigned', 'Accepted', 'In Transit'].includes(delivery.status)) {
        deliveries.push(delivery);
      }
    });
    
    // Sort in memory instead of in query
    deliveries.sort((a, b) => {
      const dateA = new Date(a.scheduledDate + 'T' + a.scheduledTime);
      const dateB = new Date(b.scheduledDate + 'T' + b.scheduledTime);
      return dateA.getTime() - dateB.getTime();
    });
    
    return { success: true, deliveries };
  } catch (error) {
    console.error('Error fetching assigned deliveries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch assigned deliveries' 
    };
  }
};

// Claim a delivery (assign to driver)
export const claimDelivery = async (deliveryId: string, driverEmail: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, deliveryId);
    await updateDoc(docRef, {
      assignedDriver: driverEmail,
      status: 'Accepted',
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error claiming delivery:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to claim delivery' 
    };
  }
};

// Clean up existing deliveries in Firestore
export const cleanupExistingDeliveries = async (): Promise<{ success: boolean; updatedCount?: number; error?: string }> => {
  try {
    console.log('🧹 Starting delivery cleanup process...');
    
    // Get all deliveries
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    
    if (querySnapshot.empty) {
      console.log('📭 No deliveries found to cleanup');
      return { success: true, updatedCount: 0 };
    }
    
    let updatedCount = 0;
    const batch = writeBatch(db);
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const docRef = doc(db, COLLECTION_NAME, docSnapshot.id);
      let needsUpdate = false;
      const updates: any = {};
      
      // Fix status field
      if (!data.status || data.status === '' || data.status === 'Pending') {
        updates.status = 'pending';
        needsUpdate = true;
        console.log(`📝 Setting status to 'pending' for delivery ${docSnapshot.id}`);
      }
      
      // Fix assignedDriver field
      if (data.assignedDriver === '' || data.assignedDriver === undefined) {
        updates.assignedDriver = null;
        needsUpdate = true;
        console.log(`👤 Setting assignedDriver to null for delivery ${docSnapshot.id}`);
      }
      
      // Fix originStore field
      if (!data.originStore || (data.originStore !== 'Framingham' && data.originStore !== 'Marlborough')) {
        updates.originStore = 'Framingham'; // Default fallback
        needsUpdate = true;
        console.log(`🏪 Setting originStore to 'Framingham' for delivery ${docSnapshot.id}`);
      }
      
      if (needsUpdate) {
        updates.updatedAt = serverTimestamp();
        batch.update(docRef, updates);
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Cleanup completed! Updated ${updatedCount} deliveries.`);
    } else {
      console.log('✨ All deliveries are already clean, no updates needed.');
    }
    
    return { success: true, updatedCount };
  } catch (error) {
    console.error('❌ Error during delivery cleanup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cleanup deliveries' 
    };
  }
};

// Upload delivery photo to Firebase Storage
export const uploadDeliveryPhotos = async (
  deliveryId: string, 
  imageFiles: File[]
): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> => {
  try {
    console.log(`📸 Uploading ${imageFiles.length} photos for delivery ${deliveryId}`);
    
    // Validate all files first
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      
      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          error: `File ${file.name} is not a valid image type. Please select JPEG, PNG, or WebP images.`
        };
      }
      
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File ${file.name} is too large. Please select images under 10MB.`
        };
      }
    }
    
    // Upload all files
    const uploadPromises = imageFiles.map(async (file, index) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `photo_${index + 1}_${timestamp}.${fileExtension}`;
      
      // Create storage reference in delivery-specific folder
      const storageRef = ref(storage, `delivery_photos/${deliveryId}/${fileName}`);
      
      // Upload file
      const uploadResult = await uploadBytes(storageRef, file);
      console.log(`📸 Photo ${index + 1} uploaded successfully:`, uploadResult.metadata.fullPath);
      
      // Get download URL
      const photoUrl = await getDownloadURL(uploadResult.ref);
      console.log(`📸 Photo ${index + 1} URL generated:`, photoUrl);
      
      return photoUrl;
    });
    
    // Wait for all uploads to complete
    const photoUrls = await Promise.all(uploadPromises);
    
    console.log(`📸 All ${photoUrls.length} photos uploaded successfully for delivery ${deliveryId}`);
    
    return {
      success: true,
      photoUrls
    };
    
  } catch (error) {
    console.error('❌ Error uploading delivery photos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload photos'
    };
  }
};

// Legacy function for backward compatibility
export const uploadDeliveryPhoto = async (
  deliveryId: string, 
  imageFile: File
): Promise<{ success: boolean; photoUrl?: string; error?: string }> => {
  const result = await uploadDeliveryPhotos(deliveryId, [imageFile]);
  
  if (result.success && result.photoUrls && result.photoUrls.length > 0) {
    return {
      success: true,
      photoUrl: result.photoUrls[0]
    };
  }
  
  return {
    success: false,
    error: result.error
  };
};

// Update delivery status
export const updateDeliveryStatus = async (deliveryId: string, status: string, additionalData?: any): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`🔄 Updating delivery ${deliveryId} status to: ${status}`, additionalData);
    
    const docRef = doc(db, COLLECTION_NAME, deliveryId);
    
    // Get current document to check ownership and prevent conflicts
    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) {
      return { success: false, error: 'Delivery not found' };
    }
    
    const currentData = currentDoc.data();
    
    // CRITICAL: Prevent different drivers from working on same delivery
    if (currentData.startedBy && additionalData?.lastUpdatedBy && 
        currentData.startedBy !== additionalData.lastUpdatedBy) {
      return { 
        success: false, 
        error: `This delivery is owned by another driver: ${currentData.startedBy}` 
      };
    }
    
    // If trying to claim an already claimed delivery
    if (additionalData?.startedBy && currentData.startedBy && 
        currentData.startedBy !== additionalData.startedBy) {
      return { 
        success: false, 
        error: `Delivery already claimed by: ${currentData.startedBy}` 
      };
    }
    
    // Build new edit history entry for status change
    const newEditEntry = {
      editedBy: additionalData?.lastUpdatedBy || additionalData?.editedBy || 'System',
      editedByName: additionalData?.lastUpdatedByName || additionalData?.editedByName || additionalData?.lastUpdatedBy || 'System',
      editedAt: new Date().toISOString(),
      action: 'status_changed' as const,
      changes: `Status changed to ${status}`
    };
    
    // Preserve existing edit history and add new entry
    const updatedEditHistory = [
      ...(currentData.editHistory || []),
      newEditEntry
    ];
    
    const updateData = {
      status,
      updatedAt: serverTimestamp(),
      editHistory: updatedEditHistory,
      ...additionalData
    };
    
    await updateDoc(docRef, updateData);
    
    console.log(`✅ Successfully updated delivery ${deliveryId} status to: ${status}`);
    
    // Trigger GoHighLevel webhook when status changes to "GETTING LOAD"
    if (status?.toUpperCase().trim() === "GETTING LOAD") {
      try {
        console.log(`📡 Triggering GoHighLevel webhook for delivery ${deliveryId}`);
        
        // Get the updated delivery data for webhook
        const updatedDoc = await getDoc(docRef);
        if (updatedDoc.exists()) {
          const delivery = updatedDoc.data();
          
          const webhookPayload = {
            firstName: delivery.clientName,
            phone: delivery.phone,
            address: delivery.address,
            invoice: delivery.invoiceNumber,
            status: delivery.status
          };
          
          console.log(`📤 Sending webhook payload:`, webhookPayload);
          
          const response = await fetch("https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/e74a90fe-2813-4631-93e3-f3d0aaf27968", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(webhookPayload)
          });
          
          const data = await response.json();
          console.log("📦 Webhook response:", data);
          
          if (response.ok) {
            console.log(`✅ GoHighLevel webhook triggered successfully for delivery ${deliveryId}`);
          } else {
            console.error(`❌ GoHighLevel webhook failed with status ${response.status}:`, data);
          }
        }
      } catch (webhookError) {
        console.error(`❌ Error triggering GoHighLevel webhook for delivery ${deliveryId}:`, webhookError);
        // Don't fail the delivery update if webhook fails
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update delivery status' 
    };
  }
};