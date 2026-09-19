export default {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: false,
  rules: {
    'type-case': [2, 'always', 'lower-case'],
  },
};
