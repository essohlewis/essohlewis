<?php
/* ==========================================================================
   controllers/AuthController.php — Inscription, connexion, profil courant.
   ========================================================================== */

class AuthController
{
    /** Limite anti-brute-force appliquée aux routes d'authentification. */
    private function limiterAuth(): void
    {
        $limites = App::config('rate_limit', []);
        RateLimiter::verifier('auth', (int) ($limites['auth'] ?? 12), 60);
    }

    /** POST /auth/register */
    public function register(array $params): void
    {
        $this->limiterAuth();
        $d = Request::corps();
        (new Validator($d))
            ->requis('prenom')->requis('nom')
            ->email('email')->requis('email')
            ->telephoneCI('telephone')
            ->min('motDePasse', 6, 'Mot de passe : 6 caractères minimum')
            ->dansListe('role', ['client', 'coach'], 'Rôle invalide')
            ->ouEchouer();

        $userModel = new User();
        if ($userModel->parEmail($d['email'])) {
            Response::erreur('Un compte existe déjà avec cet email.', 409);
        }

        $id = $userModel->creer($d);

        // Fiche coach minimale si rôle coach.
        $coachId = null;
        if ($d['role'] === 'coach') {
            $coachId = $this->creerFicheCoach($id, $d);
        }

        $user = $userModel->trouver($id);
        $charge = $this->avecToken($user);
        if ($coachId) {
            $charge['user']['coachId'] = $coachId;
        }
        Response::ok($charge, 201);
    }

    /** POST /auth/login */
    public function login(array $params): void
    {
        $this->limiterAuth();
        $d = Request::corps();
        $userModel = new User();
        $user = $userModel->parEmail($d['email'] ?? '');
        if (!$user || !$userModel->verifierMotDePasse($user, $d['motDePasse'] ?? '')) {
            Response::erreur('Email ou mot de passe incorrect.', 401);
        }
        Response::ok($this->avecToken($user));
    }

    /** GET /auth/me */
    public function me(array $params): void
    {
        $user = Auth::exiger();
        Response::ok(User::public($user));
    }

    /** POST /auth/mot-de-passe/oubli  { email } — génère un jeton de réinitialisation. */
    public function motDePasseOubli(array $params): void
    {
        $this->limiterAuth();
        $email = strtolower(trim((string) Request::champ('email')));
        // Réponse volontairement générique (ne révèle pas si le compte existe).
        $reponse = ['message' => "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé."];

        $user = $email ? (new User())->parEmail($email) : null;
        if ($user) {
            $token = bin2hex(random_bytes(24));
            $pdo = Database::connexion();
            $pdo->prepare("DELETE FROM resets WHERE email = ?")->execute([$email]);
            $pdo->prepare("INSERT INTO resets (email, token, expire_le) VALUES (?, ?, ?)")
                ->execute([$email, $token, date('c', time() + 3600)]);

            // Envoi de l'email de réinitialisation (mode 'log' en démo, SMTP réel
            // en production — voir config mail).
            $lien  = MailService::lienFront('#/reinitialiser?token=' . $token);
            $corps = '<p>Bonjour ' . htmlspecialchars($user['prenom']) . ',</p>'
                . '<p>Vous avez demandé la réinitialisation de votre mot de passe. Ce lien est valable 1 heure :</p>'
                . '<p><a href="' . htmlspecialchars($lien) . '" style="display:inline-block;background:#f97316;color:#fff;'
                . 'padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Réinitialiser mon mot de passe</a></p>'
                . '<p style="color:#64748b;font-size:13px;word-break:break-all">Ou copiez ce lien : ' . htmlspecialchars($lien) . '</p>';
            MailService::envoyer($email, 'Réinitialisation de votre mot de passe',
                MailService::gabarit('Réinitialisation du mot de passe', $corps));

            // DÉMO (mode 'log', pas de SMTP) : on renvoie le jeton pour permettre
            // le test sans boîte mail. EN PRODUCTION (SMTP) : le jeton n'est PAS
            // renvoyé — l'utilisateur suit le lien reçu par email.
            if (!MailService::estReel()) {
                $reponse['token'] = $token;
                $reponse['simulation'] = true;
            }
        }
        Response::ok($reponse);
    }

