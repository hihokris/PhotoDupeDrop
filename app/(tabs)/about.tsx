import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hash, Search, Image, Zap } from 'lucide-react-native';

export default function AboutTab() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Hash size={48} color="#3b82f6" />
          <Text style={styles.title}>Photo Hash</Text>
          <Text style={styles.subtitle}>Perceptual Hash Calculator</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is Perceptual Hashing?</Text>
          <Text style={styles.sectionText}>
            Perceptual hashing (pHash) is a technique used to generate a unique fingerprint 
            for images based on their visual content. Unlike cryptographic hashes, perceptual 
            hashes are designed to be similar for visually similar images, making them perfect 
            for detecting duplicates, near-duplicates, and identifying images that have been 
            slightly modified.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Image Preprocessing</Text>
                <Text style={styles.stepText}>
                  The image is converted to grayscale and resized to a standard size (32x32 pixels) 
                  to normalize the input data.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>DCT Transformation</Text>
                <Text style={styles.stepText}>
                  A Discrete Cosine Transform (DCT) is applied to extract the most important 
                  visual features while discarding less significant details.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Hash Generation</Text>
                <Text style={styles.stepText}>
                  The DCT coefficients are compared to their median value to generate a 64-bit 
                  binary hash that represents the image's perceptual fingerprint.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            <View style={styles.feature}>
              <Image size={24} color="#3b82f6" />
              <Text style={styles.featureText}>Browse your photo library</Text>
            </View>
            <View style={styles.feature}>
              <Search size={24} color="#3b82f6" />
              <Text style={styles.featureText}>Search by filename or date</Text>
            </View>
            <View style={styles.feature}>
              <Hash size={24} color="#3b82f6" />
              <Text style={styles.featureText}>Generate perceptual hashes</Text>
            </View>
            <View style={styles.feature}>
              <Zap size={24} color="#3b82f6" />
              <Text style={styles.featureText}>Fast, on-device processing</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Use Cases</Text>
          <Text style={styles.sectionText}>
            • <Text style={styles.bold}>Duplicate Detection:</Text> Find similar or identical images in your library{'\n'}
            • <Text style={styles.bold}>Content Verification:</Text> Verify if an image has been modified{'\n'}
            • <Text style={styles.bold}>Image Matching:</Text> Compare images for visual similarity{'\n'}
            • <Text style={styles.bold}>Content Organization:</Text> Group similar photos together
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This app processes all images locally on your device for privacy and speed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  stepContainer: {
    marginTop: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  featureList: {
    marginTop: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#1f2937',
  },
  footer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#0369a1',
    textAlign: 'center',
    lineHeight: 20,
  },
});