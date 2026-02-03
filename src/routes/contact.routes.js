const auth = require('../middleware/auth.middleware');
const { validateContactAdd } = require('../middleware/validation.middleware');

module.exports = (io, presenceService) => {
  const router = require('express').Router();
  const contactController = require('../controllers/contact.controller')(io, presenceService);

  // Favorites system
  router.post('/toggle-favorite', auth, validateContactAdd, contactController.toggleFavorite);
  router.get('/favorites', auth, contactController.getFavorites);
  router.get('/is-favorited', auth, contactController.isFavorited);

  // Friends system
  router.get('/friends', auth, contactController.getFriends);
  router.post('/remove-friend', auth, contactController.removeFriend);

  return router;
};

