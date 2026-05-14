import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export interface NativeGoogleCredential {
  idToken: string;
  accessToken: string | null;
}

export async function signInWithNativeGoogle(): Promise<NativeGoogleCredential> {
  const native = await FirebaseAuthentication.signInWithGoogle();
  const idToken = native.credential?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in returned no idToken');
  }
  return {
    idToken,
    accessToken: native.credential?.accessToken ?? null,
  };
}
