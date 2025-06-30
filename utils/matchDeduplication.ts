interface PhotoWithHash {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
  pHash?: string;
}

interface MatchResult {
  id: string;
  photos: PhotoWithHash[];
  confidence: number;
  timeWindow: {
    start: number;
    end: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  hammingDistance: number;
}

/**
 * Enhanced match deduplication utility that removes:
 * 1. Subset matches (where one group is contained within another)
 * 2. Reciprocal matches (A->B and B->A)
 * 3. Maintains original scoring and ranking
 */
export class MatchDeduplicator {
  /**
   * Remove duplicate matches from the results array
   */
  static deduplicateMatches(matches: MatchResult[]): MatchResult[] {
    if (matches.length <= 1) return matches;

    // Sort matches by confidence (highest first) to prioritize better matches
    const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);
    
    // Step 1: Remove subset matches
    const withoutSubsets = this.removeSubsetMatches(sortedMatches);
    
    // Step 2: Remove reciprocal matches
    const withoutReciprocals = this.removeReciprocalMatches(withoutSubsets);
    
    // Step 3: Remove temporal overlaps (matches with significant photo overlap in time)
    const finalMatches = this.removeTemporalOverlaps(withoutReciprocals);
    
    return finalMatches;
  }

  /**
   * Remove matches where one group is a subset of another
   */
  private static removeSubsetMatches(matches: MatchResult[]): MatchResult[] {
    const filteredMatches: MatchResult[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      let isSubset = false;
      
      // Check if current match is a subset of any already accepted match
      for (const acceptedMatch of filteredMatches) {
        if (this.isSubsetMatch(currentMatch, acceptedMatch)) {
          isSubset = true;
          break;
        }
      }
      
      // If not a subset, check if it makes any existing matches subsets
      if (!isSubset) {
        // Remove any existing matches that are subsets of the current match
        const indicesToRemove: number[] = [];
        
        for (let j = 0; j < filteredMatches.length; j++) {
          if (this.isSubsetMatch(filteredMatches[j], currentMatch)) {
            indicesToRemove.push(j);
          }
        }
        
        // Remove subset matches (in reverse order to maintain indices)
        for (let k = indicesToRemove.length - 1; k >= 0; k--) {
          filteredMatches.splice(indicesToRemove[k], 1);
        }
        
        filteredMatches.push(currentMatch);
      }
    }
    
    return filteredMatches;
  }

