import { NativeModule, requireNativeModule } from 'expo';

declare class PHashModule extends NativeModule {
  calculatePHash(imageUri: string): Promise<string>;
  calculateHammingDistance(hash1: string, hash2: string): Promise<number>;
}

export default requireNativeModule('PHash');