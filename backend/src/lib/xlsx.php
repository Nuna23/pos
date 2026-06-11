<?php
// Minimal .xlsx writer that builds the file IN MEMORY (a store-only ZIP),
// so it works on shared hosting without ZipArchive or a writable temp dir.
// PHP 5.6 compatible.

function xlsx_col_ref($i)
{
    $s = '';
    $i++;
    while ($i > 0) {
        $m = ($i - 1) % 26;
        $s = chr(65 + $m) . $s;
        $i = (int) (($i - $m) / 26);
    }
    return $s;
}

function xlsx_esc($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

// Build a store-only (uncompressed) ZIP from array(name => content).
function zip_store($files)
{
    $local   = '';
    $central = '';
    $offset  = 0;
    $count   = 0;
    foreach ($files as $name => $content) {
        $crc     = crc32($content);
        $len     = strlen($content);
        $nameLen = strlen($name);

        $lfh = "PK\x03\x04" . pack('v', 20) . pack('v', 0) . pack('v', 0)
             . pack('v', 0) . pack('v', 0)            // mod time, mod date
             . pack('V', $crc) . pack('V', $len) . pack('V', $len)
             . pack('v', $nameLen) . pack('v', 0) . $name . $content;
        $local .= $lfh;

        $cdh = "PK\x01\x02" . pack('v', 20) . pack('v', 20) . pack('v', 0)
             . pack('v', 0) . pack('v', 0) . pack('v', 0)
             . pack('V', $crc) . pack('V', $len) . pack('V', $len)
             . pack('v', $nameLen) . pack('v', 0) . pack('v', 0)
             . pack('v', 0) . pack('v', 0) . pack('V', 0) . pack('V', $offset)
             . $name;
        $central .= $cdh;

        $offset += strlen($lfh);
        $count++;
    }
    $eocd = "PK\x05\x06" . pack('v', 0) . pack('v', 0)
          . pack('v', $count) . pack('v', $count)
          . pack('V', strlen($central)) . pack('V', $offset) . pack('v', 0);

    return $local . $central . $eocd;
}

// $rows: array of arrays (first row = header). Streams the .xlsx as a download.
function xlsx_download($rows, $filename, $sheetName)
{
    $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    $r = 1;
    foreach ($rows as $row) {
        $sheet .= '<row r="' . $r . '">';
        $c = 0;
        foreach ($row as $val) {
            $ref = xlsx_col_ref($c) . $r;
            if (is_int($val) || (is_string($val) && preg_match('/^-?\d{1,9}$/', $val))) {
                $sheet .= '<c r="' . $ref . '"><v>' . $val . '</v></c>';
            } else {
                $sheet .= '<c r="' . $ref . '" t="inlineStr"><is><t xml:space="preserve">'
                    . xlsx_esc($val) . '</t></is></c>';
            }
            $c++;
        }
        $sheet .= '</row>';
        $r++;
    }
    $sheet .= '</sheetData></worksheet>';

    $files = array(
        '[Content_Types].xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '</Types>',
        '_rels/.rels' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>',
        'xl/workbook.xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . xlsx_esc($sheetName) . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>',
        'xl/_rels/workbook.xml.rels' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '</Relationships>',
        'xl/worksheets/sheet1.xml' => $sheet,
    );

    $zip = zip_store($files);

    // Make sure no stray output/warning corrupts the binary.
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($zip));
    echo $zip;
    exit;
}
