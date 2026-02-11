# OpenFrame Tizen TV App

Samsung Tizen TV kiosk application for OpenFrame. This app embeds the OpenFrame kiosk in a native Tizen web app with full TV remote control support.

## Features

- Full TV remote control support (D-pad, color buttons, number keys)
- Persistent configuration storage
- Auto-reconnection on network issues
- Screen always-on (disables screensaver)
- Quick page navigation via remote

## Remote Control Mapping

### Navigation
| Key | Action |
|-----|--------|
| D-pad | Navigate / Scroll |
| Enter/OK | Select |
| Back | Return to Setup |
| Menu | Open Settings |

### Media Controls
| Key | Action |
|-----|--------|
| Play/Pause | Refresh Kiosk |

### Color Buttons
| Key | Action |
|-----|--------|
| Red | Toggle Screensaver |
| Green | Calendar |
| Yellow | Dashboard |
| Blue | Home Assistant |

### Number Keys
| Key | Page |
|-----|------|
| 0 | Home |
| 1 | Calendar |
| 2 | Dashboard |
| 3 | Home Assistant |
| 4 | Photos |
| 5 | Weather |
| 6 | Tasks |
| 7 | Notes |
| 8 | Media |
| 9 | Settings |

## Development

### Prerequisites

1. **Install Tizen Studio**
   - Download from: https://developer.tizen.org/development/tizen-studio/download
   - Select "Tizen Studio with IDE installer"
   - During installation, select: Web App Development, TV Extensions

2. **Samsung Developer Account**
   - Create account at: https://developer.samsung.com/
   - Register your TV for development

3. **Enable Developer Mode on TV**
   - Go to Apps panel on TV
   - Enter "12345" on remote to open Developer Mode settings
   - Enable Developer Mode and enter your PC's IP address
   - Restart the TV

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Tizen Packaging

```bash
# Build the web app
pnpm build

# Package as .wgt (in Tizen Studio or CLI)
tizen package -t wgt -s <certificate> -- dist/

# Install to TV
tizen install -n OpenFrameKiosk.wgt -t <device-name>
```

### Certificate Setup (First Time)

1. Open Tizen Studio → Tools → Certificate Manager
2. Create Samsung Certificate (for TV deployment)
3. Register on Samsung Seller Office if distributing to others

## Project Structure

```
apps/tizen-tv/
├── src/
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   ├── components/
│   │   ├── SetupScreen.tsx  # Server URL + token configuration
│   │   ├── KioskFrame.tsx   # iframe wrapper for kiosk
│   │   └── RemoteHandler.tsx # TV remote key handling
│   ├── hooks/
│   │   └── useTizenKeys.ts  # Tizen key event hook
│   ├── services/
│   │   └── storage.ts       # Persistent storage wrapper
│   ├── styles/
│   │   └── tv.css           # TV-optimized styles
│   └── types/
│       └── tizen.d.ts       # Tizen API type definitions
├── public/
│   └── index.html
├── config.xml               # Tizen app manifest
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Configuration

The app stores configuration in localStorage:
- `openframe_server_url`: Base URL of OpenFrame server
- `openframe_kiosk_token`: UUID token for kiosk access

## Troubleshooting

### App won't install on TV
- Ensure your TV is in Developer Mode
- Check that your PC's IP is registered in TV settings
- Verify your Tizen certificate is valid

### Kiosk won't connect
- Check server URL includes https://
- Verify the kiosk token is correct
- Ensure TV has network connectivity

### Remote keys not working
- Some keys are registered on app start
- Exit and re-launch the app
- Check TV firmware is up to date
