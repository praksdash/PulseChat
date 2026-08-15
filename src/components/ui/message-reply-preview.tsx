import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type MessageReplyPreviewProps = {
  senderLabel: string;
  text: string;
};

export function MessageReplyPreview({ senderLabel, text }: MessageReplyPreviewProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.wrap, { borderLeftColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft }]}> 
      <AppText variant="micro" style={{ color: theme.colors.primary }} numberOfLines={1}>
        {senderLabel}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 1,
  },
});