    /** POST /auth/mot-de-passe/reset  { token, motDePasse } */
    public function reinitialiser(array $params): void
    {
        $this->limiterAuth();
        $d = Request::corps();
        (new Validator($d))
            ->requis('token')
            ->min('motDePasse', 6, 'Mot de passe : 6 caractères minimum')
            ->ouEchouer();

        $pdo = Database::connexion();
        $stmt = $pdo->prepare("SELECT * FROM resets WHERE token = ? LIMIT 1");
        $stmt->execute([$d['token']]);
        $reset = $stmt->fetch();
        if (!$reset || strtotime($reset['expire_le']) < time()) {
            Response::erreur('Lien invalide ou expiré. Refaites une demande.', 422);
        }
        $pdo->prepare("UPDATE users SET mot_de_passe = ? WHERE email = ?")
            ->execute([password_hash($d['motDePasse'], PASSWORD_DEFAULT), $reset['email']]);
        $pdo->prepare("DELETE FROM resets WHERE email = ?")->execute([$reset['email']]);
        Response::ok(['message' => 'Mot de passe réinitialisé. Vous pouvez vous connecter.']);
    }

    /** GET /auth/oauth/:provider — renvoie l'URL d'autorisation du réseau. */
    public function oauthUrl(array $params): void
    {
        $reseau   = strtolower($params['provider'] ?? '');
        $provider = OAuthService::pour($reseau);
        if (!$provider) {
            Response::erreur('Connexion sociale non configurée pour ce réseau.', 400);
        }
        // « state » signé (JWT) = protection CSRF, sans stockage serveur.
        $state = Jwt::encoder(['oauth' => $reseau, 'nonce' => bin2hex(random_bytes(8))]);
        $url   = $provider->urlAutorisation($state, OAuthService::redirectUri($reseau));
        Response::ok(['url' => $url]);
    }

    /** GET /auth/oauth/:provider/callback — échange le code, connecte, redirige. */
    public function oauthCallback(array $params): void
    {
        $reseau   = strtolower($params['provider'] ?? '');
        $provider = OAuthService::pour($reseau);
        $code     = (string) Request::query('code');
        $state    = (string) Request::query('state');
        $front    = OAuthService::frontUrl();

        $redirige = function (string $suffixe) use ($front): void {
            header('Location: ' . $front . '/index.html' . $suffixe);
            exit;
        };

        if (!$provider || $code === '' || !Jwt::decoder($state)) {
            $redirige('#/connexion?oauth_erreur=1');
        }

        $profil = $provider->profil($code, OAuthService::redirectUri($reseau));
        if (!$profil || empty($profil['email'])) {
            $redirige('#/connexion?oauth_erreur=1');
        }

        // Trouver ou créer le compte (rôle client par défaut).
        $userModel = new User();
        $user = $userModel->parEmail($profil['email']);
        if (!$user) {
            $id = $userModel->creer([
                'role'      => 'client',
                'prenom'    => $profil['prenom'] ?: 'Utilisateur',
                'nom'       => $profil['nom'] ?: ucfirst($reseau),
                'email'     => $profil['email'],
                'telephone' => '',
                'motDePasse'=> bin2hex(random_bytes(16)), // aléatoire : le compte se connecte via le réseau
                'source'    => $reseau,
            ]);
            $user = $userModel->trouver($id);
        }

        $token = Jwt::encoder(['sub' => (int) $user['id'], 'role' => $user['role']]);
        $redirige('#/connexion?oauth=' . urlencode($token));
    }

    /* ------------------------------------------------------------------ */
    private function avecToken(array $user): array
    {
        $token = Jwt::encoder(['sub' => (int) $user['id'], 'role' => $user['role']]);
        return ['user' => User::public($user), 'token' => $token];
    }

    private function creerFicheCoach(int $userId, array $d): string
    {
        $pdo = Database::connexion();
        $coachId = 'coach_' . $userId;
        $stmt = $pdo->prepare(
            "INSERT INTO coachs (id, proprietaire, prenom, nom, titre, categorie, commune, ville,
                bio, note, nb_avis, nb_seances, anciennete_mois, taux_reponse, couleur, email, telephone)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Abidjan', '', 0, 0, 0, 0, 100, '#1b4dcc', ?, ?)"
        );
        $stmt->execute([
            $coachId, $userId, $d['prenom'], $d['nom'],
            $d['titre'] ?? 'Nouveau coach', $d['categorie'] ?? 'Bien-être',
            $d['commune'] ?? 'Cocody', $d['email'], $d['telephone'] ?? '',
        ]);
        // Spécialité principale éventuelle.
        if (!empty($d['specialite'])) {
            $pdo->prepare("INSERT INTO coach_specialites (coach_id, specialite) VALUES (?, ?)")
                ->execute([$coachId, $d['specialite']]);
        }
        $pdo->prepare("INSERT INTO coach_langues (coach_id, langue) VALUES (?, 'Français')")
            ->execute([$coachId]);

        return $coachId;
    }
}
