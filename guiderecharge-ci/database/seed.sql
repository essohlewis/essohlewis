-- =====================================================================
-- GuideRecharge CI — Données initiales (seed)
-- Marché : Côte d'Ivoire · FCFA (XOF) · Préfixes 07 (Orange), 05 (MTN), 01 (Moov)
--
-- NB : les codes USSD ci-dessous sont réalistes et représentatifs mais
-- restent entièrement administrables depuis le back-office. Vérifiez-les
-- auprès des opérateurs avant mise en production.
-- =====================================================================

USE `guiderecharge_ci`;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `ussd_generations`;
TRUNCATE TABLE `admin_logs`;
TRUNCATE TABLE `codes_ussd`;
TRUNCATE TABLE `forfaits`;
TRUNCATE TABLE `guides`;
TRUNCATE TABLE `categories_forfait`;
TRUNCATE TABLE `operateurs`;
TRUNCATE TABLE `admin_users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Opérateurs
-- ---------------------------------------------------------------------
INSERT INTO `operateurs` (`id`, `nom`, `slug`, `couleur_hex`, `logo`, `prefixes`, `ussd_base`, `actif`) VALUES
(1, 'Orange', 'orange', '#FF6600', 'img/orange.svg', '07', '#144#', 1),
(2, 'MTN',    'mtn',    '#FFCC00', 'img/mtn.svg',    '05', '*105#', 1),
(3, 'Moov',   'moov',   '#0066CC', 'img/moov.svg',   '01', '*155#', 1);

-- ---------------------------------------------------------------------
-- Catégories de forfait
-- ---------------------------------------------------------------------
INSERT INTO `categories_forfait` (`id`, `nom`, `slug`, `icone`, `ordre`) VALUES
(1, 'Internet',            'internet', '🌐', 1),
(2, 'Appels',              'appels',   '📞', 2),
(3, 'SMS',                 'sms',      '✉️', 3),
(4, 'Pass réseaux sociaux','pass-reseaux', '💬', 4),
(5, 'Mixte',               'mixte',    '🎁', 5);

-- ---------------------------------------------------------------------
-- Codes USSD génériques
-- Placeholders : {numero}, {montant}, {code}
-- ---------------------------------------------------------------------
INSERT INTO `codes_ussd` (`operateur_id`, `action`, `libelle`, `pattern`, `description`) VALUES
-- Orange
(1, 'achat_credit',     'Acheter du crédit',        '*144*2*{numero}*{montant}#', 'Recharge un numéro Orange du montant indiqué.'),
(1, 'transfert_credit', 'Transfert de crédit',      '#144*{numero}*{montant}#',   'Transfère du crédit vers un autre numéro Orange.'),
(1, 'solde',            'Consulter le solde',       '#144#',                       'Affiche votre solde crédit Orange.'),
(1, 'activation',       'Menu forfaits',            '#123#',                       'Ouvre le menu des forfaits et pass Orange.'),
(1, 'mobile_money',     'Orange Money',             '#144#391#',                   'Accès au menu Orange Money.'),
-- MTN
(2, 'achat_credit',     'Acheter du crédit',        '*105*{montant}*{numero}#',   'Recharge un numéro MTN du montant indiqué.'),
(2, 'transfert_credit', 'Transfert de crédit (Me2U)', '*106*{numero}*{montant}#', 'Transfère du crédit vers un autre numéro MTN.'),
(2, 'solde',            'Consulter le solde',       '*105#',                       'Affiche votre solde crédit MTN.'),
(2, 'activation',       'Menu forfaits',            '*104#',                       'Ouvre le menu des forfaits et pass MTN.'),
(2, 'mobile_money',     'MTN MoMo',                 '*133*1*{numero}*{montant}#',  'Envoi d''argent MTN Mobile Money.'),
-- Moov
(3, 'achat_credit',     'Acheter du crédit',        '*155*1*1*{numero}*{montant}#', 'Recharge un numéro Moov du montant indiqué.'),
(3, 'transfert_credit', 'Transfert de crédit',      '*155*2*{numero}*{montant}#',  'Transfère du crédit vers un autre numéro Moov.'),
(3, 'solde',            'Consulter le solde',       '*155#',                       'Affiche votre solde crédit Moov.'),
(3, 'activation',       'Menu forfaits',            '*123#',                       'Ouvre le menu des forfaits et pass Moov.'),
(3, 'mobile_money',     'Moov Money',               '*155*2*1*{numero}*{montant}#', 'Envoi d''argent Moov Money.');

-- ---------------------------------------------------------------------
-- Forfaits (~17)
-- ---------------------------------------------------------------------
INSERT INTO `forfaits`
(`operateur_id`, `categorie_id`, `nom`, `description`, `prix`, `volume_data`, `minutes_appel`, `sms`, `validite`, `code_ussd`, `populaire`, `actif`) VALUES
-- Orange
(1, 1, 'Pass Internet 150 Mo', 'Idéal pour un dépannage rapide dans la journée.', 200, '150 Mo', '', '', '24 heures', '#123*1*1#', 0, 1),
(1, 1, 'Pass Internet 1 Go',   'Naviguez toute la semaine avec 1 Go de data.',   1000, '1 Go', '', '', '7 jours', '#123*1*2#', 1, 1),
(1, 1, 'Pass Internet 5 Go',   'Le pass polyvalent du mois pour les gros usages.', 3000, '5 Go', '', '', '30 jours', '#123*1*3#', 1, 1),
(1, 1, 'Pass Nuit 3 Go',       'Data illimitée façon nuit blanche : 3 Go de minuit à 6h.', 500, '3 Go', '', '', '1 nuit', '#123*1*9#', 0, 1),
(1, 2, 'Pass Appels 30 min',   '30 minutes d''appels vers tous réseaux nationaux.', 500, '', '30 min', '', '3 jours', '#123*2*1#', 0, 1),
(1, 4, 'Pass Réseaux 1 Go',    'WhatsApp, Facebook, Instagram : 1 Go dédié aux réseaux sociaux.', 500, '1 Go', '', '', '7 jours', '#123*4*1#', 1, 1),
(1, 5, 'Pass Mixte Confort',   'Data + appels + SMS pour un usage complet au quotidien.', 2000, '2 Go', '60 min', '60 SMS', '30 jours', '#123*5*1#', 0, 1),

-- MTN
(2, 1, 'Y''ello Data 200 Mo',  'Petit pass data pour rester connecté.', 200, '200 Mo', '', '', '24 heures', '*104*1*1#', 0, 1),
(2, 1, 'Y''ello Data 2 Go',    'Le meilleur rapport data du moment chez MTN.', 1500, '2 Go', '', '', '30 jours', '*104*1*2#', 1, 1),
(2, 1, 'Y''ello Nuit 5 Go',    '5 Go à consommer la nuit, parfait pour les téléchargements.', 700, '5 Go', '', '', '1 nuit', '*104*1*9#', 0, 1),
(2, 2, 'MTN Appels 60 min',    '60 minutes d''appels vers tous les réseaux.', 1000, '', '60 min', '', '7 jours', '*104*2*1#', 0, 1),
(2, 4, 'Pass WhatsApp 500 Mo', 'WhatsApp en illimité relatif avec 500 Mo dédiés.', 300, '500 Mo', '', '', '7 jours', '*104*4*1#', 0, 1),
(2, 5, 'MTN Mixte Malin',      'Combo data, minutes et SMS pour toute la famille.', 2500, '3 Go', '90 min', '100 SMS', '30 jours', '*104*5*1#', 1, 1),

-- Moov
(3, 1, 'Moov Internet 500 Mo', 'Un demi-Go pour vos usages essentiels.', 500, '500 Mo', '', '', '7 jours', '*123*1*1#', 0, 1),
(3, 1, 'Moov Internet 3 Go',   'Le pass data mensuel préféré des abonnés Moov.', 2000, '3 Go', '', '', '30 jours', '*123*1*2#', 1, 1),
(3, 2, 'Moov Appels Week-end', 'Appels illimités vers Moov tout le week-end.', 1000, '', 'Illimité Moov', '', 'Week-end', '*123*2*1#', 0, 1),
(3, 4, 'Moov Pass Social 1 Go','1 Go réservé aux réseaux sociaux et à la messagerie.', 600, '1 Go', '', '', '7 jours', '*123*4*1#', 0, 1),
(3, 5, 'Moov Mixte Family',    'Grand combo familial : data généreuse, appels et SMS.', 3000, '5 Go', '120 min', '150 SMS', '30 jours', '*123*5*1#', 1, 1);

-- ---------------------------------------------------------------------
-- Guides (5)
-- ---------------------------------------------------------------------
INSERT INTO `guides` (`titre`, `slug`, `contenu`, `categorie`, `operateur_id`, `image`, `actif`) VALUES
(
    'Comment transférer du crédit entre abonnés',
    'transferer-du-credit',
    '<p>Le transfert de crédit permet de dépanner un proche en quelques secondes. La procédure diffère légèrement selon l''opérateur.</p><h2>Orange</h2><ol><li>Composez <code>#144*numéro*montant#</code></li><li>Confirmez avec votre code secret si demandé.</li><li>Vous et le destinataire recevez un SMS de confirmation.</li></ol><h2>MTN (Me2U)</h2><ol><li>Composez <code>*106*numéro*montant#</code></li><li>Validez la demande.</li></ol><h2>Moov</h2><ol><li>Composez <code>*155*2*numéro*montant#</code></li><li>Suivez les instructions à l''écran.</li></ol><p>💡 Astuce : utilisez notre <a href="/generateur">générateur de code</a> pour obtenir le code exact prêt à composer.</p>',
    'Transfert', NULL, '', 1
),
(
    'Activer un forfait internet pas à pas',
    'activer-un-forfait-internet',
    '<p>Activer un pass internet est simple. Assurez-vous d''avoir suffisamment de crédit avant de commencer.</p><h2>Étapes générales</h2><ol><li>Ouvrez le menu forfaits de votre opérateur : Orange <code>#123#</code>, MTN <code>*104#</code>, Moov <code>*123#</code>.</li><li>Choisissez la catégorie « Internet ».</li><li>Sélectionnez le pass correspondant à votre budget.</li><li>Confirmez : le forfait s''active immédiatement.</li></ol><p>Vérifiez votre solde data après activation en composant le code de consultation de votre opérateur.</p>',
    'Activation', NULL, '', 1
),
(
    'Envoyer de l''argent par Mobile Money',
    'envoyer-argent-mobile-money',
    '<p>Le Mobile Money (Orange Money, MTN MoMo, Moov Money) permet d''envoyer de l''argent en toute sécurité.</p><h2>Avant de commencer</h2><ul><li>Votre compte doit être activé et approvisionné.</li><li>Munissez-vous du numéro du destinataire et de votre code secret.</li></ul><h2>Procédure</h2><ol><li>Composez le code de votre service : Orange Money <code>#144#391#</code>, MTN MoMo <code>*133#</code>, Moov Money <code>*155#</code>.</li><li>Choisissez « Transfert d''argent ».</li><li>Saisissez le numéro et le montant.</li><li>Confirmez avec votre code secret.</li></ol><p>⚠️ Ne communiquez jamais votre code secret à un tiers.</p>',
    'Mobile Money', NULL, '', 1
),
(
    'Réclamation : que faire en cas de problème',
    'faire-une-reclamation',
    '<p>Un forfait non crédité, un prélèvement inattendu ? Voici comment réclamer efficacement.</p><h2>1. Rassemblez les informations</h2><ul><li>Date et heure de l''opération.</li><li>Montant et code composé.</li><li>Message reçu (le cas échéant).</li></ul><h2>2. Contactez le service client</h2><ul><li>Orange : appelez le <strong>07 07</strong> (gratuit depuis une ligne Orange).</li><li>MTN : appelez le <strong>101</strong> ou le <strong>05 00 00 01 01</strong>.</li><li>Moov : appelez le <strong>101</strong> ou le <strong>01 01 01 01 01</strong>.</li></ul><h2>3. Gardez une trace</h2><p>Notez le numéro de ticket de réclamation communiqué par le conseiller.</p>',
    'Réclamation', NULL, '', 1
),
(
    'Numéros utiles et services clients',
    'numeros-utiles',
    '<p>Retrouvez les principaux numéros à connaître en Côte d''Ivoire.</p><h2>Services clients</h2><ul><li><strong>Orange :</strong> 07 07 (service client), #144# (solde).</li><li><strong>MTN :</strong> 101 (service client), *105# (solde).</li><li><strong>Moov :</strong> 101 (service client), *155# (solde).</li></ul><h2>Numéros d''urgence</h2><ul><li>Police secours : <strong>110 / 111</strong></li><li>Pompiers (GSPM) : <strong>180</strong></li><li>SAMU : <strong>185</strong></li></ul><p>Enregistrez ces numéros dans votre téléphone pour les avoir toujours sous la main.</p>',
    'Infos pratiques', NULL, '', 1
);

-- ---------------------------------------------------------------------
-- Compte administrateur par défaut
-- Email    : admin@guiderecharge.ci
-- Mot de passe : Admin@2025  (à changer immédiatement en production)
-- Hash Argon2id ci-dessous.
-- ---------------------------------------------------------------------
INSERT INTO `admin_users` (`nom`, `email`, `password_hash`, `role`) VALUES
('Administrateur', 'admin@guiderecharge.ci',
 '$argon2id$v=19$m=65536,t=4,p=1$R3p3bjRCUzR5QkdwZkdYTA$GV8zbXum2NizwzEQjWwzpDhpKtW+Q5N68TaypcFRbTc',
 'admin');
