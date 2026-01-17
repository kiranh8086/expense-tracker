# SplitTrip - Expense Tracker 💸

A beautiful, mobile-friendly expense tracker for splitting trip costs with friends. Works offline and stores data locally on your device.

## Features

- ✅ **Add Expenses** - Track who paid and for what
- ✅ **Equal Splits** - Automatically split expenses among selected members
- ✅ **Balance Tracking** - See who owes what at a glance
- ✅ **Smart Settlements** - Optimized suggestions to minimize transactions
- ✅ **Multiple Currencies** - Support for INR, USD, EUR, GBP, and more
- ✅ **Offline Ready** - Works without internet, data saved locally
- ✅ **iPhone Optimized** - Add to home screen for app-like experience

## Quick Start

1. Open `index.html` in your browser
2. Set up your trip name, currency, and add 4-10 members
3. Start adding expenses!

### Add to iPhone Home Screen

1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Name it "SplitTrip" and tap Add

## Tech Stack

- Pure HTML, CSS, JavaScript (no frameworks)
- LocalStorage for data persistence
- Mobile-first responsive design
- CSS custom properties for theming

## Screenshots

The app features:
- Dark theme with purple accent colors
- Bottom sheet modals for iOS-like UX
- Floating action button for quick expense entry
- Tabbed interface for Expenses, Balances, and Settlements

## How It Works

### Balance Calculation
For each expense, the person who paid gets credit for the full amount, while everyone in the split owes their share.

**Example:** If Alice pays ₹1000 for dinner split 4 ways:
- Alice: +₹1000 (paid) - ₹250 (her share) = +₹750
- Bob: -₹250
- Carol: -₹250
- Dave: -₹250

### Settlement Algorithm
The app uses a greedy algorithm to minimize the number of transactions needed to settle all debts.

## Data Storage

All data is stored in your browser's localStorage under the key `splittrip_data`. 

To export your data, open browser console and run:
```javascript
console.log(localStorage.getItem('splittrip_data'));
```

## License

MIT License - Feel free to use and modify!

---

Made with ❤️ for easier trip expense management

