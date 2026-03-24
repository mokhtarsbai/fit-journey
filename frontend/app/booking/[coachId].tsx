import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coach {
  user_id: string;
  name: string;
  disciplines: string[];
  hourly_rate?: number;
}

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const durations = [30, 45, 60, 90, 120];

export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coachId } = useLocalSearchParams();
  const { sessionToken } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Booking state
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Generate next 7 days
  const availableDates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  useEffect(() => {
    const fetchCoach = async () => {
      try {
        const response = await fetch(`${API_URL}/api/coaches/${coachId}`);
        if (response.ok) {
          const data = await response.json();
          setCoach(data);
          if (data.disciplines.length > 0) {
            setSelectedDiscipline(data.disciplines[0]);
          }
        }
      } catch (error) {
        console.error('Fetch coach error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (coachId) fetchCoach();
  }, [coachId]);

  const calculatePrice = () => {
    if (!coach?.hourly_rate) return 0;
    return Math.round((coach.hourly_rate * selectedDuration) / 60);
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !selectedDiscipline) {
      Alert.alert('Information manquante', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const bookingDate = setMinutes(setHours(selectedDate, hours), minutes);

    setBooking(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          coach_id: coachId,
          discipline: selectedDiscipline,
          date: bookingDate.toISOString(),
          duration_minutes: selectedDuration,
          location: location || undefined,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Réservation confirmée!',
          `Votre séance de ${selectedDiscipline} avec ${coach?.name} est confirmée.\n\n(Paiement simulé pour le MVP: ${calculatePrice()} MAD)`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Erreur', error.detail || 'Impossible de réserver');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réserver une séance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Coach Info */}
        <View style={styles.coachCard}>
          <View style={styles.coachIcon}>
            <Ionicons name="person" size={24} color="#4ECDC4" />
          </View>
          <View>
            <Text style={styles.coachName}>{coach?.name}</Text>
            <Text style={styles.coachPrice}>{coach?.hourly_rate} MAD/h</Text>
          </View>
        </View>

        {/* Discipline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discipline *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {coach?.disciplines.map((discipline) => (
              <TouchableOpacity
                key={discipline}
                style={[
                  styles.chip,
                  selectedDiscipline === discipline && styles.chipActive,
                ]}
                onPress={() => setSelectedDiscipline(discipline)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedDiscipline === discipline && styles.chipTextActive,
                  ]}
                >
                  {discipline}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableDates.map((date) => (
              <TouchableOpacity
                key={date.toISOString()}
                style={[
                  styles.dateCard,
                  selectedDate?.toDateString() === date.toDateString() && styles.dateCardActive,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dateDay,
                    selectedDate?.toDateString() === date.toDateString() && styles.dateDayActive,
                  ]}
                >
                  {format(date, 'EEE', { locale: fr })}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    selectedDate?.toDateString() === date.toDateString() && styles.dateNumberActive,
                  ]}
                >
                  {format(date, 'd')}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    selectedDate?.toDateString() === date.toDateString() && styles.dateMonthActive,
                  ]}
                >
                  {format(date, 'MMM', { locale: fr })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heure *</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeSlot,
                  selectedTime === time && styles.timeSlotActive,
                ]}
                onPress={() => setSelectedTime(time)}
              >
                <Text
                  style={[
                    styles.timeText,
                    selectedTime === time && styles.timeTextActive,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Durée</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.chip,
                  selectedDuration === duration && styles.chipActive,
                ]}
                onPress={() => setSelectedDuration(duration)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedDuration === duration && styles.chipTextActive,
                  ]}
                >
                  {duration} min
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lieu (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Adresse pour le coaching à domicile..."
            placeholderTextColor="#64748B"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Objectifs, niveau, blessures..."
            placeholderTextColor="#64748B"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>{calculatePrice()} MAD</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={handleBook}
          disabled={booking}
        >
          {booking ? (
            <ActivityIndicator color="#0A1628" />
          ) : (
            <Text style={styles.bookButtonText}>Confirmer</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F1D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  coachIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coachPrice: {
    color: '#4ECDC4',
    fontSize: 14,
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
  chip: {
    backgroundColor: '#0F1D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  chipActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#0A1628',
    fontWeight: '600',
  },
  dateCard: {
    width: 70,
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  dateCardActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  dateDay: {
    color: '#64748B',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  dateDayActive: {
    color: '#0A1628',
  },
  dateNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  dateNumberActive: {
    color: '#0A1628',
  },
  dateMonth: {
    color: '#64748B',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  dateMonthActive: {
    color: '#0A1628',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    backgroundColor: '#0F1D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  timeSlotActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  timeTextActive: {
    color: '#0A1628',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F1D32',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1D32',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
  },
  priceContainer: {},
  priceLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bookButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  bookButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
});
