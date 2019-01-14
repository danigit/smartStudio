<?php
namespace strDrawMapApp;

use Mysqli;

include_once 'strDrawMapConfig.php';
include_once 'strDrawMapGlobale.php';
include_once PATH_ZLIBRARY . 'ZDBaseFunct.php';

define('DEFAULT_LARGHEZZA', 1000);
define('DELAY_GHOST', 60);

class TDrawMapProtocol
{
    // Coordinate database
    private $FServer;
    private $FDatabase;
    private $FDBUserName;
    private $FDBPassword;

    function __construct($Server, $Database, $UserName, $Password)
    {
        $this->FServer = $Server;
        $this->FDatabase = $Database;
        $this->FDBUserName = $UserName;
        $this->FDBPassword = $Password;

        echo "\nSTART SERVICE\n";
    }

    function Login($UserName, $Password, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
        if (!$mysqli->connect_errno) {
            if (!($AQuery = $mysqli->query('SELECT * FROM utenti WHERE login = \'' . $UserName . '\'')))
                $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
            else {
                if ($Row = $AQuery->fetch_assoc()) {
                    if ((($Password == '') && ($Row['password'] == '')) ||
                        (md5($Password) == $Row['password'])) {
                        $Answer = OPERATION_OK . '~' . $Row['SUPERUSER'];
                        $Result = true;
                    } else $Answer = ERROR_PASSWORD;
                } else $Answer = ERROR_ACCOUNT_UNKNOWN;
                $AQuery->free();
            }
            $mysqli->close();
        } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
        unset($mysqli);
        $Answer = CMD_LOGIN . '~' . $Answer;
        return ($Result);
    }

