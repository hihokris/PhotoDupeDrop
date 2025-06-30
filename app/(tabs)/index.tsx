import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Clock, Hash, Search, Pause, Play, Crown } from 'lucide-react-native';
import { PhotoDetail } from '@/components/PhotoDetail';
import { MatchResultsModal } from '@/components/MatchResultsModal';
import { ViewCounterDisplay } from '@/components/ViewCounterDisplay';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { calculatePHash, calculateHammingDistance } from '@/utils/pHash';
import { viewCounter, ViewCounterState } from '@/utils/viewCounter';
import { userProfileManager } from '@/utils/userProfile';
import { processMatchesWithDeduplication } from '@/utils/matchDeduplication';

const { width } = Dimensions.get('window');
const numColumns = 2;
const imageSize = (width - 60) / numColumns;

interface Photo {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
}

interface PhotoWithHash extends Photo {
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

interface MatchGroup {
  id: string;
  photos: PhotoWithHash[];
  timeWindow: {
    start: number;
    end: number;
  };
  averageTime: number;
}

export default function GalleryTab() {
  const [allPhotos, setAllPhotos] = useState<PhotoWithHash[]>([]);
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingMatches, setProcessingMatches] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [showMatchResults, setShowMatchResults] = useState(false);
  const [processingPaused, setProcessingPaused] = useState(false);
  
