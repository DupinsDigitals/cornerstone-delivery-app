// Create Master User Document in Firestore using specific UID
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

const createMasterUserDocument = async () => {
  try {
    console.log("🚀 Creating Master User document in Firestore...");
    
    const masterUserUid = "aF7A27GddzN3FaDbcmg0zHqEDMG2";
    
    await setDoc(doc(db, "users", masterUserUid), {
      email: "admin@cornerstone.com",
      name: "Eduardo Rosa", // Add both name fields for compatibility
      fullName: "Eduardo Rosa",
      role: "master",
      status: "active",
      createdAt: serverTimestamp(),
      uid: masterUserUid
    });
    
    console.log("✅ Master User document created successfully!");
    console.log("📧 Email: admin@cornerstone.com");
    console.log("👤 Name: Eduardo Rosa");
    console.log("👑 Role: master");
    console.log("🆔 UID: " + masterUserUid);
    console.log("\nYou can now log in to the application!");
    
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error creating master user document:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

// Run the script
createMasterUserDocument();