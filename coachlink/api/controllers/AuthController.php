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

        if ($email && (new User())->parEmail($email)) {
            $token = bin2hex(random_bytes(24));
            $pdo = Database::connexion();
            $pdo->prepare("DELETE FROM resets WHERE email = ?")->execute([$email]);
            $pdo->prepare("INSERT INTO resets (email, token, expire_le) VALUES (?, ?, ?)")
                ->execute([$email, $token, date('c', time() + 3600)]);
            // DÉMO : aucun service d'email n'est branché. On renvoie le jeton pour
            // permettre le test. EN PRODUCTION : envoyez-le par email et ne le
            // renvoyez PAS dans la réponse.
            $reponse['token'] = $token;
            $reponse['simulation'] = true;
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
