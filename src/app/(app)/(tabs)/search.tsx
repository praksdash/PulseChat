import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, ChatRow, type ChatRowModel, EmptyState, SearchBar } from '@/components/ui';
import { useAppTheme } from '@/theme';

const PEOPLE: ChatRowModel[] = [
  { id: 'person-aisha', name: 'Aisha Patel', preview: '@aishap', time: '', online: true },
  { id: 'person-daniel', name: 'Daniel Kim', preview: '@danielk', time: '', online: false },
  { id: 'person-sofia', name: 'Sofia Reyes', preview: '@sofia', time: '', online: true },
];

export default function SearchScreen() {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => PEOPLE.filter((item) => `${item.name} ${item.preview}`.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title">Find people</AppText>
        <AppText variant="caption" tone="secondary">Local demo search • Real user discovery arrives in Phase 7</AppText>
      </View>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Name or username" autoCapitalize="none" />
      </View>

      {query.trim() && filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_search', web: 'person_search' }}
            title="No demo match"
            description="Real global user discovery will query Supabase in Phase 7."
          />
        </View>
      ) : (
        <View style={[styles.results, { backgroundColor: theme.colors.surface }]}>
          <AppText variant="captionStrong" tone="secondary" style={styles.sectionLabel}>
            {query.trim() ? 'RESULTS' : 'SUGGESTED'}
          </AppText>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ChatRow chat={item} onPress={() => undefined} />}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 2 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  results: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  sectionLabel: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
});
