import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK
let firebaseAdminApp: App | null = null;
let firestoreAdmin: Firestore | null = null;
let authAdmin: Auth | null = null;

export function getFirebaseAdmin() {
  if (firebaseAdminApp && firestoreAdmin && authAdmin) {
    return { app: firebaseAdminApp, db: firestoreAdmin, auth: authAdmin };
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let projectId = 'gen-lang-client-0930171043';
    let databaseId = 'ai-studio-bloxfruitsservic-556f2ca4-5b5d-4985-ac48-82fc2f53f72a';

    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.projectId) projectId = cfg.projectId;
      if (cfg.firestoreDatabaseId) databaseId = cfg.firestoreDatabaseId;
    }

    const currentApps = getApps();
    if (currentApps.length > 0) {
      firebaseAdminApp = currentApps[0];
    } else {
      firebaseAdminApp = initializeApp({
        projectId,
      });
    }

    try {
      firestoreAdmin = getFirestore(firebaseAdminApp, databaseId);
    } catch {
      firestoreAdmin = getFirestore(firebaseAdminApp);
    }

    authAdmin = getAuth(firebaseAdminApp);

    return { 
      app: firebaseAdminApp, 
      db: firestoreAdmin, 
      auth: authAdmin 
    };
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Initialization warning:', err.message);
    return { app: null, db: null, auth: null };
  }
}

export const ADMIN_EMAILS: string[] = [
  'shelendra.ubuntu@gmail.com',
  'brajbala1989@gmail.com',
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
];

export const ADMIN_EMAIL = ADMIN_EMAILS[0];

/**
 * Assign the administrative custom claim { admin: true } to a Firebase User UID.
 * This can only be executed on the trusted server via Firebase Admin SDK.
 */
export async function setAdminCustomClaim(uid: string, isAdmin = true): Promise<boolean> {
  const { auth } = getFirebaseAdmin();
  if (!auth) {
    console.error('[FirebaseAdmin] Admin Auth instance unavailable');
    return false;
  }
  try {
    await auth.setCustomUserClaims(uid, { admin: isAdmin });
    console.log(`[FirebaseAdmin] Successfully set { admin: ${isAdmin} } custom claim for UID ${uid}`);
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Failed to set custom claims for UID:', uid, err);
    return false;
  }
}

/**
 * Verify Firebase ID Token and check if user has admin privileges via Firebase Custom Claim.
 */
export async function verifyFirebaseIdToken(token: string): Promise<{ 
  uid: string; 
  email?: string; 
  isAdmin: boolean; 
  hasAdminClaim: boolean;
  claims?: any;
} | null> {
  const { auth } = getFirebaseAdmin();
  if (!auth) {
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token);
    const emailLower = decoded.email?.toLowerCase();
    const isAuthorizedEmail = Boolean(emailLower && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower));

    let hasAdminClaim = decoded.admin === true;

    // If an authorized administrator logs in with their verified email and does not yet have the custom claim,
    // server-mint the { admin: true } custom claim
    if (!hasAdminClaim && isAuthorizedEmail) {
      const assigned = await setAdminCustomClaim(decoded.uid, true);
      if (assigned) {
        hasAdminClaim = true;
      }
    }

    return {
      uid: decoded.uid,
      email: decoded.email,
      isAdmin: hasAdminClaim,
      hasAdminClaim,
      claims: decoded,
    };
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Token verification failed:', err.message);
    return null;
  }
}
