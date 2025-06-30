import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_KEY = '@user_profile';

export interface UserProfile {
  isPaidAccount: boolean;
  purchaseDate?: number;
  subscriptionType?: 'monthly' | 'yearly' | 'lifetime';
  userId?: string;
}

export class UserProfileManager {
  private static instance: UserProfileManager;
  private profile: UserProfile | null = null;

  private constructor() {}

  static getInstance(): UserProfileManager {
    if (!UserProfileManager.instance) {
      UserProfileManager.instance = new UserProfileManager();
    }
    return UserProfileManager.instance;
  }

  async initialize(): Promise<UserProfile> {
    try {
      const stored = await AsyncStorage.getItem(USER_PROFILE_KEY);
      
      if (stored) {
        this.profile = JSON.parse(stored);
      } else {
        // Default free account
        this.profile = {
          isPaidAccount: false,
        };
        await this.saveProfile();
      }
      
      return this.profile;
    } catch (error) {
      console.error('Error initializing user profile:', error);
      this.profile = { isPaidAccount: false };
      return this.profile;
    }
  }

  async getCurrentProfile(): Promise<UserProfile> {
    if (!this.profile) {
      await this.initialize();
    }
    return this.profile!;
  }

  async upgradeToPaid(subscriptionType: 'monthly' | 'yearly' | 'lifetime'): Promise<UserProfile> {
    this.profile = {
      ...this.profile,
      isPaidAccount: true,
      purchaseDate: Date.now(),
      subscriptionType,
    };
    await this.saveProfile();
    return this.profile;
  }

  async isPaidUser(): Promise<boolean> {
    const profile = await this.getCurrentProfile();
    return profile.isPaidAccount;
  }

  private async saveProfile(): Promise<void> {
    try {
      if (this.profile) {
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(this.profile));
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  // For testing purposes - simulate purchase
  async simulatePurchase(subscriptionType: 'monthly' | 'yearly' | 'lifetime' = 'monthly'): Promise<void> {
    await this.upgradeToPaid(subscriptionType);
  }

  // For testing purposes - reset to free account
  async resetToFree(): Promise<void> {
    this.profile = { isPaidAccount: false };
    await this.saveProfile();
  }
}

export const userProfileManager = UserProfileManager.getInstance();