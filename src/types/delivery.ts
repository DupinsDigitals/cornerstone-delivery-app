export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'master' | 'salesRep' | 'driver' | 'masterDriver';
  status?: 'active' | 'disabled';
  assignedStore?: 'Framingham' | 'Marlborough';
  assignedTruck?: string;
  createdAt?: string;
}

export interface Delivery {
  id: string;
  type?: 'delivery' | 'event' | 'equipmentMaintenance';
  entryType?: 'internal' | 'equipmentMaintenance';
  clientName: string;
  clientPhone: string;
  deliveryAddress: string;
  originStore: string;
  truckType: string;
  invoiceNumber: string;
  materialDescription: string;
  numberOfTrips: number;
  additionalNotes?: string;
  scheduledDate: string;
  scheduledTime: string;
  startTime?: string;
  endTime?: string;
  durationInMinutes?: number;
  estimatedTravelTime?: number;
  estimatedTimeMinutes?: number;
  createdBy: string;
  createdByName?: string;
  assignedDriver?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedBy?: string;
  lastUpdatedBy?: string;
  lastUpdatedByName?: string;
  claimedAt?: string;
  assignedTruck?: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
  lastEditedAt?: string;
  editHistory?: {
    editedBy: string;
    editedByName?: string;
    editedAt: string;
    action: 'created' | 'edited' | 'status_changed';
    changes?: string;
  }[];
  // Repeat fields for internal events
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'annually';
  repeatUntil?: string;
  isRecurring?: boolean;
  parentEventId?: string;
  // Photo support - both legacy single photo and new multiple photos
  photoUrl?: string; // Legacy single photo URL
  photoUrls?: string[]; // New multiple photo URLs array
  deliveryComment?: string; // Optional comment added by driver during completion
}