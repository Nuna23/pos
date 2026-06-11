<?php
// LINE Messaging API push (low-stock alert to the shop owner). Works on
// PHP 5.6 — just an authenticated HTTPS POST via cURL. PHP 5.6 compatible.

function line_push($config, $text)
{
    $token  = $config['line_token'];
    $userId = $config['line_user_id'];
    if ($token === '' || $userId === '') {
        return false; // not configured — skip silently (matches old behaviour)
    }

    $payload = json_encode(array(
        'to'       => $userId,
        'messages' => array(array('type' => 'text', 'text' => $text)),
    ), JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.line.me/v2/bot/message/push');
    curl_setopt_array($ch, array(
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => array(
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
        ),
    ));
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $code >= 200 && $code < 300;
}
