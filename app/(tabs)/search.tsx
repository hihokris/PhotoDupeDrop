import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Calendar, Filter } from 'lucide-react-native';
import { PhotoDetail } from '@/components/PhotoDetail';

const { width } = Dimensions.get('window');
const numColumns = 2;
const imageSize = (width - 40 - (numColumns - 1) * 12) / numColumns;

interface Photo {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
}

export default function SearchTab() {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [searchMode, setSearchMode] = useState<'filename' | 'date'>('filename');
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadAllPhotos();
  }, []);

  useEffect(() => {
    filterPhotos();
  }, [searchQuery, allPhotos, searchMode]);

  const loadAllPhotos = async () => {
    if (Platform.OS === 'web') {
      // Web fallback - use mock data
      const mockPhotos: Photo[] = [
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
          uri: 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400',
          filename: 'city-sunset.jpg',
          creationTime: Date.now() - 172800000,
          width: 800,
          height: 600,
        },
        {
          id: '3',
          uri: 'https://images.pexels.com/photos/709552/pexels-photo-709552.jpeg?auto=compress&cs=tinysrgb&w=400',
          filename: 'forest-path.jpg',
          creationTime: Date.now() - 259200000,
          width: 800,
          height: 600,
        },
        {
          id: '4',
          uri: 'https://images.pexels.com/photos/1563356/pexels-photo-1563356.jpeg?auto=compress&cs=tinysrgb&w=400',
          filename: 'ocean-waves.jpg',
          creationTime: Date.now() - 345600000,
          width: 800,
          height: 600,
        },
      ];
      setAllPhotos(mockPhotos);
      setFilteredPhotos(mockPhotos);
      setTotalCount(mockPhotos.length);
      setLoading(false);
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      let allAssets: MediaLibrary.Asset[] = [];
      let hasNextPage = true;
      let endCursor: string | undefined;
      let loadedCount = 0;

      // Load all photos in batches
      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1000, // Load 1000 photos at a time
          sortBy: 'creationTime',
          after: endCursor,
        });

        allAssets = [...allAssets, ...result.assets];
        loadedCount += result.assets.length;
        
        // Update loading progress
        setTotalCount(loadedCount);
        
        hasNextPage = result.hasNextPage;
        endCursor = result.endCursor;

        console.log(`Search: Loaded ${loadedCount} photos...`);
      }

      const photoData: Photo[] = allAssets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        width: asset.width,
        height: asset.height,
      }));

      setAllPhotos(photoData);
      setFilteredPhotos(photoData);
      setTotalCount(photoData.length);
      setLoading(false);
    } catch (error) {
      console.error('Error loading photos:', error);
      setLoading(false);
    }
  };

  const filterPhotos = () => {
    if (!searchQuery.trim()) {
      setFilteredPhotos(allPhotos);
      return;
    }

    const filtered = allPhotos.filter((photo) => {
      if (searchMode === 'filename') {
        return photo.filename.toLowerCase().includes(searchQuery.toLowerCase());
      } else {
        // Date search - format the date and search in it
        const photoDate = new Date(photo.creationTime);
        const dateString = photoDate.toLocaleDateString();
        const yearString = photoDate.getFullYear().toString();
        const monthString = photoDate.toLocaleDateString('en-US', { month: 'long' });
        
        return (
          dateString.includes(searchQuery) ||
          yearString.includes(searchQuery) ||
          monthString.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
    });

    setFilteredPhotos(filtered);
  };

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handlePhotoDeleted = (photoId: string) => {
    setAllPhotos(prev => prev.filter(p => p.id !== photoId));
    setFilteredPhotos(prev => prev.filter(p => p.id !== photoId));
    setTotalCount(prev => prev - 1);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderPhoto = ({ item }: { item: Photo }) => (
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
      <View style={styles.photoInfo}>
        <Text style={styles.filename} numberOfLines={1}>
          {item.filename}
        </Text>
        <Text style={styles.date}>{formatDate(item.creationTime)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Search Photos</Text>
          <Text style={styles.subtitle}>Loading all photos...</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>
            Loaded {totalCount} photos...
          </Text>
          <Text style={styles.infoText}>
            This may take a while for large photo libraries
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Photos</Text>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                searchMode === 'filename' 
                  ? 'Search by filename...' 
                  : 'Search by date (e.g., 2024, January)...'
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                searchMode === 'filename' && styles.filterButtonActive,
              ]}
              onPress={() => setSearchMode('filename')}
            >
              <Filter size={16} color={searchMode === 'filename' ? '#ffffff' : '#6b7280'} />
              <Text style={[
                styles.filterButtonText,
                searchMode === 'filename' && styles.filterButtonTextActive,
              ]}>
                Name
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                searchMode === 'date' && styles.filterButtonActive,
              ]}
              onPress={() => setSearchMode('date')}
            >
              <Calendar size={16} color={searchMode === 'date' ? '#ffffff' : '#6b7280'} />
              <Text style={[
                styles.filterButtonText,
                searchMode === 'date' && styles.filterButtonTextActive,
              ]}>
                Date
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.resultCount}>
          {filteredPhotos.length} of {totalCount} photos
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </Text>
      </View>

      <FlatList
        data={filteredPhotos}
        renderItem={renderPhoto}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  resultCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  grid: {
    padding: 20,
  },
  photoContainer: {
    width: imageSize,
    marginRight: 12,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: imageSize * 0.75,
  },
  photoInfo: {
    padding: 12,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
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
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});