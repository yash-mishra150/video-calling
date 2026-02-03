/**
 * Migration Script: Convert Contact collection to User.friends array
 * 
 * OLD SYSTEM: Separate Contact collection { requester, recipient, status }
 * NEW SYSTEM: User model with friends: [ObjectId] and friendRequests: [{ from, createdAt }]
 * 
 * Strategy:
 * 1. Read all contacts from Contact collection
 * 2. For status='accepted': Add to both users' friends array
 * 3. For status='pending': Add to recipient's friendRequests array
 * 4. Drop Contact collection after migration
 */

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');

const runMigration = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  console.log('\n📊 Migrating from Contact collection to User.friends array...\n');

  try {
    const Contact = mongoose.connection.collection('contacts');
    const User = mongoose.connection.collection('users');

    // Get all contacts
    const contacts = await Contact.find({}).toArray();
    
    if (contacts.length === 0) {
      console.log('✅ No contacts to migrate. All done!');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`Found ${contacts.length} contacts to migrate\n`);

    const userUpdates = new Map(); // userId -> { friends: Set, requests: Array }

    // Process all contacts
    for (const contact of contacts) {
      const requesterId = contact.requester?.toString();
      const recipientId = contact.recipient?.toString();
      const status = contact.status || 'accepted'; // Default to accepted for old data

      if (!requesterId || !recipientId) {
        console.log('⚠️  Skipping invalid contact:', contact._id);
        continue;
      }

      // Initialize user data if not exists
      if (!userUpdates.has(requesterId)) {
        userUpdates.set(requesterId, { friends: new Set(), requests: [] });
      }
      if (!userUpdates.has(recipientId)) {
        userUpdates.set(recipientId, { friends: new Set(), requests: [] });
      }

      if (status === 'accepted') {
        // Add to both users' friends arrays
        userUpdates.get(requesterId).friends.add(recipientId);
        userUpdates.get(recipientId).friends.add(requesterId);
        console.log(`✅ Friends: ${requesterId} <-> ${recipientId}`);
      } else if (status === 'pending') {
        // Add to recipient's pending requests
        userUpdates.get(recipientId).requests.push({
          from: new mongoose.Types.ObjectId(requesterId),
          createdAt: contact.createdAt || new Date()
        });
        console.log(`📬 Request: ${requesterId} -> ${recipientId}`);
      }
    }

    console.log(`\n🔄 Updating ${userUpdates.size} users...\n`);

    // Update all users
    let updated = 0;
    for (const [userId, data] of userUpdates) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            friends: Array.from(data.friends).map(id => new mongoose.Types.ObjectId(id)),
            friendRequests: data.requests
          }
        }
      );
      updated++;
    }

    console.log(`✅ Updated ${updated} users\n`);

    // Drop the Contact collection
    await Contact.drop();
    console.log('🗑️  Dropped Contact collection\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`- Contacts processed: ${contacts.length}`);
    console.log(`- Users updated: ${updated}`);
    console.log(`- Friends are now stored in User.friends array`);
    console.log(`- Pending requests are in User.friendRequests array\n`);

  } catch (error) {
    if (error.message.includes('ns not found')) {
      console.log('✅ Contact collection does not exist. Nothing to migrate.');
    } else {
      console.error('❌ Migration failed:', error);
    }
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Run migration
runMigration();
