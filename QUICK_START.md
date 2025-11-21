# Quick Start Guide - Multi-Device Tournament Management

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Firebase project configured (already done)
- Multiple devices with internet connection
- Admin credentials for login

---

## Step-by-Step Setup

### 1️⃣ **Update Firebase Security Rules** (One-time setup)

Go to [Firebase Console](https://console.firebase.google.com/) → Your Project → Realtime Database → Rules

```json
{
  "rules": {
    "registrations": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["fullName", "weight", "gender", "team"]
    },
    "tournament": {
      ".read": "auth != null",
      ".write": "auth != null",
      "matches": {
        ".indexOn": ["status", "weight", "gender", "deviceId"]
      },
      "locks": {
        ".indexOn": ["deviceId"]
      },
      "devices": {
        ".indexOn": ["status"]
      }
    }
  }
}
```

Click **Publish** to save.

---

### 2️⃣ **Admin: Register Players**

1. Open browser → Navigate to your tournament site
2. Login at `/views/log-in.html`
3. Go to Player Registration (`/player-registration.html`)
4. Register all tournament participants:
   - Full Name
   - Weight Category
   - Gender
   - Team/Club
   - Photo (optional)

---

### 3️⃣ **Admin: Generate Match Draws**

1. Navigate to `/views/generate-draws.html`
2. Select filters:
   - Weight Category
   - Gender
3. Click **"Generate Draw"**
4. Wait for animation to complete
5. ✅ Success notification appears
6. Click **"Go to Tournament Matches"**

---

### 4️⃣ **Setup Each Device**

**On Each Mat/Device:**

1. Open `/views/tournament-matches.html`
2. First-time popup appears: **"Device Setup"**
3. Enter device name:
   - Examples: `Mat 1`, `Mat 2`, `Mat 3`, `Admin Desk`
4. Click **"Save & Continue"**
5. ✅ Device is now registered!

---

### 5️⃣ **Start Managing Matches**

**On Any Device:**

1. View all matches grouped by status:
   - ⏳ **Pending** - Available to start
   - 🔒 **Locked** - Reserved by another device
   - ▶️ **In Progress** - Currently being scored
   - ✅ **Completed** - Finished

2. **To Start a Match:**
   - Find a **Pending** match
   - Click **"Lock & Start"**
   - Enter **Mat Number** (e.g., "1")
   - ✅ Scoreboard opens automatically!

3. **Score the Match:**
   - Use scoreboard interface
   - Record points, penalties, timer
   - Declare winner when done

4. **Match Completes:**
   - Automatically unlocks
   - Moves to "Completed"
   - Device ready for next match

---

## 📱 Multi-Device Features

### Real-Time Synchronization
- All devices see the same data instantly
- Changes appear within 1 second
- No manual refresh needed

### Device Locking
- ✅ Only one device can manage a match at a time
- ❌ Other devices cannot interfere
- 🔓 Lock auto-releases if device disconnects

### Device Dashboard
- See all online devices
- View which device is managing which match
- Monitor device status in real-time

---

## 🎯 Quick Reference

### Match Status Flow
```
Pending → Locked → In Progress → Completed
   ↓         ↓
Unlock    Unlock
```

### Keyboard Shortcuts (on Scoreboard)
- **Space**: Start/Pause timer
- **Q/Y**: Ippon (White/Blue)
- **W/U**: Waza-ari (White/Blue)
- **R/O**: Shido (White/Blue)
- **←/→**: Osaekomi timer
- **↓**: Stop Osaekomi

### Common Actions
| Action | Location | Button |
|--------|----------|--------|
| Register Player | Player Registration | "Save Player" |
| Generate Draws | Generate Draws | "Generate Draw" |
| Start Match | Tournament Matches | "Lock & Start" |
| Open Scoreboard | Tournament Matches | "Open Scoreboard" |
| Complete Match | Scoreboard | "Declare Winner" |

---

## ⚠️ Important Notes

### DO:
- ✅ Give each device a unique, descriptive name
- ✅ Keep browser tabs open during matches
- ✅ Ensure stable internet connection
- ✅ Lock match before starting

### DON'T:
- ❌ Close browser tab during active match
- ❌ Use same device name on multiple devices
- ❌ Try to start a locked match from another device
- ❌ Manually edit Firebase data during tournament

---

## 🔧 Troubleshooting

### Match Stuck as "Locked"?
**Solution**: Device disconnected. Lock will auto-release in 30 seconds.

### Scoreboard Won't Open?
**Solution**: Check popup blocker. Allow popups for your site.

### Changes Not Appearing?
**Solution**: 
1. Check internet connection
2. Refresh page (F5)
3. Check Firebase Console for errors

### Device Shows Offline?
**Solution**:
1. Refresh page
2. Check network connection
3. Re-enter device name if needed

---

## 📞 Need Help?

1. Check browser console (F12) for errors
2. Review `MULTI_DEVICE_GUIDE.md` for detailed documentation
3. Verify Firebase security rules are published
4. Test with single device first before multi-device

---

## 🎉 You're Ready!

Your multi-device tournament management system is now set up and ready to use!

**Next Steps:**
1. Test with 2-3 devices
2. Run a practice match
3. Familiarize staff with the interface
4. Start your tournament!

---

**Quick Links:**
- Login: `/views/log-in.html`
- Player Registration: `/player-registration.html`
- Generate Draws: `/views/generate-draws.html`
- Tournament Matches: `/views/tournament-matches.html`
- Scoreboard: `/views/scoreboard.html`

**Version**: 1.0  
**Last Updated**: November 2024
