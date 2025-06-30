import AsyncStorage from '@react-native-async-storage/async-storage';

const VIEW_COUNTER_KEY = '@photo_view_counter';
const INITIAL_VIEW_COUNT = 100;

export interface ViewCounterState {
  remainingViews: number;
  totalViews: number;
  lastUpdated: number;
}

export class ViewCounter {
  private static instance: ViewCounter;
  private state: ViewCounterState | null = null;

  private constructor() {}

  static getInstance(): ViewCounter {
    if (!ViewCounter.instance) {
      ViewCounter.instance = new ViewCounter();
    }
    return ViewCounter.instance;
  }

  async initialize(): Promise<ViewCounterState> {
    try {
      const stored = await AsyncStorage.getItem(VIEW_COUNTER_KEY);
      
      if (stored) {
        this.state = JSON.parse(stored);
      } else {
        // First time user - initialize with 100 views
        this.state = {
          remainingViews: INITIAL_VIEW_COUNT,
          totalViews: 0,
          lastUpdated: Date.now(),
        };
        await this.saveState();
      }
      
      return this.state;
    } catch (error) {
      console.error('Error initializing view counter:', error);
      // Fallback to default state
      this.state = {
        remainingViews: INITIAL_VIEW_COUNT,
        totalViews: 0,
        lastUpdated: Date.now(),
      };
      return this.state;
    }
  }

  async decrementView(): Promise<ViewCounterState> {
    if (!this.state) {
      await this.initialize();
    }

    if (this.state!.remainingViews > 0) {
      this.state!.remainingViews -= 1;
      this.state!.totalViews += 1;
      this.state!.lastUpdated = Date.now();
      
      await this.saveState();
    }

    return this.state!;
  }

  async getCurrentState(): Promise<ViewCounterState> {
    if (!this.state) {
      await this.initialize();
    }
    return this.state!;
  }

  async resetCounter(): Promise<ViewCounterState> {
    this.state = {
      remainingViews: INITIAL_VIEW_COUNT,
      totalViews: 0,
      lastUpdated: Date.now(),
    };
    await this.saveState();
    return this.state;
  }

  private async saveState(): Promise<void> {
    try {
      if (this.state) {
        await AsyncStorage.setItem(VIEW_COUNTER_KEY, JSON.stringify(this.state));
      }
    } catch (error) {
      console.error('Error saving view counter state:', error);
    }
  }
}

export const viewCounter = ViewCounter.getInstance();