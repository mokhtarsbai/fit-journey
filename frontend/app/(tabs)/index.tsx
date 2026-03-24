import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coach {
  user_id: string;
  name: string;
  picture?: string;
  city?: string;
  disciplines: string[];
  hourly_rate?: number;
  rating: number;
  total_reviews: number;
}

interface Event {
  event_id: string;
  title: string;
  description: string;
  discipline: string;
  city: string;
  date: string;
  price: number;
  image_url?: string;
  current_participants: number;
  max_participants: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sessionToken, logout } = useAuth();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [coachesRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/api/coaches`),
        fetch(`${API_URL}/api/events`),
      ]);

      if (coachesRes.ok) {
        const coachesData = await coachesRes.json();
        setCoaches(coachesData);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const disciplines = ['Yoga', 'Pilates', 'Musculation', 'CrossFit', 'Boxe', 'Running'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.name || 'Bienvenue'}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={logout}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-circle" size={40} color="#4ECDC4" />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/search')}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(78, 205, 196, 0.2)' }]}>
              <Ionicons name="search" size={24} color="#4ECDC4" />
            </View>
            <Text style={styles.quickActionText}>Trouver un coach</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/bookings')}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
              <Ionicons name="calendar" size={24} color="#6366F1" />
            </View>
            <Text style={styles.quickActionText}>Mes séances</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/community')}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
              <Ionicons name="journal" size={24} color="#EC4899" />
            </View>
            <Text style={styles.quickActionText}>Mon journal</Text>
          </TouchableOpacity>
        </View>

        {/* Disciplines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disciplines</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.disciplinesScroll}>
            {disciplines.map((discipline) => (
              <TouchableOpacity
                key={discipline}
                style={styles.disciplineChip}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { discipline } })}
              >
                <Text style={styles.disciplineText}>{discipline}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Top Coaches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coachs populaires</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {coaches.map((coach) => (
              <TouchableOpacity
                key={coach.user_id}
                style={styles.coachCard}
                onPress={() => router.push(`/coach/${coach.user_id}`)}
              >
                <Image
                  source={{ uri: coach.picture || 'https://via.placeholder.com/150' }}
                  style={styles.coachImage}
                />
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{coach.name}</Text>
                  <Text style={styles.coachCity}>{coach.city}</Text>
                  <View style={styles.coachRating}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{coach.rating}</Text>
                    <Text style={styles.reviewsText}>({coach.total_reviews})</Text>
                  </View>
                  <Text style={styles.coachPrice}>{coach.hourly_rate} MAD/h</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Events */}
        <View style={[styles.section, { marginBottom: 24 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Événements à venir</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/events')}>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {events.slice(0, 3).map((event) => (
            <TouchableOpacity
              key={event.event_id}
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.event_id}`)}
            >
              <Image
                source={{ uri: event.image_url || 'https://via.placeholder.com/300x150' }}
                style={styles.eventImage}
              />
              <View style={styles.eventInfo}>
                <View style={styles.eventBadge}>
                  <Text style={styles.eventBadgeText}>{event.discipline}</Text>
                </View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={styles.eventDetails}>
                  <View style={styles.eventDetailItem}>
                    <Ionicons name="location" size={14} color="#64748B" />
                    <Text style={styles.eventDetailText}>{event.city}</Text>
                  </View>
                  <View style={styles.eventDetailItem}>
                    <Ionicons name="calendar" size={14} color="#64748B" />
                    <Text style={styles.eventDetailText}>
                      {new Date(event.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.eventFooter}>
                  <Text style={styles.eventPrice}>{event.price} MAD</Text>
                  <Text style={styles.eventParticipants}>
                    {event.current_participants}/{event.max_participants} participants
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    color: '#64748B',
    fontSize: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  seeAllText: {
    color: '#4ECDC4',
    fontSize: 14,
  },
  disciplinesScroll: {
    paddingLeft: 20,
  },
  disciplineChip: {
    backgroundColor: '#0F1D32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  disciplineText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  coachCard: {
    width: 160,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    marginLeft: 20,
    overflow: 'hidden',
  },
  coachImage: {
    width: 160,
    height: 120,
  },
  coachInfo: {
    padding: 12,
  },
  coachName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  coachCity: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
  },
  coachRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  coachPrice: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 150,
  },
  eventInfo: {
    padding: 16,
  },
  eventBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  eventBadgeText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDetailText: {
    color: '#64748B',
    fontSize: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventPrice: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  eventParticipants: {
    color: '#64748B',
    fontSize: 12,
  },
});
