import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const createMasterUser = async () => {
  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      "admin@cornerstone.com",
      "password123"
    );
    const user = userCredential.user;

    // Add user metadata to Firestore users collection
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      name: "Master Admin",
      email: "admin@cornerstone.com",
      role: "master",
      status: "active",
      createdAt: serverTimestamp()
    });

    console.log("✅ Master user created successfully!");
    console.log("📧 Email: admin@cornerstone.com");
    console.log("🔑 Password: password123");
    console.log("👑 Role: master");
    
  } catch (error: any) {
    console.error("❌ Error creating master user:", error.message);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-in-use') {
      console.log("ℹ️  Master user already exists with this email");
    } else if (error.code === 'auth/weak-password') {
      console.log("ℹ️  Password should be at least 6 characters");
    } else if (error.code === 'auth/invalid-email') {
      console.log("ℹ️  Invalid email format");
    }
  }
};

// Export for manual execution
export { createMasterUser };

// Uncomment the line below to run this script
// createMasterUser();