import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coach {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  bio?: string;
  phone?: string;
  city?: string;
  disciplines: string[];
  hourly_rate?: number;
  rating: number;
  total_reviews: number;
  reviews?: Review[];
}

interface Review {
  review_id: string;
  client_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function CoachDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { sessionToken } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoach = async () => {
      try {
        const response = await fetch(`${API_URL}/api/coaches/${id}`);
        if (response.ok) {
          const data = await response.json();
          setCoach(data);
        }
      } catch (error) {
        console.error('Fetch coach error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCoach();
  }, [id]);

  const handleBook = () => {
    if (!sessionToken) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver une séance.');
      return;
    }
    router.push(`/booking/${id}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (!coach) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Coach non trouvé</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: coach.picture || 'https://via.placeholder.com/400' }}
            style={styles.coverImage}
          />
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.coachName}>{coach.name}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#64748B" />
                <Text style={styles.locationText}>{coach.city || 'Maroc'}</Text>
              </View>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingText}>{coach.rating}</Text>
              <Text style={styles.reviewCount}>({coach.total_reviews})</Text>
            </View>
          </View>

          {/* Disciplines */}
          <View style={styles.disciplinesContainer}>
            {coach.disciplines.map((discipline) => (
              <View key={discipline} style={styles.disciplineBadge}>
                <Text style={styles.disciplineText}>{discipline}</Text>
              </View>
            ))}
          </View>

          {/* Bio */}
          {coach.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.bioText}>{coach.bio}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="cash" size={24} color="#4ECDC4" />
              <Text style={styles.statValue}>{coach.hourly_rate} MAD</Text>
              <Text style={styles.statLabel}>par heure</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="star" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{coach.rating}</Text>
              <Text style={styles.statLabel}>Note moyenne</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="chatbubbles" size={24} color="#6366F1" />
              <Text style={styles.statValue}>{coach.total_reviews}</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
          </View>

          {/* Reviews */}
          {coach.reviews && coach.reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Avis clients</Text>
              {coach.reviews.slice(0, 3).map((review) => (
                <View key={review.review_id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Ionicons name="person" size={16} color="#64748B" />
                      </View>
                      <Text style={styles.reviewerName}>{review.client_name}</Text>
                    </View>
                    <View style={styles.reviewRating}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={[styles.bookingBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.priceInfo}>
          <Text style={styles.priceLabel}>À partir de</Text>
          <Text style={styles.priceValue}>{coach.hourly_rate} MAD/h</Text>
        </View>
        <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
          <Text style={styles.bookButtonText}>Réserver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  imageContainer: {
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 300,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  coachName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#64748B',
    fontSize: 14,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  ratingText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCount: {
    color: '#64748B',
    fontSize: 12,
  },
  disciplinesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  disciplineBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disciplineText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  bioText: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1E3A5F',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
  },
  bookingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1D32',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
  },
  priceInfo: {},
  priceLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bookButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  bookButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
});
