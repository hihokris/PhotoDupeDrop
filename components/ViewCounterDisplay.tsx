import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Eye, Crown } from 'lucide-react-native';

interface ViewCounterDisplayProps {
  remainingViews: number;
  isPaidAccount: boolean;
}

export function ViewCounterDisplay({ remainingViews, isPaidAccount }: ViewCounterDisplayProps) {
  if (isPaidAccount) {
    return (
      <View style={styles.paidContainer}>
        <Crown size={16} color="#f59e0b" />
        <Text style={styles.paidText}>Pro • Unlimited</Text>
      </View>
    );
  }

  const isLowViews = remainingViews <= 10;
  const isNoViews = remainingViews === 0;

  return (
    <View style={[
      styles.container,
      isLowViews && styles.lowViewsContainer,
      isNoViews && styles.noViewsContainer,
    ]}>
      <Eye size={16} color={isNoViews ? "#dc2626" : isLowViews ? "#f59e0b" : "#6b7280"} />
      <Text style={[
        styles.text,
        isLowViews && styles.lowViewsText,
        isNoViews && styles.noViewsText,
      ]}>
        {remainingViews} views left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  lowViewsContainer: {
    backgroundColor: '#fef3c7',
  },
  noViewsContainer: {
    backgroundColor: '#fee2e2',
  },
  paidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  lowViewsText: {
    color: '#d97706',
  },
  noViewsText: {
    color: '#dc2626',
  },
  paidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
});