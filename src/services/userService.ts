import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  serverTimestamp,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { User } from '../types/delivery';

const USERS_COLLECTION = 'users';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: 'salesRep' | 'driver' | 'master' | 'masterDriver';
  assignedStore?: 'Framingham' | 'Marlborough';
  assignedTruck?: string;
}

// Create new user with Firebase Auth and Firestore
export const createUser = async (userData: CreateUserData): Promise<{ success: boolean; error?: string }> => {
  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const uid = userCredential.user.uid;

    // Store user metadata in Firestore
    await addDoc(collection(db, USERS_COLLECTION), {
      uid,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: 'active',
      assignedStore: userData.assignedStore,
      assignedTruck: userData.assignedTruck,
      createdAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create user' 
    };
  }
};

// Get all users from Firestore
export const getAllUsers = async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        username: data.email, // Use email as username for compatibility
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        assignedStore: data.assignedStore,
        assignedTruck: data.assignedTruck,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });
    
    return { success: true, users };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch users' 
    };
  }
};

// Update user status (activate/deactivate)
export const updateUserStatus = async (userId: string, status: 'active' | 'disabled', assignedStore?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };
    
    if (assignedStore !== undefined) {
      updateData.assignedStore = assignedStore;
    }
    
    await updateDoc(userRef, updateData);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update user status' 
    };
  }
};

// Delete user from both Auth and Firestore
export const deleteUser = async (userId: string, userUid: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Delete from Firestore first
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
    
    // Note: Deleting from Firebase Auth requires the user to be currently signed in
    // In a production app, you'd typically use Firebase Admin SDK on the backend
    // For now, we'll just delete from Firestore
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete user' 
    };
  }
};

// Send password reset email
export const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send password reset email' 
    };
  }
};