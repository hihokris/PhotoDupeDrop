import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { X, Check, Trash2, SkipForward, ChevronLeft, ChevronRight, Save, Crown } from 'lucide-react-native';
import { viewCounter, ViewCounterState } from '@/utils/viewCounter';
import { userProfileManager } from '@/utils/userProfile';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { ViewCounterDisplay } from '@/components/ViewCounterDisplay';

const { width } = Dimensions.get('window');

interface Photo {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
}

interface MatchResult {
  id: string;
  photos: Photo[];
  confidence: number;
  timeWindow: {
    start: number;
    end: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  hammingDistance: number;
}

interface MatchResultsModalProps {
  visible: boolean;
  matches: MatchResult[];
  processingProgress: {
    processed: number;
    total: number;
    isProcessing: boolean;
  };
  onClose: () => void;
  onApproveMatch: (matchId: string) => void;
  onRejectMatch: (matchId: string) => void;
  onDeletePhoto: (photoId: string) => void;
  onViewPhoto: (photo: Photo) => void;
  onPauseProcessing: () => void;
  onResumeProcessing: () => void;
}

export function MatchResultsModal({
  visible,
  matches,
  processingProgress,
  onClose,
  onApproveMatch,
  onRejectMatch,
  onDeletePhoto,
  onViewPhoto,
  onPauseProcessing,
  onResumeProcessing,
}: MatchResultsModalProps) {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [queuedForDeletion, setQueuedForDeletion] = useState<Set<string>>(new Set());
  const [isProcessingDeletions, setIsProcessingDeletions] = useState(false);
  
  // View counter state
  const [viewCounterState, setViewCounterState] = useState<ViewCounterState | null>(null);
  const [isPaidAccount, setIsPaidAccount] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (visible) {
      initializeViewSystem();
    }
  }, [visible]);

  const initializeViewSystem = async () => {
    try {
      const [counterState, userProfile] = await Promise.all([
        viewCounter.getCurrentState(),
        userProfileManager.getCurrentProfile(),
      ]);
      
      setViewCounterState(counterState);
      setIsPaidAccount(userProfile.isPaidAccount);
      setIsInitialized(true);

      // Show upgrade prompt immediately if no views left and not paid
      if (counterState.remainingViews === 0 && !userProfile.isPaidAccount) {
        setShowUpgradePrompt(true);
      }
    } catch (error) {
      console.error('Error initializing view system:', error);
      setIsInitialized(true);
    }
  };

  const handleViewDecrement = async () => {
    if (!isPaidAccount && viewCounterState) {
      try {
        const newState = await viewCounter.decrementView();
        setViewCounterState(newState);

        // Show upgrade prompt when views reach 0
        if (newState.remainingViews === 0) {
          setShowUpgradePrompt(true);
        }
      } catch (error) {
        console.error('Error decrementing view counter:', error);
      }
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

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10b981'; // Green
    if (confidence >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const queuePhotoForDeletion = (photoId: string) => {
    const newQueued = new Set(queuedForDeletion);
    if (newQueued.has(photoId)) {
      newQueued.delete(photoId);
    } else {
      newQueued.add(photoId);
    }
    setQueuedForDeletion(newQueued);
  };

  const addSelectedToQueue = () => {
    if (selectedPhotos.size === 0) {
      Alert.alert('No Photos Selected', 'Please select photos to add to deletion queue by checking the boxes.');
      return;
    }

    const newQueued = new Set(queuedForDeletion);
    selectedPhotos.forEach(photoId => newQueued.add(photoId));
    setQueuedForDeletion(newQueued);
    setSelectedPhotos(new Set()); // Clear selections after adding to queue
    
    Alert.alert(
      'Added to Deletion Queue',
      `${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's' : ''} added to deletion queue. Use the "Confirm All Deletions" button to permanently delete them.`
    );
  };

  const confirmAllDeletions = async () => {
    if (queuedForDeletion.size === 0) {
      Alert.alert('No Photos Queued', 'No photos are currently queued for deletion.');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Delete Not Available',
        'Photo deletion is not available on web platform. This feature requires native device access.'
      );
      return;
    }

    const queuedPhotos = matches
      .flatMap(match => match.photos)
      .filter(photo => queuedForDeletion.has(photo.id));

    Alert.alert(
      'Confirm All Deletions',
      `Are you sure you want to permanently delete ${queuedForDeletion.size} photo${queuedForDeletion.size > 1 ? 's' : ''} from your device? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setIsProcessingDeletions(true);
            
            try {
              // Convert Set to Array for MediaLibrary
              const photoIds = Array.from(queuedForDeletion);
              
              // Delete all photos at once using MediaLibrary batch delete
              await MediaLibrary.deleteAssetsAsync(photoIds);
              
              // Notify parent component about all deletions
              photoIds.forEach(photoId => onDeletePhoto(photoId));
              
              // Clear the deletion queue
              setQueuedForDeletion(new Set());
              setSelectedPhotos(new Set());
              
              Alert.alert(
                'Deletion Complete',
                `${photoIds.length} photo${photoIds.length > 1 ? 's' : ''} deleted successfully.`
              );
              
              // Close modal if no matches remain
              const remainingMatches = matches.filter(match => 
                match.photos.some(photo => !photoIds.includes(photo.id))
              );
              
              if (remainingMatches.length === 0) {
                onClose();
              }
              
            } catch (error) {
              console.error('Error deleting photos:', error);
              Alert.alert(
                'Deletion Failed',
                'Some photos could not be deleted. Please try again or delete them individually.'
              );
            } finally {
              setIsProcessingDeletions(false);
            }
          }
        }
      ]
    );
  };

  const handleSinglePhotoDelete = async (photoId: string) => {
    // Check view limit for free users
    if (!isPaidAccount && viewCounterState && viewCounterState.remainingViews <= 0) {
      setShowUpgradePrompt(true);
      return;
    }

    queuePhotoForDeletion(photoId);
    
    // Decrement view counter for free users
    await handleViewDecrement();
    
    const isQueued = !queuedForDeletion.has(photoId);
    Alert.alert(
      isQueued ? 'Added to Queue' : 'Removed from Queue',
      isQueued 
        ? 'Photo added to deletion queue. Use "Confirm All Deletions" to permanently delete.'
        : 'Photo removed from deletion queue.'
    );
  };

  const handleSkipMatch = async () => {
    // Check view limit for free users
    if (!isPaidAccount && viewCounterState && viewCounterState.remainingViews <= 0) {
      setShowUpgradePrompt(true);
      return;
    }

    setSelectedPhotos(new Set()); // Clear selections
    
    // Decrement view counter for free users
    await handleViewDecrement();
    
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    } else {
      // No more matches, close modal
      onClose();
    }
  };

  const handlePreviousMatch = () => {
    setSelectedPhotos(new Set()); // Clear selections
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1);
    }
  };

  const handleNextMatch = async () => {
    // Check view limit for free users
    if (!isPaidAccount && viewCounterState && viewCounterState.remainingViews <= 0) {
      setShowUpgradePrompt(true);
      return;
    }

    setSelectedPhotos(new Set()); // Clear selections
    
    // Decrement view counter for free users
    await handleViewDecrement();
    
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    }
  };

  const handleCloseWithConfirmation = () => {
    if (queuedForDeletion.size > 0) {
      Alert.alert(
        'Unsaved Changes',
        `You have ${queuedForDeletion.size} photo${queuedForDeletion.size > 1 ? 's' : ''} queued for deletion. What would you like to do?`,
        [
          {
            text: 'Discard Queue',
            style: 'destructive',
            onPress: () => {
              setQueuedForDeletion(new Set());
              setSelectedPhotos(new Set());
              onClose();
            }
          },
          {
            text: 'Keep Queue',
            style: 'cancel'
          },
          {
            text: 'Delete Now',
            onPress: confirmAllDeletions
          }
        ]
      );
    } else {
      onClose();
    }
  };

  const renderPhoto = (photo: Photo) => {
    const isSelected = selectedPhotos.has(photo.id);
    const isQueued = queuedForDeletion.has(photo.id);
    
    return (
      <View key={photo.id} style={styles.photoContainer}>
        <TouchableOpacity
          style={[styles.photoTouchable, isQueued && styles.photoQueued]}
          onPress={() => onViewPhoto(photo)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.fullWidthImage}
            contentFit="cover"
          />
          
          {/* Queued overlay */}
          {isQueued && (
            <View style={styles.queuedOverlay}>
              <View style={styles.queuedBadge}>
                <Trash2 size={16} color="#ffffff" />
                <Text style={styles.queuedText}>Queued for Deletion</Text>
              </View>
            </View>
          )}
          
          {/* Checkbox overlay */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => togglePhotoSelection(photo.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Check size={16} color="#ffffff" />}
            </View>
          </TouchableOpacity>

          {/* Trash icon overlay */}
          <TouchableOpacity
            style={styles.trashIconContainer}
            onPress={() => handleSinglePhotoDelete(photo.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.trashIcon, isQueued && styles.trashIconQueued]}>
              <Trash2 size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {/* Photo info overlay */}
          <View style={styles.photoInfoOverlay}>
            <Text style={styles.photoFilename} numberOfLines={1}>
              {photo.filename}
            </Text>
            <Text style={styles.photoTime}>
              {formatTime(photo.creationTime)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Show upgrade prompt if no views left and not paid
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

  // Show loading state if not initialized or no matches yet
  if (!isInitialized || matches.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Finding Matches</Text>
              <Text style={styles.headerSubtitle}>
                Analyzing photos for duplicates...
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isInitialized && viewCounterState && (
                <ViewCounterDisplay
                  remainingViews={viewCounterState.remainingViews}
                  isPaidAccount={isPaidAccount}
                />
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Processing Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {processingProgress.isProcessing ? 'Processing photos...' : 'Processing complete'}
              </Text>
              <Text style={styles.progressNumbers}>
                {processingProgress.processed} / {processingProgress.total}
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { 
                    width: `${(processingProgress.processed / processingProgress.total) * 100}%` 
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.emptyStateText}>
              Looking for photo matches...
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Matches will appear here as they're found
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  const currentMatch = matches[currentMatchIndex];
  const confidenceColor = getConfidenceColor(currentMatch.confidence);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCloseWithConfirmation}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Photo Match</Text>
            <Text style={styles.headerSubtitle}>
              {currentMatchIndex + 1} of {matches.length} matches
              {queuedForDeletion.size > 0 && ` • ${queuedForDeletion.size} queued for deletion`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {viewCounterState && (
              <ViewCounterDisplay
                remainingViews={viewCounterState.remainingViews}
                isPaidAccount={isPaidAccount}
              />
            )}
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseWithConfirmation}>
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Deletion Queue Status */}
        {queuedForDeletion.size > 0 && (
          <View style={styles.queueStatusSection}>
            <View style={styles.queueStatusInfo}>
              <Trash2 size={16} color="#ef4444" />
              <Text style={styles.queueStatusText}>
                {queuedForDeletion.size} photo{queuedForDeletion.size > 1 ? 's' : ''} queued for deletion
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmDeleteButton, isProcessingDeletions && styles.confirmDeleteButtonDisabled]}
              onPress={confirmAllDeletions}
              disabled={isProcessingDeletions}
              activeOpacity={0.8}
            >
              {isProcessingDeletions ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Save size={16} color="#ffffff" />
              )}
              <Text style={styles.confirmDeleteButtonText}>
                {isProcessingDeletions ? 'Deleting...' : 'Confirm All Deletions'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Match Info */}
        <View style={styles.matchInfoSection}>
          <View style={styles.matchInfoRow}>
            <Text style={styles.matchTitle}>
              {currentMatch.photos.length} Similar Photos
            </Text>
            <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
              <Text style={styles.confidenceText}>
                {currentMatch.confidence.toFixed(0)}% Match
              </Text>
            </View>
          </View>
          
          <Text style={styles.matchSubtitle}>
            {formatDate(currentMatch.photos[0].creationTime)} • 
            Distance: {currentMatch.hammingDistance} • 
            {getConfidenceText(currentMatch.confidence)} confidence
          </Text>
        </View>

        {/* Navigation Controls */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={[styles.navButton, currentMatchIndex === 0 && styles.navButtonDisabled]}
            onPress={handlePreviousMatch}
            disabled={currentMatchIndex === 0}
            activeOpacity={0.8}
          >
            <ChevronLeft size={20} color={currentMatchIndex === 0 ? "#9ca3af" : "#374151"} />
            <Text style={[styles.navButtonText, currentMatchIndex === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipMatch}
            activeOpacity={0.8}
          >
            <SkipForward size={20} color="#6b7280" />
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, currentMatchIndex === matches.length - 1 && styles.navButtonDisabled]}
            onPress={handleNextMatch}
            disabled={currentMatchIndex === matches.length - 1}
            activeOpacity={0.8}
          >
            <Text style={[styles.navButtonText, currentMatchIndex === matches.length - 1 && styles.navButtonTextDisabled]}>
              Next
            </Text>
            <ChevronRight size={20} color={currentMatchIndex === matches.length - 1 ? "#9ca3af" : "#374151"} />
          </TouchableOpacity>
        </View>

        {/* Photos */}
        <ScrollView 
          style={styles.photosContainer}
          contentContainerStyle={styles.photosContent}
          showsVerticalScrollIndicator={false}
        >
          {currentMatch.photos.map((photo) => renderPhoto(photo))}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {selectedPhotos.size > 0 ? (
            <TouchableOpacity
              style={styles.addToQueueButton}
              onPress={addSelectedToQueue}
              activeOpacity={0.8}
            >
              <Trash2 size={20} color="#ffffff" />
              <Text style={styles.addToQueueButtonText}>
                Add {selectedPhotos.size} Selected to Deletion Queue
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                Select photos and add to queue, or tap trash icons to queue individual photos
              </Text>
              {!isPaidAccount && viewCounterState && viewCounterState.remainingViews <= 10 && (
                <TouchableOpacity
                  style={styles.upgradeHint}
                  onPress={() => setShowUpgradePrompt(true)}
                  activeOpacity={0.8}
                >
                  <Crown size={16} color="#f59e0b" />
                  <Text style={styles.upgradeHintText}>
                    Upgrade for unlimited matching
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  queueStatusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  queueStatusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  queueStatusText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  confirmDeleteButtonDisabled: {
    opacity: 0.6,
  },
  confirmDeleteButtonText: {
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
  matchInfoSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  matchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  matchSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  navigationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  navButtonTextDisabled: {
    color: '#9ca3af',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 8,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  photosContainer: {
    flex: 1,
  },
  photosContent: {
    padding: 16,
    paddingBottom: 100,
  },
  photoContainer: {
    marginBottom: 16,
  },
  photoTouchable: {
    position: 'relative',
  },
  photoQueued: {
    opacity: 0.8,
  },
  fullWidthImage: {
    width: width - 32,
    height: 250,
    borderRadius: 12,
  },
  queuedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 1,
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  queuedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  trashIconContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  trashIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  trashIconQueued: {
    backgroundColor: '#dc2626',
  },
  photoInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  photoFilename: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  photoTime: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.8,
  },
  bottomActions: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  addToQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addToQueueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  upgradeHintText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});