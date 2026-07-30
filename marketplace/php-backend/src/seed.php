<?php
declare(strict_types=1);

/**
 * Données d'amorçage — MÊME référentiel que le backend Node / le front
 * (shared/catalogue.js) : mêmes identifiants, boutiques et prix (effectifs).
 * Utilisé au premier démarrage si les tables sont vides.
 */

return [
    'stores' => [
        'sto_1' => 'Élégance Abidjan',
        'sto_2' => 'HighTech CI',
        'sto_3' => 'Saveurs du Terroir',
        'sto_4' => 'Maison & Confort',
    ],
    // [id, storeId, name, description, price(effectif FCFA), category, stock]
    'products' => [
        ['prd_1', 'sto_1', 'Robe pagne wax élégante', 'Robe cintrée en tissu wax authentique.', 18500, 'mode', 12],
        ['prd_2', 'sto_1', 'Ensemble bogolan homme', 'Ensemble traditionnel en bogolan.', 32000, 'mode', 8],
        ['prd_3', 'sto_1', 'Sac à main cuir artisanal', 'Sac à main en cuir véritable fait main.', 15000, 'accessoires', 20],
        ['prd_4', 'sto_1', 'Foulard en soie imprimé', 'Foulard léger aux motifs africains.', 4900, 'accessoires', 30],
        ['prd_5', 'sto_2', 'Smartphone Android 128 Go', 'Écran 6.5", 128 Go, double SIM, garantie 12 mois.', 119000, 'electronique', 15],
        ['prd_6', 'sto_2', 'Écouteurs Bluetooth sans fil', 'TWS avec boîtier de charge, autonomie 20h.', 12500, 'electronique', 40],
        ['prd_7', 'sto_2', 'Powerbank 20000 mAh', 'Batterie externe, charge rapide, double USB.', 14000, 'electronique', 25],
        ['prd_8', 'sto_2', 'Montre connectée sport', 'Fréquence cardiaque, notifications, étanche.', 28000, 'electronique', 0],
        ['prd_9', 'sto_2', 'Chargeur secteur rapide 25W', 'Chargeur mural USB-C charge rapide.', 5500, 'electronique', 18],
        ['prd_10', 'sto_3', 'Attiéké frais (1 kg)', 'Attiéké artisanal préparé du jour.', 1500, 'alimentation', 100],
        ['prd_11', 'sto_3', 'Huile rouge de palme (1 L)', 'Huile de palme rouge naturelle, pressée localement.', 2000, 'alimentation', 60],
        ['prd_12', 'sto_3', 'Panier épices & condiments', 'Assortiment de piments, gingembre, épices locales.', 8000, 'alimentation', 22],
        ['prd_13', 'sto_4', 'Service à thé 6 pièces', 'Théière + tasses en céramique décorée.', 9500, 'maison', 14],
        ['prd_14', 'sto_4', 'Ventilateur rechargeable', 'Ventilateur portable rechargeable, 3 vitesses.', 16500, 'maison', 10],
        ['prd_15', 'sto_4', 'Set de rangement cuisine', 'Boîtes de conservation hermétiques (lot de 5).', 7500, 'maison', 35],
        ['prd_16', 'sto_4', 'Tapis décoratif salon', 'Tapis moelleux motifs géométriques, 160x230 cm.', 17000, 'maison', 5],
    ],
    // [id, label, icon]
    'categories' => [
        ['mode', 'Mode & Vêtements', '👗'],
        ['electronique', 'Électronique', '📱'],
        ['maison', 'Maison & Déco', '🛋️'],
        ['beaute', 'Beauté & Soins', '💄'],
        ['alimentation', 'Alimentation', '🥘'],
        ['accessoires', 'Accessoires', '👜'],
        ['enfants', 'Enfants & Bébé', '🧸'],
        ['sport', 'Sport & Loisirs', '⚽'],
    ],
];
