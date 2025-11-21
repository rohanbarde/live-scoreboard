# Multi-Device Tournament Management System

## Overview

This system enables seamless management of judo tournament matches across multiple devices with real-time synchronization and device locking to prevent conflicts.

## Features

### 1. **Device Management**
- Unique device identification
- Device naming (e.g., "Mat 1", "Mat 2", "Admin Desk")
- Real-time device status tracking (online/offline)
- Automatic heartbeat monitoring

### 2. **Match Locking System**
- Prevents multiple devices from accessing the same match simultaneously
- Automatic lock release on device disconnect
- Visual indicators for locked matches
- Device ownership tracking

### 3. **Real-Time Synchronization**
- Firebase Realtime Database integration
- Instant updates across all connected devices
- Match status changes propagate immediately
- Device status monitoring

### 4. **Match Management**
- Lock and start matches from any device
- Automatic scoreboard opening
- Mat assignment
- Match completion tracking

## Workflow

### Step 1: Admin Login
1. Navigate to `/views/log-in.html`
2. Enter admin credentials
3. System redirects to player registration or intended page

### Step 2: Player Registration
1. Access `/player-registration.html`
2. Register all tournament participants
3. Enter player details: name, weight, gender, team, photo

### Step 3: Generate Match Draws
1. Navigate to `/views/generate-draws.html`
2. Select weight categories and gender
3. Click "Generate Draw"
4. System creates matches and saves to Firebase
5. Matches are automatically available on all devices

### Step 4: Multi-Device Match Management
1. Open `/views/tournament-matches.html` on each device
2. First-time setup: Enter device name (e.g., "Mat 1")
3. View all available matches grouped by status:
   - **Pending**: Available to lock and start
   - **Locked**: Reserved by a specific device
   - **In Progress**: Currently being scored
   - **Completed**: Finished matches

### Step 5: Start a Match
1. Find a pending match
2. Click "Lock & Start"
3. Enter mat number
4. System:
   - Locks the match (prevents other devices from accessing it)
   - Updates match status to "in_progress"
   - Opens dedicated scoreboard in new window/tab
   - Displays match on vMix overlay (if configured)

### Step 6: Score the Match
1. Use the scoreboard interface to record:
   - Ippon, Waza-ari, Yuko scores
   - Shido penalties
   - Red cards (Hansoku-make)
   - Match timer and Osaekomi timer
2. All actions are logged in real-time
3. Declare winner when match completes

### Step 7: Complete Match
1. Match automatically completes when winner is declared
2. Lock is released
3. Match moves to "Completed" status
4. Device becomes available for next match

## Database Structure

### Firebase Realtime Database Schema

```
tournament/
├── matches/
│   ├── match_[id]/
│   │   ├── id: string
│   │   ├── matchNumber: number
│   │   ├── round: number
│   │   ├── weight: string
│   │   ├── gender: string
│   │   ├── fighterA: object
│   │   ├── fighterB: object
│   │   ├── status: "pending" | "locked" | "in_progress" | "completed"
│   │   ├── winner: string | null
│   │   ├── mat: number | null
│   │   ├── deviceId: string | null
│   │   ├── deviceName: string | null
│   │   ├── startTime: timestamp | null
│   │   ├── endTime: timestamp | null
│   │   └── createdAt: timestamp
│   └── ...
├── locks/
│   ├── match_[id]/
│   │   ├── deviceId: string
│   │   ├── deviceName: string
│   │   ├── lockedAt: timestamp
│   │   └── matchId: string
│   └── ...
└── devices/
    ├── device_[id]/
    │   ├── deviceId: string
    │   ├── deviceName: string
    │   ├── lastSeen: timestamp
    │   ├── status: "online" | "offline"
    │   └── currentMatch: string | null
    └── ...
```

## API Reference

### MatchManager Class

#### Constructor
```javascript
const matchManager = new MatchManager();
```

#### Methods

##### `createMatchesFromDraw(drawData)`
Creates matches from draw generation data.
```javascript
await matchManager.createMatchesFromDraw({
    categories: [
        {
            weight: "60kg",
            gender: "Male",
            players: [player1, player2, ...]
        }
    ]
});
```

##### `lockMatch(matchId)`
Attempts to lock a match for exclusive access.
```javascript
try {
    await matchManager.lockMatch('match_123');
    console.log('Match locked successfully');
} catch (error) {
    console.error('Failed to lock:', error.message);
}
```

##### `unlockMatch(matchId)`
Releases a match lock.
```javascript
await matchManager.unlockMatch('match_123');
```

##### `startMatch(matchId, matNumber)`
Starts a locked match and opens scoreboard.
```javascript
await matchManager.startMatch('match_123', '1');
```

##### `completeMatch(matchId, winner, scoreData)`
Marks a match as completed.
```javascript
await matchManager.completeMatch('match_123', 'fighterA', {
    ipponA: 1,
    wazaA: 0,
    // ... score data
});
```

##### `onMatchesUpdate(callback)`
Listens for real-time match updates.
```javascript
matchManager.onMatchesUpdate(matches => {
    console.log('Matches updated:', matches);
});
```

