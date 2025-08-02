// Node.js script to create Master User
// Run this with: node src/utils/setupMasterUser.js

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
const auth = getAuth(app);
const db = getFirestore(app);

const createMasterUser = async () => {
  try {
    console.log("🚀 Creating Master User...");
    
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      "admin@cornerstone.com",
      "password123"
    );
    const user = userCredential.user;
    
    console.log("✅ Firebase Auth user created:", user.uid);

    // Add user metadata to Firestore users collection
    const docRef = await addDoc(collection(db, "users"), {
      uid: user.uid,
      name: "Master Admin", 
      fullName: "Master Admin", // Add both field names for compatibility
      email: "admin@cornerstone.com",
      role: "master",
      status: "active",
      createdAt: serverTimestamp()
    });
    
    console.log("✅ Firestore document created:", docRef.id);
    console.log("\n🎉 Master user created successfully!");
    console.log("📧 Email: admin@cornerstone.com");
    console.log("🔑 Password: password123");
    console.log("👑 Role: master");
    console.log("\nYou can now log in to the application!");
    
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error creating master user:", error.message);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-in-use') {
      console.log("ℹ️  Master user already exists with this email");
      console.log("📧 Email: admin@cornerstone.com");
      console.log("🔑 Password: password123");
    } else if (error.code === 'auth/weak-password') {
      console.log("ℹ️  Password should be at least 6 characters");
    } else if (error.code === 'auth/invalid-email') {
      console.log("ℹ️  Invalid email format");
    }
    
    process.exit(1);
  }
};

// Run the script
createMasterUser();