# WordStream

Learn languages while watching videos. Browser extension that helps you translate, save words and take notes.

## Project Structure

The project is structured as follows:

```
extension/
├─ src/
│  ├─ background/         ← Service Worker
│  │  ├─ auth.ts          ← Authentication handling
│  │  ├─ storage.ts       ← Local storage management
│  │  ├─ firestore.ts     ← Firestore database interactions
│  │  ├─ message-bus.ts   ← Messaging system
│  │  ├─ constants.ts     ← Shared constants
│  │  └─ index.ts         ← Main service worker
│  ├─ shared/             ← Shared code
│  │  └─ message.ts       ← Message type definitions
│  ├─ utils/              ← Utility functions
│  ├─ popup/              ← Popup UI
│  │  └─ simple-popup.html ← Simple HTML popup
│  ├─ content/            ← Content script
│  │  └─ index.ts         ← Content script entry
│  └─ manifest.json       ← Extension manifest
├─ webpack.config.js      ← Build configuration
└─ package.json           ← Dependencies
```

## Architecture

This extension uses a modern service worker based architecture:

1. **Background Service Worker**: Manages authentication, storage, and all background processing.
2. **Content Script**: Injected into web pages to provide translation and notes functionality.
3. **Popup UI**: Simple HTML/JS interface for user interaction.

## Communication System

Components communicate through a unified messaging system:

- All messages are sent through `chrome.runtime.sendMessage`
- The `message-bus.ts` module handles routing and dispatching of messages
- Message types are defined in `constants.ts` and exported via `shared/message.ts`

## Authentication

Authentication is handled via Chrome Identity API and Firebase:

- Service worker manages the auth state
- Identity tokens are obtained via `chrome.identity.getAuthToken`
- Firebase is used for persistent authentication
- Auth state is broadcast to all extension components

## Development

1. Install dependencies:
```
npm install
```

2. Start development mode with hot reloading:
```
npm run dev
```

3. Build for production:
```
npm run build
```

4. Load the unpacked extension from the `dist` folder in Chrome.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 