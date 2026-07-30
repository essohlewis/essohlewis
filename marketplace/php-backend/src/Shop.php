<?php
declare(strict_types=1);

/** Shop — logique métier (catalogue, recherche, facettes, panier, commandes, avis). */
final class Shop
{
    private const PRICE_BUCKETS = [
        ['id' => '0-5000', 'label' => 'Moins de 5 000 FCFA', 'min' => 0, 'max' => 5000],
        ['id' => '5000-15000', 'label' => '5 000 – 15 000 FCFA', 'min' => 5000, 'max' => 15000],
        ['id' => '15000-30000', 'label' => '15 000 – 30 000 FCFA', 'min' => 15000, 'max' => 30000],
        ['id' => '30000-100000', 'label' => '30 000 – 100 000 FCFA', 'min' => 30000, 'max' => 100000],
        ['id' => '100000+', 'label' => 'Plus de 100 000 FCFA', 'min' => 100000, 'max' => PHP_INT_MAX],
    ];

    /** Amorçage des produits et catégories si les tables sont vides. */
    public static function seedIfEmpty(): void
    {
        $pdo  = Db::pdo();
        $seed = require __DIR__ . '/seed.php';
        $now  = Auth::now();

        if ((int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0) {
            $ins = $pdo->prepare('INSERT INTO products (id,storeId,storeName,name,description,price,currency,category,image,stock,active,createdAt)
                VALUES (?,?,?,?,?,?,?,?,?,?,1,?)');
            foreach ($seed['products'] as $p) {
                [$id, $storeId, $name, $desc, $price, $cat, $stock] = $p;
                $ins->execute([$id, $storeId, $seed['stores'][$storeId] ?? '', $name, $desc, $price, 'FCFA', $cat, '/assets/placeholder.svg', $stock, $now]);
            }
        }
        if ((int) $pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn() === 0) {
            $ins = $pdo->prepare('INSERT INTO categories (id,label,icon,parentId,sortOrder,active,createdAt) VALUES (?,?,?,NULL,?,1,?)');
            foreach ($seed['categories'] as $i => $c) {
                $ins->execute([$c[0], $c[1], $c[2], $i, $now]);
            }
        }
    }

    public static function countProducts(): int
    {
        return (int) Db::pdo()->query('SELECT COUNT(*) FROM products')->fetchColumn();
    }

    /** Catalogue filtré (actifs), avec recherche LIKE simple + catégorie/boutique. */
    public static function listProducts(?string $category = null, ?string $q = null, ?string $storeId = null, int $limit = 1000): array
    {
        $sql = 'SELECT * FROM products WHERE active=1';
        $args = [];
        if ($category) { $sql .= ' AND category=?'; $args[] = $category; }
        if ($storeId) { $sql .= ' AND storeId=?'; $args[] = $storeId; }
        if ($q) { $sql .= ' AND (name LIKE ? OR description LIKE ?)'; $args[] = "%$q%"; $args[] = "%$q%"; }
        $sql .= ' ORDER BY createdAt DESC LIMIT ' . (int) $limit;
        $st = Db::pdo()->prepare($sql);
        $st->execute($args);
        return array_map([self::class, 'decorateProduct'], $st->fetchAll());
    }

    public static function getProduct(string $id): ?array
    {
        $st = Db::pdo()->prepare('SELECT * FROM products WHERE id=?');
        $st->execute([$id]);
        $p = $st->fetch();
        return $p ? self::decorateProduct($p) : null;
    }

    private static function decorateProduct(array $p): array
    {
        $p['price']  = (int) $p['price'];
        $p['stock']  = (int) $p['stock'];
        $p['active'] = (int) $p['active'];
        $p['createdAt'] = (int) $p['createdAt'];
        return $p;
    }

    /* --------- Recherche plein texte (accents + tolérance aux fautes) --------- */
    private static function fold(string $s): string
    {
        $s = mb_strtolower($s, 'UTF-8');
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        return $t !== false ? strtolower($t) : $s;
    }

    private static function tokenize(string $s): array
    {
        return array_values(array_filter(preg_split('/[^a-z0-9]+/', self::fold($s)) ?: [], fn ($t) => strlen($t) >= 2));
    }

    public static function search(string $q, ?string $category = null, ?string $storeId = null, int $limit = 50): array
    {
        $terms = self::tokenize($q);
        $rows  = self::listProducts($category, null, $storeId, 500);
        if ($terms === []) {
            return array_slice($rows, 0, $limit);
        }
        $fields = [['name', 6], ['category', 3], ['storeName', 2], ['description', 1]];
        $scored = [];
        foreach ($rows as $p) {
            $score = 0.0; $matched = 0;
            foreach ($terms as $term) {
                $best = 0.0;
                foreach ($fields as [$field, $weight]) {
                    $hay = self::fold((string) ($p[$field] ?? ''));
                    if ($hay !== '' && str_contains($hay, $term)) {
                        $best = max($best, $weight * ($hay === $term ? 3 : (str_starts_with($hay, $term) ? 2 : 1.5)));
                        continue;
                    }
                    $maxDist = strlen($term) <= 4 ? 1 : 2;
                    foreach (self::tokenize((string) ($p[$field] ?? '')) as $w) {
                        $d = levenshtein($term, $w);
                        if ($d <= $maxDist) {
                            $best = max($best, $weight * (1 - $d / ($maxDist + 1)));
                        }
                    }
                }
                if ($best > 0) { $score += $best; $matched++; }
            }
            if ($score > 0) {
                if ($matched === count($terms)) { $score += 5; }
                $p['_score'] = round($score, 2);
                $scored[] = $p;
            }
        }
        usort($scored, fn ($a, $b) => ($b['_score'] <=> $a['_score']) ?: ($b['createdAt'] <=> $a['createdAt']));
        return array_slice($scored, 0, $limit);
    }

    /* ------------------------------ Facettes -------------------------------- */
    public static function facets(?string $q = null, ?string $storeId = null): array
    {
        $base = $q ? self::search($q, null, $storeId, 500) : self::listProducts(null, null, $storeId, 500);
        $byCat = []; $byBucket = []; $byStore = []; $min = PHP_INT_MAX; $max = 0;
        foreach ($base as $p) {
            $byCat[$p['category']] = ($byCat[$p['category']] ?? 0) + 1;
            if ($p['storeId']) {
                $byStore[$p['storeId']] ??= ['name' => $p['storeName'], 'count' => 0];
                $byStore[$p['storeId']]['count']++;
            }
            $price = (int) $p['price'];
            $min = min($min, $price); $max = max($max, $price);
            foreach (self::PRICE_BUCKETS as $b) {
                if ($price >= $b['min'] && $price < $b['max']) { $byBucket[$b['id']] = ($byBucket[$b['id']] ?? 0) + 1; break; }
            }
        }
        $categories = [];
        foreach ($byCat as $v => $c) { $categories[] = ['value' => $v, 'count' => $c]; }
        usort($categories, fn ($a, $b) => $b['count'] <=> $a['count']);
        $stores = [];
        foreach ($byStore as $id => $s) { $stores[] = ['id' => $id, 'name' => $s['name'], 'count' => $s['count']]; }
        usort($stores, fn ($a, $b) => $b['count'] <=> $a['count']);
        $ranges = [];
        foreach (self::PRICE_BUCKETS as $b) {
            if (!empty($byBucket[$b['id']])) {
                $ranges[] = ['id' => $b['id'], 'label' => $b['label'], 'min' => $b['min'], 'max' => $b['max'] === PHP_INT_MAX ? null : $b['max'], 'count' => $byBucket[$b['id']]];
            }
        }
        return ['total' => count($base), 'categories' => $categories, 'stores' => $stores, 'priceRanges' => $ranges, 'priceMin' => $base ? $min : 0, 'priceMax' => $max];
    }

    /* ------------------------------ Catégories ------------------------------ */
    public static function categories(bool $activeOnly = true): array
    {
        $sql = 'SELECT * FROM categories' . ($activeOnly ? ' WHERE active=1' : '') . ' ORDER BY sortOrder ASC, label ASC';
        return Db::pdo()->query($sql)->fetchAll();
    }

    public static function categoryTree(): array
    {
        $all = self::categories();
        $byId = []; foreach ($all as $c) { $c['children'] = []; $byId[$c['id']] = $c; }
        $roots = [];
        foreach ($all as $c) {
            if ($c['parentId'] && isset($byId[$c['parentId']])) {
                $byId[$c['parentId']]['children'][] = &$byId[$c['id']];
            } else {
                $roots[] = &$byId[$c['id']];
            }
        }
        return array_values(array_map(fn ($id) => $byId[$id], array_keys(array_filter($byId, fn ($c) => !$c['parentId'] || !isset($byId[$c['parentId']])))));
    }

    /* -------------------------------- Panier -------------------------------- */
    public static function getCart(string $userId): array
    {
        $st = Db::pdo()->prepare('SELECT items FROM carts WHERE userId=?');
        $st->execute([$userId]);
        $r = $st->fetch();
        return $r ? (json_decode((string) $r['items'], true) ?: []) : [];
    }

    public static function setCart(string $userId, array $items): void
    {
        $pdo = Db::pdo();
        $pdo->prepare('INSERT INTO carts (userId,items,updatedAt) VALUES (?,?,?)
            ON CONFLICT(userId) DO UPDATE SET items=excluded.items, updatedAt=excluded.updatedAt')
            ->execute([$userId, json_encode(array_values($items), JSON_UNESCAPED_UNICODE), Auth::now()]);
    }

    /* ------------------------------- Commandes ------------------------------ */
    public static function createOrder(?string $userId, array $payload): array
    {
        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
        if ($items === []) {
            return ['error' => 'Panier vide.'];
        }
        $itemsTotal = 0; $resolved = [];
        foreach ($items as $it) {
            $prod = !empty($it['productId']) ? self::getProduct((string) $it['productId']) : null;
            $price = $prod ? (int) $prod['price'] : max(0, (int) ($it['price'] ?? 0));
            $qty   = max(1, (int) ($it['qty'] ?? 1));
            $itemsTotal += $price * $qty;
            $resolved[] = [
                'productId' => $it['productId'] ?? '', 'name' => $prod['name'] ?? ($it['name'] ?? 'Article'),
                'price' => $price, 'qty' => $qty, 'variant' => (string) ($it['variant'] ?? ''),
                'storeId' => $prod['storeId'] ?? ($it['storeId'] ?? ''), 'storeName' => $prod['storeName'] ?? ($it['storeName'] ?? ''),
            ];
        }
        $deliveryFee = max(0, (int) ($payload['deliveryFee'] ?? 0));
        $discount    = max(0, (int) ($payload['discount'] ?? 0));
        $total = max(0, $itemsTotal - $discount) + $deliveryFee;
        $now = Auth::now();
        $o = [
            'id' => 'cmd_' . bin2hex(random_bytes(7)), 'userId' => $userId,
            'customerName' => (string) ($payload['customerName'] ?? ''), 'phone' => (string) ($payload['phone'] ?? ''),
            'address' => (string) ($payload['address'] ?? ''), 'city' => (string) ($payload['city'] ?? ''),
            'itemsTotal' => $itemsTotal, 'deliveryFee' => $deliveryFee, 'discount' => $discount, 'total' => $total,
            'currency' => 'FCFA', 'paymentMethod' => (string) ($payload['paymentMethod'] ?? 'cod'),
            'status' => 'pending', 'note' => (string) ($payload['note'] ?? ''), 'createdAt' => $now, 'updatedAt' => $now,
        ];
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO orders (id,userId,customerName,phone,address,city,itemsTotal,deliveryFee,discount,total,currency,paymentMethod,status,note,createdAt,updatedAt)
                VALUES (:id,:userId,:customerName,:phone,:address,:city,:itemsTotal,:deliveryFee,:discount,:total,:currency,:paymentMethod,:status,:note,:createdAt,:updatedAt)')->execute($o);
            $insItem = $pdo->prepare('INSERT INTO order_items (orderId,productId,name,price,qty,variant,storeId,storeName) VALUES (?,?,?,?,?,?,?,?)');
            $dec = $pdo->prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id=? AND stock > 0');
            foreach ($resolved as $r) {
                $insItem->execute([$o['id'], $r['productId'], $r['name'], $r['price'], $r['qty'], $r['variant'], $r['storeId'], $r['storeName']]);
                if ($r['productId']) { $dec->execute([$r['qty'], $r['productId']]); }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            return ['error' => "Échec de l'enregistrement de la commande."];
        }
        if ($userId) { self::setCart($userId, []); }
        return ['order' => self::getOrder($o['id'])];
    }

    public static function getOrder(string $id): ?array
    {
        $pdo = Db::pdo();
        $st = $pdo->prepare('SELECT * FROM orders WHERE id=?');
        $st->execute([$id]);
        $o = $st->fetch();
        if (!$o) { return null; }
        $it = $pdo->prepare('SELECT productId,name,price,qty,variant,storeName FROM order_items WHERE orderId=?');
        $it->execute([$id]);
        $o['items'] = $it->fetchAll();
        foreach (['itemsTotal','deliveryFee','discount','total','createdAt','updatedAt'] as $k) { $o[$k] = (int) $o[$k]; }
        return $o;
    }

    public static function listOrders(?string $userId = null, ?string $status = null): array
    {
        $sql = 'SELECT * FROM orders WHERE 1=1'; $args = [];
        if ($userId) { $sql .= ' AND userId=?'; $args[] = $userId; }
        if ($status && $status !== 'all') { $sql .= ' AND status=?'; $args[] = $status; }
        $sql .= ' ORDER BY createdAt DESC LIMIT 500';
        $st = Db::pdo()->prepare($sql); $st->execute($args);
        return array_map(fn ($o) => self::getOrder($o['id']), $st->fetchAll());
    }

    public static function setOrderStatus(string $id, string $status): ?array
    {
        $valid = ['pending','confirmed','shipped','delivered','cancelled'];
        if (!in_array($status, $valid, true)) { return null; }
        $pdo = Db::pdo();
        $st = $pdo->prepare('UPDATE orders SET status=?, updatedAt=? WHERE id=?');
        $st->execute([$status, Auth::now(), $id]);
        return $st->rowCount() ? self::getOrder($id) : null;
    }

    /* --------------------------------- Avis --------------------------------- */
    public static function addReview(string $userId, array $b): array
    {
        $tt = (string) ($b['targetType'] ?? ''); $ti = (string) ($b['targetId'] ?? '');
        $rating = max(1, min(5, (int) ($b['rating'] ?? 0)));
        if (!in_array($tt, ['product','store'], true) || $ti === '') {
            return ['error' => 'Cible invalide.'];
        }
        $r = [
            'id' => 'rev_' . bin2hex(random_bytes(7)), 'targetType' => $tt, 'targetId' => $ti, 'userId' => $userId,
            'authorName' => (string) ($b['authorName'] ?? 'Client'), 'rating' => $rating,
            'comment' => (string) ($b['comment'] ?? ''), 'verified' => !empty($b['verified']) ? 1 : 0,
            'status' => 'visible', 'createdAt' => Auth::now(),
        ];
        Db::pdo()->prepare('INSERT INTO reviews (id,targetType,targetId,userId,authorName,rating,comment,verified,status,createdAt)
            VALUES (:id,:targetType,:targetId,:userId,:authorName,:rating,:comment,:verified,:status,:createdAt)')->execute($r);
        return ['ok' => true, 'review' => $r];
    }

    public static function listReviews(?string $targetType, ?string $targetId): array
    {
        $sql = "SELECT * FROM reviews WHERE status='visible'"; $args = [];
        if ($targetType) { $sql .= ' AND targetType=?'; $args[] = $targetType; }
        if ($targetId) { $sql .= ' AND targetId=?'; $args[] = $targetId; }
        $sql .= ' ORDER BY createdAt DESC LIMIT 500';
        $st = Db::pdo()->prepare($sql); $st->execute($args);
        return $st->fetchAll();
    }

    public static function ratingFor(string $targetType, string $targetId): array
    {
        $st = Db::pdo()->prepare("SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE status='visible' AND targetType=? AND targetId=?");
        $st->execute([$targetType, $targetId]);
        $r = $st->fetch();
        return ['count' => (int) $r['c'], 'avg' => round((float) $r['a'], 1)];
    }

    public static function stats(): array
    {
        $pdo = Db::pdo();
        return [
            'users'    => (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
            'products' => (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn(),
            'orders'   => (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
            'revenue'  => (int) $pdo->query("SELECT COALESCE(SUM(total),0) FROM orders WHERE status IN('confirmed','shipped','delivered')")->fetchColumn(),
        ];
    }

    /* -------- Collections génériques (favoris, souhaits…) — write-through -------- */
    private const SYNC_COLLECTIONS = ['favorites','subs','wishlists','notifs','messages','coupons','questions','alerts','stores','expenses','reports'];

    public static function isSyncCollection(string $c): bool { return in_array($c, self::SYNC_COLLECTIONS, true); }

    public static function getAllDocs(string $userId): array
    {
        $st = Db::pdo()->prepare('SELECT collection, data FROM documents WHERE userId=?');
        $st->execute([$userId]);
        $out = [];
        foreach ($st->fetchAll() as $r) { $out[$r['collection']] = json_decode((string) $r['data'], true); }
        return $out;
    }

    public static function getDocsMeta(string $userId): array
    {
        $st = Db::pdo()->prepare('SELECT collection, updatedAt FROM documents WHERE userId=?');
        $st->execute([$userId]);
        $out = [];
        foreach ($st->fetchAll() as $r) { $out[$r['collection']] = (int) $r['updatedAt']; }
        return $out;
    }

    public static function getDocWithMeta(string $userId, string $collection): array
    {
        $st = Db::pdo()->prepare('SELECT data, updatedAt FROM documents WHERE collection=? AND userId=?');
        $st->execute([$collection, $userId]);
        $r = $st->fetch();
        return $r ? ['data' => json_decode((string) $r['data'], true), 'updatedAt' => (int) $r['updatedAt']] : ['data' => null, 'updatedAt' => 0];
    }

    public static function putDoc(string $userId, string $collection, $data): array
    {
        if (!self::isSyncCollection($collection)) { return ['error' => 'Collection inconnue.']; }
        $ts = Auth::now();
        Db::pdo()->prepare('INSERT INTO documents (collection,userId,data,updatedAt) VALUES (?,?,?,?)
            ON CONFLICT(collection,userId) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt')
            ->execute([$collection, $userId, json_encode($data, JSON_UNESCAPED_UNICODE), $ts]);
        return ['ok' => true, 'updatedAt' => $ts];
    }

    public static function upsertProducts(array $products): int
    {
        $pdo = Db::pdo();
        $stmt = $pdo->prepare('INSERT INTO products (id,storeId,storeName,name,description,price,currency,category,image,stock,active,createdAt)
            VALUES (:id,:storeId,:storeName,:name,:description,:price,:currency,:category,:image,:stock,:active,:createdAt)
            ON CONFLICT(id) DO UPDATE SET storeId=excluded.storeId,storeName=excluded.storeName,name=excluded.name,
              description=excluded.description,price=excluded.price,category=excluded.category,image=excluded.image,
              stock=excluded.stock,active=excluded.active');
        $n = 0;
        foreach ($products as $p) {
            $stmt->execute([
                'id' => $p['id'] ?? ('p_' . bin2hex(random_bytes(6))), 'storeId' => $p['storeId'] ?? '', 'storeName' => $p['storeName'] ?? '',
                'name' => $p['name'] ?? '', 'description' => $p['description'] ?? '', 'price' => max(0, (int) ($p['price'] ?? 0)),
                'currency' => 'FCFA', 'category' => $p['category'] ?? '', 'image' => $p['image'] ?? '',
                'stock' => (int) ($p['stock'] ?? 0), 'active' => (($p['active'] ?? true) === false) ? 0 : 1, 'createdAt' => Auth::now(),
            ]);
            $n++;
        }
        return $n;
    }
}
