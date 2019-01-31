<?php /** @noinspection PhpUndefinedFieldInspection */

/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 14/01/19
 * Time: 19.58
 */

require_once '../ajax/communication.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
require_once '../database/connection.php';

class webSocketServer implements MessageComponentInterface{
    protected $clients;
    private $connection;

    public function __construct(){
//        echo "SERVER IS LISTENING...\n\n";
        $this->clients = [];
        $this->connection = new Connection();
    }

    /**
     * When a new connection is opened it will be passed to this method
     * @param  ConnectionInterface $conn The socket/connection that just connected to your application
     * @throws \Exception
     */
    function onOpen(ConnectionInterface $conn){
        if (!isset($_SESSION)) {
            session_start();
        }
        session_regenerate_id();

        // TODO: Implement onOpen() method.
        echo "CONNECTION ESTABLISHED WITH ({$conn->resourceId})!\n";
        $this->clients[$conn->resourceId] = $conn;
//        $conn->send(json_encode(array('connectionId' => $conn->resourceId)));
    }

    /**
     * This is called before or after a socket is closed (depends on how it's closed).  SendMessage to $conn will not result in an error if it has already been closed.
     * @param  ConnectionInterface $conn The socket/connection that is closing/closed
     * @throws \Exception
     */
    function onClose(ConnectionInterface $conn){
//        if (!isset($_SESSION)) {
//            session_start();
//        }
//        $_SESSION = array();
//        session_regenerate_id();
//        session_write_close();

        // TODO: Implement onClose() method.
        unset($this->clients[$conn->resourceId]);
    }

    /**
     * If there is an error with one of the sockets, or somewhere in the application where an Exception is thrown,
     * the Exception is sent back down the stack, handled by the Server and bubbled back up the application through this method
     * @param  ConnectionInterface $conn
     * @param  \Exception $e
     * @throws \Exception
     */
    function onError(ConnectionInterface $conn, \Exception $e){
        // TODO: Implement onError() method.
        echo "An error has occurred: {$e->getMessage()}\n";

        $conn->close();
    }

    /**
     * Triggered when a client sends data through the socket
     * @param  \Ratchet\ConnectionInterface $from The socket/connection that sent the message to your application
     * @param  string $msg The message received
     * @throws \Exception
     */
    function onMessage(ConnectionInterface $from, $msg){
        // TODO: Implement onMessage() method.

        $result = array();
        echo sprintf('Connection %d has send message: "%s"' . "\n", $from->resourceId, $msg);

        $decoded_message = json_decode($msg, true);

        switch ($decoded_message['action']){
            case 'login':{
                $result['action'] = 'login';
                $query = $this->connection->login($decoded_message['data']['username'], $decoded_message['data']['password']);

                if ($query instanceof db_errors){
                    $result['result'] = $query->getErrorName();
                }else{
                    $result['result'] = $query;

                    $_SESSION = array();
                    $_SESSION['username'] = $decoded_message['data']['username'];
                    $_SESSION['id'] = $result['result']['id'];
                    $_SESSION['is_admin'] = $result['result']['role'];
                    session_write_close();
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'is_logged':{
                $result['action'] = 'is_logged';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username']))
                    $result['result'] = array('session_name' => $_SESSION['username'], 'id' => $_SESSION['id'], 'is_admin' => $_SESSION['is_admin']);
                else
                    $result['result'] = 'not_logged';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'logout':{
                $result['action'] = 'logout';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username'])) {
                    $_SESSION = array();
                    session_write_close();
                    $result['result'] = 'logged_out';
                } else
                    $result['result'] = 'not_logged_out';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_session':{
                $result['action'] = 'get_session';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username']))
                    $result['result'] = array('session_name' => $_SESSION['username'], 'id' => $_SESSION['id'], 'is_admin' => $_SESSION['is_admin']);
                else
                    $result['result'] = 'no_session';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_markers':{
                $result['action'] = 'get_markers';
                echo $decoded_message['data']['username'];
                $query = $this->connection->get_markers($decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_floor_info':{
                $result['action'] = 'get_floor_info';
                $query = $this->connection->get_floor_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_anchors':{
                $result['action'] = 'get_anchors';
                $query = $this->connection->get_anchors($decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_cameras':{
                $result['action'] = 'get_cameras';
                $query = $this->connection->get_cameras($decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_tags':{
                $result['action'] = 'get_tags';
                $query = $this->connection->get_tags($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_floors':{
                $result['action'] = 'get_floors';
                $query = $this->connection->get_floors($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'change_tag_name':{
                $result['action'] = 'change_tag_name';
                $query = $this->connection->change_tag_name($decoded_message['data']['tag'], $decoded_message['data']['name']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'change_anchor_field':{
                $result['action'] = 'change_anchor_field';
                $query = $this->connection->change_anchor_field($decoded_message['data']['anchor_id'], $decoded_message['data']['anchor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'change_floor_field':{
                $result['action'] = 'change_floor_field';
                $query = $this->connection->change_floor_field($decoded_message['data']['floor_id'], $decoded_message['data']['floor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            default:
                $this->clients[$from->resourceId]->send(json_encode(array('result' => 'no_action')));
        }
    }
}