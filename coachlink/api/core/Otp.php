<?php
/* ==========================================================================
   core/Otp.php — Code de présence rotatif (type TOTP), fenêtre de 30 secondes.
   Dérive un code à 6 chiffres depuis le jeton secret d'une réservation et la
   fenêtre temporelle courante. La dérivation (FNV-1a 32 bits + avalanche) est
   STRICTEMENT identique à js/utils/otp.js : le code affiché côté client et le
   code validé côté serveur concordent. Un code capturé expire après ~30 s.
   ========================================================================== */

class Otp
{
    public const PERIODE = 30; // secondes

    /** Multiplication 32 bits non signée, équivalente à Math.imul de JavaScript. */
    private static function imul(int $a, int $b): int
    {
        $a &= 0xFFFFFFFF; $b &= 0xFFFFFFFF;
        $ah = ($a >> 16) & 0xFFFF; $al = $a & 0xFFFF;
        $bh = ($b >> 16) & 0xFFFF; $bl = $b & 0xFFFF;
        return (($al * $bl) + (((($ah * $bl) + ($al * $bh)) & 0xFFFF) << 16)) & 0xFFFFFFFF;
    }

    /** Hachage déterministe 32 bits (FNV-1a + avalanche). Identique à otp.js. */
    private static function hash(string $str): int
    {
        $h = 0x811c9dc5;
        $len = strlen($str);
        for ($i = 0; $i < $len; $i++) {
            $h = ($h ^ ord($str[$i])) & 0xFFFFFFFF;
            $h = self::imul($h, 0x01000193);
        }
        $h = ($h ^ ($h >> 15)) & 0xFFFFFFFF; $h = self::imul($h, 0x2c1b3c6d);
        $h = ($h ^ ($h >> 13)) & 0xFFFFFFFF; $h = self::imul($h, 0x297a2d39);
        $h = ($h ^ ($h >> 16)) & 0xFFFFFFFF;
        return $h & 0xFFFFFFFF;
    }

    public static function fenetre(?int $t = null): int
    {
        $t = $t ?? time();
        return intdiv($t, self::PERIODE);
    }

    /** Code à 6 chiffres pour un secret et une fenêtre donnés. */
    public static function code(string $secret, int $fenetre): string
    {
        return str_pad((string) (self::hash($secret . '|' . $fenetre) % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /** Valide un code saisi/scané en tolérant la fenêtre courante ± $tol (défaut 1). */
    public static function valide(string $secret, string $saisi, ?int $t = null, int $tol = 1): bool
    {
        $saisi = trim($saisi);
        if (preg_match('/(\d{6})$/', $saisi, $m)) {
            $saisi = $m[1]; // accepte le code brut ou le payload complet CLQR-<fenetre>-<code>
        }
        if (!preg_match('/^\d{6}$/', $saisi)) {
            return false;
        }
        $f = self::fenetre($t);
        for ($d = -$tol; $d <= $tol; $d++) {
            if (hash_equals(self::code($secret, $f + $d), $saisi)) {
                return true;
            }
        }
        return false;
    }
}
