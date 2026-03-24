import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Event {
  event_id: string;
  title: string;
  description: string;
  discipline: string;
  location: string;
  city: string;
  date: string;
  price: number;
  max_participants: number;
  current_participants: number;
  image_url?: string;
}

const disciplines = ['Tous', 'Yoga', 'Running', 'CrossFit', 'Pilates', 'Boxe'];
const cities = ['Toutes', 'Casablanca', 'Rabat', 'Marrakech', 'Taghazout', 'Bouskoura', 'Agadir'];

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState('Tous');
  const [selectedCity, setSelectedCity] = useState('Toutes');

  const fetchEvents = async () => {
    try {
      let url = `${API_URL}/api/events?`;
      if (selectedDiscipline !== 'Tous') {
        url += `discipline=${encodeURIComponent(selectedDiscipline)}&`;
      }
      if (selectedCity !== 'Toutes') {
        url += `city=${encodeURIComponent(selectedCity)}&`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Fetch events error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedDiscipline, selectedCity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [selectedDiscipline, selectedCity]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Événements</Text>
        <Text style={styles.headerSubtitle}>Découvrez les événements sportifs au Maroc</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
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

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#4ECDC4" style={styles.loader} />
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#64748B" />
            <Text style={styles.emptyText}>Aucun événement trouvé</Text>
          </View>
        ) : (
          events.map((event) => (
            <TouchableOpacity
              key={event.event_id}
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.event_id}`)}
            >
              <Image
                source={{ uri: event.image_url || 'https://via.placeholder.com/400x200' }}
                style={styles.eventImage}
              />
              <View style={styles.eventContent}>
                <View style={styles.eventBadges}>
                  <View style={styles.disciplineBadge}>
                    <Text style={styles.disciplineBadgeText}>{event.discipline}</Text>
                  </View>
                  <View style={styles.cityBadge}>
                    <Ionicons name="location" size={12} color="#64748B" />
                    <Text style={styles.cityBadgeText}>{event.city}</Text>
                  </View>
                </View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
                <View style={styles.eventMeta}>
                  <View style={styles.eventMetaItem}>
                    <Ionicons name="calendar" size={16} color="#4ECDC4" />
                    <Text style={styles.eventMetaText}>
                      {format(new Date(event.date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </Text>
                  </View>
                  <View style={styles.eventMetaItem}>
                    <Ionicons name="people" size={16} color="#4ECDC4" />
                    <Text style={styles.eventMetaText}>
                      {event.current_participants}/{event.max_participants}
                    </Text>
                  </View>
                </View>
                <View style={styles.eventFooter}>
                  <Text style={styles.eventPrice}>{event.price} MAD</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${(event.current_participants / event.max_participants) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.spotsText}>
                      {event.max_participants - event.current_participants} places restantes
                    </Text>
                  </View>
                </View>
              </View>
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
  headerSubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  filtersSection: {
    paddingBottom: 16,
  },
  filterScroll: {
    paddingLeft: 20,
    marginBottom: 8,
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
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#0A1628',
    fontWeight: '600',
  },
  content: {
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
  eventCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventImage: {
    width: '100%',
    height: 160,
  },
  eventContent: {
    padding: 16,
  },
  eventBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  disciplineBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  disciplineBadgeText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '500',
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  cityBadgeText: {
    color: '#64748B',
    fontSize: 12,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDescription: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMetaText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventPrice: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressBar: {
    width: 100,
    height: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#4ECDC4',
    borderRadius: 3,
  },
  spotsText: {
    color: '#64748B',
    fontSize: 11,
  },
});
