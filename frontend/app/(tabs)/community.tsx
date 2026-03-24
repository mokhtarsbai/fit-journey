import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Post {
  post_id: string;
  author_id: string;
  author_name: string;
  author_picture?: string;
  content: string;
  media_type: string;
  media_url?: string;
  likes: string[];
  comments_count: number;
  created_at: string;
}

interface JournalEntry {
  entry_id: string;
  title: string;
  content: string;
  mood: string;
  discipline?: string;
  duration_minutes?: number;
  date: string;
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'journal'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showNewJournalModal, setShowNewJournalModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newJournalTitle, setNewJournalTitle] = useState('');
  const [newJournalContent, setNewJournalContent] = useState('');
  const [newJournalMood, setNewJournalMood] = useState('good');

  const fetchFeed = async () => {
    try {
      const response = await fetch(`${API_URL}/api/feed`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Fetch feed error:', error);
    }
  };

  const fetchJournal = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/journal`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setJournal(data);
      }
    } catch (error) {
      console.error('Fetch journal error:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'feed') {
      await fetchFeed();
    } else {
      await fetchJournal();
    }
    setRefreshing(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchFeed();
    } else {
      fetchJournal();
    }
  }, [activeTab]);

  const handleLike = async (postId: string) => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/feed/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        fetchFeed();
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleCreatePost = async () => {
    if (!sessionToken || !newPostContent.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ content: newPostContent }),
      });
      if (response.ok) {
        setNewPostContent('');
        setShowNewPostModal(false);
        fetchFeed();
      }
    } catch (error) {
      console.error('Create post error:', error);
    }
  };

  const handleCreateJournal = async () => {
    if (!sessionToken || !newJournalTitle.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: newJournalTitle,
          content: newJournalContent,
          mood: newJournalMood,
        }),
      });
      if (response.ok) {
        setNewJournalTitle('');
        setNewJournalContent('');
        setNewJournalMood('good');
        setShowNewJournalModal(false);
        fetchJournal();
      }
    } catch (error) {
      console.error('Create journal error:', error);
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'good':
        return 'happy';
      case 'neutral':
        return 'remove-circle';
      case 'tired':
        return 'sad';
      default:
        return 'happy';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'good':
        return '#4ECDC4';
      case 'neutral':
        return '#F59E0B';
      case 'tired':
        return '#EF4444';
      default:
        return '#4ECDC4';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ma Communauté</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (activeTab === 'feed' ? setShowNewPostModal(true) : setShowNewJournalModal(true))}
        >
          <Ionicons name="add" size={24} color="#0A1628" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'journal' && styles.tabActive]}
          onPress={() => setActiveTab('journal')}
        >
          <Text style={[styles.tabText, activeTab === 'journal' && styles.tabTextActive]}>
            Mon Journal
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {activeTab === 'feed' ? (
          posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Aucune publication</Text>
              <Text style={styles.emptySubtext}>Soyez le premier à partager!</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.post_id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  {post.author_picture ? (
                    <Image source={{ uri: post.author_picture }} style={styles.authorImage} />
                  ) : (
                    <View style={styles.authorPlaceholder}>
                      <Ionicons name="person" size={20} color="#64748B" />
                    </View>
                  )}
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.authorName}>{post.author_name}</Text>
                    <Text style={styles.postDate}>
                      {format(new Date(post.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.postContent}>{post.content}</Text>
                <View style={styles.postActions}>
                  <TouchableOpacity
                    style={styles.postAction}
                    onPress={() => handleLike(post.post_id)}
                  >
                    <Ionicons
                      name={post.likes.includes(user?.user_id || '') ? 'heart' : 'heart-outline'}
                      size={20}
                      color={post.likes.includes(user?.user_id || '') ? '#EF4444' : '#64748B'}
                    />
                    <Text style={styles.actionText}>{post.likes.length}</Text>
                  </TouchableOpacity>
                  <View style={styles.postAction}>
                    <Ionicons name="chatbubble-outline" size={20} color="#64748B" />
                    <Text style={styles.actionText}>{post.comments_count}</Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : journal.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="journal" size={48} color="#64748B" />
            <Text style={styles.emptyText}>Votre journal est vide</Text>
            <Text style={styles.emptySubtext}>Commencez à suivre vos séances!</Text>
          </View>
        ) : (
          journal.map((entry) => (
            <View key={entry.entry_id} style={styles.journalCard}>
              <View style={styles.journalHeader}>
                <View style={[styles.moodBadge, { backgroundColor: `${getMoodColor(entry.mood)}20` }]}>
                  <Ionicons name={getMoodIcon(entry.mood)} size={16} color={getMoodColor(entry.mood)} />
                </View>
                <Text style={styles.journalDate}>
                  {format(new Date(entry.date), 'd MMMM yyyy', { locale: fr })}
                </Text>
              </View>
              <Text style={styles.journalTitle}>{entry.title}</Text>
              <Text style={styles.journalContent}>{entry.content}</Text>
              {entry.discipline && (
                <View style={styles.journalMeta}>
                  <View style={styles.metaBadge}>
                    <Ionicons name="fitness" size={12} color="#4ECDC4" />
                    <Text style={styles.metaText}>{entry.discipline}</Text>
                  </View>
                  {entry.duration_minutes && (
                    <View style={styles.metaBadge}>
                      <Ionicons name="time" size={12} color="#4ECDC4" />
                      <Text style={styles.metaText}>{entry.duration_minutes} min</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* New Post Modal */}
      <Modal visible={showNewPostModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle publication</Text>
              <TouchableOpacity onPress={() => setShowNewPostModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.postInput}
              placeholder="Partagez votre expérience..."
              placeholderTextColor="#64748B"
              multiline
              value={newPostContent}
              onChangeText={setNewPostContent}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleCreatePost}>
              <Text style={styles.submitButtonText}>Publier</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Journal Modal */}
      <Modal visible={showNewJournalModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle entrée</Text>
              <TouchableOpacity onPress={() => setShowNewJournalModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.titleInput}
              placeholder="Titre"
              placeholderTextColor="#64748B"
              value={newJournalTitle}
              onChangeText={setNewJournalTitle}
            />
            <TextInput
              style={styles.postInput}
              placeholder="Décrivez votre séance..."
              placeholderTextColor="#64748B"
              multiline
              value={newJournalContent}
              onChangeText={setNewJournalContent}
            />
            <Text style={styles.moodLabel}>Comment vous sentez-vous?</Text>
            <View style={styles.moodSelector}>
              {['good', 'neutral', 'tired'].map((mood) => (
                <TouchableOpacity
                  key={mood}
                  style={[
                    styles.moodOption,
                    newJournalMood === mood && { backgroundColor: `${getMoodColor(mood)}40` },
                  ]}
                  onPress={() => setNewJournalMood(mood)}
                >
                  <Ionicons
                    name={getMoodIcon(mood)}
                    size={24}
                    color={newJournalMood === mood ? getMoodColor(mood) : '#64748B'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitButton} onPress={handleCreateJournal}>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4ECDC4',
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
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  postCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postHeaderInfo: {
    marginLeft: 12,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  postDate: {
    color: '#64748B',
    fontSize: 12,
  },
  postContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#64748B',
    fontSize: 12,
  },
  journalCard: {
    backgroundColor: '#0F1D32',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  moodBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalDate: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 12,
  },
  journalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  journalContent: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  journalMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  metaText: {
    color: '#4ECDC4',
    fontSize: 12,
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
    maxHeight: '80%',
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
  titleInput: {
    backgroundColor: '#0A1628',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
  postInput: {
    backgroundColor: '#0A1628',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  moodLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
  },
  moodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  moodOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    alignItems: 'center',
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
