// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  { ignores: ['dist*/**', '.expo/**'] },
  expoConfig,
  {
    rules: {
      // PulseChat intentionally starts async screen loads and controlled form
      // resets from effects. The Expo rule flags the call site even though the
      // actual state updates happen after an external async operation.
      'react-hooks/set-state-in-effect': 'off',
      // Supabase-generated function signatures use both T[] and Array<T>.
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      // Supabase Edge Functions use Deno's npm: import specifier, which the
      // React Native resolver does not understand.
      'import/no-unresolved': 'off',
    },
  },
]);