##### `getDevices()`
Retrieves all registered devices.
```javascript
const devices = await matchManager.getDevices();
```

##### `setDeviceName(name)`
Updates the current device's name.
```javascript
await matchManager.setDeviceName('Mat 2');
```

## Security Rules

### Recommended Firebase Security Rules

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

## Conflict Resolution

### Scenario 1: Device Disconnects During Match
**Problem**: Device managing a match loses connection.
**Solution**: 
- Firebase `onDisconnect()` automatically removes lock
- Match returns to "pending" status
- Another device can pick up the match

### Scenario 2: Multiple Devices Try to Lock Same Match
**Problem**: Two devices click "Lock & Start" simultaneously.
**Solution**:
- Firebase transaction ensures atomic lock acquisition
- Only one device succeeds
- Other device receives error message

### Scenario 3: Device Crashes Mid-Match
**Problem**: Device crashes while scoring a match.
**Solution**:
- Heartbeat monitoring detects device offline
- Lock is automatically released after timeout
- Match can be resumed from another device

## Best Practices

### 1. Device Setup
- Give each device a descriptive name
- Use consistent naming (e.g., "Mat 1", "Mat 2", not "John's Laptop")
- Keep device names short and clear

### 2. Network Requirements
- Stable internet connection required
- Minimum 1 Mbps upload/download speed
- Low latency (<100ms) preferred

### 3. Match Management
- Always lock a match before starting
- Don't close browser tab during active match
- Complete or unlock matches when done

### 4. Troubleshooting
- If match appears stuck, check device status
- Refresh page if synchronization seems delayed
- Check Firebase console for lock status

## Testing Checklist

### Single Device Testing
- [ ] Device registration and naming
- [ ] Lock a pending match
- [ ] Start a locked match
- [ ] Scoreboard opens correctly
- [ ] Complete a match
- [ ] Unlock a match

### Multi-Device Testing
- [ ] Open tournament page on 2+ devices
- [ ] Verify all devices see same matches
- [ ] Lock match on Device A
- [ ] Verify Device B cannot lock same match
- [ ] Start match on Device A
- [ ] Verify Device B shows match as "in progress"
- [ ] Complete match on Device A
- [ ] Verify Device B shows match as "completed"

### Conflict Testing
- [ ] Disconnect Device A during match
- [ ] Verify lock is released
- [ ] Device B can pick up match
- [ ] Simultaneous lock attempts fail gracefully

### Performance Testing
- [ ] Test with 50+ matches
- [ ] Test with 5+ concurrent devices
- [ ] Verify real-time updates are fast (<1 second)
- [ ] Check memory usage over time

## Monitoring

### Device Status Dashboard
Access `/views/tournament-matches.html` to view:
- All online devices
- Offline devices with last seen time
- Current match assignments
- Device activity

### Firebase Console
Monitor in Firebase Console:
- `/tournament/matches` - All match data
- `/tournament/locks` - Active locks
- `/tournament/devices` - Device registry

## Troubleshooting

### Issue: Match Stuck in "Locked" Status
**Symptoms**: Match shows locked but device is offline.
**Solution**:
1. Check Firebase Console → `/tournament/locks/[matchId]`
2. Manually delete the lock entry
3. Match will return to "pending"

### Issue: Device Not Appearing Online
**Symptoms**: Device shows offline despite being connected.
**Solution**:
1. Refresh the page
2. Check browser console for errors
3. Verify Firebase connection
4. Check network connectivity

### Issue: Scoreboard Not Opening
**Symptoms**: "Start Match" doesn't open scoreboard.
**Solution**:
1. Check popup blocker settings
2. Allow popups for your domain
3. Try opening scoreboard manually: `/views/scoreboard.html`

### Issue: Slow Synchronization
**Symptoms**: Changes take >5 seconds to appear on other devices.
**Solution**:
1. Check internet connection speed
2. Verify Firebase quota not exceeded
3. Reduce number of concurrent devices
4. Check browser console for errors

## Advanced Configuration

### Custom Device Types
Modify `match-manager.js` to add device types:
```javascript
const DEVICE_TYPES = {
    MAT: 'mat',
    ADMIN: 'admin',
    DISPLAY: 'display'
};
```

### Custom Match Statuses
Extend match statuses in database:
```javascript
const MATCH_STATUSES = {
    PENDING: 'pending',
    LOCKED: 'locked',
    IN_PROGRESS: 'in_progress',
    PAUSED: 'paused',        // Add custom status
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'   // Add custom status
};
```

### Heartbeat Interval
Adjust device heartbeat frequency in `match-manager.js`:
```javascript
// Default: 5000ms (5 seconds)
this.heartbeatInterval = setInterval(() => {
    deviceRef.update({
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
}, 5000); // Change this value
```

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify Firebase configuration
3. Test with single device first
4. Review Firebase security rules
5. Check network connectivity

---

**Version**: 1.0  
**Last Updated**: November 2024  
**Author**: BLACKTROUNCE STUDIO
