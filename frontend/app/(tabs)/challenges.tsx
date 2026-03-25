import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Challenge {
  challenge_id: string;
  title: string;
  description: string;
  discipline: string;
  points_reward: number;
  start_date: string;
  end_date: string;
  participants: string[];
  submissions: any[];
  image_url?: string;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  picture?: string;
  city?: string;
  total_points: number;
  badges: string[];
}

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'challenges' | 'leaderboard'>('challenges');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const cities = ['Toutes', 'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir'];

  const fetchChallenges = async () => {
    try {
      const response = await fetch(`${API_URL}/api/challenges`);
      if (response.ok) {
        const data = await response.json();
        setChallenges(data);
      }
    } catch (error) {
      console.error('Fetch challenges error:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      let url = `${API_URL}/api/leaderboard`;
      if (selectedCity && selectedCity !== 'Toutes') {
        url += `?city=${encodeURIComponent(selectedCity)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Fetch leaderboard error:', error);
    }
  };

  useEffect(() => {
    fetchChallenges();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [selectedCity, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchChallenges(), fetchLeaderboard()]);
    setRefreshing(false);
  }, []);

  const joinChallenge = async (challengeId: string) => {
    if (!sessionToken) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour participer.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        Alert.alert('Inscrit!', 'Vous participez maintenant au challenge!');
        fetchChallenges();
      } else {
        const error = await response.json();
        Alert.alert('Erreur', error.detail || 'Impossible de rejoindre');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return { icon: 'trophy', color: '#F59E0B' };
      case 2:
        return { icon: 'medal', color: '#94A3B8' };
      case 3:
        return { icon: 'medal', color: '#CD7F32' };
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges & Classement</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
          onPress={() => setActiveTab('challenges')}
        >
          <Ionicons
            name="trophy"
            size={20}
            color={activeTab === 'challenges' ? '#4ECDC4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>
            Challenges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Ionicons
            name="podium"
            size={20}
            color={activeTab === 'leaderboard' ? '#4ECDC4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            Classement
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {activeTab === 'challenges' ? (
          challenges.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Aucun challenge actif</Text>
            </View>
          ) : (
            challenges.map((challenge) => {
              const daysLeft = differenceInDays(new Date(challenge.end_date), new Date());
              const isJoined = user && challenge.participants.includes(user.user_id);

              return (
                <View key={challenge.challenge_id} style={styles.challengeCard}>
                  <Image
                    source={{ uri: challenge.image_url || 'https://via.placeholder.com/400x200' }}
                    style={styles.challengeImage}
                  />
                  <View style={styles.challengeContent}>
                    <View style={styles.challengeBadges}>
                      <View style={styles.disciplineBadge}>
                        <Text style={styles.disciplineBadgeText}>{challenge.discipline}</Text>
                      </View>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="trophy" size={12} color="#F59E0B" />
                        <Text style={styles.pointsBadgeText}>{challenge.points_reward} pts</Text>
                      </View>
                    </View>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeDescription}>{challenge.description}</Text>
                    <View style={styles.challengeMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time" size={16} color="#64748B" />
                        <Text style={styles.metaText}>{daysLeft} jours restants</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people" size={16} color="#64748B" />
                        <Text style={styles.metaText}>{challenge.participants.length} participants</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinButton, isJoined && styles.joinedButton]}
                      onPress={() => !isJoined && joinChallenge(challenge.challenge_id)}
                      disabled={isJoined}
                    >
                      <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
                        {isJoined ? 'Participant' : 'Participer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        ) : (
          <>
            {/* City Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityFilter}>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.cityChip,
                    (selectedCity === city || (!selectedCity && city === 'Toutes')) && styles.cityChipActive,
                  ]}
                  onPress={() => setSelectedCity(city === 'Toutes' ? null : city)}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                      (selectedCity === city || (!selectedCity && city === 'Toutes')) && styles.cityChipTextActive,
                    ]}
                  >
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Leaderboard */}
            {leaderboard.map((entry, index) => {
              const rankInfo = getRankIcon(entry.rank);
              const isCurrentUser = user && entry.user_id === user.user_id;

              return (
                <View
                  key={entry.user_id}
                  style={[styles.leaderboardItem, isCurrentUser && styles.leaderboardItemHighlight]}
                >
                  <View style={styles.rankContainer}>
                    {rankInfo ? (
                      <Ionicons name={rankInfo.icon as any} size={24} color={rankInfo.color} />
                    ) : (
                      <Text style={styles.rankNumber}>{entry.rank}</Text>
                    )}
                  </View>
                  {entry.picture ? (
                    <Image source={{ uri: entry.picture }} style={styles.leaderboardImage} />
                  ) : (
                    <View style={styles.leaderboardPlaceholder}>
                      <Ionicons name="person" size={20} color="#64748B" />
                    </View>
                  )}
                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>{entry.name}</Text>
                    {entry.city && <Text style={styles.leaderboardCity}>{entry.city}</Text>}
                  </View>
                  <View style={styles.pointsContainer}>
                    <Text style={styles.pointsText}>{entry.total_points}</Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                  </View>
                </View>
              );
            })}
          </>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#0F1D32',
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#4ECDC4',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
  challengeCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  challengeImage: {
    width: '100%',
    height: 160,
  },
  challengeContent: {
    padding: 16,
  },
  challengeBadges: {
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
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pointsBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  challengeDescription: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  challengeMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#64748B',
    fontSize: 13,
  },
  joinButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinedButton: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  joinButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
  joinedButtonText: {
    color: '#4ECDC4',
  },
  cityFilter: {
    marginBottom: 16,
  },
  cityChip: {
    backgroundColor: '#0F1D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  cityChipActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  cityChipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  cityChipTextActive: {
    color: '#0A1628',
    fontWeight: '600',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1D32',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  leaderboardItemHighlight: {
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankNumber: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  leaderboardImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  leaderboardPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaderboardName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardCity: {
    color: '#64748B',
    fontSize: 12,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  pointsText: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pointsLabel: {
    color: '#64748B',
    fontSize: 10,
  },
});
