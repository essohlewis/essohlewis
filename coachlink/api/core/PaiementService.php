<?php
/* ==========================================================================
   core/PaiementService.php — Sélectionne la passerelle de paiement adaptée à
   l'opérateur et à la configuration.

   Par défaut (mode 'simulateur' ou opérateur non activé), on renvoie le
   PaiementSimulateur : l'application fonctionne sans aucun identifiant réel.
   En mode 'reel' avec un opérateur activé et configuré, on renvoie sa
   passerelle réelle (Orange Money, Wave…).
   ========================================================================== */

class PaiementService
{
    public static function pour(string $operateur): PaiementGateway
    {
        $cfg  = App::config('paiement', []);
        $mode = $cfg['mode'] ?? 'simulateur';
        $op   = strtolower(trim($operateur));
        $opCfg = $cfg[$op] ?? [];

        if ($mode === 'reel' && !empty($opCfg['actif'])) {
            switch ($op) {
                case 'orange':
                    return new PaiementOrangeMoney($opCfg);
                case 'wave':
                    return new PaiementWave($opCfg);
                case 'mtn':
                    return new PaiementMtn($opCfg);
                case 'moov':
                    return new PaiementMoov($opCfg);
            }
        }
        return new PaiementSimulateur();
    }

    /** Indique si un opérateur est réellement branché (utile pour l'UI/diagnostic). */
    public static function estReel(string $operateur): bool
    {
        $cfg = App::config('paiement', []);
        $op  = strtolower(trim($operateur));
        return ($cfg['mode'] ?? 'simulateur') === 'reel' && !empty($cfg[$op]['actif']);
    }
}
