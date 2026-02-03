const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Contact = require('./src/models/contact.model');

async function cleanupDuplicates() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 Scanning for duplicate contacts...');
    
    // Get all contacts
    const allContacts = await Contact.find().lean();
    console.log(`📊 Total contacts found: ${allContacts.length}`);

    // Find duplicates
    const seen = new Map();
    const duplicates = [];

    allContacts.forEach(contact => {
      const key = `${contact.owner}-${contact.contact}`;
      
      if (seen.has(key)) {
        duplicates.push(contact._id);
        console.log(`⚠️  Duplicate found: ${contact.owner} -> ${contact.contact}`);
      } else {
        seen.set(key, true);
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
    } else {
      console.log(`\n🗑️  Found ${duplicates.length} duplicates. Deleting...`);
      
      const result = await Contact.deleteMany({ _id: { $in: duplicates } });
      console.log(`✅ Deleted ${result.deletedCount} duplicate contacts`);
    }

    // Also find contacts where owner === contact (self-referencing)
    console.log('\n🔍 Scanning for self-referencing contacts...');
    const selfContacts = await Contact.find({
      $expr: { $eq: ['$owner', '$contact'] }
    });

    if (selfContacts.length > 0) {
      console.log(`⚠️  Found ${selfContacts.length} self-referencing contacts`);
      const result = await Contact.deleteMany({
        $expr: { $eq: ['$owner', '$contact'] }
      });
      console.log(`✅ Deleted ${result.deletedCount} self-referencing contacts`);
    } else {
      console.log('✅ No self-referencing contacts found!');
    }

    console.log('\n✅ Cleanup complete!');
    console.log('📝 Remaining contacts:', await Contact.countDocuments());

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
