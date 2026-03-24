import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coach {
  user_id: string;
  name: string;
  picture?: string;
  bio?: string;
  city?: string;
  disciplines: string[];
  hourly_rate?: number;
  rating: number;
  total_reviews: number;
}

const disciplines = ['Tous', 'Yoga', 'Pilates', 'Musculation', 'CrossFit', 'Boxe', 'Running'];
const cities = ['Toutes', 'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState(params.discipline as string || 'Tous');
  const [selectedCity, setSelectedCity] = useState('Toutes');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/coaches?`;
      if (selectedDiscipline !== 'Tous') {
        url += `discipline=${encodeURIComponent(selectedDiscipline)}&`;
      }
      if (selectedCity !== 'Toutes') {
        url += `city=${encodeURIComponent(selectedCity)}&`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCoaches(data);
      }
    } catch (error) {
      console.error('Fetch coaches error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [selectedDiscipline, selectedCity]);

  const filteredCoaches = coaches.filter((coach) =>
    coach.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trouver un Coach</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un coach..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.filterLabel}>Discipline</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {disciplines.map((discipline) => (
            <TouchableOpacity
              key={discipline}
              style={[
                styles.filterChip,
                selectedDiscipline === discipline && styles.filterChipActive,
              ]}
              onPress={() => setSelectedDiscipline(discipline)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedDiscipline === discipline && styles.filterChipTextActive,
                ]}
              >
                {discipline}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Ville</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {cities.map((city) => (
            <TouchableOpacity
              key={city}
              style={[
                styles.filterChip,
                selectedCity === city && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCity(city)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCity === city && styles.filterChipTextActive,
                ]}
              >
                {city}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#4ECDC4" style={styles.loader} />
        ) : filteredCoaches.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#64748B" />
            <Text style={styles.emptyText}>Aucun coach trouvé</Text>
          </View>
        ) : (
          filteredCoaches.map((coach) => (
            <TouchableOpacity
              key={coach.user_id}
              style={styles.coachCard}
              onPress={() => router.push(`/coach/${coach.user_id}`)}
            >
              <Image
                source={{ uri: coach.picture || 'https://via.placeholder.com/100' }}
                style={styles.coachImage}
              />
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>{coach.name}</Text>
                <View style={styles.coachMeta}>
                  <Ionicons name="location" size={14} color="#64748B" />
                  <Text style={styles.coachCity}>{coach.city}</Text>
                </View>
                <View style={styles.disciplinesContainer}>
                  {coach.disciplines.slice(0, 3).map((disc) => (
                    <View key={disc} style={styles.disciplineBadge}>
                      <Text style={styles.disciplineBadgeText}>{disc}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.coachFooter}>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{coach.rating}</Text>
                    <Text style={styles.reviewsText}>({coach.total_reviews} avis)</Text>
                  </View>
                  <Text style={styles.priceText}>{coach.hourly_rate} MAD/h</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1D32',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 14,
  },
  filtersSection: {
    paddingBottom: 16,
  },
  filterLabel: {
    color: '#64748B',
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterScroll: {
    paddingLeft: 20,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#0F1D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  filterChipActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  filterChipText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#0A1628',
    fontWeight: '600',
  },
  results: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 16,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  coachImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  coachInfo: {
    flex: 1,
    marginLeft: 12,
  },
  coachName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  coachMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coachCity: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 4,
  },
  disciplinesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  disciplineBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  disciplineBadgeText: {
    color: '#4ECDC4',
    fontSize: 10,
  },
  coachFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  reviewsText: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 4,
  },
  priceText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
});
