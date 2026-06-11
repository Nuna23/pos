<?php
// Web Push (RFC 8291 "aes128gcm" + RFC 8292 VAPID), implemented with the
// OpenSSL/hash primitives in PHP, no Composer dependency.
//
// NOTE ON PHP VERSION: the payload encryption needs ECDH key agreement
// (openssl_pkey_derive, PHP 7.3+), HKDF (hash_hkdf, PHP 7.1.2+) and AES-128-GCM
// (PHP 7.1+). On the PHP 5.6 image these are absent, so webpush_capable()
// returns false and sending becomes a logged no-op — the order still completes,
// exactly like the old NestJS code disabled push when keys were missing.
// Deploy the backend on PHP 7.3+ (e.g. cPanel ea-php82) to enable live push.

function webpush_capable()
{
    return function_exists('openssl_pkey_derive')
        && function_exists('hash_hkdf')
        && function_exists('openssl_pkey_new')
        && in_array('aes-128-gcm', openssl_get_cipher_methods(), true);
}

// Build the "your crepe is ready" payload from an order row and send it.
function webpush_notify_order_done($config, $orderRow)
{
    if (empty($orderRow['push_endpoint']) || empty($orderRow['push_p256dh']) || empty($orderRow['push_auth'])) {
        return; // customer did not subscribe to push
    }
    $payload = json_encode(array(
        'title'   => 'เครปของคุณพร้อมแล้ว! 🥞',
        'body'    => 'คิวที่ ' . (int) $orderRow['queue_number'] . ' มารับได้เลย',
        'orderId' => (int) $orderRow['id'],
    ), JSON_UNESCAPED_UNICODE);

    $sub = array(
        'endpoint' => $orderRow['push_endpoint'],
        'p256dh'   => $orderRow['push_p256dh'],
        'auth'     => $orderRow['push_auth'],
    );
    webpush_send($config, $sub, $payload);
}

// Returns true on a 2xx from the push service, false otherwise (incl. disabled).
function webpush_send($config, $sub, $payload)
{
    if ($config['vapid_public'] === '' || $config['vapid_private'] === '' || strpos($config['vapid_public'], 'your_vapid') !== false) {
        return false; // VAPID not configured
    }
    if (!webpush_capable()) {
        error_log('CrepePOS: web push unavailable on this PHP build — skipping (needs PHP 7.3+).');
        return false;
    }

    try {
        $uaPublic   = webpush_b64url_decode($sub['p256dh']); // 65 bytes
        $authSecret = webpush_b64url_decode($sub['auth']);   // 16 bytes

        // Ephemeral sender keypair (P-256).
        $local   = openssl_pkey_new(array('curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC));
        $details = openssl_pkey_get_details($local);
        $asPublic = "\x04"
            . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
            . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

        // ECDH shared secret with the user agent's public key.
        $uaKey  = openssl_pkey_get_public(webpush_ec_public_pem($uaPublic));
        $shared = openssl_pkey_derive($uaKey, $local);

        // RFC 8291 key derivation.
        $ikm   = hash_hkdf('sha256', $shared, 32, "WebPush: info\x00" . $uaPublic . $asPublic, $authSecret);
        $salt  = openssl_random_pseudo_bytes(16);
        $cek   = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\x00", $salt);

        // Single AES-128-GCM record. 0x02 is the last-record delimiter.
        $tag = '';
        $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
        $encrypted = $cipher . $tag;

        // RFC 8188 header: salt(16) | rs(uint32) | idlen(uint8) | keyid(as_public).
        $body = $salt . pack('N', 4096) . chr(strlen($asPublic)) . $asPublic . $encrypted;

        $jwt = webpush_vapid_jwt($config, $sub['endpoint']);

        $ch = curl_init($sub['endpoint']);
        curl_setopt_array($ch, array(
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => array(
                'Authorization: vapid t=' . $jwt . ', k=' . $config['vapid_public'],
                'Content-Encoding: aes128gcm',
                'Content-Type: application/octet-stream',
                'TTL: 43200',
            ),
        ));
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $code >= 200 && $code < 300;
    } catch (Exception $e) {
        error_log('CrepePOS: web push failed — ' . $e->getMessage());
        return false;
    }
}

// --- VAPID (RFC 8292) ----------------------------------------------------

function webpush_vapid_jwt($config, $endpoint)
{
    $parts = parse_url($endpoint);
    $aud   = $parts['scheme'] . '://' . $parts['host'];

    $header  = webpush_b64url_encode(json_encode(array('typ' => 'JWT', 'alg' => 'ES256')));
    $claims  = webpush_b64url_encode(json_encode(array(
        'aud' => $aud,
        'exp' => time() + 43200, // 12h
        'sub' => $config['vapid_subject'],
    )));
    $signingInput = $header . '.' . $claims;

    $pem = webpush_ec_private_pem(
        webpush_b64url_decode($config['vapid_private']),
        webpush_b64url_decode($config['vapid_public'])
    );
    $der = '';
    openssl_sign($signingInput, $der, $pem, 'sha256'); // ES256
    $sig = webpush_ecdsa_der_to_raw($der);

    return $signingInput . '.' . webpush_b64url_encode($sig);
}

// --- ASN.1 / DER helpers -------------------------------------------------

// Wrap a raw 65-byte uncompressed P-256 point as an EC public-key PEM.
function webpush_ec_public_pem($point65)
{
    $der = "\x30\x59\x30\x13"
        . "\x06\x07\x2a\x86\x48\xce\x3d\x02\x01"          // id-ecPublicKey
        . "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07"      // prime256v1
        . "\x03\x42\x00" . $point65;                      // BIT STRING (point)
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

// Wrap a raw 32-byte private scalar + 65-byte public point as an EC key PEM.
function webpush_ec_private_pem($priv32, $point65)
{
    $der = "\x30\x77\x02\x01\x01"
        . "\x04\x20" . $priv32                            // OCTET STRING d
        . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07" // [0] prime256v1
        . "\xa1\x44\x03\x42\x00" . $point65;              // [1] BIT STRING point
    return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
}

// Convert an ECDSA DER signature (SEQUENCE of two INTEGERs) to the raw 64-byte
// r||s form that JWS ES256 requires.
function webpush_ecdsa_der_to_raw($der)
{
    $offset = 0;
    $offset++;                       // 0x30 SEQUENCE
    $len = ord($der[$offset++]);
    if ($len & 0x80) {               // long-form length (rare for P-256)
        $offset += ($len & 0x7f);
    }
    $offset++;                       // 0x02 INTEGER (r)
    $rLen = ord($der[$offset++]);
    $r = substr($der, $offset, $rLen);
    $offset += $rLen;
    $offset++;                       // 0x02 INTEGER (s)
    $sLen = ord($der[$offset++]);
    $s = substr($der, $offset, $sLen);

    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);
    return $r . $s;
}

// --- base64url -----------------------------------------------------------

function webpush_b64url_encode($data)
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function webpush_b64url_decode($data)
{
    $pad = strlen($data) % 4;
    if ($pad) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}