  // View counter state
  const [viewCounterState, setViewCounterState] = useState<ViewCounterState | null>(null);
  const [isPaidAccount, setIsPaidAccount] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  
  // Processing control refs
  const processingCancelledRef = useRef(false);
  const processingPausedRef = useRef(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize view counter and user profile
      const [counterState, userProfile] = await Promise.all([
        viewCounter.getCurrentState(),
        userProfileManager.getCurrentProfile(),
      ]);
      
      setViewCounterState(counterState);
      setIsPaidAccount(userProfile.isPaidAccount);

      // Request photo permissions and load photos
      await requestPermission();
    } catch (error) {
      console.error('Error initializing app:', error);
      await requestPermission();
    }
  };

  const requestPermission = async () => {
    if (Platform.OS === 'web') {
      setHasPermission(true);
      loadMockPhotos();
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    
    if (status === 'granted') {
      loadAllPhotos();
    } else {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    try {
      // Simulate purchase process
      await userProfileManager.simulatePurchase(plan);
      setIsPaidAccount(true);
      setShowUpgradePrompt(false);
      
      Alert.alert(
        'Purchase Successful!',
        `Welcome to KleerFrame Pro! You now have unlimited photo matching.`,
        [{ text: 'Continue', onPress: () => {} }]
      );
    } catch (error) {
      console.error('Error processing purchase:', error);
      Alert.alert('Purchase Failed', 'Please try again later.');
    }
  };

  const loadMockPhotos = async () => {
    const mockPhotos: PhotoWithHash[] = [
      {
        id: '1',
        uri: 'https://images.pexels.com/photos/1851415/pexels-photo-1851415.jpeg?auto=compress&cs=tinysrgb&w=400',
        filename: 'landscape-mountains.jpg',
        creationTime: Date.now() - 86400000,
        width: 800,
        height: 600,
      },
      {
        id: '2',
        uri: 'https://images.pexels.com/photos/1851415/pexels-photo-1851415.jpeg?auto=compress&cs=tinysrgb&w=400',
        filename: 'landscape-mountains-copy.jpg',
        creationTime: Date.now() - 86400000 + 600000,
        width: 800,
        height: 600,
      },
      {
        id: '3',
        uri: 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400',
        filename: 'city-sunset.jpg',
        creationTime: Date.now() - 172800000,
        width: 800,
        height: 600,
      },
      {
        id: '4',
        uri: 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400',
        filename: 'city-sunset-edited.jpg',
        creationTime: Date.now() - 172800000 + 300000,
        width: 800,
        height: 600,
      },
      {
        id: '5',
        uri: 'https://images.pexels.com/photos/709552/pexels-photo-709552.jpeg?auto=compress&cs=tinysrgb&w=400',
        filename: 'forest-path.jpg',
        creationTime: Date.now() - 259200000,
        width: 800,
        height: 600,
      },
    ];
    
    setAllPhotos(mockPhotos);
    setTotalCount(mockPhotos.length);
    setLoading(false);
    await findMatchingGroupsWithRealTimeResults(mockPhotos);
  };

  const loadAllPhotos = async () => {
    setLoadingPhotos(true);
    setLoading(true);
    
    try {
      let allAssets: MediaLibrary.Asset[] = [];
      let hasNextPage = true;
      let endCursor: string | undefined;
      let loadedCount = 0;

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1000,
          sortBy: 'creationTime',
          after: endCursor,
        });

        allAssets = [...allAssets, ...result.assets];
        loadedCount += result.assets.length;
        
        setTotalCount(loadedCount);
        
        hasNextPage = result.hasNextPage;
        endCursor = result.endCursor;

        console.log(`Loaded ${loadedCount} photos...`);
      }

      console.log(`Total photos loaded: ${allAssets.length}`);

      const photoData: PhotoWithHash[] = allAssets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        width: asset.width,
        height: asset.height,
      }));

      setAllPhotos(photoData);
      setTotalCount(photoData.length);
      setLoading(false);
      setLoadingPhotos(false);
      
      await findMatchingGroupsWithRealTimeResults(photoData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load photos');
      console.error('Error loading photos:', error);
      setLoading(false);
      setLoadingPhotos(false);
    }
  };

  const findMatchingGroupsWithRealTimeResults = async (photos: PhotoWithHash[]) => {
    setProcessingMatches(true);
    setProcessedCount(0);
    setMatchResults([]);
    processingCancelledRef.current = false;
    processingPausedRef.current = false;
    
    try {
      const sortedPhotos = [...photos].sort((a, b) => b.creationTime - a.creationTime);
      const photosWithHashes: PhotoWithHash[] = [];
      const rawMatches: MatchResult[] = [];
      const batchSize = 5;
      
      // Process photos in batches and calculate hashes
      for (let i = 0; i < sortedPhotos.length; i += batchSize) {
        if (processingCancelledRef.current) break;
        
        // Handle pause
        while (processingPausedRef.current && !processingCancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const batch = sortedPhotos.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (photo) => {
          try {
            const hash = await calculatePHash(photo.uri);
            return { ...photo, pHash: hash };
          } catch (error) {
            console.error(`Failed to calculate hash for ${photo.filename}:`, error);
            return photo;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        photosWithHashes.push(...batchResults);
        
        setProcessedCount(photosWithHashes.length);
        
        // Check for matches in real-time as we process
        await findMatchesInBatch(photosWithHashes, batchResults, rawMatches);
      }

      if (!processingCancelledRef.current) {
        // Apply enhanced deduplication to remove subsets and reciprocals
        console.log(`Raw matches found: ${rawMatches.length}`);
        const deduplicatedMatches = processMatchesWithDeduplication(rawMatches);
        console.log(`Deduplicated matches: ${deduplicatedMatches.length}`);
        
        setMatchResults(deduplicatedMatches);
        
        // Final processing - create match groups from deduplicated results
        const groups = createMatchGroupsFromResults(deduplicatedMatches);
        setMatchGroups(groups);
        setCurrentGroupIndex(0);
        
        console.log(`Final unique matches: ${deduplicatedMatches.length} from ${photosWithHashes.length} photos`);
      }
    } catch (error) {
      console.error('Error finding matching groups:', error);
      Alert.alert('Error', 'Failed to process photo matches');
    } finally {
      setProcessingMatches(false);
    }
  };

  const findMatchesInBatch = async (
    allProcessedPhotos: PhotoWithHash[], 
    newBatch: PhotoWithHash[], 
    rawMatches: MatchResult[]
  ) => {
    for (const newPhoto of newBatch) {
      if (!newPhoto.pHash || processingCancelledRef.current) continue;
      
      const timeWindow = {
        start: newPhoto.creationTime - 15 * 60 * 1000,
        end: newPhoto.creationTime + 15 * 60 * 1000,
      };
      
      const matchingPhotos: PhotoWithHash[] = [newPhoto];
      let totalDistance = 0;
      let validComparisons = 0;
      
      // Find photos within time window with similar hashes
      for (const otherPhoto of allProcessedPhotos) {
        if (otherPhoto.id === newPhoto.id || !otherPhoto.pHash) continue;
        
        if (otherPhoto.creationTime >= timeWindow.start && 
            otherPhoto.creationTime <= timeWindow.end) {
          
          try {
            const distance = await calculateHammingDistance(newPhoto.pHash, otherPhoto.pHash);
            
            if (distance <= 20) { // Updated threshold to 20
              matchingPhotos.push(otherPhoto);
              totalDistance += distance;
              validComparisons++;
            }
          } catch (error) {
            console.error('Error calculating Hamming distance:', error);
          }
        }
      }
      
      // Create match result if we found similar photos
      if (matchingPhotos.length > 1) {
        const averageDistance = validComparisons > 0 ? totalDistance / validComparisons : 0;
        const confidence = Math.max(0, 100 - (averageDistance * 3));
        
        const matchResult: MatchResult = {
          id: `match-${newPhoto.id}-${Date.now()}`,
          photos: matchingPhotos.sort((a, b) => a.creationTime - b.creationTime),
          confidence,
          timeWindow,
          status: 'pending',
          hammingDistance: averageDistance,
        };
        
        rawMatches.push(matchResult);
        
        // Update UI with deduplicated matches in real-time
        const currentDeduplicatedMatches = processMatchesWithDeduplication([...rawMatches]);
        setMatchResults(currentDeduplicatedMatches);
      }
    }
  };

  const createMatchGroupsFromResults = (matches: MatchResult[]): MatchGroup[] => {
    const approvedMatches = matches.filter(m => m.status === 'approved');
    
    return approvedMatches.map(match => ({
      id: match.id,
      photos: match.photos,
      timeWindow: match.timeWindow,
      averageTime: match.photos.reduce((sum, p) => sum + p.creationTime, 0) / match.photos.length,
    })).sort((a, b) => b.averageTime - a.averageTime);
  };

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handlePhotoDeleted = async (photoId: string) => {
    // Update local state immediately
    setAllPhotos(prev => prev.filter(p => p.id !== photoId));
    setMatchGroups(prev => 
      prev.map(group => ({
        ...group,
        photos: group.photos.filter(p => p.id !== photoId)
      })).filter(group => group.photos.length > 1)
    );
    setMatchResults(prev =>
      prev.map(match => ({
        ...match,
        photos: match.photos.filter(p => p.id !== photoId)
      })).filter(match => match.photos.length > 1)
    );

    // Reload photos from device to ensure sync
    if (Platform.OS !== 'web') {
      try {
        await loadAllPhotos();
      } catch (error) {
        console.error('Error reloading photos after deletion:', error);
      }
    }
  };

  const handleApproveMatch = (matchId: string) => {
    setMatchResults(prev =>
      prev.map(match =>
        match.id === matchId ? { ...match, status: 'approved' as const } : match
      )
    );
  };

  const handleRejectMatch = (matchId: string) => {
    setMatchResults(prev =>
      prev.map(match =>
        match.id === matchId ? { ...match, status: 'rejected' as const } : match
      )
    );
  };

  const handlePauseProcessing = () => {
    processingPausedRef.current = true;
    setProcessingPaused(true);
  };

  const handleResumeProcessing = () => {
    processingPausedRef.current = false;
    setProcessingPaused(false);
  };

  const goToNextGroup = () => {
    if (currentGroupIndex < matchGroups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1);
    }
  };

  const formatTimeWindow = (timeWindow: { start: number; end: number }) => {
    const startDate = new Date(timeWindow.start);
    const endDate = new Date(timeWindow.end);
    
    return `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPhoto = ({ item }: { item: PhotoWithHash }) => (
    <TouchableOpacity
      style={styles.photoContainer}
      onPress={() => handlePhotoSelect(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.photo}
        contentFit="cover"
      />
      <View style={styles.photoOverlay}>
        <Text style={styles.photoTime}>
          {new Date(item.creationTime).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
        {item.pHash && (
          <View style={styles.hashIndicator}>
            <Hash size={12} color="#10b981" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Show upgrade prompt if needed
  if (showUpgradePrompt && viewCounterState) {
    return (
      <UpgradePrompt
        visible={true}
        onClose={() => setShowUpgradePrompt(false)}
        onPurchase={handlePurchase}
        remainingViews={viewCounterState.remainingViews}
      />
    );
  }

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Requesting permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Permission Required</Text>
          <Text style={styles.errorText}>
            This app needs access to your photos to find matching images.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestPermission}>
            <Text style={styles.retryButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || loadingPhotos) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>
            {loadingPhotos ? 'Loading all photos...' : 'Preparing photos...'}
          </Text>
          {loadingPhotos && (
            <Text style={styles.progressText}>
              Loaded {totalCount} photos
            </Text>
          )}
          <Text style={styles.infoText}>
            This may take a while for large photo libraries...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show real-time results if processing or if we have matches
  if (processingMatches || matchResults.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Photo Analysis</Text>
            <Text style={styles.subtitle}>
              {processingMatches ? 'Finding unique matches...' : 'Analysis complete'} • {totalCount} photos
            </Text>
          </View>
          <View style={styles.headerRight}>
            {viewCounterState && (
              <ViewCounterDisplay
                remainingViews={viewCounterState.remainingViews}
                isPaidAccount={isPaidAccount}
              />
            )}
            {!isPaidAccount && viewCounterState && viewCounterState.remainingViews <= 10 && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => setShowUpgradePrompt(true)}
                activeOpacity={0.8}
              >
                <Crown size={16} color="#ffffff" />
                <Text style={styles.upgradeButtonText}>Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.viewMatchesButton}
            onPress={() => setShowMatchResults(true)}
            activeOpacity={0.8}
          >
            <Search size={20} color="#ffffff" />
            <Text style={styles.viewMatchesButtonText}>
              View Unique Matches ({matchResults.length})
            </Text>
          </TouchableOpacity>

          {processingMatches && (
            <TouchableOpacity
              style={[styles.pauseResumeButton, processingPaused && styles.resumeButton]}
              onPress={processingPaused ? handleResumeProcessing : handlePauseProcessing}
              activeOpacity={0.8}
            >
              {processingPaused ? (
                <Play size={16} color="#ffffff" />
              ) : (
                <Pause size={16} color="#ffffff" />
              )}
              <Text style={styles.pauseResumeButtonText}>
                {processingPaused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {processingPaused ? 'Processing paused' : 
               processingMatches ? 'Analyzing photos for unique matches...' : 'Analysis complete'}
            </Text>
            <Text style={styles.progressNumbers}>
              {processedCount} / {totalCount}
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { width: `${(processedCount / totalCount) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <View style={styles.centerContent}>
          {processingMatches && (
            <ActivityIndicator size="large" color="#3b82f6" />
          )}
          <Text style={styles.analysisText}>
            {matchResults.length > 0 ? 
              `Found ${matchResults.length} unique matches` :
              'Looking for similar photos...'
            }
          </Text>
          <Text style={styles.infoText}>
            Advanced deduplication removes subsets and reciprocals
          </Text>
        </View>

        <MatchResultsModal
          visible={showMatchResults}
          matches={matchResults}
          processingProgress={{
            processed: processedCount,
            total: totalCount,
            isProcessing: processingMatches && !processingPaused,
          }}
          onClose={() => setShowMatchResults(false)}
          onApproveMatch={handleApproveMatch}
          onRejectMatch={handleRejectMatch}
          onDeletePhoto={handlePhotoDeleted}
          onViewPhoto={handlePhotoSelect}
          onPauseProcessing={handlePauseProcessing}
          onResumeProcessing={handleResumeProcessing}
        />

        {selectedPhoto && (
          <PhotoDetail
            photo={selectedPhoto}
            allPhotos={allPhotos}
            onClose={() => setSelectedPhoto(null)}
            onPhotoSelect={handlePhotoSelect}
            onPhotoDeleted={handlePhotoDeleted}
          />
        )}
      </SafeAreaView>
    );
  }

  if (matchGroups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Photo Matches</Text>
            <Text style={styles.subtitle}>Analyzed {totalCount} photos</Text>
          </View>
          <View style={styles.headerRight}>
            {viewCounterState && (
              <ViewCounterDisplay
                remainingViews={viewCounterState.remainingViews}
                isPaidAccount={isPaidAccount}
              />
            )}
          </View>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.noMatchesTitle}>No Unique Matches Found</Text>
          <Text style={styles.noMatchesText}>
            No photos with similar content were found within 30-minute time windows from your {totalCount} photos after removing duplicates and subsets.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => findMatchingGroupsWithRealTimeResults(allPhotos)}
          >
            <Text style={styles.retryButtonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentGroup = matchGroups[currentGroupIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Photo Matches</Text>
          <Text style={styles.subtitle}>
            Group {currentGroupIndex + 1} of {matchGroups.length} • {totalCount} photos analyzed
          </Text>
        </View>
        <View style={styles.headerRight}>
          {viewCounterState && (
            <ViewCounterDisplay
              remainingViews={viewCounterState.remainingViews}
              isPaidAccount={isPaidAccount}
            />
          )}
        </View>
      </View>

      <View style={styles.groupInfo}>
        <View style={styles.groupInfoRow}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.groupInfoText}>
            {formatDate(currentGroup.averageTime)} • {formatTimeWindow(currentGroup.timeWindow)}
          </Text>
        </View>
        <Text style={styles.groupPhotosCount}>
          {currentGroup.photos.length} matching photos
        </Text>
      </View>

      <FlatList
        data={currentGroup.photos}
        renderItem={renderPhoto}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
      />

      {currentGroupIndex < matchGroups.length - 1 && (
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextGroup}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Next Match</Text>
            <ChevronRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          allPhotos={allPhotos}
          onClose={() => setSelectedPhoto(null)}
          onPhotoSelect={handlePhotoSelect}
          onPhotoDeleted={handlePhotoDeleted}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  viewMatchesButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  viewMatchesButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pauseResumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  resumeButton: {
    backgroundColor: '#10b981',
  },
  pauseResumeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  progressNumbers: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  groupInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  groupPhotosCount: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  grid: {
    padding: 20,
    paddingBottom: 100,
  },
  photoContainer: {
    width: imageSize,
    height: imageSize,
    marginRight: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoTime: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  hashIndicator: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 10,
    padding: 4,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 12,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  analysisText: {
    marginTop: 16,
    fontSize: 18,
    color: '#1f2937',
    textAlign: 'center',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  noMatchesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  noMatchesText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});