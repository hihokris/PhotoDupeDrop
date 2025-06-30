import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { X, Search, Info, Calendar, FileText, Trash2 } from 'lucide-react-native';
import { calculatePHash, calculateHammingDistance } from '@/utils/pHash';

const { width, height } = Dimensions.get('window');

interface Photo {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
}

interface PhotoDetailProps {
  photo: Photo;
  allPhotos: Photo[];
  onClose: () => void;
  onPhotoSelect: (photo: Photo) => void;
  onPhotoDeleted?: (photoId: string) => void;
}

interface SimilarPhoto extends Photo {
  distance: number;
  similarity: number;
}

export function PhotoDetail({ photo, allPhotos, onClose, onPhotoSelect, onPhotoDeleted }: PhotoDetailProps) {
  const [pHash, setPHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [findingSimilar, setFindingSimilar] = useState(false);
  const [similarPhotos, setSimilarPhotos] = useState<SimilarPhoto[]>([]);
  const [showSimilarPhotos, setShowSimilarPhotos] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(photo);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPhoto(photo);
    generateHash();
  }, [photo]);

  const generateHash = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const hash = await calculatePHash(currentPhoto.uri);
      setPHash(hash);
    } catch (err) {
      console.error('Error generating pHash:', err);
      setError('Failed to generate perceptual hash');
    } finally {
      setLoading(false);
    }
  };

  const findSimilarPhotos = async () => {
    if (!pHash) {
      Alert.alert('Error', 'Photo hash not available. Please wait for processing to complete.');
      return;
    }

    setFindingSimilar(true);
    setSimilarPhotos([]);

    try {
      const similarResults: SimilarPhoto[] = [];
      
      const currentHash = pHash;
      const otherPhotos = allPhotos.filter(p => p.id !== currentPhoto.id);
      
      const batchSize = 5;
      
      for (let i = 0; i < otherPhotos.length; i += batchSize) {
        const batch = otherPhotos.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (otherPhoto) => {
          try {
            const otherHash = await calculatePHash(otherPhoto.uri);
            const distance = await calculateHammingDistance(currentHash, otherHash);
            
            // Updated threshold to 20
            if (distance <= 20) {
              const similarity = Math.max(0, 100 - (distance * 4));
              return {
                ...otherPhoto,
                distance,
                similarity
              };
            }
            return null;
          } catch (error) {
            console.error(`Error processing photo ${otherPhoto.filename}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result): result is SimilarPhoto => result !== null);
        similarResults.push(...validResults);

        setSimilarPhotos([...similarResults].sort((a, b) => a.distance - b.distance));
      }

      if (similarResults.length === 0) {
        Alert.alert('No Similar Photos', 'No similar photos were found based on visual content.');
      } else {
        setShowSimilarPhotos(true);
      }
    } catch (err) {
      console.error('Error finding similar photos:', err);
      Alert.alert('Error', 'Failed to find similar photos. Please try again.');
    } finally {
      setFindingSimilar(false);
    }
  };

  const handleDeletePhoto = async (photoToDelete: Photo) => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Delete Not Available',
        'Photo deletion is not available on web platform. This feature requires native device access.'
      );
      return;
    }

    Alert.alert(
      'Delete Photo',
      'Are you sure you want to permanently delete this photo from your device?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingPhotoId(photoToDelete.id);
            try {
              await MediaLibrary.deleteAssetsAsync([photoToDelete.id]);
              
              setSimilarPhotos(prev => prev.filter(p => p.id !== photoToDelete.id));
              onPhotoDeleted?.(photoToDelete.id);
              
              if (photoToDelete.id === currentPhoto.id) {
                onClose();
              }
              
              Alert.alert('Success', 'Photo deleted successfully');
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo. Please try again.');
            } finally {
              setDeletingPhotoId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const imageAspectRatio = currentPhoto.width / currentPhoto.height;
  const maxImageWidth = width - 40;
  const maxImageHeight = height * 0.4;
  
  let imageDisplayWidth = maxImageWidth;
  let imageDisplayHeight = maxImageWidth / imageAspectRatio;
  
  if (imageDisplayHeight > maxImageHeight) {
    imageDisplayHeight = maxImageHeight;
    imageDisplayWidth = imageDisplayHeight * imageAspectRatio;
  }

  const renderSimilarPhoto = ({ item }: { item: SimilarPhoto }) => (
    <View style={styles.similarPhotoContainer}>
      <TouchableOpacity
        style={styles.similarPhotoItem}
        onPress={() => {
          setShowSimilarPhotos(false);
          onPhotoSelect(item);
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.similarPhotoImage}
          contentFit="cover"
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeletePhoto(item)}
        disabled={deletingPhotoId === item.id}
        activeOpacity={0.8}
      >
        {deletingPhotoId === item.id ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Trash2 size={16} color="#ffffff" />
        )}
      </TouchableOpacity>
      
      <View style={styles.similarPhotoInfo}>
        <Text style={styles.similarPhotoName} numberOfLines={1}>
          {item.filename}
        </Text>
        <Text style={styles.similarPhotoSimilarity}>
          {item.similarity.toFixed(1)}% similar
        </Text>
      </View>
    </View>
  );

  if (showSimilarPhotos) {
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSimilarPhotos(false)}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Similar Photos</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowSimilarPhotos(false)}
            >
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.similarPhotosContainer}>
            <View style={styles.originalPhotoSection}>
              <Text style={styles.sectionTitle}>Original Photo</Text>
              <View style={styles.originalPhotoContainer}>
                <Image
                  source={{ uri: currentPhoto.uri }}
                  style={styles.originalPhoto}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(currentPhoto)}
                  disabled={deletingPhotoId === currentPhoto.id}
                  activeOpacity={0.8}
                >
                  {deletingPhotoId === currentPhoto.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Trash2 size={16} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <View style={styles.originalPhotoInfo}>
                  <Text style={styles.originalPhotoName}>{currentPhoto.filename}</Text>
                </View>
              </View>
            </View>

            {similarPhotos.length > 0 && (
              <View style={styles.similarPhotosSection}>
                <Text style={styles.sectionTitle}>
                  Similar Photos ({similarPhotos.length})
                </Text>
                <View style={styles.photosGrid}>
                  {similarPhotos.map((item) => (
                    <View key={item.id} style={styles.gridItem}>
                      {renderSimilarPhoto({ item })}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Photo Details</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: currentPhoto.uri }}
              style={[
                styles.image,
                {
                  width: imageDisplayWidth,
                  height: imageDisplayHeight,
                },
              ]}
              contentFit="contain"
            />
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <FileText size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Filename</Text>
                <Text style={styles.infoValue}>{currentPhoto.filename}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Calendar size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{formatDate(currentPhoto.creationTime)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Info size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dimensions</Text>
                <Text style={styles.infoValue}>
                  {currentPhoto.width} × {currentPhoto.height} pixels
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[
                styles.findSimilarButton,
                (loading || findingSimilar || !pHash) && styles.findSimilarButtonDisabled
              ]}
              onPress={findSimilarPhotos}
              disabled={loading || findingSimilar || !pHash}
              activeOpacity={0.8}
            >
              {findingSimilar ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Search size={20} color="#ffffff" />
              )}
              <Text style={styles.findSimilarButtonText}>
                {findingSimilar ? 'Finding Similar Photos...' : 'Find Similar Photos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deletePhotoButton}
              onPress={() => handleDeletePhoto(currentPhoto)}
              disabled={deletingPhotoId === currentPhoto.id}
              activeOpacity={0.8}
            >
              {deletingPhotoId === currentPhoto.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Trash2 size={20} color="#ffffff" />
              )}
              <Text style={styles.deletePhotoButtonText}>
                {deletingPhotoId === currentPhoto.id ? 'Deleting...' : 'Delete Photo'}
              </Text>
            </TouchableOpacity>

            {loading && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.processingText}>Processing image...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={generateHash}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  image: {
    borderRadius: 12,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  actionSection: {
    gap: 16,
  },
  findSimilarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  findSimilarButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  findSimilarButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deletePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  deletePhotoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  similarPhotosContainer: {
    flex: 1,
  },
  originalPhotoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  originalPhotoContainer: {
    position: 'relative',
    alignSelf: 'center',
  },
  originalPhoto: {
    width: width - 40,
    height: 300,
    borderRadius: 12,
  },
  originalPhotoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  originalPhotoName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  similarPhotosSection: {
    padding: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - 60) / 2,
    marginBottom: 16,
  },
  similarPhotoContainer: {
    position: 'relative',
  },
  similarPhotoItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  similarPhotoImage: {
    width: '100%',
    height: 200,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  similarPhotoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  similarPhotoName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  similarPhotoSimilarity: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '500',
  },
});