import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Crown, Check, X, Star, Zap, Shield } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: (plan: 'monthly' | 'yearly' | 'lifetime') => void;
  remainingViews: number;
}

interface PricingPlan {
  id: 'monthly' | 'yearly' | 'lifetime';
  name: string;
  price: string;
  originalPrice?: string;
  savings?: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

export function UpgradePrompt({ visible, onClose, onPurchase, remainingViews }: UpgradePromptProps) {
  const plans: PricingPlan[] = [
    {
      id: 'monthly',
      name: 'Monthly Pro',
      price: '$4.99',
      features: [
        'Unlimited photo matching',
        'Advanced similarity detection',
        'Batch photo deletion',
        'Priority support',
      ],
      icon: <Zap size={24} color="#3b82f6" />,
    },
    {
      id: 'yearly',
      name: 'Yearly Pro',
      price: '$39.99',
      originalPrice: '$59.88',
      savings: 'Save 33%',
      features: [
        'Everything in Monthly Pro',
        'Advanced analytics',
        'Export match reports',
        'Premium support',
      ],
      popular: true,
      icon: <Star size={24} color="#f59e0b" />,
    },
    {
      id: 'lifetime',
      name: 'Lifetime Pro',
      price: '$99.99',
      originalPrice: '$199.99',
      savings: 'Save 50%',
      features: [
        'Everything in Yearly Pro',
        'Lifetime updates',
        'No recurring payments',
        'VIP support',
      ],
      icon: <Crown size={24} color="#8b5cf6" />,
    },
  ];

  const renderPlan = (plan: PricingPlan) => (
    <TouchableOpacity
      key={plan.id}
      style={[styles.planContainer, plan.popular && styles.popularPlan]}
      onPress={() => onPurchase(plan.id)}
      activeOpacity={0.8}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}
      
      <View style={styles.planHeader}>
        {plan.icon}
        <Text style={styles.planName}>{plan.name}</Text>
      </View>

      <View style={styles.planPricing}>
        <Text style={styles.planPrice}>{plan.price}</Text>
        {plan.originalPrice && (
          <Text style={styles.originalPrice}>{plan.originalPrice}</Text>
        )}
        {plan.savings && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>{plan.savings}</Text>
          </View>
        )}
      </View>

      <View style={styles.planFeatures}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Check size={16} color="#10b981" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planButton}>
        <Text style={styles.planButtonText}>Choose Plan</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Crown size={32} color="#f59e0b" />
            <Text style={styles.headerTitle}>Upgrade to Pro</Text>
            <Text style={styles.headerSubtitle}>
              {remainingViews === 0 
                ? 'You\'ve reached your view limit' 
                : `${remainingViews} views remaining`
              }
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>
              Unlock Unlimited Photo Matching
            </Text>
            <Text style={styles.heroDescription}>
              Get unlimited access to advanced photo duplicate detection, 
              batch operations, and premium features to keep your photo library organized.
            </Text>
          </View>

          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>Why Upgrade?</Text>
            
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Zap size={20} color="#3b82f6" />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Unlimited Matching</Text>
                  <Text style={styles.benefitDescription}>
                    Find duplicates across your entire photo library without limits
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Shield size={20} color="#10b981" />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Advanced Detection</Text>
                  <Text style={styles.benefitDescription}>
                    More accurate similarity detection with fine-tuned algorithms
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Star size={20} color="#f59e0b" />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Premium Features</Text>
                  <Text style={styles.benefitDescription}>
                    Batch operations, analytics, and priority customer support
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.plansSection}>
            <Text style={styles.plansTitle}>Choose Your Plan</Text>
            <View style={styles.plansContainer}>
              {plans.map(renderPlan)}
            </View>
          </View>

          <View style={styles.guaranteeSection}>
            <Shield size={24} color="#10b981" />
            <Text style={styles.guaranteeText}>
              30-day money-back guarantee. Cancel anytime.
            </Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  benefitsSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  benefitsList: {
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  plansSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: '#f8fafc',
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  plansContainer: {
    gap: 16,
  },
  planContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  popularPlan: {
    borderColor: '#f59e0b',
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    right: 20,
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 12,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  originalPrice: {
    fontSize: 16,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  savingsBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  planFeatures: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  planButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  planButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  guaranteeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  guaranteeText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
});