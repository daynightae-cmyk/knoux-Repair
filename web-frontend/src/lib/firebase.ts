import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Configure Google OAuth Provider with Google Workspace Scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/documents');
googleProvider.addScope('https://www.googleapis.com/auth/presentations');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/forms.body');

// Flag to track sign-in in progress
let isSigningIn = false;
export const isWorkspaceSigningIn = () => isSigningIn;
// In-memory cache for OAuth access token (per instructions: NEVER in localStorage)
let cachedAccessToken: string | null = null;

// Auth listener callback registrations
type AuthCallback = (user: User | null, accessToken: string | null) => void;
const authListeners: Set<AuthCallback> = new Set();

export const onWorkspaceAuthChange = (cb: AuthCallback) => {
  authListeners.add(cb);
  cb(auth.currentUser, cachedAccessToken);
  return () => {
    authListeners.delete(cb);
  };
};

// Initialize auth state listener
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
  authListeners.forEach((cb) => cb(user, cachedAccessToken));
});

// Test Firestore connection on boot per Firebase skill guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status:', error.message);
    }
    return false;
  }
}

// Google Sign-In with popup
export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to acquire OAuth access token for Google Workspace');
    }

    cachedAccessToken = credential.accessToken;
    authListeners.forEach((cb) => cb(result.user, cachedAccessToken));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  authListeners.forEach((cb) => cb(auth.currentUser, cachedAccessToken));
};

export const signOutGoogleWorkspace = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  authListeners.forEach((cb) => cb(null, null));
};
