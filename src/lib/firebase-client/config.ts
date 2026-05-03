import type { FirebaseOptions } from 'firebase/app';

export interface FirebaseConfig extends FirebaseOptions {
  isConfigured: boolean;
  missingKeys: string[];
  isProductionReady: boolean;
}

export class FirebaseConfigManager {
  private static instance: FirebaseConfigManager;
  private config: FirebaseConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): FirebaseConfigManager {
    if (!FirebaseConfigManager.instance) {
      FirebaseConfigManager.instance = new FirebaseConfigManager();
    }
    return FirebaseConfigManager.instance;
  }

  private loadConfig(): FirebaseConfig {
    const config: FirebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
      isConfigured: false,
      missingKeys: [],
      isProductionReady: false,
    };

    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const optionalKeys = ['storageBucket', 'messagingSenderId', 'measurementId'];

    config.missingKeys = requiredKeys.filter(
      (key) =>
        !config[key as keyof FirebaseConfig] ||
        (config[key as keyof FirebaseConfig] as string) === `YOUR_${key.toUpperCase()}_HERE` ||
        (config[key as keyof FirebaseConfig] as string).trim() === '',
    );

    config.isConfigured = config.missingKeys.length === 0;
    config.isProductionReady =
      config.isConfigured && optionalKeys.every((key) => !!config[key as keyof FirebaseConfig]);

    return config;
  }

  getConfig(): FirebaseConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return this.config.isConfigured;
  }

  getMissingKeys(): string[] {
    return this.config.missingKeys;
  }

  shouldUseMock(): boolean {
    return !this.config.isConfigured || process.env.NEXT_PUBLIC_ENABLE_FIREBASE_MOCK === 'true';
  }

  getFirebaseOptions(): FirebaseOptions {
    if (!this.config.isConfigured) {
      throw new Error(
        'Firebase not configured. Missing keys: ' + this.config.missingKeys.join(', '),
      );
    }
    const {
      isConfigured: _isConfigured, // eslint-disable-line @typescript-eslint/no-unused-vars -- destructure-and-discard pattern strips internal diagnostic fields from the object spread passed to firebase.initializeApp()
      missingKeys: _missingKeys, // eslint-disable-line @typescript-eslint/no-unused-vars -- destructure-and-discard: `missingKeys` is a diagnostic list, not a FirebaseOptions field
      isProductionReady: _isProductionReady, // eslint-disable-line @typescript-eslint/no-unused-vars -- destructure-and-discard: internal readiness flag, not part of FirebaseOptions
      ...options
    } = this.config;
    return options;
  }

  isDebugEnabled(): boolean {
    return process.env.NEXT_PUBLIC_FIREBASE_DEBUG === 'true';
  }
}

export const firebaseConfig = FirebaseConfigManager.getInstance();
