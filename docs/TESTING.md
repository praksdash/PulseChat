# PulseChat Testing

## Phase 3 manual test checklist

1. App opens on Login without Expo starter UI.
2. Login screen responds correctly to system light/dark appearance.
3. Password visibility icon toggles the secure field presentation.
4. Create account opens Register.
5. Back to sign in returns to Login.
6. Preview PulseChat opens Chats.
7. Chats tab renders four styled demo conversations.
8. Tapping a conversation opens its dynamic conversation screen.
9. Conversation back button returns to Chats.
10. Search tab filters the three local demo people as text is typed.
11. A nonsense search displays the empty-state component.
12. Profile tab renders profile and settings cards.
13. Profile return-to-login button returns to Login.
14. Bottom tabs remain readable and tappable in light and dark modes.
15. Android back navigation produces no route errors.

## Automated/static checks for this phase

Run:

```bash
npx tsc --noEmit
npx expo export --platform android --output-dir dist-phase3-check
```

Both commands must complete successfully before committing Phase 3.
