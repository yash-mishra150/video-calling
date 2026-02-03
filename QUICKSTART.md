# Quick Start Guide - Video Calling App

## 🚀 Getting Started in 5 Minutes

### Step 1: Install Dependencies
```bash
cd Frontend
npm install
```

### Step 2: Run Development Server
```bash
npm run dev
```

### Step 3: Open in Browser
Navigate to: `http://localhost:3000`

---

## 🔐 Demo Login

The app includes demo credentials for testing:

**Username**: `demo`
**Password**: `demo`

Or click on the demo link on the login page.

---

## 🎯 Quick Tour

### After Login, You'll See:

1. **Top Navigation Bar**
   - App title and menu toggle
   - Status dropdown (Online/Away/Busy/Offline)
   - Logout button

2. **Left Sidebar** (collapsible)
   - Online Friends list
   - Recent Calls
   - User info section

3. **Main Content Area**
   - Contacts list with search
   - Interactive contacts with call buttons
   - Status indicators

4. **Right Panel**
   - Console/Logs viewer
   - Real-time event tracking

---

## 🧪 Features to Try

### Test Authentication
1. Click "Register" to create a new account
2. Or use demo credentials to login
3. View localStorage in DevTools to see token storage
4. Log out and verify redirect to login page

### Test Contact Management
1. Search for contacts using the search bar
2. Hover over contacts to see actions
3. Click to call or toggle favorite status
4. View console logs for each action

### Test Status Management
1. Click status indicator in top right
2. Select different status (Online/Away/Busy/Offline)
3. Watch console log the status change
4. Status persists in the navbar

### Test Incoming Call
1. Click "Demo Incoming Call" button at bottom
2. Watch modal appear with ringing animation
3. Accept or reject the call
4. View action logged in console

### Test Console Logs
1. Perform any action in the app
2. Check the right-side console panel
3. Logs are color-coded by type:
   - 🔵 Blue = Info
   - 🟢 Green = Success
   - 🟡 Yellow = Warning
   - 🔴 Red = Error

---

## 📁 File Structure

```
Frontend/
├── app/page.tsx                  # Authentication router
├── app/call/page.tsx             # Video call interface
├── components/                   # React components
├── lib/                          # Services (API, Socket.IO)
├── data/dummyContacts.ts         # Sample data
└── .env.local                    # Configuration
```

---

## 🔧 Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## 📱 Responsive Design

The app works on:
- ✅ Desktop (1920px+)
- ✅ Laptop (1280px+)
- ✅ Tablet (768px+)
- ✅ Mobile (320px+)

Try resizing the browser to see sidebar collapse on smaller screens.

---

## 🔌 Environment Configuration

Edit `.env.local` to configure API endpoints:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

These need a backend server to actually connect.

---

## 💡 Component Usage

### Add a New Contact
Edit `data/dummyContacts.ts` to add more sample contacts.

### Modify Styling
All styling uses Tailwind CSS. Edit component className attributes.

### Add New Pages
Create new files in `app/` directory following Next.js conventions.

### Add Icons
Import from Lucide React:
```typescript
import { Phone, Video, Settings } from 'lucide-react';
```

---

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
npm run dev -- -p 3001
```

### Changes Not Reflecting
1. Clear browser cache (Cmd+Shift+Delete)
2. Hard refresh (Cmd+Shift+R)
3. Restart dev server

### TypeScript Errors
```bash
npm run build  # Will show all errors
```

---

## 🎨 Customization Tips

### Change Colors
Search for color classes in components:
- `bg-blue-600` → Change to your color
- `text-gray-700` → Modify text colors
- Use Tailwind's color palette: blue, purple, green, red, etc.

### Change Fonts
Edit `app/globals.css` to modify font-family.

### Add More Contacts
Edit `data/dummyContacts.ts` and add objects to the contacts array.

### Modify Console Colors
Edit `ConsolePanel.tsx` `getLogColor()` function.

---

## 📊 Project Stats

- **Components**: 10
- **Pages**: 2
- **Services**: 2 (API, Socket.IO)
- **Lines of Code**: ~3500
- **Dependencies**: 2 major (lucide-react, socket.io-client)
- **Build Time**: <1 second (dev)
- **Package Size**: ~50MB (node_modules)

---

## 🎯 Next Steps

### For Frontend Development
1. Customize components and styling
2. Add more pages or features
3. Improve error handling
4. Add form validation

### For Backend Integration
1. Set up backend server
2. Create API endpoints (auth, users, calls)
3. Implement Socket.IO server
4. Connect to database

### For WebRTC Integration
1. Use `navigator.mediaDevices.getUserMedia()`
2. Create RTCPeerConnection
3. Handle offer/answer signaling via Socket.IO
4. Display real video streams

---

## 🔗 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [React Hooks](https://react.dev/reference/react)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [Socket.IO](https://socket.io/docs/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [TypeScript](https://www.typescriptlang.org)

---

## 📝 Notes

- All features are fully functional with demo/mock data
- Console logs help debug actions and track user flow
- Components are well-typed with TypeScript
- Styling is responsive and mobile-friendly
- Ready for backend integration
- Ready for WebRTC implementation

---

**Happy Coding! 🚀**

For detailed information, see `IMPLEMENTATION_SUMMARY.md`
