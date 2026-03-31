import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, loginWithEmail, registerWithEmail, loginWithApple } = useAuth();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  const handleGoogleLogin = () => {
    if (!consentAccepted) {
      alert('Veuillez accepter les conditions générales et la politique de confidentialité pour continuer.');
      return;
    }
    login();
  };

  const handleAppleLogin = () => {
    if (!consentAccepted) {
      alert('Veuillez accepter les conditions générales et la politique de confidentialité pour continuer.');
      return;
    }
    loginWithApple?.();
  };

  const handleEmailAuth = async () => {
    if (!consentAccepted) {
      alert('Veuillez accepter les conditions générales et la politique de confidentialité pour continuer.');
      return;
    }

    if (!emailForm.email || !emailForm.password) {
      setEmailError('Email et mot de passe requis');
      return;
    }

    if (isRegisterMode && !emailForm.name) {
      setEmailError('Le nom est requis');
      return;
    }

    setEmailLoading(true);
    setEmailError('');

    try {
      if (isRegisterMode) {
        const success = await registerWithEmail?.(
          emailForm.email,
          emailForm.password,
          emailForm.name,
          emailForm.phone || undefined
        );
        if (success) {
          setShowEmailModal(false);
          router.replace('/(tabs)');
        } else {
          setEmailError('Erreur lors de l\'inscription. Email peut-être déjà utilisé.');
        }
      } else {
        const success = await loginWithEmail?.(emailForm.email, emailForm.password);
        if (success) {
          setShowEmailModal(false);
          router.replace('/(tabs)');
        } else {
          setEmailError('Email ou mot de passe incorrect');
        }
      }
    } catch (error) {
      setEmailError('Une erreur est survenue');
    } finally {
      setEmailLoading(false);
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(`${API_URL}/api/auth/privacy-policy`);
  };

  const openTerms = () => {
    Linking.openURL(`${API_URL}/api/auth/terms`);
  };

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
          <Text style={styles.tagline}>Votre coach sportif à domicile au Maroc</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Sécurisé</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="calendar" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Facile</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="trophy" size={24} color="#4ECDC4" />
            <Text style={styles.featureText}>Premium</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          {/* Apple Sign-In Button (iOS style) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity 
              style={styles.appleButton} 
              onPress={handleAppleLogin}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.appleButtonText}>Continuer avec Apple</Text>
            </TouchableOpacity>
          )}

          {/* Google Sign-In Button */}
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>Continuer avec Google</Text>
          </TouchableOpacity>

          {/* Email/Phone Alternative Link */}
          <TouchableOpacity 
            style={styles.emailLink}
            onPress={() => setShowEmailModal(true)}
          >
            <Ionicons name="mail-outline" size={16} color="#64748B" />
            <Text style={styles.emailLinkText}>Continuer avec Email ou Téléphone</Text>
          </TouchableOpacity>

          {/* Consent Checkbox */}
          <TouchableOpacity 
            style={styles.consentContainer}
            onPress={() => setConsentAccepted(!consentAccepted)}
          >
            <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
              {consentAccepted && <Ionicons name="checkmark" size={14} color="#0A1628" />}
            </View>
            <Text style={styles.consentText}>
              En continuant, j'accepte les{' '}
              <Text style={styles.consentLink} onPress={openTerms}>Conditions Générales</Text>
              {' '}et la{' '}
              <Text style={styles.consentLink} onPress={openPrivacyPolicy}>Politique de Confidentialité</Text>
              {' '}(conformité CNDP)
            </Text>
          </TouchableOpacity>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Ionicons name="lock-closed" size={12} color="#64748B" />
            <Text style={styles.securityText}>Connexion sécurisée OAuth 2.0 • TLS 1.3</Text>
          </View>
        </View>
      </View>

      {/* Email Auth Modal */}
      <Modal visible={showEmailModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRegisterMode ? 'Créer un compte' : 'Se connecter'}
              </Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isRegisterMode && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Nom complet *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Votre nom"
                    placeholderTextColor="#64748B"
                    value={emailForm.name}
                    onChangeText={(v) => setEmailForm({ ...emailForm, name: v })}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor="#64748B"
                  value={emailForm.email}
                  onChangeText={(v) => setEmailForm({ ...emailForm, email: v })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mot de passe *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  value={emailForm.password}
                  onChangeText={(v) => setEmailForm({ ...emailForm, password: v })}
                  secureTextEntry
                />
              </View>

              {isRegisterMode && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Téléphone (optionnel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+212 6 XX XX XX XX"
                    placeholderTextColor="#64748B"
                    value={emailForm.phone}
                    onChangeText={(v) => setEmailForm({ ...emailForm, phone: v })}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, emailLoading && styles.submitButtonDisabled]}
                onPress={handleEmailAuth}
                disabled={emailLoading}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#0A1628" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isRegisterMode ? 'Créer mon compte' : 'Se connecter'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setEmailError('');
                }}
              >
                <Text style={styles.switchModeText}>
                  {isRegisterMode 
                    ? 'Déjà un compte ? Se connecter' 
                    : 'Pas de compte ? S\'inscrire'}
                </Text>
              </TouchableOpacity>

              {/* Consent reminder in modal */}
              <View style={styles.modalConsentReminder}>
                <Ionicons name="information-circle" size={16} color="#64748B" />
                <Text style={styles.modalConsentText}>
                  En continuant, vous acceptez notre politique de confidentialité conforme à la réglementation CNDP.
                </Text>
              </View>
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height * 0.55,
    top: 0,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: height * 0.25,
    height: height * 0.75,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 15,
    color: '#A0AEC0',
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
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
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  buttonIcon: {
    marginRight: 10,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
  },
  emailLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  emailLinkText: {
    color: '#64748B',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4ECDC4',
  },
  consentText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  consentLink: {
    color: '#4ECDC4',
    textDecorationLine: 'underline',
  },
  securityBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  securityText: {
    color: '#64748B',
    fontSize: 11,
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
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#A0AEC0',
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0A1628',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#0A1628',
    fontSize: 16,
    fontWeight: '600',
  },
  switchModeButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#4ECDC4',
    fontSize: 14,
  },
  modalConsentReminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  modalConsentText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
});