    function GetPoints($UserName, $Piano, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM mappe WHERE Piano = ' . $Piano . '')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    if ($Row = $AQuery->fetch_assoc()) {
                        $Answer = OPERATION_OK . '~' . $Row['Larghezza'] . '~' . $Row['Tacca'] . '~' . $Row['Punti'] . '~' . $Row['nome_piano'] . '~' . $Row['immagine_mappa'];
                        $Result = true;
                    } else $Answer = OPERATION_OK . '~' . DEFAULT_LARGHEZZA . '~100~';
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_POINTS . '~' . $Answer;
        return ($Result);
    }

    function SetPoints($UserName, $Piano, $Larghezza, $Tacca, $Points, $NomePiano, $NomeMappa, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        $EditSQL = '';
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            $mysqli->autocommit(true);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM mappe WHERE Piano = ' . $Piano . '')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    if ($Row = $AQuery->fetch_assoc())
                        $EditSQL = 'UPDATE mappe SET Punti = \'' . $Points . '\',' .
                            'Larghezza = ' . $Larghezza . ',' .
                            'immagine_mappa = \'' . $NomeMappa . '\',' .
                            'nome_piano = \'' . $NomePiano . '\',' .
                            'Tacca = ' . $Tacca . ' ' .
                            'WHERE Piano = ' . $Piano;
                    else $EditSQL = 'INSERT INTO mappe (Piano,Larghezza,nome_piano,immagine_mappa, Tacca,Punti)' .
                        'VALUES(' . $Piano . ',' . $Larghezza . ',\'' . $NomePiano . '\',' . '\'' . $NomeMappa . '\',' . $Tacca . ',\'' . $Points . '\')';
                    $AQuery->free();
                }
                if ($EditSQL != '') {
                    if (!($AQuery = $mysqli->query($EditSQL)))
                        $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                    else {
                        $Answer = OPERATION_OK;
                        $Result = true;
                    }
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_SET_POINTS . '~' . $Answer;
        return ($Result);
    }

    function ChangePassword($UserName, $OldPassword, $NewPassword, &$Answer)
    {
        $PasswordOk = false;
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
        if (!$mysqli->connect_errno) {
            if (!($AQuery = $mysqli->query('SELECT * FROM utenti WHERE login = \'' . $UserName . '\'')))
                $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
            else {
                if ($Row = $AQuery->fetch_assoc()) {
                    if ((($OldPassword == '') && ($Row['password'] == '')) ||
                        (md5($OldPassword) == $Row['password']))
                        $PasswordOk = true;
                    else $Answer = ERROR_PASSWORD;
                } else $Answer = ERROR_ACCOUNT_UNKNOWN;
                $AQuery->free();
            }
            if ($PasswordOk) {
                if (!($AQuery = $mysqli->query('UPDATE utenti SET password = \'' . md5($NewPassword) . '\' WHERE login = \'' . $UserName . '\'')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK;
                    $Result = true;
                }
            }
            $mysqli->close();
        } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
        unset($mysqli);
        $Answer = CMD_CHANGE_PASSWORD . '~' . $Answer;
        return ($Result);
    }

    function GetAnchors($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM anchors WHERE ID_ANCHOR >= 0 ORDER BY ID_ANCHOR')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['ID_ANCHOR'] . ',' .
                            intval($Row['X_POS_ANCHOR'] * 100) . ',' .
                            intval($Row['Y_POS_ANCHOR'] * 100) . ',' .
                            intval($Row['Z_H_POS_ANCHOR'] * 100) . ',' .
                            $Row['Z_POS_ANCHOR'] . ',' .
                            ($Row['Raggio'] * 100) . ',' .
                            ($Row['ISONLINE'] ? '0' : '1') . ',' .
                            $Row['NAME'] . ',' .
                            $Row['MAC_ANCHOR'] . ',' .
                            $Row['BUILDING'] . ',' .
                            ($Row['PROXIMITY'] ? '1' : '0') . ',' .
                            $Row['RSSI_THRESHOLD'] . ',' .
                            $Row['IP'] . ',' .
                            $Row['ZONE'] . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_ANCHORS . '~' . $Answer;
        return ($Result);
    }

    function GetVideocamere($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM video')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['ID'] . ',' .
                            intval($Row['XPOS'] * 100) . ',' .
                            intval($Row['YPOS'] * 100) . ',' .
                            $Row['ZPOS'] . ',' .
                            $Row['IP_ADDRESS'] . ',' .
                            $Row['NVR'] . ',' .
                            $Row['CAMERA'] . ',' .
                            $Row['USER'] . ',' .
                            $Row['PWD'] . ',' .
                            intval($Row['RADIUS'] * 100) . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_VIDEO . '~' . $Answer;
        return ($Result);
    }

    function GetZones($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {

            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM zones WHERE ID >= 1 ORDER BY ID')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['ID'] . ',' .
                            intval($Row['X_LEFT'] * 100) . ',' .
                            intval($Row['X_RIGHT'] * 100) . ',' .
                            intval($Row['Y_UP'] * 100) . ',' .
                            intval($Row['Y_DOWN'] * 100) . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);

        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_ZONES . '~' . $Answer;
        return ($Result);
    }

    function GetEventList($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {

            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM event ORDER BY DESCRIPTION')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['ID'] . ',' . $Row['DESCRIPTION'] . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);

        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_EVENT_LIST . '~' . $Answer;
        return ($Result);
    }

    function GetHistory($UserName, $ToDate, $FromDate, $SelectTag, $SelectEvent, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                $BodySQL = "SELECT history.*,event.DESCRIPTION,event.ICON_NAME,tag.NAME as NOME_TAG,anchors.NAME as NOME_ANCORA" .
                    "  FROM history,event,tag,anchors " .
                    " WHERE history.EVENT_ID = event.ID" .
                    "   AND history.TAG_MAC = tag.MAC" .
                    "   AND history.TAG_AN_REF = anchors.MAC_ANCHOR";
                if ($FromDate != "") $BodySQL .= " AND history.TIMESTAMP >= '" . $FromDate . "'";
                if ($ToDate != "") $BodySQL .= " AND history.TIMESTAMP <= '" . $ToDate . "'";

                if ($SelectEvent != "") $BodySQL .= " AND history.EVENT_ID = " . $SelectEvent;
                if ($SelectTag != "") $BodySQL .= " AND tag.ID = " . $SelectTag;

                $BodySQL .= " ORDER BY history.TIMESTAMP DESC";

                if (!($AQuery = $mysqli->query($BodySQL)))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['ICON_NAME'] . ',' .
                            $Row['NOME_TAG'] . ',' .
                            $Row['NOME_ANCORA'] . ',' .
                            $Row['TIMESTAMP'] . ',' .
                            $Row['TAG_X_POS'] . ',' .
                            $Row['TAG_Y_POS'] . ',' .
                            $Row['DESCRIPTION'] . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }

                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_HISTORY . '~' . $Answer;
        return ($Result);
    }

    function GetFloors($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;

        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {

                if (!($AQuery = $mysqli->query('SELECT piano,nome_piano FROM mappe ORDER BY piano')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    $Answer = OPERATION_OK . '~';
                    while ($Row = $AQuery->fetch_assoc()) {
                        $Answer .= $Row['piano'] . ',' . $Row['nome_piano'] . '^';
                    }
                    $Result = true;
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_FLOORS . '~' . $Answer;
        return ($Result);
    }

    function GetBeacons($UserName, $Piano, &$Answer)
    {
        return ($this->FGetBeaconsUltraBand($UserName, $Answer));
    }

    private function FGetWathdog($mysqli, &$Answer, &$DateWatchdog)
    {
        if (!($AQuery = $mysqli->query('SELECT TIMESTAMP_LE FROM rtls '))) {
            $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
            return (false);
        } else {
            if ($Row = $AQuery->fetch_assoc()) {
                $ElementiData = explode(" ", $Row['TIMESTAMP_LE']);
                $DateWatchdog = mktime($ElementiData[3],
                    $ElementiData[4],
                    $ElementiData[5],
                    $ElementiData[1],
                    $ElementiData[2],
                    $ElementiData[0]);
                return (true);
            } else {
                $Answer = ERROR_SQL . "~SQL error: Configurazione rtls assente";
                return (false);
            }
        }
    }

    private function FGetBeaconsUltraBand($UserName, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        $DateWatchdog = '2000 01 01 00 00 00';
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if ($this->FGetWathdog($mysqli, $Answer, $DateWatchdog)) {
                    date_default_timezone_set('Europe/Rome');
                    $AlarmEngineOff = ((time() - $DateWatchdog) > DELAY_GHOST);
                    if (!($AQuery = $mysqli->query('SELECT tag.ID,tag.XPOS, ' .
                        '       tag.YPOS,anchors.Z_POS_ANCHOR,  ' .
                        '       tag.name,  ' .
                        '       tag.MANDOWN AS UomoATerra,' .
                        '       tag.HELMET_DPI,' .
                        '       tag.BELT_DPI,' .
                        '       tag.RADIO_SWITCHED_OFF,' .
                        '       tag.GLOVE_DPI,' .
                        '       tag.SHOE_DPI,' .
                        '       tag.ROPE_DPI,' .
                        '       tag.MAN_DOWN_TACITATED,' .
                        '       tag.MAN_DOWN_DISABLED,' .
                        '       tag.BATTERY_STATUS,' .
                        '       tag.CALL_ME_ALARM,' .
                        '       tag.EVACUATION_ALARM,' .
                        '       tag.AN_REF,' .
                        '       tag.MAC,' .
                        '       tag.ISEXIT,' .
                        '       tag.GPS_NORTH_DEGREES,' .
                        '       tag.GPS_EAST_DEGREES,' .
                        '       tag.TIMESTAMP AS UltimoAggiornamento,' .
                        '       anchors.ID_ANCHOR,anchors.Z_POS_ANCHOR,anchors.EMERGENCY_ZONE ' .
                        '  FROM tag,anchors ' .
                        ' WHERE ID >= 1 ' .
                        '   AND tag.AN_REF = anchors.MAC_ANCHOR')))
                        $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                    else {
                        $Answer = OPERATION_OK . '~' . ($AlarmEngineOff ? '1' : '0') . '~';
                        while ($Row = $AQuery->fetch_assoc()) {
                            $ElementiData = explode(" ", $Row['UltimoAggiornamento']);
                            $DataAggiornamento = mktime($ElementiData[3],
                                $ElementiData[4],
                                $ElementiData[5],
                                $ElementiData[1],
                                $ElementiData[2],
                                $ElementiData[0]);
                            date_default_timezone_set('Europe/Rome');
                            $ElementiData = null;

                            $Answer .= $Row['ID'] . ',' .
                                intval($Row['XPOS'] * 100) . ',' .
                                intval($Row['YPOS'] * 100) . ',' .
                                $Row['Z_POS_ANCHOR'] . ',' .
                                ($Row['ISEXIT'] == 1 ? '1' : '0') . ',' .
                                (isset($Row['UomoATerra']) ? $Row['UomoATerra'] : '0') . ',' .
                                $Row['name'] . ',' .
                                $Row['HELMET_DPI'] . ',' .
                                $Row['BELT_DPI'] . ',' .
                                $Row['GLOVE_DPI'] . ',' .
                                $Row['SHOE_DPI'] . ',' .
                                $Row['ROPE_DPI'] . ',' .
                                $Row['MAN_DOWN_TACITATED'] . ',' .
                                $Row['MAN_DOWN_DISABLED'] . ',' .
                                $Row['BATTERY_STATUS'] . ',' .
                                $Row['MAC'] . ',' .
                                $Row['AN_REF'] . ',' .
                                ($Row['RADIO_SWITCHED_OFF'] == 1 ? '1' : '0') . ',' .
                                $Row['EMERGENCY_ZONE'] . ',' .
                                $Row['CALL_ME_ALARM'] . ',' .
                                $Row['EVACUATION_ALARM'] . ',' .
                                (isset($Row['GPS_NORTH_DEGREES']) ? number_format($Row['GPS_NORTH_DEGREES'], 8, ".", "") : '0') . ',' .
                                (isset($Row['GPS_EAST_DEGREES']) ? number_format($Row['GPS_EAST_DEGREES'], 8, ".", "") : '0') . '^';
                        }
                        $Result = true;
                        $AQuery->free();
                    }
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_GET_BEACONS . '~' . $Answer;
        return ($Result);
    }

    function SetAnchors($UserName, $Anchors, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            $mysqli->autocommit(true);
            if (!$mysqli->connect_errno) {
                $ArrayAncore = explode('^', $Anchors);
                for ($i = 0; $i < count($ArrayAncore); $i++) {
                    $SingolaAncora = explode(',', $ArrayAncore[$i]);
                    if (!($AQuery = $mysqli->query("UPDATE anchors SET X_POS_ANCHOR = " . number_format($SingolaAncora[1] / 100, 2, '.', '') . ", " .
                        "Y_POS_ANCHOR = " . number_format($SingolaAncora[2] / 100, 2, '.', '') . ", " .
                        "Z_POS_ANCHOR = " . $SingolaAncora[4] . ", " .
                        "Raggio = " . number_format($SingolaAncora[5] / 100, 2, '.', '') . ", " .
                        "ZONE = '" . $SingolaAncora[6] . "', " .
                        "NAME = '" . $SingolaAncora[7] . "', " .
                        "IP = '" . $SingolaAncora[8] . "', " .
                        "RSSI_THRESHOLD = " . $SingolaAncora[9] . ", " .
                        "PROXIMITY = " . $SingolaAncora[10] . ", " .
                        "Z_H_POS_ANCHOR = " . number_format($SingolaAncora[3] / 100, 2, '.', '') . " " .
                        "WHERE ID_ANCHOR = $SingolaAncora[0]"))) {
                        $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                        break;
                    } else {
                        $Answer = OPERATION_OK;
                        $Result = true;
                    }
                    unset($SingolaAncora);
                }
                unset($ArrayAncore);
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_SET_ANCHORS . '~' . $Answer;
        return ($Result);
    }

    function SetBeacons($UserName, $Beacon, $ID, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        $EditSQL = '';
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            $mysqli->autocommit(true);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query('SELECT * FROM tag WHERE ID = ' . '\'' . $ID . '\'' . '')))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    if ($Row = $AQuery->fetch_assoc())
                        $EditSQL = 'UPDATE tag SET NAME = \'' . $Beacon . '\'' .
                            'WHERE ID = ' . '\'' . $ID . '\'';

                    $AQuery->free();
                }
                if ($EditSQL != '') {
                    if (!($AQuery = $mysqli->query($EditSQL)))
                        $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                    else {
                        $Answer = OPERATION_OK;
                        $Result = true;
                    }
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_SET_BEACONS . '~' . $Answer;
        return ($Result);
    }

    function SetZones($UserName, $Zones, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            $mysqli->autocommit(true);
            if (!$mysqli->connect_errno) {
                if (!$mysqli->query("DELETE FROM zones")) {
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                } else {
                    $ArrayZone = explode('^', $Zones);
                    for ($i = 0; $i < count($ArrayZone); $i++) {
                        $SingolaZona = explode(',', $ArrayZone[$i]);
                        if (!$mysqli->query("INSERT INTO zones (ID,X_LEFT,X_RIGHT,Y_UP,Y_DOWN) " .
                            "VALUES (" . $SingolaZona[0] . ', ' .
                            number_format($SingolaZona[1] / 100, 2, '.', '') . ", " .
                            number_format($SingolaZona[2] / 100, 2, '.', '') . ", " .
                            number_format($SingolaZona[3] / 100, 2, '.', '') . ", " .
                            number_format($SingolaZona[4] / 100, 2, '.', '') . ")")) {
                            $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                            break;
                        } else {
                            $Answer = OPERATION_OK;
                            $Result = true;
                        }
                        unset($SingolaZona);
                    }
                    unset($ArrayZone);
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_SET_ZONES . '~' . $Answer;
        return ($Result);
    }

    function SendAdviceToTag($UserName, $Comando, $MacTag, &$Answer)
    {
        $Answer = ERROR_SQL . '~Unknown error';
        $Result = false;
        if ($UserName != null) {
            $mysqli = new mysqli($this->FServer, $this->FDBUserName, $this->FDBPassword, $this->FDatabase);
            if (!$mysqli->connect_errno) {
                if (!($AQuery = $mysqli->query("SELECT * FROM anchors WHERE ID_ANCHOR >= 0 AND ISONLINE = '1' ORDER BY ID_ANCHOR")))
                    $Answer = ERROR_SQL . "~SQL error: " . $mysqli->error;
                else {
                    try {
                        $Answer = OPERATION_OK . '~' . $Comando . '~' . $MacTag;

                        while ($Row = $AQuery->fetch_assoc()) {
                            echo "Invio comando " . $Comando . " a " . $MacTag . ". Ancora: " . $Row['IP'] . "\n";
                            $message = $MacTag . $Comando;
                            if ($socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP)) {
                                socket_sendto($socket, $message, strlen($message), 0, $Row['IP'], 5000);
                                //echo "Inviato " . $Comando . " a " . $MacTag . "\n";
                                socket_close($socket);
                            } else {
                                if ($Answer == OPERATION_OK)
                                    $Answer = ERROR_SYSTEM . '~Impossibile connettersi a ';
                                $Answer .= $Row['ID_ANCHOR'] . ' ';
                            }
                        }
                        $Result = $Answer == OPERATION_OK;
                    } catch (Exception $e) {
                        $Answer = ERROR_SYSTEM . '~' . $e->getMessage();
                    }
                    $AQuery->free();
                }
                $mysqli->close();
            } else $Answer = ERROR_SQL . '~' . $mysqli->connect_error;
            unset($mysqli);
        } else $Answer = ERROR_NOT_LOGGED;
        $Answer = CMD_ADVICE_TO_TAG . '~' . $Answer;
        return ($Result);
    }

}

?>
