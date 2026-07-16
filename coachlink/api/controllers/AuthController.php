<?php
/* ==========================================================================
   controllers/AuthController.php — Inscription, connexion, profil courant.
   ========================================================================== */

class AuthController
{
    /** POST /auth/register */
    public function register(array $params): void
    {
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
