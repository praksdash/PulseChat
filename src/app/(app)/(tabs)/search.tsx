import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, EmptyState, SearchBar, UserRow } from '@/components/ui';
import { searchUsers } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { PublicUserProfile } from '@/types/user-discovery';

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    // Invalidate any in-flight request immediately when the user changes the query.
    // This prevents a slower old request from briefly replacing newer intent during
    // the debounce window.
    requestSequence.current += 1;
    setIsSearching(trimmedQuery.length >= MIN_SEARCH_LENGTH);

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  useEffect(() => {
    const requestId = ++requestSequence.current;

    if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    void searchUsers(debouncedQuery)
      .then((data) => {
        if (requestId !== requestSequence.current) return;
        setResults(data);
      })
      .catch((searchError: unknown) => {
        if (requestId !== requestSequence.current) return;
        console.warn('User discovery failed:', searchError);
        setResults([]);
        setError('Unable to search right now. Check your connection and try again.');
      })
      .finally(() => {
        if (requestId === requestSequence.current) setIsSearching(false);
      });
  }, [debouncedQuery, retryNonce]);

  const openUser = (user: PublicUserProfile) => {
    router.push({
      pathname: '/users/[userId]',
      params: { userId: user.id },
    });
  };

  const renderBody = () => {
    if (!canSearch) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'person.2', android: 'person_search', web: 'person_search' }}
            title="Find someone on PulseChat"
            description="Enter at least 2 characters from a display name or username. Email addresses are never exposed in discovery."
          />
        </View>
      );
    }

    if (isSearching) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Searching PulseChat…</AppText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' }}
            title="Search unavailable"
            description={error}
          />
          <View style={styles.retryButton}>
            <AppButton
              label="Try again"
              variant="secondary"
              onPress={() => setRetryNonce((value) => value + 1)}
            />
          </View>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_off', web: 'person_off' }}
            title="No people found"
            description="Try a different display name or username. Your own account is intentionally excluded from results."
          />
        </View>
      );
    }

    return (
      <View style={[styles.results, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.resultHeader}>
          <AppText variant="captionStrong" tone="secondary">RESULTS</AppText>
          <AppText variant="micro" tone="tertiary">Up to 20 matches</AppText>
        </View>
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <UserRow user={item} onPress={() => openUser(item)} />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title">Find people</AppText>
        <AppText variant="caption" tone="secondary">
          Search real PulseChat profiles by name or username
        </AppText>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Name or username"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={50}
          returnKeyType="search"
        />
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 2 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  results: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  resultHeader: {
    minHeight: 42,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listContent: { paddingBottom: 30 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 70, gap: 18 },
  retryButton: { width: '100%', maxWidth: 260 },
});
