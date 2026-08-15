# PulseChat Architecture

## Current client architecture

```text
src/app                  Expo Router routes
   ↓
src/components/ui        Reusable presentation components
   ↓
src/theme                Design tokens and system theme selection
```

## Route tree

```text
/
├── (auth)
│   ├── login
│   └── register
└── (app)
    ├── (tabs)
    │   ├── chats
    │   ├── search
    │   └── profile
    └── chat/[conversationId]
```

## Phase 3 design-system architecture

The UI does not hard-code a separate palette in every screen. Screens request the active theme through `useAppTheme()`. Reusable primitives own repeated styling and behavior.

Core primitives:
- AppText
- AppIcon
- AppButton
- AppTextField
- Avatar
- SearchBar
- ChatRow
- MessageBubble
- SurfaceCard
- SettingsRow
- EmptyState

## Theming

The application currently follows the device light/dark appearance automatically. A user-selectable theme preference will be added during the Settings phase. The design tokens are already structured so that feature does not require rewriting individual screens.

## Future integration boundaries

Phase 4 will add an authentication/session layer without replacing the presentation components. Later data features should place Supabase calls in feature/service modules rather than directly coupling database logic to UI primitives.