  /**
   * Check if match A is a subset of match B
   */
  private static isSubsetMatch(matchA: MatchResult, matchB: MatchResult): boolean {
    const photoIdsA = new Set(matchA.photos.map(p => p.id));
    const photoIdsB = new Set(matchB.photos.map(p => p.id));
    
    // A is a subset of B if all photos in A are also in B, and A has fewer photos
    if (photoIdsA.size >= photoIdsB.size) return false;
    
    for (const photoId of photoIdsA) {
      if (!photoIdsB.has(photoId)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Remove reciprocal matches (A->B and B->A)
   */
  private static removeReciprocalMatches(matches: MatchResult[]): MatchResult[] {
    const processedPairs = new Set<string>();
    const filteredMatches: MatchResult[] = [];
    
    for (const match of matches) {
      const photoIds = match.photos.map(p => p.id).sort();
      const pairKey = this.generatePairKey(photoIds);
      
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        filteredMatches.push(match);
      }
    }
    
    return filteredMatches;
  }

  /**
   * Generate a unique key for a set of photo IDs
   */
  private static generatePairKey(photoIds: string[]): string {
    return photoIds.sort().join('|');
  }

  /**
   * Remove matches with significant temporal and photo overlap
   */
  private static removeTemporalOverlaps(matches: MatchResult[]): MatchResult[] {
    const filteredMatches: MatchResult[] = [];
    
    for (const currentMatch of matches) {
      let hasSignificantOverlap = false;
      
      for (const existingMatch of filteredMatches) {
        const overlap = this.calculatePhotoOverlap(currentMatch, existingMatch);
        const timeOverlap = this.calculateTimeOverlap(currentMatch, existingMatch);
        
        // If there's significant photo overlap (>50%) and time overlap, skip this match
        if (overlap > 0.5 && timeOverlap > 0) {
          hasSignificantOverlap = true;
          break;
        }
      }
      
      if (!hasSignificantOverlap) {
        filteredMatches.push(currentMatch);
      }
    }
    
    return filteredMatches;
  }

  /**
   * Calculate photo overlap ratio between two matches
   */
  private static calculatePhotoOverlap(matchA: MatchResult, matchB: MatchResult): number {
    const photoIdsA = new Set(matchA.photos.map(p => p.id));
    const photoIdsB = new Set(matchB.photos.map(p => p.id));
    
    const intersection = new Set([...photoIdsA].filter(id => photoIdsB.has(id)));
    const union = new Set([...photoIdsA, ...photoIdsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate time window overlap between two matches
   */
  private static calculateTimeOverlap(matchA: MatchResult, matchB: MatchResult): number {
    const startA = matchA.timeWindow.start;
    const endA = matchA.timeWindow.end;
    const startB = matchB.timeWindow.start;
    const endB = matchB.timeWindow.end;
    
    const overlapStart = Math.max(startA, startB);
    const overlapEnd = Math.min(endA, endB);
    
    if (overlapStart >= overlapEnd) return 0;
    
    const overlapDuration = overlapEnd - overlapStart;
    const totalDuration = Math.max(endA, endB) - Math.min(startA, startB);
    
    return overlapDuration / totalDuration;
  }

  /**
   * Advanced deduplication with clustering analysis
   */
  static advancedDeduplication(matches: MatchResult[]): MatchResult[] {
    if (matches.length <= 1) return matches;

    // Group matches by photo clusters
    const clusters = this.identifyPhotoClusters(matches);
    
    // Select best representative match from each cluster
    const representativeMatches: MatchResult[] = [];
    
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        representativeMatches.push(cluster[0]);
      } else {
        // Select the match with highest confidence and most photos
        const bestMatch = cluster.reduce((best, current) => {
          const bestScore = best.confidence * best.photos.length;
          const currentScore = current.confidence * current.photos.length;
          return currentScore > bestScore ? current : best;
        });
        representativeMatches.push(bestMatch);
      }
    }
    
    return representativeMatches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Identify clusters of related matches
   */
  private static identifyPhotoClusters(matches: MatchResult[]): MatchResult[][] {
    const clusters: MatchResult[][] = [];
    const processed = new Set<string>();
    
    for (const match of matches) {
      if (processed.has(match.id)) continue;
      
      const cluster = [match];
      processed.add(match.id);
      
      // Find all matches that share photos with this match
      for (const otherMatch of matches) {
        if (processed.has(otherMatch.id)) continue;
        
        const overlap = this.calculatePhotoOverlap(match, otherMatch);
        if (overlap > 0.3) { // 30% overlap threshold
          cluster.push(otherMatch);
          processed.add(otherMatch.id);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }

  /**
   * Validate match quality and remove low-quality duplicates
   */
  static validateAndCleanMatches(matches: MatchResult[]): MatchResult[] {
    return matches.filter(match => {
      // Remove matches with only 2 photos and low confidence
      if (match.photos.length === 2 && match.confidence < 70) {
        return false;
      }
      
      // Remove matches with very high hamming distance (likely false positives)
      if (match.hammingDistance > 25) {
        return false;
      }
      
      // Ensure minimum time window makes sense
      const timeSpan = match.timeWindow.end - match.timeWindow.start;
      if (timeSpan > 24 * 60 * 60 * 1000) { // More than 24 hours
        return false;
      }
      
      return true;
    });
  }
}

/**
 * Main function to process matches with comprehensive deduplication
 */
export function processMatchesWithDeduplication(rawMatches: MatchResult[]): MatchResult[] {
  // Step 1: Basic validation and cleaning
  const validMatches = MatchDeduplicator.validateAndCleanMatches(rawMatches);
  
  // Step 2: Remove subsets and reciprocals
  const deduplicatedMatches = MatchDeduplicator.deduplicateMatches(validMatches);
  
  // Step 3: Advanced clustering-based deduplication
  const finalMatches = MatchDeduplicator.advancedDeduplication(deduplicatedMatches);
  
  return finalMatches;
}