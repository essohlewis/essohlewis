<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Helpers\Sanitize;
use App\Models\ChildProfile;

final class ProfileController extends Controller
{
    private const MAX_PROFILES = 4;

    public function __construct(private ChildProfile $profiles = new ChildProfile())
    {
    }

    /** GET /api/v1/profiles (auth) */
    public function index(Request $request): void
    {
        $rows = $this->profiles->forUser($this->userId());
        Response::ok(['profiles' => array_map([$this, 'present'], $rows)]);
    }

    /** POST /api/v1/profiles (auth) */
    public function store(Request $request): void
    {
        if ($this->profiles->countForUser($this->userId()) >= self::MAX_PROFILES) {
            Response::error('Limite de 4 profils atteinte.', 409);
            return;
        }

        $v = new Validator($request->all(), [
            'first_name'  => 'required|string|min:1|max:50',
            'birth_year'  => 'required|int|between:2010,2025',
            'birth_month' => 'required|int|between:1,12',
            'avatar_key'  => 'string|max:50',
            'narration_lang' => 'string|max:10',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $year  = (int) $request->input('birth_year');
        $month = (int) $request->input('birth_month');
        $level = ChildProfile::levelForAge($year, $month);

        $id = $this->profiles->insert([
            'user_id'        => $this->userId(),
            'first_name'     => Sanitize::text($request->input('first_name'), 50),
            'birth_year'     => $year,
            'birth_month'    => $month,
            'avatar_key'     => Sanitize::text($request->input('avatar_key', 'avatar_01'), 50),
            'reading_level'  => $level,
            'narration_lang' => Sanitize::text($request->input('narration_lang', 'fr'), 10),
        ]);

        Response::ok(['profile' => $this->present($this->profiles->find($id) ?? [])], 201);
    }

    /** PATCH /api/v1/profiles/{id} (auth) */
    public function update(Request $request): void
    {
        $childId = (int) $request->param('id');
        $profile = $this->profiles->findOwned($childId, $this->userId());
        if ($profile === null) {
            Response::error('Profil introuvable.', 404); // protection IDOR
            return;
        }

        $v = new Validator($request->all(), [
            'first_name'          => 'string|min:1|max:50',
            'birth_year'          => 'int|between:2010,2025',
            'birth_month'         => 'int|between:1,12',
            'avatar_key'          => 'string|max:50',
            'narration_lang'      => 'string|max:10',
            'reading_level'       => 'in:N1,N2,N3',
            'level_locked'        => 'bool',
            'daily_limit_minutes' => 'int|between:5,120',
        ]);
        if ($v->fails()) {
            Response::error('Données invalides.', 422, $v->errors());
            return;
        }

        $data = [];
        foreach (['first_name', 'avatar_key', 'narration_lang'] as $f) {
            if ($request->input($f) !== null) {
                $data[$f] = Sanitize::text($request->input($f), 50);
            }
        }
        foreach (['birth_year', 'birth_month', 'daily_limit_minutes'] as $f) {
            if ($request->input($f) !== null) {
                $data[$f] = (int) $request->input($f);
            }
        }

        // Niveau : soit forcé manuellement, soit recalculé si l'âge change.
        if ($request->input('reading_level') !== null) {
            $data['reading_level'] = (string) $request->input('reading_level');
            $data['level_locked']  = 1;
        } elseif (isset($data['birth_year']) || isset($data['birth_month'])) {
            if ((int) $profile['level_locked'] === 0) {
                $data['reading_level'] = ChildProfile::levelForAge(
                    $data['birth_year'] ?? (int) $profile['birth_year'],
                    $data['birth_month'] ?? (int) $profile['birth_month']
                );
            }
        }
        if ($request->input('level_locked') !== null) {
            $data['level_locked'] = (int) (bool) $request->input('level_locked');
        }

        $this->profiles->update($childId, $data);
        Response::ok(['profile' => $this->present($this->profiles->find($childId) ?? [])]);
    }

    /** DELETE /api/v1/profiles/{id} (auth) */
    public function destroy(Request $request): void
    {
        $childId = (int) $request->param('id');
        $profile = $this->profiles->findOwned($childId, $this->userId());
        if ($profile === null) {
            Response::error('Profil introuvable.', 404);
            return;
        }
        $this->profiles->delete($childId);
        Response::ok(['deleted' => true]);
    }

    /** @param array<string,mixed> $p */
    private function present(array $p): array
    {
        return [
            'id'                  => (int) ($p['id'] ?? 0),
            'first_name'          => $p['first_name'] ?? '',
            'birth_year'          => (int) ($p['birth_year'] ?? 0),
            'birth_month'         => (int) ($p['birth_month'] ?? 0),
            'avatar_key'          => $p['avatar_key'] ?? 'avatar_01',
            'reading_level'       => $p['reading_level'] ?? 'N2',
            'level_locked'        => (bool) ($p['level_locked'] ?? false),
            'narration_lang'      => $p['narration_lang'] ?? 'fr',
            'daily_limit_minutes' => (int) ($p['daily_limit_minutes'] ?? 30),
        ];
    }
}
