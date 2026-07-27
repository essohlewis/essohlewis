<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Models\Referral;

/** Page « Inviter des amis » : lien de parrainage + statistiques (Phase 5). */
final class ReferralController extends Controller
{
    public function index(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $referral = new Referral();
        $code = $referral->codeFor($uid);
        $base = rtrim((string) Env::get('APP_URL', ''), '/');

        $this->view('referral/index', [
            'code' => $code,
            'link' => ($base !== '' ? $base : '') . '/register?ref=' . $code,
            'stats' => $referral->statsFor($uid),
            'referrer_reward' => Referral::REFERRER_REWARD,
            'referee_bonus' => Referral::REFEREE_BONUS,
        ]);
    }
}
