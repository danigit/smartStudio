<?php

namespace strDrawMapApp;
error_reporting(E_ALL);

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

echo __DIR__;
include_once "strDrawMapProtocol.php";

class strWebSocketHandler implements MessageComponentInterface
{
    protected $clients;
    private $FProtocol;
    private $FLogins = array();

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        $this->FProtocol = new TDrawMapProtocol(MYSQLSERVER, MYSQLDBASE, MYSQLACCOUNT, MYSQLPASSWORD);
    }

    public function onOpen(ConnectionInterface $conn)
    {
        // Store the new connection to send messages to later
        $this->clients->attach($conn);

        echo "New connection! ($conn->resourceId)\n";
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $numRecv = count($this->clients) - 1;
        $Parametri = explode("~", $msg);
        try {
            if (count($Parametri) > 0)
                switch ($Parametri[0]) {
                    case CMD_LOGIN:
                        {
                            if (count($Parametri) >= 2) {
                                $APassword = "";
                                if (isset($Parametri[2])) $APassword = $Parametri[2];
                                echo "Login: " . $Parametri[1] . "\n";
                                $Answer = "";
                                $Connesso = $this->FProtocol->Login($Parametri[1], $APassword, $Answer);
                                $from->send($Answer);
                                if ($Connesso) {
                                    echo "Connessione avvenuta \n";
                                    $this->FLogins[$from->resourceId] = trim($Parametri[1]);
                                    $this->FProtocol->GetFloors(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                                    $from->send($Answer);
                                    $this->FProtocol->GetAnchors(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                                    $from->send($Answer);
                                    $this->FProtocol->GetZones(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                                    $from->send($Answer);
                                    $this->FProtocol->GetEventList(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                                    $from->send($Answer);
                                    $this->FProtocol->GetVideocamere(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                                    $from->send($Answer);
                                }
                            }
                            break;
                        }
                    case CMD_GET_FLOORS:
                        {
                            $Answer = "";
                            echo "Richiesta lista dei piani\n";
                            $this->FProtocol->GetFloors(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                            $from->send($Answer);
                            break;
                        }
                    case CMD_GET_POINTS:
                        {
                            if (count($Parametri >= 1)) {
                                $Answer = "";
                                echo "Richiesta punti mappa\n";
                                $this->FProtocol->GetPoints(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null,
                                    $Parametri[1], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_SET_POINTS:
                        {
                            if (count($Parametri >= 5)) {
                                $Answer = "";
                                echo "Impostazione punti mappa \n";
                                $this->FProtocol->SetPoints(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null,
                                    $Parametri[1], $Parametri[2], $Parametri[3], $Parametri[4], $Parametri[5], $Parametri[6], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_LOGOUT:
                        {
                            echo "Logout\n";
                            if (isset($this->FLogins[$from->resourceId]))
                                unset($this->FLogins[$from->resourceId]);
                            $from->send(CMD_LOGOUT . "~" . OPERATION_OK);
                            break;

                        }
                    case CMD_CHANGE_PASSWORD:
                        {
                            if (count($Parametri) >= 3) {
                                echo "Cambiamento password\n";
                                $this->FProtocol->ChangePassword(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Parametri[1], $Parametri[2], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_GET_BEACONS:
                        {
                            if (count($Parametri) >= 1) {
                                echo "Richiesta posizione fari\n";
                                $this->FProtocol->GetBeacons(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Parametri[1], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_GET_ANCHORS:
                        {
                            echo "Richiesta posizione ancore\n";
                            $this->FProtocol->GetAnchors(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                            $from->send($Answer);
                            break;
                        }
                    case CMD_GET_VIDEO:
                        {
                            echo "Richiesta posizione video\n";
                            $this->FProtocol->GetVideocamere(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                            $from->send($Answer);
                            break;
                        }
                    case CMD_GET_ZONES:
                        {
                            echo "Richiesta zone\n";
                            $this->FProtocol->GetZones(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Answer);
                            $from->send($Answer);
                            break;
                        }
                    case CMD_GET_HISTORY:
                        {
                            if (count($Parametri >= 0)) {
                                $Answer = "";
                                echo "Richiesta storico\n";
                                $this->FProtocol->GetHistory(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null,
                                    $Parametri[1], $Parametri[2], $Parametri[3], $Parametri[4], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_SET_ANCHORS:
                        {
                            if (count($Parametri >= 1)) {
                                $Answer = "";
                                echo "Impostazione posizione ancore\n";
                                $this->FProtocol->SetAnchors(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Parametri[1], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_SET_BEACONS:
                        {

                            if (count($Parametri >= 1)) {
                                $Answer = "";
                                echo "Impostazione tag \n";
                                $this->FProtocol->SetBeacons(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null,
                                    $Parametri[1], $Parametri[2], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_SET_ZONES:
                        {
                            if (count($Parametri >= 1)) {
                                $Answer = "";
                                echo "Impostazione posizione zone\n";
                                $this->FProtocol->SetZones(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Parametri[1], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    case CMD_ADVICE_TO_TAG:
                        {
                            if (count($Parametri > 2)) {
                                echo('comando al tag ' . $Parametri[2] . ' Comando ' . $Parametri[1] . "\n");
                                $this->FProtocol->SendAdviceToTag(isset($this->FLogins[$from->resourceId]) ? $this->FLogins[$from->resourceId] : null, $Parametri[1], $Parametri[2], $Answer);
                                $from->send($Answer);
                            }
                            break;
                        }
                    default:
                        echo "Comando sconosciuto ($msg) ricevuto da $from->resourceId\n";
                }
        } catch (Exception $ex) {
            echo "Eccezione non gestita: " . $ex->get_message . "\n";
        }
        unset($Parametri);

    }

    public function onClose(ConnectionInterface $conn)
    {
        // The connection is closed, remove it, as we can no longer send it messages
        $this->clients->detach($conn);
        if (isset($FLogins[$conn->resourceId])) unset($FLogins[$conn->resourceId]);
        echo "La connessione $conn->resourceId è stata chiusa\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Errore durante la comunicazione WebSocket: $e->getMessage()\n";
        $conn->close();
    }
}

?>