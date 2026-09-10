import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Data-boundary rule: KNOUX Repair must never silently attach to another
// project's Firebase backend. The bundled configuration slot is an explicit
// opt-in: only a dedicated KNOUX project with configured=true is used. Until
// then the Workspace integration reports "not configured" and every other
// feature keeps working against the local localhost bridge.
interface KnouxFirebaseSlot {
  configured?: boolean;
  projectId?: string;
  apiKey?: string;
}

export function isWorkspaceConfigured(): boolean {
  const slot = firebaseConfig as KnouxFirebaseSlot;
  return slot.configured === true && Boolean(slot.apiKey) && Boolean(slot.projectId) && slot.projectId !== 'knoux-repair-local';
}

function bootApp(): FirebaseApp | null {
  try {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    console.warn('Workspace backend unavailable:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

const configuredApp = isWorkspaceConfigured() ? bootApp() : null;

// Initialize Firebase App (only for a dedicated, explicitly configured project)
export const app = configuredApp;
export const auth: Auth = configuredApp ? getAuth(configuredApp) : ({ currentUser: null } as unknown as Auth);
export const firestore: Firestore = configuredApp ? getFirestore(configuredApp) : (null as unknown as Firestore);

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

// Initialize auth state listener (only when a backend is configured)
if (configuredApp) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    authListeners.forEach((cb) => cb(user, cachedAccessToken));
  });
}

// Test Firestore connection on boot per Firebase skill guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  if (!configuredApp || !firestore) return false;
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
  if (!configuredApp) {
    throw new Error('Google Workspace integration is not configured. Provision a dedicated KNOUX Firebase project to enable sign-in.');
  }
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
  if (!configuredApp) {
    cachedAccessToken = null;
    authListeners.forEach((cb) => cb(null, null));
    return;
  }
  await signOut(auth);
  cachedAccessToken = null;
  authListeners.forEach((cb) => cb(null, null));
};
