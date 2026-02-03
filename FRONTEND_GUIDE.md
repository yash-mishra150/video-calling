# 📞 Video Calling App - Frontend

A beautiful, modern video calling application built with Next.js, React, and Tailwind CSS.

## ✨ Features

### Home Page (`/`)
- **Search Bar**: Search contacts with clear button functionality
- **Contact List**: 
  - All contacts view with recent calls
  - Favorites view with starred contacts
  - Beautiful contact cards with avatars
- **Quick Actions**: Cards for recent calls, favorites, groups, and settings
- **Stats Dashboard**: Shows total contacts, online users, and call time

### Contact Card Features
- **Phone Call Icon** (📞): Green button to initiate calls
- **Favorite/Star Button** (⭐): Toggle to add/remove from favorites
- **Menu Button** (⋮): Additional options like call, message, delete
- **Status Indicator**: Shows missed call information
- **Hover Effects**: Smooth animations and visual feedback

### Call Page (`/call`)
A full-screen video calling interface featuring:

#### Video Display
- **Two-camera layout**: Local video on left, remote video on right
- **Grid responsive design**: Adapts to mobile and desktop
- **Signal indicators**: Green dots showing connection quality
- **Camera labels**: Clear identification of local and remote user

#### Control Panel
- **Microphone Toggle** (🎤/🔇): Turn mic on/off with color feedback
- **Camera Toggle** (📹/📵): Turn camera on/off with color feedback
- **Speaker Toggle** (🔊/🔕): Control audio output
- **End Call Button** (📵): Terminate the call with emphasis
- **More Options** (⋮): Additional call features

#### Call Information
- **Caller Name**: Large display of the person you're calling
- **Call Duration**: Real-time call timer
- **Header Info**: Quick access menu

## 🎨 Design Highlights

### Color Scheme
- **Primary**: Blue gradient (`from-blue-600 to-blue-700`)
- **Success**: Green (`bg-green-500`)
- **Attention**: Red (for end call, muted states)
- **Neutral**: Gray palette for backgrounds
- **Accent**: Yellow for favorites

### Components

#### SearchBar.tsx
- Enhanced with clear button
- Enter key support for search
- Hover animations
- Props for custom placeholder and search handler

#### ContactCard.tsx
- Multi-action buttons (call, favorite, menu)
- Gradient avatar backgrounds
- Status indicators
- Dropdown menu for additional options
- Responsive hover states

#### ContactList.tsx
- Tab navigation (All/Favorites)
- Counter badges
- Empty state messaging
- Favorite management

#### CallPage.tsx
- Full-screen dark theme
- Responsive grid layout
- Control buttons with hover scaling
- Connection quality indicators
- Accessible button titles

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Production Build
```bash
npm run build
npm start
```

## 📁 Project Structure

```
Frontend/
├── app/
│   ├── page.tsx              # Home page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── call/
│       └── page.tsx          # Call page
├── components/
│   ├── SearchBar.tsx         # Search input component
│   ├── ContactCard.tsx       # Individual contact display
│   ├── ContactList.tsx       # List of contacts
│   └── CallPage.tsx          # Full-screen call interface
└── data/
    └── dummyContacts.ts      # Sample contact data
```

## 🔧 Tailwind Configuration

The app uses Tailwind CSS with custom configurations:
- Rounded corners (2xl, 3xl)
- Shadow utilities
- Gradient backgrounds
- Transition effects
- Responsive breakpoints

## 📱 Responsive Design

- **Mobile**: Single column layout, adjusted button sizes
- **Tablet**: Two-column grid
- **Desktop**: Full-featured layout with 3-column grids

## 🎯 Key Technologies

- **Next.js 13+**: React framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **React Hooks**: State management with useState

## 🔮 Future Enhancements

- [ ] Real WebRTC integration
- [ ] Call history persistence
- [ ] Group video calls
- [ ] Screen sharing
- [ ] Message history
- [ ] User authentication
- [ ] Dark mode toggle
- [ ] Settings page

## 📝 Component Props

### SearchBar
```tsx
interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}
```

### ContactCard
```tsx
interface ContactCardProps {
  contact: Contact;
  onCall?: (contact: Contact) => void;
  onToggleFavorite?: (contact: Contact) => void;
  isFavorited?: boolean;
}
```

### CallPage
```tsx
interface CallPageProps {
  callerName?: string;
  onEndCall?: () => void;
}
```

## 🎨 Customization

All colors and styles can be customized through Tailwind CSS classes. Key classes to modify:

- **Primary color**: Change `from-blue-600` to any Tailwind color
- **Call button**: Modify `bg-green-500` class
- **Favorite button**: Modify `bg-yellow-400` class
- **Shadows**: Adjust `shadow-lg`, `shadow-xl` classes

---

Built with ❤️ using Next.js and Tailwind CSS
