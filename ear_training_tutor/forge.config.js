const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'src/assets/icons/icon'), // no file extension required, packager will use the right format
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Windows specific configuration
        iconUrl: path.resolve(__dirname, 'src/assets/icons/icon.ico'),
        setupIcon: path.resolve(__dirname, 'src/assets/icons/icon.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        // Debian/Ubuntu specific configuration
        options: {
          icon: path.resolve(__dirname, 'src/assets/icons/icon.png'),
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        // RPM specific configuration (Fedora, RHEL, etc.)
        options: {
          icon: path.resolve(__dirname, 'src/assets/icons/icon.png'),
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
