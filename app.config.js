const fs = require('node:fs');
const path = require('node:path');

const googleServicesFile = './google-services.json';

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // Local lint/typecheck/Metro export must work before the developer adds
    // their Firebase file. EAS/native notification builds include it as soon
    // as google-services.json is placed at the project root.
    googleServicesFile: fs.existsSync(path.resolve(process.cwd(), googleServicesFile))
      ? googleServicesFile
      : undefined,
  },
});
