import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Session {
  session_id: string;
  coach_id: string;
  client_id: string;
  discipline: string;
  date: string;
  duration_minutes: number;
  status: string;
  location?: string;
  price: number;
  coach?: {
    name: string;
    picture?: string;
  };
  client?: {
    name: string;
  };
}

interface Pack {
  pack_id: string;
  discipline: string;
  total_sessions: number;
  remaining_sessions: number;
  price: number;
  expires_at: string;
  coach?: {
    name: string;
    picture?: string;
  };
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { sessionToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sessions' | 'packs'>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Fetch sessions error:', error);
    }
  };

  const fetchPacks = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/packs`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPacks(data);
      }
    } catch (error) {
      console.error('Fetch packs error:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchPacks()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [sessionToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const downloadInvoice = async (packId: string) => {
    if (!sessionToken) return;
    try {
      const invoiceUrl = `${API_URL}/api/invoices/${packId}/pdf`;
      if (Platform.OS === 'web') {
        // Web : fetch avec header auth puis déclenchement du téléchargement
        const response = await fetch(invoiceUrl, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!response.ok) {
          Alert.alert('Erreur', 'Impossible de télécharger la facture');
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture_${packId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile : token passé en query param (accepté par le backend pour les téléchargements)
        const urlWithToken = `${invoiceUrl}?token=${encodeURIComponent(sessionToken)}`;
        const supported = await Linking.canOpenURL(urlWithToken);
        if (supported) {
          await Linking.openURL(urlWithToken);
        } else {
          Alert.alert('Erreur', "Impossible d'ouvrir le lien de la facture");
        }
      }
    } catch (error) {
      console.error('Download invoice error:', error);
      Alert.alert('Erreur', 'Erreur lors du téléchargement de la facture');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#4ECDC4';
      case 'pending':
        return '#F59E0B';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmée';
      case 'pending':
        return 'En attente';
      case 'completed':
        return 'Terminée';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
    }
  };

  const upcomingSessions = sessions.filter(
    (s) => s.status === 'confirmed' && new Date(s.date) > new Date()
  );
  const pastSessions = sessions.filter(
    (s) => s.status === 'completed' || (s.status === 'confirmed' && new Date(s.date) < new Date())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Réservations</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sessions' && styles.tabActive]}
          onPress={() => setActiveTab('sessions')}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={activeTab === 'sessions' ? '#4ECDC4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
            Séances
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'packs' && styles.tabActive]}
          onPress={() => setActiveTab('packs')}
        >
          <Ionicons
            name="gift"
            size={20}
            color={activeTab === 'packs' ? '#4ECDC4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'packs' && styles.tabTextActive]}>
            Mes Packs
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#4ECDC4" style={styles.loader} />
        ) : activeTab === 'sessions' ? (
          <>
            {upcomingSessions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Séances à venir</Text>
                {upcomingSessions.map((session) => (
                  <View key={session.session_id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionDate}>
                        <Text style={styles.dateDay}>
                          {format(new Date(session.date), 'd', { locale: fr })}
                        </Text>
                        <Text style={styles.dateMonth}>
                          {format(new Date(session.date), 'MMM', { locale: fr })}
                        </Text>
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionDiscipline}>{session.discipline}</Text>
                        <Text style={styles.sessionCoach}>
                          {user?.role === 'coach' ? session.client?.name : session.coach?.name}
                        </Text>
                        <Text style={styles.sessionTime}>
                          {format(new Date(session.date), 'HH:mm', { locale: fr })} - {session.duration_minutes} min
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(session.status)}20` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                          {getStatusText(session.status)}
                        </Text>
                      </View>
                    </View>
                    {session.location && (
                      <View style={styles.sessionLocation}>
                        <Ionicons name="location" size={14} color="#64748B" />
                        <Text style={styles.locationText}>{session.location}</Text>
                      </View>
                    )}
                    <View style={styles.sessionFooter}>
                      <Text style={styles.sessionPrice}>{session.price} MAD</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {pastSessions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historique</Text>
                {pastSessions.map((session) => (
                  <View key={session.session_id} style={[styles.sessionCard, styles.pastSession]}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionDate}>
                        <Text style={styles.dateDay}>
                          {format(new Date(session.date), 'd', { locale: fr })}
                        </Text>
                        <Text style={styles.dateMonth}>
                          {format(new Date(session.date), 'MMM', { locale: fr })}
                        </Text>
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionDiscipline}>{session.discipline}</Text>
                        <Text style={styles.sessionCoach}>
                          {user?.role === 'coach' ? session.client?.name : session.coach?.name}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(session.status)}20` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                          {getStatusText(session.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {sessions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>Aucune séance</Text>
                <Text style={styles.emptySubtext}>Réservez votre première séance!</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {packs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="gift-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>Aucun pack</Text>
                <Text style={styles.emptySubtext}>Achetez un pack pour économiser!</Text>
              </View>
            ) : (
              packs.map((pack) => (
                <View key={pack.pack_id} style={styles.packCard}>
                  <View style={styles.packHeader}>
                    <View style={styles.packIcon}>
                      <Ionicons name="fitness" size={24} color="#4ECDC4" />
                    </View>
                    <View style={styles.packInfo}>
                      <Text style={styles.packDiscipline}>{pack.discipline}</Text>
                      <Text style={styles.packCoach}>avec {pack.coach?.name}</Text>
                    </View>
                  </View>
                  <View style={styles.packProgress}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${((pack.total_sessions - pack.remaining_sessions) / pack.total_sessions) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {pack.remaining_sessions}/{pack.total_sessions} séances restantes
                    </Text>
                  </View>
                  <View style={styles.packFooter}>
                    <Text style={styles.packExpiry}>
                      Expire le {format(new Date(pack.expires_at), 'd MMM yyyy', { locale: fr })}
                    </Text>
                    <Text style={styles.packPrice}>{pack.price} MAD</Text>
                  </View>
                  {/* Download Invoice Button */}
                  <TouchableOpacity 
                    style={styles.invoiceButton}
                    onPress={() => downloadInvoice(pack.pack_id)}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#4ECDC4" />
                    <Text style={styles.invoiceButtonText}>Télécharger la facture PDF</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
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
  loader: {
    marginTop: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pastSession: {
    opacity: 0.7,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDate: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateMonth: {
    color: '#4ECDC4',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  sessionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sessionDiscipline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionCoach: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  sessionTime: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sessionLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  locationText: {
    color: '#64748B',
    fontSize: 12,
  },
  sessionFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sessionPrice: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  packCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  packIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packInfo: {
    marginLeft: 12,
  },
  packDiscipline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  packCoach: {
    color: '#64748B',
    fontSize: 14,
  },
  packProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#4ECDC4',
    borderRadius: 4,
  },
  progressText: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  packFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packExpiry: {
    color: '#64748B',
    fontSize: 12,
  },
  packPrice: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '600',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  invoiceButtonText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
  },
});
