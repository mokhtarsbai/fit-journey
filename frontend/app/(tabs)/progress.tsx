import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ProgressEntry {
  progress_id: string;
  date: string;
  weight?: number;
  calories?: number;
  activity_minutes?: number;
  steps?: number;
  notes?: string;
}

interface Badge {
  badge_id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuth();
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    weight: '',
    calories: '',
    activity_minutes: '',
    steps: '',
    notes: '',
  });

  const fetchProgress = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/progress?days=30`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProgress(data.entries || []);
        setTotalSessions(data.total_sessions_completed || 0);
        setTotalPoints(data.total_points || 0);
      }
    } catch (error) {
      console.error('Fetch progress error:', error);
    }
  };

  const fetchBadges = async () => {
    if (!sessionToken || !user) return;
    try {
      const [userBadgesRes, allBadgesRes] = await Promise.all([
        fetch(`${API_URL}/api/users/${user.user_id}/badges`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${API_URL}/api/badges`),
      ]);
      
      if (userBadgesRes.ok) {
        const data = await userBadgesRes.json();
        setBadges(data.badges || []);
      }
      if (allBadgesRes.ok) {
        setAllBadges(await allBadgesRes.json());
      }
    } catch (error) {
      console.error('Fetch badges error:', error);
    }
  };

  useEffect(() => {
    fetchProgress();
    fetchBadges();
  }, [sessionToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProgress(), fetchBadges()]);
    setRefreshing(false);
  }, []);

  const addProgressEntry = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          weight: newEntry.weight ? parseFloat(newEntry.weight) : null,
          calories: newEntry.calories ? parseInt(newEntry.calories) : null,
          activity_minutes: newEntry.activity_minutes ? parseInt(newEntry.activity_minutes) : null,
          steps: newEntry.steps ? parseInt(newEntry.steps) : null,
          notes: newEntry.notes || null,
        }),
      });
      if (response.ok) {
        setShowAddModal(false);
        setNewEntry({ weight: '', calories: '', activity_minutes: '', steps: '', notes: '' });
        fetchProgress();
      }
    } catch (error) {
      console.error('Add progress error:', error);
    }
  };

  // Simple chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
  const chartData = last7Days.map((date) => {
    const entry = progress.find(
      (p) => format(new Date(p.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    return {
      date,
      weight: entry?.weight,
      minutes: entry?.activity_minutes,
    };
  });

  const maxMinutes = Math.max(...chartData.map((d) => d.minutes || 0), 60);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma Progression</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color="#0A1628" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="fitness" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Séances</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{totalPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="ribbon" size={24} color="#EC4899" />
            <Text style={styles.statValue}>{badges.length}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
        </View>

        {/* Activity Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activité (7 derniers jours)</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {chartData.map((data, index) => (
                <View key={index} style={styles.chartBar}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${((data.minutes || 0) / maxMinutes) * 100}%` },
                    ]}
                  />
                  <Text style={styles.barLabel}>
                    {format(data.date, 'EEE', { locale: fr }).charAt(0).toUpperCase()}
                  </Text>
                  {data.minutes && <Text style={styles.barValue}>{data.minutes}'</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes Badges</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {allBadges.map((badge) => {
              const isEarned = badges.includes(badge.badge_id);
              return (
                <View
                  key={badge.badge_id}
                  style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}
                >
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgePoints}>{badge.points} pts</Text>
                  {!isEarned && (
                    <View style={styles.lockedOverlay}>
                      <Ionicons name="lock-closed" size={20} color="#64748B" />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Recent Entries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {progress.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucune entrée</Text>
              <Text style={styles.emptySubtext}>Commencez à suivre votre progression!</Text>
            </View>
          ) : (
            progress.slice(0, 10).map((entry) => (
              <View key={entry.progress_id} style={styles.entryCard}>
                <View style={styles.entryDate}>
                  <Text style={styles.entryDay}>
                    {format(new Date(entry.date), 'd', { locale: fr })}
                  </Text>
                  <Text style={styles.entryMonth}>
                    {format(new Date(entry.date), 'MMM', { locale: fr })}
                  </Text>
                </View>
                <View style={styles.entryDetails}>
                  {entry.weight && (
                    <View style={styles.entryMetric}>
                      <Ionicons name="scale" size={14} color="#4ECDC4" />
                      <Text style={styles.metricText}>{entry.weight} kg</Text>
                    </View>
                  )}
                  {entry.activity_minutes && (
                    <View style={styles.entryMetric}>
                      <Ionicons name="time" size={14} color="#6366F1" />
                      <Text style={styles.metricText}>{entry.activity_minutes} min</Text>
                    </View>
                  )}
                  {entry.steps && (
                    <View style={styles.entryMetric}>
                      <Ionicons name="footsteps" size={14} color="#EC4899" />
                      <Text style={styles.metricText}>{entry.steps} pas</Text>
                    </View>
                  )}
                  {entry.calories && (
                    <View style={styles.entryMetric}>
                      <Ionicons name="flame" size={14} color="#F59E0B" />
                      <Text style={styles.metricText}>{entry.calories} kcal</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Add Entry Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle entrée</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Poids (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="70.5"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  value={newEntry.weight}
                  onChangeText={(v) => setNewEntry({ ...newEntry, weight: v })}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Calories</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2000"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={newEntry.calories}
                  onChangeText={(v) => setNewEntry({ ...newEntry, calories: v })}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Minutes d'activité</Text>
                <TextInput
                  style={styles.input}
                  placeholder="60"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={newEntry.activity_minutes}
                  onChangeText={(v) => setNewEntry({ ...newEntry, activity_minutes: v })}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10000"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={newEntry.steps}
                  onChangeText={(v) => setNewEntry({ ...newEntry, steps: v })}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Comment s'est passée votre journée?"
              placeholderTextColor="#64748B"
              multiline
              value={newEntry.notes}
              onChangeText={(v) => setNewEntry({ ...newEntry, notes: v })}
            />

            <TouchableOpacity style={styles.submitButton} onPress={addProgressEntry}>
              <Text style={styles.submitButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  chartContainer: {
    paddingHorizontal: 20,
  },
  chart: {
    flexDirection: 'row',
    height: 150,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  chartBar: {
    alignItems: 'center',
    width: 32,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 20,
    backgroundColor: '#4ECDC4',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
  },
  barValue: {
    color: '#4ECDC4',
    fontSize: 10,
    position: 'absolute',
    top: -15,
  },
  badgeCard: {
    width: 100,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginLeft: 12,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeNameLocked: {
    color: '#64748B',
  },
  badgePoints: {
    color: '#4ECDC4',
    fontSize: 11,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F1D32',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  entryDate: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entryDay: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryMonth: {
    color: '#4ECDC4',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  entryDetails: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  entryMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1D32',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0A1628',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
});
