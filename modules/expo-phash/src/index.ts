import PHashModule from './PHashModule';

export async function calculatePHash(imageUri: string): Promise<string> {
  return await PHashModule.calculatePHash(imageUri);
}

export async function calculateHammingDistance(hash1: string, hash2: string): Promise<number> {
  return await PHashModule.calculateHammingDistance(hash1, hash2);
}

export async function areImagesSimilar(hash1: string, hash2: string, threshold: number = 10): Promise<boolean> {
  // This can be calculated on JS side since it's just a comparison
  const distance = await PHashModule.calculateHammingDistance(hash1, hash2);
  
  return distance <= threshold;
}