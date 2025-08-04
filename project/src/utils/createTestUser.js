// Create Test User Document in Firestore using specific UID
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
const db = getFirestore(app);

const createTestUser = async () => {
  try {
    console.log("🚀 Creating Test User document in Firestore...");
    
    const testUserUid = "8gnBPKU370VR6vYmfFZ1qA874C3";
    
    // Create document using UID as document ID
    await setDoc(doc(db, "users", testUserUid), {
      email: "ed@clsupplies.com",
      name: "Eduardo Rosa",
      fullName: "Eduardo Rosa",
      role: "master",
      status: "active",
      createdAt: serverTimestamp(),
      uid: testUserUid
    });
    
    console.log("✅ Test User document created successfully!");
    console.log("📧 Email: ed@clsupplies.com");
    console.log("👤 Name: Eduardo Rosa");
    console.log("👑 Role: master");
    console.log("🆔 UID: " + testUserUid);
    console.log("\nYou can now log in to the application!");
    
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error creating test user document:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

// Run the script
createTestUser();