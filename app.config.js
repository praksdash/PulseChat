const fs = require('node:fs');
const path = require('node:path');

const localGoogleServicesFile = './google-services.json';

module.exports = ({ config }) => {
  const easGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();
  const localFirebaseAvailable = fs.existsSync(path.resolve(process.cwd(), localGoogleServicesFile));
  const googleServicesFile = easGoogleServicesFile || (localFirebaseAvailable ? localGoogleServicesFile : undefined);
  const requirePrivateConfig = process.env.PULSECHAT_REQUIRE_PRIVATE_CONFIG === '1';

  if (requirePrivateConfig && !googleServicesFile) {
    throw new Error(
      'Release build requires GOOGLE_SERVICES_JSON as an EAS file variable or google-services.json at the project root.',
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      // EAS resolves GOOGLE_SERVICES_JSON from a secret file variable. Local
      // configured builds fall back to the ignored project-root client file.
      googleServicesFile,
    },
    extra: {
      ...config.extra,
      release: {
        buildProfile: process.env.PULSECHAT_BUILD_PROFILE || 'local',
      },
    },
  };
};
