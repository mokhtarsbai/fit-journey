import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Story {
  story_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
}

interface CoachStories {
  coach_id: string;
  coach_name: string;
  coach_picture?: string;
  stories: Story[];
}

interface Coach {
  user_id: string;
  name: string;
  picture?: string;
  city?: string;
  disciplines: string[];
  hourly_rate?: number;
  rating: number;
  total_reviews: number;
  is_verified?: boolean;
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

interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  discipline: string;
  points_reward: number;
  end_date: string;
  image_url?: string;
  participants: string[];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sessionToken, logout } = useAuth();
  const [stories, setStories] = useState<CoachStories[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStory, setSelectedStory] = useState<CoachStories | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const fetchData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const [storiesRes, coachesRes, eventsRes, challengesRes] = await Promise.all([
        fetch(`${API_URL}/api/stories`, { headers }),
        fetch(`${API_URL}/api/coaches`, { headers }),
        fetch(`${API_URL}/api/events`, { headers }),
        fetch(`${API_URL}/api/challenges`, { headers }),
      ]);

      if (storiesRes.ok) setStories(await storiesRes.json());
      if (coachesRes.ok) setCoaches(await coachesRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (challengesRes.ok) setChallenges(await challengesRes.json());
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const openStory = (coachStories: CoachStories) => {
    setSelectedStory(coachStories);
    setCurrentStoryIndex(0);
  };

  const closeStory = () => {
    setSelectedStory(null);
    setCurrentStoryIndex(0);
  };

  const nextStory = () => {
    if (selectedStory && currentStoryIndex < selectedStory.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      closeStory();
    }
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
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/(tabs)/messages')}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileButton} onPress={logout}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.profileImage} />
              ) : (
                <Ionicons name="person-circle" size={40} color="#4ECDC4" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* FitStories */}
        {stories.length > 0 && (
          <View style={styles.storiesSection}>
            <Text style={styles.sectionTitleSmall}>FitStories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesScroll}>
              {stories.map((coachStories) => (
                <TouchableOpacity
                  key={coachStories.coach_id}
                  style={styles.storyItem}
                  onPress={() => openStory(coachStories)}
                >
                  <View style={styles.storyRing}>
                    {coachStories.coach_picture ? (
                      <Image source={{ uri: coachStories.coach_picture }} style={styles.storyImage} />
                    ) : (
                      <View style={styles.storyPlaceholder}>
                        <Ionicons name="person" size={24} color="#64748B" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>
                    {coachStories.coach_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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

        {/* Active Challenges */}
        {challenges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Challenges du mois</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/challenges')}>
                <Text style={styles.seeAllText}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {challenges.slice(0, 3).map((challenge) => (
                <TouchableOpacity
                  key={challenge.challenge_id}
                  style={styles.challengeCard}
                  onPress={() => router.push(`/challenge/${challenge.challenge_id}`)}
                >
                  <Image
                    source={{ uri: challenge.image_url || 'https://via.placeholder.com/200' }}
                    style={styles.challengeImage}
                  />
                  <View style={styles.challengeOverlay}>
                    <View style={styles.challengeBadge}>
                      <Ionicons name="trophy" size={12} color="#F59E0B" />
                      <Text style={styles.challengePoints}>{challenge.points_reward} pts</Text>
                    </View>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeParticipants}>
                      {challenge.participants.length} participants
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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
                <View style={styles.coachImageContainer}>
                  <Image
                    source={{ uri: coach.picture || 'https://via.placeholder.com/150' }}
                    style={styles.coachImage}
                  />
                  {coach.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                    </View>
                  )}
                </View>
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

      {/* Story Modal */}
      <Modal visible={!!selectedStory} animationType="fade" transparent>
        <View style={styles.storyModal}>
          <TouchableOpacity style={styles.storyModalClose} onPress={closeStory}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedStory && selectedStory.stories[currentStoryIndex] && (
            <TouchableOpacity
              style={styles.storyModalContent}
              activeOpacity={1}
              onPress={nextStory}
            >
              <View style={styles.storyProgressContainer}>
                {selectedStory.stories.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.storyProgressBar,
                      index <= currentStoryIndex && styles.storyProgressBarActive,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.storyHeader}>
                {selectedStory.coach_picture ? (
                  <Image source={{ uri: selectedStory.coach_picture }} style={styles.storyHeaderImage} />
                ) : (
                  <View style={styles.storyHeaderPlaceholder}>
                    <Ionicons name="person" size={16} color="#64748B" />
                  </View>
                )}
                <Text style={styles.storyHeaderName}>{selectedStory.coach_name}</Text>
              </View>
              <Image
                source={{ uri: selectedStory.stories[currentStoryIndex].media_url }}
                style={styles.storyFullImage}
                resizeMode="contain"
              />
              {selectedStory.stories[currentStoryIndex].caption && (
                <View style={styles.storyCaptionContainer}>
                  <Text style={styles.storyCaption}>
                    {selectedStory.stories[currentStoryIndex].caption}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Modal>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F1D32',
    justifyContent: 'center',
    alignItems: 'center',
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
  storiesSection: {
    marginBottom: 16,
  },
  sectionTitleSmall: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  storiesScroll: {
    paddingLeft: 20,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    padding: 2,
    marginBottom: 4,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  storyPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    color: '#FFFFFF',
    fontSize: 11,
    maxWidth: 68,
    textAlign: 'center',
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
  challengeCard: {
    width: 200,
    height: 140,
    marginLeft: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  challengeImage: {
    width: '100%',
    height: '100%',
  },
  challengeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  challengePoints: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  challengeParticipants: {
    color: '#A0AEC0',
    fontSize: 11,
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
  coachImageContainer: {
    position: 'relative',
  },
  coachImage: {
    width: 160,
    height: 120,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
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
  storyModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storyModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  storyModalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  storyProgressContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    gap: 4,
  },
  storyProgressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  storyProgressBarActive: {
    backgroundColor: '#FFFFFF',
  },
  storyHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  storyHeaderImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  storyHeaderPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyHeaderName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  storyFullImage: {
    width: width,
    height: width * 1.5,
  },
  storyCaptionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  storyCaption: {
    color: '#FFFFFF',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
