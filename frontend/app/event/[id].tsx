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

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { sessionToken } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${API_URL}/api/events/${id}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data);
        }
      } catch (error) {
        console.error('Fetch event error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEvent();
  }, [id]);

  const handleRegister = async () => {
    if (!sessionToken) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour vous inscrire.');
      return;
    }

    setRegistering(true);
    try {
      const response = await fetch(`${API_URL}/api/events/${id}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        Alert.alert(
          'Inscription confirmée!',
          'Vous êtes inscrit à cet événement. (Paiement simulé pour le MVP)',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Erreur', error.detail || 'Impossible de s\'inscrire');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Événement non trouvé</Text>
      </View>
    );
  }

  const spotsLeft = event.max_participants - event.current_participants;
  const isFull = spotsLeft <= 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: event.image_url || 'https://via.placeholder.com/400x250' }}
            style={styles.coverImage}
          />
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.disciplineBadgeOverlay}>
            <Text style={styles.disciplineBadgeText}>{event.discipline}</Text>
          </View>
        </View>

        {/* Event Info */}
        <View style={styles.contentSection}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Key Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar" size={20} color="#4ECDC4" />
              </View>
              <View>
                <Text style={styles.detailLabel}>Date et heure</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(event.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="location" size={20} color="#4ECDC4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Lieu</Text>
                <Text style={styles.detailValue}>{event.location}</Text>
                <Text style={styles.detailSubvalue}>{event.city}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="people" size={20} color="#4ECDC4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Participants</Text>
                <Text style={styles.detailValue}>
                  {event.current_participants} / {event.max_participants}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(event.current_participants / event.max_participants) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {/* What's Included (Mock) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ce qui est inclus</Text>
            <View style={styles.includesList}>
              <View style={styles.includeItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
                <Text style={styles.includeText}>Accès à l'événement</Text>
              </View>
              <View style={styles.includeItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
                <Text style={styles.includeText}>Encadrement professionnel</Text>
              </View>
              <View style={styles.includeItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
                <Text style={styles.includeText}>Certificat de participation</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Register Bar */}
      <View style={[styles.registerBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.priceInfo}>
          <Text style={styles.priceLabel}>{spotsLeft} places restantes</Text>
          <Text style={styles.priceValue}>{event.price} MAD</Text>
        </View>
        <TouchableOpacity
          style={[styles.registerButton, isFull && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isFull || registering}
        >
          {registering ? (
            <ActivityIndicator color="#0A1628" />
          ) : (
            <Text style={styles.registerButtonText}>
              {isFull ? 'Complet' : "S'inscrire"}
            </Text>
          )}
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
    height: 250,
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
  disciplineBadgeOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(78, 205, 196, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disciplineBadgeText: {
    color: '#0A1628',
    fontSize: 14,
    fontWeight: '600',
  },
  contentSection: {
    padding: 20,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  detailsCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  detailSubvalue: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#1E3A5F',
    marginVertical: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 3,
    marginTop: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#4ECDC4',
    borderRadius: 3,
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
  description: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 22,
  },
  includesList: {
    gap: 12,
  },
  includeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  includeText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  registerBar: {
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  registerButtonDisabled: {
    backgroundColor: '#64748B',
  },
  registerButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
});
