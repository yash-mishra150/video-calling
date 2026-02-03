const User = require('../models/users.model.js');

module.exports = (io, presenceService) => {
  const controllers = {};


  controllers.toggleFavorite = async (req, res) => {
    const { userId } = req.body;
    const currentUserId = req.user.userId;

    try {
      if (currentUserId === userId) {
        return res.status(400).json({ error: 'Cannot favorite yourself' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const currentUser = await User.findById(currentUserId);

      const isFavorited = currentUser.favorites.includes(userId);

      if (isFavorited) {
        currentUser.favorites = currentUser.favorites.filter(id => id.toString() !== userId);
        await currentUser.save();
        res.json({ 
          message: 'Removed from favorites',
          isFavorited: false
        });
      } else {
        currentUser.favorites.push(userId);
        await currentUser.save();
        res.json({ 
          message: 'Added to favorites',
          isFavorited: true
        });
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  };

 
  controllers.getFavorites = async (req, res) => {
    const userId = req.user.userId;

    try {
      const currentUser = await User.findById(userId)
        .populate('favorites', 'username');

      const favorites = currentUser.favorites.map(fav => ({
        userId: fav._id,
        username: fav.username
      }));

      res.json({ favorites });
    } catch (error) {
      console.error('Get favorites error:', error);
      res.status(500).json({ error: 'Failed to get favorites' });
    }
  };

 
  controllers.isFavorited = async (req, res) => {
    const { userId } = req.query;
    const currentUserId = req.user.userId;

    try {
      const currentUser = await User.findById(currentUserId);
      const isFavorited = currentUser.favorites.includes(userId);
      res.json({ isFavorited });
    } catch (error) {
      console.error('Check favorite error:', error);
      res.status(500).json({ error: 'Failed to check favorite status' });
    }
  };


  controllers.getFriends = async (req, res) => {
    const userId = req.user.userId;

    try {
      const currentUser = await User.findById(userId)
        .populate('friends', 'username');

      const friends = currentUser.friends.map(friend => ({
        friendId: friend._id,
        friendName: friend.username
      }));

      res.json({ friends });
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ error: 'Failed to get friends' });
    }
  };


  controllers.removeFriend = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.user.userId;

    try {
      const currentUser = await User.findById(userId);
      const friend = await User.findById(friendId);

      if (!friend) {
        return res.status(404).json({ error: 'User not found' });
      }

      currentUser.friends = currentUser.friends.filter(
        id => id.toString() !== friendId
      );
      friend.friends = friend.friends.filter(
        id => id.toString() !== userId
      );

      await currentUser.save();
      await friend.save();

      res.json({ message: 'Friend removed successfully' });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  };

  return controllers;
};
