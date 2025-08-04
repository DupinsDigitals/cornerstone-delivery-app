import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc,
  query,
  collection,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types/delivery';

// Login with email and password
export const loginWithEmailAndPassword = async (
  email: string, 
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // Authenticate with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user role and details from Firestore
    const userDoc = await getUserFromFirestore(firebaseUser.uid);
    
    if (!userDoc) {
      await signOut(auth); // Sign out if no user document found
      return {
        success: false,
        error: 'User account not found. Please contact your administrator.'
      };
    }

    // Check if user is active
    if (userDoc.status === 'disabled') {
      await signOut(auth); // Sign out disabled users
      return {
        success: false,
        error: 'Your account has been disabled. Please contact your administrator.'
      };
    }

    return {
      success: true,
      user: userDoc
    };

  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle specific Firebase Auth errors
    let errorMessage = 'Login failed. Please try again.';
    
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        errorMessage = 'Invalid email or password.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

// Get user document from Firestore by Firebase UID
const getUserFromFirestore = async (uid: string): Promise<User | null> => {
  try {
    console.log('Looking for user with UID:', uid);
    
    // Method 1: Try to get document using UID as document ID
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        console.log('Found user document using UID as document ID');
        const userData = userDocSnap.data();
        
        return {
          id: userDocSnap.id,
          username: userData.email,
          name: userData.name || userData.fullName || userData.displayName,
          email: userData.email,
          role: userData.role,
          status: userData.status || 'active',
          assignedStore: userData.assignedStore,
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }
    } catch (error) {
      console.log('Error checking document by UID:', error);
    }
    
    // Method 2: Query users collection by uid field
    try {
      const q = query(collection(db, 'users'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      console.log('Query by uid field results:', querySnapshot.size, 'documents found');
      
      if (!querySnapshot.empty) {
        console.log('Found user by uid field query');
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        return {
          id: userDoc.id,
          username: userData.email,
          name: userData.name || userData.fullName || userData.displayName,
          email: userData.email,
          role: userData.role,
          status: userData.status || 'active',
          assignedStore: userData.assignedStore,
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }
    } catch (error) {
      console.log('Error querying by uid field:', error);
    }
    
    // Method 3: Get current Firebase user email and query by email
    try {
      const currentUser = auth.currentUser;
      if (currentUser?.email) {
        console.log('Trying to find user by email:', currentUser.email);
        const emailQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          console.log('Found user by email query');
          const userDoc = emailSnapshot.docs[0];
          const userData = userDoc.data();
          
          return {
            id: userDoc.id,
            username: userData.email,
            name: userData.name || userData.fullName || userData.displayName,
            email: userData.email,
            role: userData.role,
            status: userData.status || 'active',
            assignedStore: userData.assignedStore,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.log('Error querying by email:', error);
    }
    
    console.log('No user document found for UID:', uid);
    return null;
  } catch (error) {
    console.error('Error fetching user from Firestore:', error);
    return null;
  }
};

// Logout user
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: 'Failed to logout. Please try again.'
    };
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // User is signed in, get their role from Firestore
      const userDoc = await getUserFromFirestore(firebaseUser.uid);
      callback(userDoc);
    } else {
      // User is signed out
      callback(null);
    }
  });
};

// Check if user has required role
export const hasRole = (user: User | null, requiredRoles: string[]): boolean => {
  if (!user) return false;
  return requiredRoles.includes(user.role);
};

// Check if user can access specific features
export const canAccessUserManagement = (user: User | null): boolean => {
  return hasRole(user, ['master']);
};

export const canCreateDeliveries = (user: User | null): boolean => {
  return hasRole(user, ['master', 'salesRep']);
};

export const canEditDeliveries = (user: User | null): boolean => {
  return hasRole(user, ['master']);
};

export const canViewDeliveries = (user: User | null): boolean => {
  return hasRole(user, ['master', 'salesRep']);
};

export const canAccessDriverDashboard = (user: User | null): boolean => {
  return hasRole(user, ['driver']);
};