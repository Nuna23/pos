<?php
// Minimal .xlsx + .csv reader that returns rows as arrays of strings. Reads
// .xlsx WITHOUT the zip extension / ZipArchive (parses the ZIP central
// directory by hand and inflates entries with gzinflate) so it works on
// shared PHP 5.6 hosting. PHP 5.6 compatible.

function read_table_file($content)
{
    // .xlsx is a ZIP archive ("PK\x03\x04"); anything else is treated as CSV.
    if (substr($content, 0, 2) === 'PK') {
        return xlsx_read_rows($content);
    }
    return csv_read_rows($content);
}

function csv_read_rows($content)
{
    // Strip a UTF-8 BOM if present, normalise newlines.
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }
    $content = str_replace(array("\r\n", "\r"), "\n", $content);
    $rows = array();
    foreach (explode("\n", $content) as $line) {
        if (trim($line) === '') {
            continue;
        }
        $rows[] = str_getcsv($line);
    }
    return $rows;
}

// --- xlsx ----------------------------------------------------------------

function xlsx_read_rows($zip)
{
    $files = zip_read_entries($zip);

    $shared = array();
    if (isset($files['xl/sharedStrings.xml'])) {
        $shared = xlsx_shared_strings($files['xl/sharedStrings.xml']);
    }

    $sheetXml = isset($files['xl/worksheets/sheet1.xml']) ? $files['xl/worksheets/sheet1.xml'] : null;
    if ($sheetXml === null) {
        foreach ($files as $name => $data) {
            if (strpos($name, 'xl/worksheets/') === 0 && substr($name, -4) === '.xml') {
                $sheetXml = $data;
                break;
            }
        }
    }
    return $sheetXml === null ? array() : xlsx_parse_sheet($sheetXml, $shared);
}

// Read all entries of a ZIP via its central directory -> array(name => bytes).
function zip_read_entries($zip)
{
    $entries = array();
    $eocd = strrpos($zip, "PK\x05\x06");
    if ($eocd === false) {
        return $entries;
    }
    $count  = u16($zip, $eocd + 10);
    $offset = u32($zip, $eocd + 16);

    $p = $offset;
    for ($i = 0; $i < $count; $i++) {
        if (substr($zip, $p, 4) !== "PK\x01\x02") {
            break;
        }
        $method     = u16($zip, $p + 10);
        $compSize   = u32($zip, $p + 20);
        $nameLen    = u16($zip, $p + 28);
        $extraLen   = u16($zip, $p + 30);
        $commentLen = u16($zip, $p + 32);
        $localOff   = u32($zip, $p + 42);
        $name       = substr($zip, $p + 46, $nameLen);
        $p += 46 + $nameLen + $extraLen + $commentLen;

        if (substr($zip, $localOff, 4) !== "PK\x03\x04") {
            continue;
        }
        $lNameLen  = u16($zip, $localOff + 26);
        $lExtraLen = u16($zip, $localOff + 28);
        $dataAt    = $localOff + 30 + $lNameLen + $lExtraLen;
        $data      = substr($zip, $dataAt, $compSize);

        if ($method === 0) {
            $entries[$name] = $data;
        } elseif ($method === 8 && function_exists('gzinflate')) {
            $entries[$name] = gzinflate($data);
        }
    }
    return $entries;
}

function u16($s, $o)
{
    $v = unpack('v', substr($s, $o, 2));
    return $v[1];
}

function u32($s, $o)
{
    $v = unpack('V', substr($s, $o, 4));
    return $v[1];
}

function xlsx_shared_strings($xml)
{
    $out = array();
    if (preg_match_all('#<si>(.*?)</si>#s', $xml, $m)) {
        foreach ($m[1] as $si) {
            $text = '';
            if (preg_match_all('#<t[^>]*>(.*?)</t>#s', $si, $tm)) {
                foreach ($tm[1] as $t) {
                    $text .= $t;
                }
            }
            $out[] = xlsx_decode($text);
        }
    }
    return $out;
}

function xlsx_parse_sheet($xml, $shared)
{
    $rows = array();
    if (!preg_match_all('#<row[^>]*>(.*?)</row>#s', $xml, $rm)) {
        return $rows;
    }
    foreach ($rm[1] as $rowXml) {
        $cells = array();
        if (preg_match_all('#<c\b([^>]*)>(.*?)</c>#s', $rowXml, $cm, PREG_SET_ORDER)) {
            foreach ($cm as $c) {
                $attr  = $c[1];
                $inner = $c[2];
                $col   = 0;
                if (preg_match('#r="([A-Z]+)\d+"#', $attr, $rmatch)) {
                    $col = col_to_index($rmatch[1]);
                }
                $type = preg_match('#t="([^"]+)"#', $attr, $tmatch) ? $tmatch[1] : '';

                $val = '';
                if ($type === 'inlineStr') {
                    if (preg_match('#<t[^>]*>(.*?)</t>#s', $inner, $im)) {
                        $val = xlsx_decode($im[1]);
                    }
                } elseif (preg_match('#<v>(.*?)</v>#s', $inner, $vm)) {
                    if ($type === 's') {
                        $idx = (int) $vm[1];
                        $val = isset($shared[$idx]) ? $shared[$idx] : '';
                    } else {
                        $val = xlsx_decode($vm[1]);
                    }
                }
                $cells[$col] = $val;
            }
        }
        if (empty($cells)) {
            $rows[] = array();
            continue;
        }
        $max = max(array_keys($cells));
        $row = array();
        for ($i = 0; $i <= $max; $i++) {
            $row[] = isset($cells[$i]) ? $cells[$i] : '';
        }
        $rows[] = $row;
    }
    return $rows;
}

function col_to_index($letters)
{
    $n   = 0;
    $len = strlen($letters);
    for ($i = 0; $i < $len; $i++) {
        $n = $n * 26 + (ord($letters[$i]) - 64);
    }
    return $n - 1;
}

function xlsx_decode($s)
{
    return html_entity_decode($s, ENT_QUOTES, 'UTF-8');
}
