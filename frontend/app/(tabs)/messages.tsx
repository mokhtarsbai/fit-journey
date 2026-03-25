import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_picture?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, sessionToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Fetch conversations error:', error);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    if (!sessionToken) return;
    try {
      const response = await fetch(`${API_URL}/api/messages/${partnerId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };

  const sendMessage = async () => {
    if (!sessionToken || !selectedPartner || !newMessage.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          receiver_id: selectedPartner.partner_id,
          content: newMessage.trim(),
        }),
      });
      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedPartner.partner_id);
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [sessionToken]);

  useEffect(() => {
    if (selectedPartner) {
      fetchMessages(selectedPartner.partner_id);
      // Polling for real-time feel
      pollingRef.current = setInterval(() => {
        fetchMessages(selectedPartner.partner_id);
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedPartner]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, []);

  if (selectedPartner) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedPartner(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedPartner.partner_picture ? (
            <Image source={{ uri: selectedPartner.partner_picture }} style={styles.chatPartnerImage} />
          ) : (
            <View style={styles.chatPartnerPlaceholder}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
          <Text style={styles.chatPartnerName}>{selectedPartner.partner_name}</Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.message_id}
              style={[
                styles.messageBubble,
                msg.sender_id === user?.user_id ? styles.myMessage : styles.theirMessage,
              ]}
            >
              <Text style={styles.messageText}>{msg.content}</Text>
              <Text style={styles.messageTime}>
                {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={styles.messageInput}
            placeholder="Votre message..."
            placeholderTextColor="#64748B"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={20} color="#0A1628" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Conversations List */}
      <ScrollView
        style={styles.conversationsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />}
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#64748B" />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubtext}>Commencez à discuter avec un coach!</Text>
          </View>
        ) : (
          conversations.map((conv) => (
            <TouchableOpacity
              key={conv.partner_id}
              style={styles.conversationItem}
              onPress={() => setSelectedPartner(conv)}
            >
              {conv.partner_picture ? (
                <Image source={{ uri: conv.partner_picture }} style={styles.partnerImage} />
              ) : (
                <View style={styles.partnerPlaceholder}>
                  <Ionicons name="person" size={24} color="#64748B" />
                </View>
              )}
              <View style={styles.conversationInfo}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.partnerName}>{conv.partner_name}</Text>
                  {conv.last_message_at && (
                    <Text style={styles.conversationTime}>
                      {format(new Date(conv.last_message_at), 'HH:mm', { locale: fr })}
                    </Text>
                  )}
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {conv.last_message}
                </Text>
              </View>
              {conv.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{conv.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
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
  conversationsList: {
    flex: 1,
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
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  partnerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  partnerPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  partnerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationTime: {
    color: '#64748B',
    fontSize: 12,
  },
  lastMessage: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#4ECDC4',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#0A1628',
    fontSize: 12,
    fontWeight: '600',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  backButton: {
    marginRight: 12,
  },
  chatPartnerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatPartnerPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatPartnerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4ECDC4',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F1D32',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#0F1D32',
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
