/**
 * Migration Script: Convert old contacts to new friend request system
 * 
 * OLD SCHEMA: { owner, contact }
 * NEW SCHEMA: { requester, recipient, status: 'pending'|'accepted'|'rejected' }
 * 
 * Strategy:
 * 1. Find all existing contacts in OLD schema (owner/contact fields)
 * 2. Convert to NEW schema (requester/recipient fields)
 * 3. Set status to 'accepted' (assume existing contacts are already friends)
 * 4. Handle bidirectional relationships (if A->B and B->A exist, keep only one)
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

  console.log('\n📊 Starting migration to friend request system...\n');

  try {
    // Get raw collection to handle both old and new schemas
    const Contact = mongoose.connection.collection('contacts');

    // Find all documents with OLD schema (has 'owner' field)
    const oldContacts = await Contact.find({ owner: { $exists: true } }).toArray();

    console.log(`Found ${oldContacts.length} contacts in OLD schema format`);

    if (oldContacts.length === 0) {
      console.log('✅ No old contacts to migrate. All done!');
      process.exit(0);
    }

    // Track unique friendships to avoid duplicates
    const friendshipSet = new Set();
    const migratedContacts = [];

    for (const oldContact of oldContacts) {
      const owner = oldContact.owner.toString();
      const contact = oldContact.contact.toString();

      // Create friendship key (sorted to handle bidirectional)
      const friendshipKey = [owner, contact].sort().join('-');

      // Skip if already processed (bidirectional relationship)
      if (friendshipSet.has(friendshipKey)) {
        console.log(`⏭️  Skipping duplicate friendship: ${owner} <-> ${contact}`);
        continue;
      }

      friendshipSet.add(friendshipKey);

      // Create new contact with 'accepted' status
      migratedContacts.push({
        requester: oldContact.owner,
        recipient: oldContact.contact,
        status: 'accepted',
        createdAt: oldContact.createdAt || new Date(),
        updatedAt: new Date()
      });

      console.log(`✅ Converted: ${owner} -> ${contact} (status: accepted)`);
    }

    // Delete all OLD schema documents
    const deleteResult = await Contact.deleteMany({ owner: { $exists: true } });
    console.log(`\n🗑️  Deleted ${deleteResult.deletedCount} old contact records`);

    // Insert NEW schema documents
    if (migratedContacts.length > 0) {
      const insertResult = await Contact.insertMany(migratedContacts);
      console.log(`✅ Inserted ${insertResult.length} new friend relationships\n`);
    }

    console.log('🎉 Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`- Old contacts found: ${oldContacts.length}`);
    console.log(`- Duplicates removed: ${oldContacts.length - migratedContacts.length}`);
    console.log(`- New friendships created: ${migratedContacts.length}`);
    console.log(`- All existing contacts are now 'accepted' friends\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Run migration
runMigration();
