import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDOectd6VmEYQmqM5A-j3V-bzXmvWfQkvM",
  authDomain: "cls---delivery-scheduling.firebaseapp.com",
  projectId: "cls---delivery-scheduling",
  storageBucket: "cls---delivery-scheduling.firebasestorage.app",
  messagingSenderId: "330760008981",
  appId: "1:330760008981:web:7a2fed7fb5fecfc4cca51c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

export default app;