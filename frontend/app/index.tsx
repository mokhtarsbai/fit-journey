import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    // Seed data on first load
    const seedData = async () => {
      try {
        await fetch(`${API_URL}/api/seed`, { method: 'POST' });
      } catch (error) {
        console.log('Seed error (may already be seeded):', error);
      }
    };
    seedData();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.pexels.com/photos/5646004/pexels-photo-5646004.jpeg?auto=compress&cs=tinysrgb&w=1200' }}
        style={styles.backgroundImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(10, 22, 40, 0.8)', '#0A1628']}
        style={styles.gradient}
      />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="fitness" size={40} color="#4ECDC4" />
          </View>
          <Text style={styles.logoText}>Fit Journey</Text>
          <Text style={styles.tagline}>Votre coach sportif à domicile</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="person" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Coachs certifiés</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="calendar" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Réservation facile</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="trophy" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Événements sportifs</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={login}>
            <Ionicons name="logo-google" size={20} color="#FFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Continuer avec Google</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            En continuant, vous acceptez nos conditions d'utilisation
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height * 0.6,
    top: 0,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: height * 0.3,
    height: height * 0.7,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#A0AEC0',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 8,
  },
  buttonsContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
