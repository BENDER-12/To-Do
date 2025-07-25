import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAUyRfibTcxnzC3YnV6iZGeExsV3usMM_E",
    authDomain: "todostream-94eb8.firebaseapp.com",
    projectId: "todostream-94eb8",
    storageBucket: "todostream-94eb8.firebasestorage.app",
    messagingSenderId: "878090612223",
    appId: "1:878090612223:web:72496b79d4587403914bca",
    measurementId: "G-BH0YR5BW4Q"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);



// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase
