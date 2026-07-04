# TaskFlow est une application Node.js / Express (voir server.js et package.json).
# L'ancien Dockerfile ciblait PHP/Apache et un index.php inexistant : le conteneur
# ne pouvait donc pas servir l'application. On construit ici une image Node.

FROM node:20-alpine

WORKDIR /usr/src/app

# 1. Installer les dépendances d'abord (meilleure mise en cache des couches).
#    On copie uniquement les manifestes puis on installe les dépendances de
#    production de façon reproductible à partir du package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2. Copier le reste du code de l'application.
COPY . .

# 3. Les dossiers des pièces jointes et des logs doivent exister et être inscriptibles.
RUN mkdir -p uploads logs && chown -R node:node /usr/src/app

# 4. Ne pas tourner en root (l'image node fournit l'utilisateur "node").
USER node

# Le port est configurable via la variable d'environnement PORT (défaut : 3000).
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
