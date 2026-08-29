import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { REPORT_REASONS, type ReportReason } from '@/types/privacy';
import { useAppTheme } from '@/theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';

type ReportModalProps = {
  visible: boolean;
  targetLabel: string;
  messageReport?: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
};

export function ReportModal({
  visible,
  targetLabel,
  messageReport = false,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const theme = useAppTheme();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReason('spam');
    setDetails('');
    setError(null);
    setIsSubmitting(false);
  }, [visible]);

  const submit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason, details.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit this report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={isSubmitting ? undefined : onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close report form"
          disabled={isSubmitting}
          style={[styles.dismissLayer, { backgroundColor: theme.colors.overlay }]}
          onPress={isSubmitting ? undefined : onClose}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}> 
          <View style={styles.heading}>
            <AppText variant="heading">Report {messageReport ? 'message' : 'user'}</AppText>
            <AppText variant="caption" tone="secondary">
              {messageReport
                ? `Report this message from ${targetLabel}. Reports are private and stored for moderation review.`
                : `Report ${targetLabel}. Reports are private and are not shown to the reported user.`}
            </AppText>
          </View>

          <ScrollView style={styles.reasonScroll} contentContainerStyle={styles.reasons} showsVerticalScrollIndicator={false}>
            {REPORT_REASONS.map((item) => {
              const selected = reason === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setReason(item.value)}
                  style={[
                    styles.reasonRow,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                    },
                  ]}>
                  <View style={[styles.radioOuter, { borderColor: selected ? theme.colors.primary : theme.colors.textTertiary }]}>
                    {selected ? <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} /> : null}
                  </View>
                  <AppText variant="bodyStrong">{item.label}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.inputShell, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <TextInput
              multiline
              maxLength={1000}
              value={details}
              onChangeText={setDetails}
              placeholder="Optional details"
              placeholderTextColor={theme.colors.textTertiary}
              allowFontScaling
              maxFontSizeMultiplier={2}
              style={[styles.input, theme.typography.body, { color: theme.colors.text }]}
              accessibilityLabel="Report details"
            />
            <AppText variant="micro" tone="tertiary" style={styles.counter}>{details.length}/1000</AppText>
          </View>

          {error ? (
            <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" variant="caption" tone="danger">
              {error}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <AppButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={onClose} />
            </View>
            <View style={styles.actionCell}>
              <AppButton label="Submit report" variant="danger" loading={isSubmitting} onPress={() => void submit()} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  dismissLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: { width: '100%', maxWidth: 480, maxHeight: '90%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 18, gap: 15 },
  heading: { gap: 5 },
  reasonScroll: { maxHeight: 330 },
  reasons: { gap: 8 },
  reasonRow: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  inputShell: { minHeight: 105, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 7 },
  input: { minHeight: 72, maxHeight: 130, textAlignVertical: 'top' },
  counter: { textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10 },
  actionCell: { flex: 1 },
});
