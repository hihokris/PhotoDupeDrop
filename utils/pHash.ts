import { Platform } from 'react-native';

// Import the native module only for mobile platforms
let PHashModule: any = null;

if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    PHashModule = require('../modules/expo-phash/src/index');
  } catch (error) {
    console.warn('Native pHash module not available:', error);
  }
}

/**
 * Calculate perceptual hash for an image
 * Uses native implementation on mobile, web fallback for web platform
 */
export async function calculatePHash(imageUri: string): Promise<string> {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    if (PHashModule) {
      try {
        return await PHashModule.calculatePHash(imageUri);
      } catch (error) {
        console.error('Native pHash calculation failed:', error);
        throw new Error('Failed to calculate perceptual hash using native module');
      }
    } else {
      throw new Error('Native pHash module not available');
    }
  }

  // Web fallback implementation
  return calculatePHashWeb(imageUri);
}

/**
 * Web-based pHash implementation using Canvas API
 */
async function calculatePHashWeb(imageUri: string): Promise<string> {
  try {
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Resize image to 32x32 for DCT processing
          const size = 32;
          canvas.width = size;
          canvas.height = size;
          
          // Draw and resize image
          ctx.drawImage(img, 0, 0, size, size);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, size, size);
          const pixels = imageData.data;
          
          // Convert to grayscale
          const grayscale: number[] = [];
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // Use luminance formula for grayscale conversion
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            grayscale.push(gray);
          }
          
          // Apply DCT (Discrete Cosine Transform)
          const dctCoefficients = applyDCT(grayscale, size);
          
          // Generate hash from DCT coefficients
          const hash = generateHashFromDCT(dctCoefficients);
          
          resolve(hash);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUri;
    });
  } catch (error) {
    console.error('Error calculating pHash:', error);
    throw error;
  }
}

/**
 * Apply 2D Discrete Cosine Transform
 */
function applyDCT(pixels: number[], size: number): number[][] {
  const dct: number[][] = [];
  
  // Initialize DCT coefficient matrix
  for (let i = 0; i < size; i++) {
    dct[i] = new Array(size).fill(0);
  }
  
  // Apply 2D DCT
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const pixelValue = pixels[x * size + y];
          const cosU = Math.cos((2 * x + 1) * u * Math.PI / (2 * size));
          const cosV = Math.cos((2 * y + 1) * v * Math.PI / (2 * size));
          sum += pixelValue * cosU * cosV;
        }
      }
      
      // Apply normalization factors
      const alphaU = u === 0 ? 1 / Math.sqrt(2) : 1;
      const alphaV = v === 0 ? 1 / Math.sqrt(2) : 1;
      
      dct[u][v] = (2 / size) * alphaU * alphaV * sum;
    }
  }
  
  return dct;
}

/**
 * Generate hash from DCT coefficients
 */
function generateHashFromDCT(dctCoefficients: number[][]): string {
  // Use top-left 8x8 DCT coefficients (excluding DC component at [0,0])
  const hashSize = 8;
  const coefficients: number[] = [];
  
  for (let i = 0; i < hashSize; i++) {
    for (let j = 0; j < hashSize; j++) {
      if (i === 0 && j === 0) continue; // Skip DC component
      coefficients.push(dctCoefficients[i][j]);
    }
  }
  
  // Calculate median of coefficients
  const sortedCoefficients = [...coefficients].sort((a, b) => a - b);
  const median = sortedCoefficients[Math.floor(sortedCoefficients.length / 2)];
  
  // Generate binary hash based on median comparison
  let binaryHash = '';
  for (const coeff of coefficients) {
    binaryHash += coeff > median ? '1' : '0';
  }
  
  // Convert binary to hexadecimal
  let hexHash = '';
  for (let i = 0; i < binaryHash.length; i += 4) {
    const binaryChunk = binaryHash.substr(i, 4);
    hexHash += parseInt(binaryChunk, 2).toString(16);
  }
  
  return hexHash.toUpperCase();
}

/**
 * Calculate Hamming distance between two pHash values
 * Lower distance means more similar images
 */
export async function calculateHammingDistance(hash1: string, hash2: string): Promise<number> {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    if (PHashModule) {
      try {
        return await PHashModule.calculateHammingDistance(hash1, hash2);
      } catch (error) {
        console.error('Native Hamming distance calculation failed:', error);
        // Fall back to JS implementation
      }
    }
  }

  // JavaScript fallback implementation
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must be equal');
  }
  
  let distance = 0;
  
  for (let i = 0; i < hash1.length; i++) {
    const int1 = parseInt(hash1[i], 16);
    const int2 = parseInt(hash2[i], 16);
    
    // XOR and count set bits
    let xor = int1 ^ int2;
    while (xor !== 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  
  return distance;
}

/**
 * Determine if two images are similar based on their pHash values
 * Threshold of 10 or less typically indicates similar images
 */
export async function areImagesSimilar(hash1: string, hash2: string, threshold: number = 10): Promise<boolean> {
  const distance = await calculateHammingDistance(hash1, hash2);
  return distance <= threshold;
}