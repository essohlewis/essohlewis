// Evite d'écrire try/catch dans chaque contrôleur : si la fonction async
// lève une erreur, elle est automatiquement transmise à next() puis au
// gestionnaire d'erreurs centralisé (middleware/errorHandler.js).
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
